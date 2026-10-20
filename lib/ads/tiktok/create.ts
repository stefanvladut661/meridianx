import "server-only";

import { adSetName } from "../plan-derive";
import type { Plan } from "../plan-schema";
import { recordCampaign, type PlatformObjects } from "../store";
import type { CreateResponse, CreatedObject, JobView } from "../types";
import type { AdsWorkspace } from "../workspaces";
import { campaignUrl } from "../links";
import { claimJob, createJob, openJobFor, readJob, saveJob, type JobRow, type JobStep } from "../jobs";
import { TikTokApiError, tiktokCreate, tiktokGet, tiktokGetAll } from "./api";
import { buildAdGroup, buildAds, buildCampaign, tiktokStartTime } from "./build";
import type { TikTokCheckContext } from "./check";
import { describeTikTokError, tiktokRateLimit } from "./errors";

/**
 * Crearea pe TikTok, ca lucrare pe pași (v2, migrarea 13): copertele (una pe
 * video) → campanie → grup de reclame → reclamele (toate într-o cerere: TikTok
 * le creează pe toate sau niciuna). Totul cu `operation_status: DISABLE`.
 *
 * Aceeași regulă ca pe Meta: coperta întâi (o imagine în bibliotecă, nu costă
 * nimic); campania e primul obiect „adevărat”; de la ea încolo, o eroare lasă în
 * urmă obiecte OPRITE, arătate cu link și notate „parțial” — nu le ștergem.
 *
 * LIMITELE TIKTOK: 600 de cereri pe minut pe aplicație (la nivelul de bază); după
 * o depășire, TikTok cere 5 minute (codurile 40100, 40016, 40133). Lucrarea trece
 * „în așteptare” și se reia de unde a rămas. Fără răspuns de la TikTok (rețea,
 * timp expirat), pasul rămâne „trimis” și la reluare campania, grupul și
 * reclamele se caută întâi (după nume, sub părintele lor), ca să nu apară de două ori.
 */

export interface TikTokJobState {
  version: 1;
  plan: Plan;
  advertiserId: string;
  locationIds: string[];
  languageCodes: string[];
  interestIds: string[];
  pixelId: string | null;
  videos: Array<{ videoId: string; thumbnailUrl: string | null; coverImageId?: string }>;
  /** Când a pornit lucrarea (UTC, ca la TikTok): la căutarea campaniei după nume. */
  startedAt: string;
  campaignId?: string;
  adGroupId?: string;
  adIds?: string[];
  adNames?: string[];
  steps: JobStep[];
}

const BUDGET_MS = 40_000;

export interface TikTokCreateInput {
  workspace: AdsWorkspace;
  context: TikTokCheckContext;
  user: { id: string; email: string | null };
}

function idOf(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function initialState(context: TikTokCheckContext): TikTokJobState | null {
  const { account, videos } = context;
  if (!account || videos.length === 0 || !context.check.ok) return null;
  const plan = context.targeting.plan;
  const many = videos.length > 1;
  const steps: JobStep[] = videos.map((_, index) => ({
    key: `cover:${index}`,
    kind: "image" as const,
    name: `Coperta video-ului ${index + 1}`,
    label: many ? `coperta video-ului ${index + 1}` : "coperta",
    status: "pending" as const,
  }));
  steps.push({ key: "campaign", kind: "campaign", name: plan.campaign.name, label: "campania", status: "pending" });
  steps.push({ key: "adgroup", kind: "adset", name: adSetName(plan.campaign.name), label: "grupul de reclame", status: "pending" });
  steps.push({ key: "ads", kind: "ad", name: "Reclamele", label: "reclamele", status: "pending" });
  return {
    version: 1,
    plan,
    advertiserId: account.id,
    locationIds: context.targeting.locationIds,
    languageCodes: context.targeting.languageCodes,
    interestIds: context.targeting.interestIds,
    pixelId: context.pixel?.id ?? null,
    videos: videos.map((video) => ({ videoId: video.id, thumbnailUrl: video.thumbnailUrl })),
    startedAt: new Date().toISOString(),
    steps,
  };
}

function createdOf(state: TikTokJobState): CreatedObject[] {
  const out: CreatedObject[] = state.steps
    .filter((step) => step.status === "done" && step.id && step.kind !== "ad")
    .map((step) => ({ kind: step.kind, id: step.id!, name: step.name }));
  (state.adIds ?? []).forEach((id, index) => out.push({ kind: "ad", id, name: state.adNames?.[index] ?? `Reclama ${index + 1}` }));
  return out;
}

export function tiktokJobView(job: JobRow<TikTokJobState>): JobView {
  const state = job.state;
  const next = state.steps.find((step) => step.status !== "done");
  return {
    id: job.id,
    platform: "tiktok",
    status: job.status,
    stepsDone: state.steps.filter((step) => step.status === "done").length,
    stepsTotal: state.steps.length,
    next: next ? next.label : null,
    waitUntil: job.waitUntil,
    message: job.message,
    created: createdOf(state),
    adsManagerUrl: state.campaignId ? campaignUrl("tiktok", state.advertiserId, state.campaignId) : null,
  };
}

/** Coperta propusă de TikTok pentru video (linkul expiră într-o oră — se ia acum). */
async function suggestedCover(workspace: AdsWorkspace, advertiserId: string, videoId: string): Promise<string | null> {
  const data = await tiktokGet<{ list?: Array<{ url?: string }> }>(workspace, "/file/video/suggestcover/", {
    advertiser_id: advertiserId,
    video_id: videoId,
    poster_number: 1,
  });
  return data.list?.find((item) => item.url)?.url ?? null;
}

class StepFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StepFailure";
  }
}

