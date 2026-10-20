import "server-only";

import { adSetName } from "../plan-derive";
import type { Plan } from "../plan-schema";
import { recordCampaign, type PlatformObjects } from "../store";
import type { AdsWorkspace } from "../workspaces";
import { claimJob, createJob, openJobFor, readJob, saveJob, type JobRow, type JobStep } from "../jobs";
import { META_LISTED_STATUSES } from "../model/status";
import { buildAd, buildAdSet, buildCampaign, buildCreatives, type CreativeVideo, type Dsa, type Thumbnail } from "./build";
import type { MetaCheckContext, ThumbnailSource } from "./check";
import { describeMetaError, metaRateLimit } from "./errors";
import { MetaApiError, metaCreate, metaGetAll, metaUploadImage } from "./graph";
import { campaignUrl } from "../links";
import { ThumbnailError, downloadThumbnail } from "./thumbnail";
import type { CreateResponse, CreatedObject, JobView } from "../types";

/**
 * Crearea pe Meta, ca lucrare pe pași (v2, migrarea 13): copertele (una pe
 * video) → campanie → set → (creativ → reclamă) × N, N = video-uri × texte.
 * Totul pe pauză.
 *
 * Ordinea contează. Copertele se urcă primele: o imagine în biblioteca contului
 * nu e o reclamă și nu costă nimic. Campania e primul obiect „adevărat”: dacă
 * pică, nu s-a creat nimic. De la campanie încolo, o eroare lasă în urmă obiecte
 * OPRITE — nu le ștergem automat (o ștergere e încă o scriere care poate pica),
 * ci le arătăm omului, cu link, și le notăm în bază ca „parțial”.
 *
 * LIMITELE META: la accesul de bază, Meta răspunde „așteaptă” după câteva zeci
 * de cereri pe oră. Atunci lucrarea se oprește cu tot ce a creat salvat, trece
 * „în așteptare” până la ora spusă de Meta și se reia de acolo. Un pas se
 * notează „trimis” ÎNAINTE de cerere și „gata” (cu id-ul) după: dacă răspunsul
 * se pierde, la reluare campania, setul și reclamele se caută întâi după nume —
 * nimic nu se creează de două ori. Copertele și creativele nu se caută: sunt în
 * biblioteca contului, nu cheltuie și nu apar nicăieri.
 */

export interface MetaJobState {
  version: 1;
  plan: Plan;
  locales: number[];
  dsa: Dsa | null;
  account: { id: string; name: string; currency: string };
  /** Când a pornit lucrarea: la căutarea după nume, doar obiectele create de atunci. */
  startedAt: string;
  videos: Array<{ videoId: string; source: ThumbnailSource; hash?: string }>;
  campaignId?: string;
  adSetId?: string;
  /** Pe fiecare reclamă: numele, creativul și reclama create. */
  ads: Array<{ name: string; creativeId?: string; adId?: string }>;
  steps: JobStep[];
}

/** Cât lucrează o cerere înainte să predea (Vercel oprește funcția la 60 de secunde). */
const BUDGET_MS = 40_000;

export interface CreateInput {
  workspace: AdsWorkspace;
  context: MetaCheckContext;
  user: { id: string; email: string | null };
}

function initialState(context: MetaCheckContext): MetaJobState | null {
  const { account, videos, thumbnails } = context;
  if (!account || videos.length === 0 || thumbnails.length !== videos.length || !context.check.ok) return null;
  const plan = context.resolved.plan;
  // Numele reclamelor nu depind de coperte: le aflăm acum, cu o copertă de probă.
  const planned = buildCreatives(plan, { videos: videos.map((video) => ({ videoId: video.id, thumbnail: { url: "https://example.com/proba.jpg" } })) });
  const many = videos.length > 1;
  const steps: JobStep[] = [];
  videos.forEach((video, index) => {
    if (thumbnails[index].kind === "meta") {
      steps.push({ key: `thumb:${index}`, kind: "image", name: `Coperta video-ului ${index + 1}`, label: many ? `coperta video-ului ${index + 1}` : "coperta", status: "pending" });
    }
  });
  steps.push({ key: "campaign", kind: "campaign", name: plan.campaign.name, label: "campania", status: "pending" });
  steps.push({ key: "adset", kind: "adset", name: adSetName(plan.campaign.name), label: "setul de reclame", status: "pending" });
  planned.forEach((ad, index) => {
    const which = planned.length > 1 ? ` ${index + 1} din ${planned.length}` : "";
    steps.push({ key: `creative:${index}`, kind: "creative", name: ad.name, label: `materialul reclamei${which}`, status: "pending" });
    steps.push({ key: `ad:${index}`, kind: "ad", name: ad.name, label: `reclama${which}`, status: "pending" });
  });
  return {
    version: 1,
    plan,
    locales: context.resolved.locales,
    dsa: context.dsa,
    account: { id: account.id, name: account.name, currency: account.currency },
    startedAt: new Date().toISOString(),
    videos: videos.map((video, index) => ({ videoId: video.id, source: thumbnails[index] })),
    ads: planned.map((ad) => ({ name: ad.name })),
    steps,
  };
}

function createdOf(state: MetaJobState): CreatedObject[] {
  return state.steps.filter((step) => step.status === "done" && step.id).map((step) => ({ kind: step.kind, id: step.id!, name: step.name }));
}

export function metaJobView(job: JobRow<MetaJobState>): JobView {
  const state = job.state;
  const next = state.steps.find((step) => step.status !== "done");
  return {
    id: job.id,
    platform: "meta",
    status: job.status,
    stepsDone: state.steps.filter((step) => step.status === "done").length,
    stepsTotal: state.steps.length,
    next: next ? next.label : null,
    waitUntil: job.waitUntil,
    message: job.message,
    created: createdOf(state),
    adsManagerUrl: state.campaignId ? campaignUrl("meta", state.account.id, state.campaignId) : null,
  };
}

// ---------------------------------------------------------------------------
// Căutarea după nume a unui pas „trimis” fără răspuns
// ---------------------------------------------------------------------------

async function findByName(workspace: AdsWorkspace, path: string, name: string, since: string): Promise<string | null> {
  const rows = await metaGetAll<{ id?: string; name?: string; created_time?: string }>(
    workspace,
    path,
    { fields: "id,name,created_time", effective_status: META_LISTED_STATUSES, limit: 200 },
    2000
  );
  const from = Date.parse(since) - 60_000;
  const match = rows
    .filter((row) => row.id && row.name === name && (!row.created_time || Date.parse(row.created_time) >= from))
    .sort((a, b) => (a.created_time ?? "").localeCompare(b.created_time ?? ""));
  return match[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Pașii
// ---------------------------------------------------------------------------

class StepFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StepFailure";
  }
}

async function runStep(workspace: AdsWorkspace, state: MetaJobState, step: JobStep, resumed: boolean): Promise<string> {
  const { plan, account } = state;
  if (step.kind === "image") {
    const index = Number(step.key.split(":")[1]);
    const video = state.videos[index];
    if (video.source.kind !== "meta") throw new StepFailure("coperta nu e de urcat");
    try {
      const image = await downloadThumbnail(video.source.uri, video.videoId);
      const { hash } = await metaUploadImage(workspace, account.id, image);
      video.hash = hash;
      return hash;
    } catch (error) {
      if (error instanceof ThumbnailError) {
        throw new StepFailure(
          `Coperta ${state.videos.length > 1 ? `video-ului ${index + 1}` : "video-ului"} nu s-a putut pregăti: ${error.message}. Pune o imagine în creative.thumbnail: { "url": "https://…" } și verifică din nou.`
        );
      }
      throw error;
    }
  }

  if (step.kind === "campaign") {
    if (resumed) {
      const found = await findByName(workspace, `/${account.id}/campaigns`, step.name, state.startedAt);
      if (found) return (state.campaignId = found);
    }
    const { id } = await metaCreate(workspace, account.id, "campaigns", buildCampaign(plan));
    return (state.campaignId = id);
  }

  if (step.kind === "adset") {
    if (!state.campaignId) throw new StepFailure("lipsește campania");
    if (resumed) {
      const found = await findByName(workspace, `/${state.campaignId}/adsets`, step.name, state.startedAt);
      if (found) return (state.adSetId = found);
    }
    const payload = buildAdSet(plan, { campaignId: state.campaignId, locales: state.locales, dsa: state.dsa });
    const { id } = await metaCreate(workspace, account.id, "adsets", payload);
    return (state.adSetId = id);
  }

  const index = Number(step.key.split(":")[1]);
  const slot = state.ads[index];
  if (step.kind === "creative") {
    const covered: CreativeVideo[] = state.videos.map((video) => ({
      videoId: video.videoId,
      thumbnail: (video.source.kind === "url" ? { url: video.source.url } : { hash: video.hash ?? "" }) as Thumbnail,
    }));
    if (covered.some((video) => "hash" in video.thumbnail && !video.thumbnail.hash)) throw new StepFailure("lipsește coperta urcată");
    const planned = buildCreatives(plan, { videos: covered })[index];
    const { id } = await metaCreate(workspace, account.id, "adcreatives", planned.creative);
    return (slot.creativeId = id);
  }

  // Reclama.
  if (!state.adSetId || !slot.creativeId) throw new StepFailure("lipsesc setul sau materialul reclamei");
  if (resumed) {
    const found = await findByName(workspace, `/${state.adSetId}/ads`, slot.name, state.startedAt);
    if (found) return (slot.adId = found);
  }
  const { id } = await metaCreate(workspace, account.id, "ads", buildAd(plan, { name: slot.name, adSetId: state.adSetId, creativeId: slot.creativeId }));
  return (slot.adId = id);
}