/** „2026-10-20 18:00:00” (UTC), cum cere filtrul de creare al TikTok. */
function tiktokTime(iso: string): string {
  return new Date(Date.parse(iso) - 60_000).toISOString().slice(0, 19).replace("T", " ");
}

async function runStep(workspace: AdsWorkspace, state: TikTokJobState, step: JobStep, resumed: boolean): Promise<string> {
  const { plan, advertiserId } = state;

  if (step.kind === "image") {
    const index = Number(step.key.split(":")[1]);
    const video = state.videos[index];
    const coverUrl = plan.creative.thumbnail !== "auto" ? plan.creative.thumbnail.url : ((await suggestedCover(workspace, advertiserId, video.videoId)) ?? video.thumbnailUrl);
    if (!coverUrl) {
      throw new StepFailure(
        state.videos.length > 1
          ? `TikTok n-a propus nicio copertă pentru video-ul ${index + 1}. Alege alt video sau fă din el un plan separat, cu copertă din plan.`
          : 'TikTok n-a propus nicio copertă pentru video-ul ăsta. Pune o imagine în creative.thumbnail: { "url": "https://…" }, cu aceleași proporții ca video-ul.'
      );
    }
    const data = await tiktokCreate<{ image_id?: string }>(workspace, "/file/image/ad/upload/", {
      advertiser_id: advertiserId,
      upload_type: "UPLOAD_BY_URL",
      image_url: coverUrl,
      // Numele trebuie să fie unic în cont.
      file_name: `coperta-${video.videoId}-${Date.now().toString(36)}`,
    });
    if (!data.image_id) throw new StepFailure("TikTok n-a întors id-ul imaginii.");
    video.coverImageId = data.image_id;
    return data.image_id;
  }

  if (step.kind === "campaign") {
    if (resumed) {
      const rows = await tiktokGetAll<{ campaign_id?: unknown; campaign_name?: string }>(
        workspace,
        "/campaign/get/",
        { advertiser_id: advertiserId, fields: ["campaign_id", "campaign_name"], filtering: { creation_filter_start_time: tiktokTime(state.startedAt) } },
        "list",
        1000,
        100
      );
      const found = rows.find((row) => row.campaign_name === step.name);
      if (found && idOf(found.campaign_id)) return (state.campaignId = idOf(found.campaign_id)!);
    }
    const data = await tiktokCreate<{ campaign_id?: unknown }>(workspace, "/campaign/create/", buildCampaign(plan, advertiserId));
    const campaignId = idOf(data.campaign_id);
    if (!campaignId) throw new StepFailure("TikTok a răspuns fără id de campanie. Caută campania în TikTok Ads Manager înainte să încerci din nou.");
    return (state.campaignId = campaignId);
  }

  if (step.kind === "adset") {
    if (!state.campaignId) throw new StepFailure("lipsește campania");
    if (resumed) {
      const rows = await tiktokGetAll<{ adgroup_id?: unknown; adgroup_name?: string }>(
        workspace,
        "/adgroup/get/",
        { advertiser_id: advertiserId, fields: ["adgroup_id", "adgroup_name"], filtering: { campaign_ids: [state.campaignId] } },
        "list",
        100,
        100
      );
      const found = rows.find((row) => row.adgroup_name === step.name);
      if (found && idOf(found.adgroup_id)) return (state.adGroupId = idOf(found.adgroup_id)!);
    }
    const payload = buildAdGroup(plan, advertiserId, {
      campaignId: state.campaignId,
      locationIds: state.locationIds,
      languageCodes: state.languageCodes,
      interestIds: state.interestIds,
      pixelId: state.pixelId,
      startTime: tiktokStartTime(),
    });
    const adGroupId = idOf((await tiktokCreate<{ adgroup_id?: unknown }>(workspace, "/adgroup/create/", payload)).adgroup_id);
    if (!adGroupId) throw new StepFailure("TikTok a răspuns fără id de grup de reclame.");
    return (state.adGroupId = adGroupId);
  }

  // Reclamele, toate într-o cerere.
  if (!state.adGroupId) throw new StepFailure("lipsește grupul de reclame");
  const covered = state.videos.map((video) => ({ videoId: video.videoId, coverImageId: video.coverImageId ?? "" }));
  if (covered.some((video) => !video.coverImageId)) throw new StepFailure("lipsește o copertă urcată");
  const payload = buildAds(plan, advertiserId, { adGroupId: state.adGroupId, videos: covered, pixelId: state.pixelId });
  const names = (payload.creatives as Array<{ ad_name: string }>).map((creative) => creative.ad_name);
  state.adNames = names;
  if (resumed) {
    const rows = await tiktokGetAll<{ ad_id?: unknown; ad_name?: string }>(
      workspace,
      "/ad/get/",
      { advertiser_id: advertiserId, fields: ["ad_id", "ad_name"], filtering: { adgroup_ids: [state.adGroupId] } },
      "list",
      100,
      100
    );
    const found = rows.filter((row) => row.ad_name && names.includes(row.ad_name));
    if (found.length > 0) {
      state.adIds = found.map((row) => idOf(row.ad_id)).filter((value): value is string => value !== null);
      if (state.adIds.length !== names.length) throw new StepFailure(`TikTok are ${state.adIds.length} reclame din ${names.length} în grup. Verifică grupul în TikTok Ads Manager.`);
      return state.adIds.join(",");
    }
  }
  const data = await tiktokCreate<{ ad_ids?: unknown[] }>(workspace, "/ad/create/", payload);
  state.adIds = (data.ad_ids ?? []).map(idOf).filter((value): value is string => value !== null);
  if (state.adIds.length !== names.length) throw new StepFailure(`TikTok a creat ${state.adIds.length} reclame din ${names.length}. Verifică grupul în TikTok Ads Manager.`);
  return state.adIds.join(",");
}