function objectsOf(state: MetaJobState): PlatformObjects {
  return {
    adset: state.adSetId,
    creatives: state.ads.map((ad) => ad.creativeId).filter((id): id is string => Boolean(id)),
    ads: state.ads.map((ad) => ad.adId).filter((id): id is string => Boolean(id)),
  };
}

async function record(job: JobRow<MetaJobState>, workspace: AdsWorkspace, creation: "complete" | "partial", error: string | null) {
  const state = job.state;
  if (!state.campaignId) return null;
  return recordCampaign({
    workspace: workspace.id,
    platform: "meta",
    adAccount: state.account.id,
    platformCampaignId: state.campaignId,
    plan: state.plan,
    fingerprint: job.fingerprint,
    creation,
    creationError: error,
    platformObjects: objectsOf(state),
    createdBy: { id: job.createdBy, email: job.createdByEmail },
  });
}

/**
 * Rulează pașii rămași ai unei lucrări, cât încape în timpul unei cereri.
 * Întoarce răspunsul pentru ecran: creată, în așteptare / în lucru (cu `job`),
 * oprită la jumătate (cu `partial`) sau refuzată.
 */
export async function runMetaJob(workspace: AdsWorkspace, job: JobRow<MetaJobState>): Promise<CreateResponse> {
  const started = Date.now();
  const state = job.state;
  const view = () => metaJobView(job);

  if (job.status === "done") {
    return {
      ok: true,
      recordId: job.recordId,
      adsManagerUrl: campaignUrl("meta", state.account.id, state.campaignId ?? ""),
      created: createdOf(state),
      storeWarning: null,
    };
  }
  if (job.status === "waiting" && job.waitUntil && Date.parse(job.waitUntil) > Date.now()) {
    return { ok: false, message: job.message ?? "Meta a cerut o pauză.", job: view() };
  }
  if (!(await claimJob(job.id, 55))) {
    // Altă fereastră o rulează chiar acum: ecranul acesta mai întreabă peste 15 secunde.
    const message = "Crearea rulează chiar acum din altă fereastră. Mai întreb peste câteva secunde.";
    return { ok: false, message, job: { ...view(), status: "waiting", waitUntil: new Date(Date.now() + 15_000).toISOString(), message } };
  }
  job.status = "running";
  job.waitUntil = null;
  job.message = null;
  await saveJob(job.id, { status: "running", waitUntil: null, message: null });

  for (const step of state.steps) {
    if (step.status === "done") continue;
    if (Date.now() - started > BUDGET_MS) {
      job.message = "Continuă cu pasul următor.";
      await saveJob(job.id, { state, message: job.message, release: true });
      return { ok: false, message: "Crearea merge mai departe, pas cu pas.", job: view() };
    }
    const resumed = step.status === "sent";
    step.status = "sent";
    await saveJob(job.id, { state });
    try {
      step.id = await runStep(workspace, state, step, resumed);
      step.status = "done";
      await saveJob(job.id, { state, stepsDone: state.steps.filter((item) => item.status === "done").length });
    } catch (error) {
      // Fără răspuns de la Meta (rețea, timp expirat): cererea poate să fi creat
      // obiectul. Pasul rămâne „trimis”, deci la reluare se caută întâi după nume.
      if (error instanceof MetaApiError && error.info.status === 0) {
        const waitUntil = new Date(Date.now() + 60_000).toISOString();
        job.status = "waiting";
        job.waitUntil = waitUntil;
        job.message = `Meta n-a răspuns la ${step.label}. Reiau peste un minut și verific întâi dacă s-a creat, ca să nu apară de două ori.`;
        await saveJob(job.id, { status: "waiting", state, waitUntil, message: job.message, release: true });
        return { ok: false, message: job.message, job: view() };
      }
      const limit = metaRateLimit(error);
      if (limit) {
        // Cererea n-a ajuns la Meta (limita e verificată înainte): pasul nu e trimis.
        step.status = resumed ? "sent" : "pending";
        const waitUntil = new Date(Date.now() + limit.minutes * 60_000).toISOString();
        const time = new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" }).format(new Date(waitUntil));
        job.status = "waiting";
        job.waitUntil = waitUntil;
        job.message = `Meta limitează cererile contului (accesul de bază). Reiau singur la ${time}, de la ${step.label}; ce s-a creat până acum rămâne, pe pauză.`;
        await saveJob(job.id, { status: "waiting", state, waitUntil, message: job.message, release: true });
        return { ok: false, message: job.message, job: view() };
      }
      // Altă eroare: lucrarea se oprește. Ce s-a creat rămâne pe pauză și se notează.
      step.status = "pending";
      const message =
        error instanceof StepFailure ? error.message : describeMetaError(error, step.kind === "campaign" ? "crearea campaniei" : `crearea pentru ${step.label}`, workspace.tokenEnv);
      job.status = "failed";
      job.message = message;
      const stored = await record(job, workspace, "partial", message);
      await saveJob(job.id, { status: "failed", state, message, recordId: stored?.ok ? stored.data.id : null, release: true });
      if (!state.campaignId) return { ok: false, message };
      return {
        ok: false,
        message: stored && !stored.ok ? `${message} În plus, campania n-a putut fi notată în baza portalului — linkul de mai jos e singurul drum spre ea.` : message,
        partial: { adsManagerUrl: campaignUrl("meta", state.account.id, state.campaignId), created: createdOf(state), recordId: stored?.ok ? stored.data.id : null },
      };
    }
  }

  const stored = await record(job, workspace, "complete", null);
  job.status = "done";
  await saveJob(job.id, { status: "done", state, message: null, recordId: stored?.ok ? stored.data.id : null, release: true });
  return {
    ok: true,
    recordId: stored?.ok ? stored.data.id : null,
    adsManagerUrl: campaignUrl("meta", state.account.id, state.campaignId ?? ""),
    created: createdOf(state),
    storeWarning:
      stored && stored.ok
        ? null
        : "Campania e creată în Meta, dar n-a putut fi notată în baza portalului, deci nu va apărea în lista de campanii. Păstrează linkul de mai sus.",
  };
}