function objectsOf(state: TikTokJobState): PlatformObjects {
  return { adset: state.adGroupId, ads: state.adIds ?? [] };
}

async function record(job: JobRow<TikTokJobState>, workspace: AdsWorkspace, creation: "complete" | "partial", error: string | null) {
  const state = job.state;
  if (!state.campaignId) return null;
  return recordCampaign({
    workspace: workspace.id,
    platform: "tiktok",
    adAccount: state.advertiserId,
    platformCampaignId: state.campaignId,
    plan: state.plan,
    fingerprint: job.fingerprint,
    creation,
    creationError: error,
    platformObjects: objectsOf(state),
    createdBy: { id: job.createdBy, email: job.createdByEmail },
  });
}

const clock = (iso: string) => new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" }).format(new Date(iso));

export async function runTikTokJob(workspace: AdsWorkspace, job: JobRow<TikTokJobState>): Promise<CreateResponse> {
  const started = Date.now();
  const state = job.state;
  const view = () => tiktokJobView(job);
  const url = () => campaignUrl("tiktok", state.advertiserId, state.campaignId ?? "");

  if (job.status === "done") return { ok: true, recordId: job.recordId, adsManagerUrl: url(), created: createdOf(state), storeWarning: null };
  if (job.status === "waiting" && job.waitUntil && Date.parse(job.waitUntil) > Date.now()) return { ok: false, message: job.message ?? "TikTok a cerut o pauză.", job: view() };
  if (!(await claimJob(job.id, 55))) {
    const message = "Crearea rulează chiar acum din altă fereastră. Mai întreb peste câteva secunde.";
    return { ok: false, message, job: { ...view(), status: "waiting", waitUntil: new Date(Date.now() + 15_000).toISOString(), message } };
  }
  job.status = "running";
  job.waitUntil = null;
  job.message = null;
  await saveJob(job.id, { status: "running", waitUntil: null, message: null });

  const wait = async (minutes: number, message: string) => {
    const waitUntil = new Date(Date.now() + minutes * 60_000).toISOString();
    job.status = "waiting";
    job.waitUntil = waitUntil;
    job.message = message.replace("{ora}", clock(waitUntil));
    await saveJob(job.id, { status: "waiting", state, waitUntil, message: job.message, release: true });
    return { ok: false as const, message: job.message, job: view() };
  };

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
      if (error instanceof TikTokApiError && error.info.status === 0) {
        return wait(1, `TikTok n-a răspuns la ${step.label}. Reiau la {ora} și verific întâi dacă s-a creat, ca să nu apară de două ori.`);
      }
      const limit = tiktokRateLimit(error);
      if (limit) {
        step.status = resumed ? "sent" : "pending";
        return wait(limit.minutes, `TikTok limitează cererile aplicației. Reiau singur la {ora}, de la ${step.label}; ce s-a creat până acum rămâne, oprit.`);
      }
      step.status = "pending";
      const message = error instanceof StepFailure ? error.message : describeTikTokError(error, step.kind === "campaign" ? "crearea campaniei" : `crearea pentru ${step.label}`, workspace.tokenEnv);
      job.status = "failed";
      job.message = message;
      const stored = await record(job, workspace, "partial", message);
      await saveJob(job.id, { status: "failed", state, message, recordId: stored?.ok ? stored.data.id : null, release: true });
      if (!state.campaignId) return { ok: false, message };
      return {
        ok: false,
        message: stored && !stored.ok ? `${message} În plus, campania n-a putut fi notată în baza portalului — linkul de mai jos e singurul drum spre ea.` : message,
        partial: { adsManagerUrl: url(), created: createdOf(state), recordId: stored?.ok ? stored.data.id : null },
      };
    }
  }

  const stored = await record(job, workspace, "complete", null);
  job.status = "done";
  await saveJob(job.id, { status: "done", state, message: null, recordId: stored?.ok ? stored.data.id : null, release: true });
  return {
    ok: true,
    recordId: stored?.ok ? stored.data.id : null,
    adsManagerUrl: url(),
    created: createdOf(state),
    storeWarning:
      stored && stored.ok
        ? null
        : "Campania e creată în TikTok, dar n-a putut fi notată în baza portalului, deci nu va apărea în lista de campanii. Păstrează linkul de mai sus.",
  };
}

export async function createPausedOnTikTok(input: TikTokCreateInput): Promise<CreateResponse> {
  const { workspace, context, user } = input;
  const state = initialState(context);
  if (!state) return { ok: false, message: "Verificarea pe TikTok nu e completă. Verifică din nou planul.", recheck: true };

  const open = await openJobFor<TikTokJobState>(context.check.fingerprint);
  if (!open.ok) return { ok: false, message: open.message };
  if (open.data) return runTikTokJob(workspace, open.data);

  const job = await createJob<TikTokJobState>({
    platform: "tiktok",
    workspace: workspace.id,
    adAccount: state.advertiserId,
    fingerprint: context.check.fingerprint,
    planName: state.plan.campaign.name,
    state,
    stepsTotal: state.steps.length,
    user,
  });
  if (!job.ok) return { ok: false, message: job.message };
  return runTikTokJob(workspace, job.data);
}

export async function continueTikTokJob(workspace: AdsWorkspace, jobId: string): Promise<CreateResponse> {
  const job = await readJob<TikTokJobState>(jobId);
  if (!job.ok) return { ok: false, message: job.message };
  if (!job.data || job.data.platform !== "tiktok") return { ok: false, message: "Lucrarea nu există." };
  if (job.data.workspace !== workspace.id) return { ok: false, message: "Lucrarea e în alt spațiu de lucru decât cel de pe ecran." };
  if (job.data.status === "failed") return { ok: false, message: job.data.message ?? "Crearea s-a oprit.", job: tiktokJobView(job.data) };
  return runTikTokJob(workspace, job.data);
}