/** „Creează pe pauză”: o lucrare nouă (sau cea deschisă a aceluiași plan), apoi primii pași. */
export async function createPausedOnMeta(input: CreateInput): Promise<CreateResponse> {
  const { workspace, context, user } = input;
  const state = initialState(context);
  if (!state) return { ok: false, message: "Verificarea pe Meta nu e completă. Verifică din nou planul.", recheck: true };

  const open = await openJobFor<MetaJobState>(context.check.fingerprint);
  if (!open.ok) return { ok: false, message: open.message };
  if (open.data) return runMetaJob(workspace, open.data);

  const job = await createJob<MetaJobState>({
    platform: "meta",
    workspace: workspace.id,
    adAccount: state.account.id,
    fingerprint: context.check.fingerprint,
    planName: state.plan.campaign.name,
    state,
    stepsTotal: state.steps.length,
    user,
  });
  if (!job.ok) return { ok: false, message: job.message };
  return runMetaJob(workspace, job.data);
}

/** „Continuă”: lucrarea, de unde a rămas. */
export async function continueMetaJob(workspace: AdsWorkspace, jobId: string): Promise<CreateResponse> {
  const job = await readJob<MetaJobState>(jobId);
  if (!job.ok) return { ok: false, message: job.message };
  if (!job.data || job.data.platform !== "meta") return { ok: false, message: "Lucrarea nu există." };
  if (job.data.workspace !== workspace.id) return { ok: false, message: "Lucrarea e în alt spațiu de lucru decât cel de pe ecran." };
  if (job.data.status === "failed") return { ok: false, message: job.data.message ?? "Crearea s-a oprit.", job: metaJobView(job.data) };
  return runMetaJob(workspace, job.data);
}
