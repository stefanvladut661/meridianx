"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/supabase/clients";
import { PLATFORM_LABEL } from "@/lib/ads/constants";
import { campaignUrl } from "@/lib/ads/links";
import { adapterFor, type PlatformAdapter } from "@/lib/ads/platform";
import { BATCH_DUPLICATE_DAYS } from "@/lib/ads/plan-batch";
import type { Plan } from "@/lib/ads/plan-schema";
import { validatePlan } from "@/lib/ads/plan-validate";
import { createStagingDownload, createStagingUpload, isStagingNameOf, removeStaged } from "@/lib/ads/staging";
import { STORE_FAILURE_MESSAGE, findRecentDuplicate, knownAccounts } from "@/lib/ads/store";
import { runAdsSync } from "@/lib/ads/sync";
import type { CheckResponse, CreateResponse, LibraryResponse, UploadStatus } from "@/lib/ads/types";
import { WORKSPACES, findWorkspace, isWorkspaceId, workspaceName, type AdsWorkspace } from "@/lib/ads/workspaces";
import { WORKSPACE_COOKIE, currentWorkspaceId, workspaceToken } from "@/lib/ads/workspaces.server";
import { contextForClaude } from "@/lib/ads/claude-brief";
import { readAccountContext } from "@/lib/ads/claude-context";
import { PIXEL_ID as SITE_META_PIXEL_ID } from "@/lib/meta-pixel";
import { TIKTOK_PIXEL_ID as SITE_TIKTOK_PIXEL_CODE } from "@/lib/tiktok-pixel";
import { GOOGLE_ADS_LEAD_SEND_TO } from "@/lib/google-tag";
import { SITE_URL } from "@/lib/site-url";
import { describeGoogleError } from "@/lib/ads/google/errors";
import { checkSearchOnGoogle } from "@/lib/ads/google/search/check";
import { createSearchOnGoogle } from "@/lib/ads/google/search/create";
import type { SearchPlan } from "@/lib/ads/google/search/schema";
import type { SearchCheck, SearchCheckResponse, SearchCreateResponse } from "@/lib/ads/google/search/types";
import { validateSearchPlan } from "@/lib/ads/google/search/validate";
import { planFormatOf } from "@/lib/ads/plan-json";
import type { PlatformCheck } from "@/lib/ads/types";
import { recordChange } from "@/lib/ads/changes";
import { findGoogleAccount, type GoogleAccount } from "@/lib/ads/google/lookup";
import { applyNegatives, pauseCampaigns, prepareNegatives, type NegativesRequest } from "@/lib/ads/google/account/service";
import type { NegativesResponse, PauseResponse } from "@/lib/ads/google/account/types";
import { markPortalPaused } from "@/lib/ads/store";

/**
 * Acțiunile portalului de reclame.
 *
 * Fiecare își reverifică sesiunea, ca în panoul de lead-uri: garda din
 * layout protejează randarea, nu și acțiunile — o acțiune de server e un
 * endpoint POST care poate fi apelat direct.
 *
 * Nimic din ce vine din browser nu e de încredere: planul se validează din
 * nou aici, cu aceleași reguli ca în previzualizare, iar spațiul de lucru
 * afișat pe ecran trebuie să fie și cel din cookie.
 *
 * Platforma (Meta sau TikTok) vine din spațiul de lucru; ce face fiecare stă
 * în adaptorul ei (`lib/ads/platform.ts`).
 *
 * NU există nicio acțiune care să pornească, să modifice sau să șteargă o
 * campanie. Portalul creează — oprit — și atât.
 */

const SESSION_EXPIRED = "Sesiunea a expirat. Reîncarcă pagina și intră din nou în panou.";

type Failure = { ok: false; message: string };

export async function chooseWorkspace(formData: FormData): Promise<void> {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const id = formData.get("workspace");
  if (!isWorkspaceId(id)) return;

  const store = await cookies();
  store.set(WORKSPACE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 60 * 60 * 24 * 365,
  });

  // Formularul pleacă spre pagina curentă; fără redirect, omul rămâne unde
  // era, iar layout-ul se randează din nou cu spațiul nou.
  revalidatePath("/admin/ads", "layout");
}

// ---------------------------------------------------------------------------
// Sesiunea și spațiul de pe ecran
// ---------------------------------------------------------------------------

/** Sesiune de admin + spațiul afișat pe ecran = spațiul din cookie. */
async function session(
  workspaceId: string
): Promise<{ ok: true; user: { id: string; email: string | null }; workspace: AdsWorkspace; adapter: PlatformAdapter } | Failure> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };

  // Un al doilea tab deschis pe alt portofoliu nu poate muta o campanie
  // dintr-o parte în alta.
  const currentId = await currentWorkspaceId();
  const workspace = findWorkspace(currentId);
  if (!workspace) return { ok: false, message: "Spațiul de lucru nu există." };
  if (workspaceId !== currentId) {
    return {
      ok: false,
      message: `Între timp ai trecut în ${workspaceName(workspace)} (probabil din alt tab). Reîncarcă pagina ca să vezi spațiul în care lucrezi acum.`,
    };
  }
  return { ok: true, user, workspace, adapter: adapterFor(workspace.platform) };
}

/** Plus contul de reclame, în forma platformei. */
async function accountSession(workspaceId: string, adAccountInput: string) {
  const context = await session(workspaceId);
  if (!context.ok) return context;
  const adAccount = context.adapter.normalizeAccount(adAccountInput);
  if (!adAccount) {
    return {
      ok: false as const,
      message:
        context.workspace.platform === "meta"
          ? `„${adAccountInput}” nu e un cont de reclame Meta (act_ urmat de cifre).`
          : context.workspace.platform === "google"
            ? `„${adAccountInput}” nu e un cont Google Ads (10 cifre, 123-456-7890).`
            : `„${adAccountInput}” nu e un advertiser_id TikTok (doar cifre).`,
    };
  }
  return { ...context, adAccount };
}

type Prepared =
  | { ok: true; user: { id: string; email: string | null }; workspace: AdsWorkspace; adapter: PlatformAdapter; plan: Plan }
  | { ok: false; message: string; problems?: { path: string; message: string }[] };

async function preparePlan(input: { plan: unknown; workspace: string }): Promise<Prepared> {
  const context = await session(input.workspace);
  if (!context.ok) return context;

  const validation = validatePlan(input.plan, { currentWorkspace: context.workspace.id });
  if (!validation.ok) {
    return {
      ok: false,
      message: "Planul are greșeli — corectează-le mai sus și verifică din nou.",
      problems: validation.errors,
    };
  }
  return { ...context, plan: validation.plan };
}

// ---------------------------------------------------------------------------
// Verificarea pe platformă
// ---------------------------------------------------------------------------

async function checkPrepared(prepared: Extract<Prepared, { ok: true }>): Promise<CheckResponse> {
  try {
    const { check } = await prepared.adapter.prepare(prepared.workspace, prepared.plan);
    return { ok: true, check };
  } catch (error) {
    return { ok: false, message: prepared.adapter.describeError(error, "verificarea planului", prepared.workspace.tokenEnv) };
  }
}

export async function checkPlan(input: { plan: unknown; workspace: string }): Promise<CheckResponse> {
  const prepared = await preparePlan(input);
  if (!prepared.ok) return prepared;
  return checkPrepared(prepared);
}

// ---------------------------------------------------------------------------
// Crearea pe pauză
// ---------------------------------------------------------------------------

/** „acum 3 minute", „acum 5 ore", „acum 2 zile". */
function agoLabel(iso: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 60) return minutes === 1 ? "acum un minut" : `acum ${minutes} minute`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return hours === 1 ? "acum o oră" : `acum ${hours} ore`;
  return `acum ${Math.round(hours / 24)} zile`;
}

export async function createPausedCampaign(input: {
  plan: unknown;
  workspace: string;
  fingerprint: string;
  allowDuplicate: boolean;
}): Promise<CreateResponse> {
  const prepared = await preparePlan(input);
  if (!prepared.ok) return prepared;
  return createPrepared(prepared, {
    fingerprint: input.fingerprint,
    allowDuplicate: input.allowDuplicate,
    duplicateMinutes: 30,
  });
}

async function createPrepared(
  prepared: Extract<Prepared, { ok: true }>,
  options: { fingerprint: string; allowDuplicate: boolean; duplicateMinutes: number }
): Promise<CreateResponse> {
  const { workspace, plan, user, adapter } = prepared;
  const label = PLATFORM_LABEL[workspace.platform];

  // Verificarea se reface aici, pe server. Amprenta trebuie să fie aceeași
  // cu cea văzută de om: altfel ceva s-a schimbat (planul sau ce a găsit platforma).
  let creation: Awaited<ReturnType<PlatformAdapter["prepare"]>>;
  try {
    creation = await adapter.prepare(workspace, plan);
  } catch (error) {
    return { ok: false, message: adapter.describeError(error, "verificarea dinaintea creării", workspace.tokenEnv) };
  }
  if (!creation.check.ok) {
    return {
      ok: false,
      message: `Verificarea pe ${label} a găsit probleme noi. Verifică din nou planul.`,
      problems: creation.check.errors,
      recheck: true,
    };
  }
  if (creation.check.fingerprint !== options.fingerprint) {
    return {
      ok: false,
      message: `Planul sau ce a găsit ${label} s-a schimbat de la verificare. Verifică din nou, ca să creezi exact ce vezi pe ecran.`,
      recheck: true,
    };
  }

  // Dublul clic, al doilea tab, lotul lipit a doua oară: același plan, creat de curând.
  if (!options.allowDuplicate) {
    const duplicate = await findRecentDuplicate(creation.check.fingerprint, options.duplicateMinutes);
    if (!duplicate.ok) {
      return { ok: false, message: STORE_FAILURE_MESSAGE[duplicate.reason] };
    }
    if (duplicate.data) {
      return {
        ok: false,
        message: `Exact planul ăsta a fost creat ${agoLabel(duplicate.data.createdAt)}${duplicate.data.createdByEmail ? `, de ${duplicate.data.createdByEmail}` : ""}. Încă o creare înseamnă a doua campanie cu același buget.`,
        duplicate: {
          createdAt: duplicate.data.createdAt,
          adsManagerUrl: campaignUrl(duplicate.data.platform, duplicate.data.adAccount, duplicate.data.platformCampaignId),
          recordId: duplicate.data.id,
        },
      };
    }
  }

  const result = await creation.create(user);
  revalidatePath("/admin/ads");
  return result;
}

// ---------------------------------------------------------------------------
// Planul de căutare (faza 10): verificare cu validateOnly, creare atomică
// ---------------------------------------------------------------------------

type SearchPrepared =
  | { ok: true; user: { id: string; email: string | null }; workspace: AdsWorkspace; plan: SearchPlan }
  | { ok: false; message: string; problems?: { path: string; message: string }[] };

function validateSearchFor(workspace: AdsWorkspace, plan: unknown, user: { id: string; email: string | null }): SearchPrepared {
  if (workspace.platform !== "google") {
    return { ok: false, message: `Planurile de căutare se creează în Google Ads, iar ${workspaceName(workspace)} e pe altă platformă. Nu s-a trimis nimic.` };
  }
  const validation = validateSearchPlan(plan, { currentWorkspace: workspace.id });
  if (!validation.ok) {
    return { ok: false, message: "Planul are greșeli — corectează-le și verifică din nou.", problems: validation.errors };
  }
  return { ok: true, user, workspace, plan: validation.plan };
}

async function prepareSearchPlan(input: { plan: unknown; workspace: string }): Promise<SearchPrepared> {
  const context = await session(input.workspace);
  if (!context.ok) return context;
  return validateSearchFor(context.workspace, input.plan, context.user);
}

async function checkSearchPrepared(prepared: Extract<SearchPrepared, { ok: true }>): Promise<SearchCheckResponse> {
  try {
    const { check } = await checkSearchOnGoogle(prepared.workspace, prepared.plan);
    return { ok: true, check };
  } catch (error) {
    return { ok: false, message: describeGoogleError(error, "verificarea planului", prepared.workspace.tokenEnv) };
  }
}

export async function checkSearchPlan(input: { plan: unknown; workspace: string }): Promise<SearchCheckResponse> {
  const prepared = await prepareSearchPlan(input);
  if (!prepared.ok) return prepared;
  return checkSearchPrepared(prepared);
}

async function createSearchPrepared(
  prepared: Extract<SearchPrepared, { ok: true }>,
  options: { fingerprint: string; duplicateMinutes: number }
): Promise<SearchCreateResponse> {
  const { workspace, plan, user } = prepared;

  // Același plan, creat de curând: campaniile există deja (iar Google n-ar
  // primi a doua oară aceleași nume). Întâi baza — e mai ieftină decât Google.
  const duplicate = await findRecentDuplicate(options.fingerprint, options.duplicateMinutes);
  if (!duplicate.ok) return { ok: false, message: STORE_FAILURE_MESSAGE[duplicate.reason] };
  if (duplicate.data) {
    return {
      ok: false,
      message: `Exact planul ăsta a fost creat ${agoLabel(duplicate.data.createdAt)}${duplicate.data.createdByEmail ? `, de ${duplicate.data.createdByEmail}` : ""}. Campaniile lui sunt deja în cont, oprite; Google n-ar primi a doua oară aceleași nume.`,
      duplicate: {
        createdAt: duplicate.data.createdAt,
        adsManagerUrl: campaignUrl("google", duplicate.data.adAccount, duplicate.data.platformCampaignId),
        recordId: duplicate.data.id,
      },
    };
  }

  // Verificarea se reface aici, pe server: amprenta trebuie să fie cea văzută de om.
  let context: Awaited<ReturnType<typeof checkSearchOnGoogle>>;
  try {
    context = await checkSearchOnGoogle(workspace, plan);
  } catch (error) {
    return { ok: false, message: describeGoogleError(error, "verificarea dinaintea creării", workspace.tokenEnv) };
  }
  if (!context.check.ok) {
    return { ok: false, message: "Verificarea pe Google a găsit probleme noi. Verifică din nou planul.", problems: context.check.errors, recheck: true };
  }
  if (context.check.fingerprint !== options.fingerprint) {
    return { ok: false, message: "Planul sau ce a găsit Google s-a schimbat de la verificare. Verifică din nou, ca să creezi exact ce vezi pe ecran.", recheck: true };
  }

  const result = await createSearchOnGoogle({ workspace, context, user });
  revalidatePath("/admin/ads");
  return result;
}

export async function createSearchPlan(input: { plan: unknown; workspace: string; fingerprint: string }): Promise<SearchCreateResponse> {
  const prepared = await prepareSearchPlan(input);
  if (!prepared.ok) return prepared;
  return createSearchPrepared(prepared, { fingerprint: input.fingerprint, duplicateMinutes: 30 });
}

/**
 * Verificarea unui plan de căutare, în forma pe care o citește lotul: același
 * panou ca pentru planurile video (contul, locațiile și limbile găsite, erorile).
 */
function searchCheckForBatch(check: SearchCheck): PlatformCheck {
  return {
    platform: "google",
    ok: check.ok,
    fingerprint: check.fingerprint,
    checkedAt: check.checkedAt,
    account: check.account,
    identity: null,
    instagram: null,
    pixel: check.callConversions[0] ? { id: check.callConversions[0].id, name: `${check.callConversions[0].name} · apeluri` } : null,
    video: null,
    videos: [],
    dsa: null,
    conversionDomain: null,
    locations: check.campaigns.flatMap((campaign) => [...campaign.locations, ...campaign.excluded.map((name) => ({ ...name, asked: `fără ${name.asked}` }))]),
    languages: check.campaigns.flatMap((campaign) => campaign.languages),
    interests: [],
    behaviors: [],
    errors: check.errors,
    warnings: [...check.warnings, { path: "", message: `${check.operations} de operații trimise la Google cu validateOnly — ${check.ok ? "le-ar accepta pe toate" : "nu s-a creat nimic"}.` }],
  };
}

function searchCreateForBatch(result: SearchCreateResponse): CreateResponse {
  if (!result.ok) return result;
  return {
    ok: true,
    recordId: result.campaigns[0]?.recordId ?? null,
    adsManagerUrl: result.accountUrl,
    created: result.campaigns.map((campaign) => ({ kind: "campaign" as const, id: campaign.id, name: campaign.name })),
    storeWarning: result.storeWarning,
  };
}

// ---------------------------------------------------------------------------
// Lotul: mai multe planuri, același proprietar
// ---------------------------------------------------------------------------

/**
 * Un plan din lot: spațiul de pe ecran trebuie să fie cel din cookie (ca la
 * un plan singur — al doilea tab nu mută nimic), iar spațiul planului
 * trebuie să fie al ACELUIAȘI proprietar. Platforma poate diferi: fiecare
 * plan se validează, se verifică și se creează în spațiul scris în el.
 */
async function prepareBatchPlan(input: { plan: unknown; screenWorkspace: string }): Promise<Prepared> {
  const screen = await session(input.screenWorkspace);
  if (!screen.ok) return screen;

  const record = input.plan && typeof input.plan === "object" ? (input.plan as Record<string, unknown>) : null;
  const workspace = findWorkspace(record?.workspace);
  if (!workspace) {
    return {
      ok: false,
      message: "Planul nu spune un spațiu de lucru cunoscut. Corectează câmpul workspace.",
      problems: [{ path: "workspace", message: "Spațiul de lucru lipsește sau nu există." }],
    };
  }
  if (workspace.owner !== screen.workspace.owner) {
    return {
      ok: false,
      message: `Planul e pentru ${workspaceName(workspace)}, iar lotul e pentru ${workspaceName(screen.workspace)}: un lot nu amestecă banii agenției cu ai clienților. Nu s-a trimis nimic.`,
    };
  }

  const validation = validatePlan(input.plan, { currentWorkspace: workspace.id });
  if (!validation.ok) {
    return {
      ok: false,
      message: "Planul are greșeli — corectează-le și verifică din nou.",
      problems: validation.errors,
    };
  }
  return { ok: true, user: screen.user, workspace, adapter: adapterFor(workspace.platform), plan: validation.plan };
}

/** Un plan de căutare din lot: aceeași regulă a banilor, apoi validarea de căutare. */
async function prepareBatchSearch(input: { plan: unknown; screenWorkspace: string }): Promise<SearchPrepared> {
  const screen = await session(input.screenWorkspace);
  if (!screen.ok) return screen;
  const workspace = findWorkspace((input.plan as { workspace?: unknown } | null)?.workspace);
  if (!workspace) return { ok: false, message: "Planul nu spune un spațiu de lucru cunoscut. Corectează câmpul workspace." };
  if (workspace.owner !== screen.workspace.owner) {
    return {
      ok: false,
      message: `Planul e pentru ${workspaceName(workspace)}, iar lotul e pentru ${workspaceName(screen.workspace)}: un lot nu amestecă banii agenției cu ai clienților. Nu s-a trimis nimic.`,
    };
  }
  return validateSearchFor(workspace, input.plan, screen.user);
}

export async function checkBatchPlan(input: { plan: unknown; screenWorkspace: string }): Promise<CheckResponse> {
  if (planFormatOf(input.plan) === "search") {
    const prepared = await prepareBatchSearch(input);
    if (!prepared.ok) return prepared;
    const response = await checkSearchPrepared(prepared);
    return response.ok ? { ok: true, check: searchCheckForBatch(response.check) } : response;
  }
  const prepared = await prepareBatchPlan(input);
  if (!prepared.ok) return prepared;
  return checkPrepared(prepared);
}

/**
 * Crearea unui plan din lot. Fără „creează încă una, intenționat": un plan
 * creat în ultimele două săptămâni se sare și se arată cu linkul lui — un
 * lot lipit a doua oară, după două corecturi, nu dublează celelalte opt.
 */
export async function createBatchPlan(input: {
  plan: unknown;
  screenWorkspace: string;
  fingerprint: string;
}): Promise<CreateResponse> {
  if (planFormatOf(input.plan) === "search") {
    const search = await prepareBatchSearch(input);
    if (!search.ok) return search;
    return searchCreateForBatch(
      await createSearchPrepared(search, { fingerprint: input.fingerprint, duplicateMinutes: BATCH_DUPLICATE_DAYS * 24 * 60 })
    );
  }
  const prepared = await prepareBatchPlan(input);
  if (!prepared.ok) return prepared;
  return createPrepared(prepared, {
    fingerprint: input.fingerprint,
    allowDuplicate: false,
    duplicateMinutes: BATCH_DUPLICATE_DAYS * 24 * 60,
  });
}

// ---------------------------------------------------------------------------
// Video nou: browser → stocarea temporară → platforma
// ---------------------------------------------------------------------------

export async function prepareVideoUpload(input: {
  workspace: string;
  adAccount: string;
  file: { name: string; size: number; type: string };
}): Promise<{ ok: true; uploadUrl: string; name: string } | Failure> {
  const context = await accountSession(input.workspace, input.adAccount);
  if (!context.ok) return context;

  // Înainte de 50 MB urcați degeaba: tokenul trebuie să vadă contul.
  try {
    const account = await context.adapter.findAccount(context.workspace, context.adAccount);
    if (!account) {
      return {
        ok: false,
        message: `Tokenul spațiului ${workspaceName(context.workspace)} nu vede contul ${context.adAccount}, deci n-ar putea pune video-ul în biblioteca lui. Verifică contul din plan.`,
      };
    }
  } catch (error) {
    return { ok: false, message: context.adapter.describeError(error, "verificarea contului", context.workspace.tokenEnv) };
  }

  const staged = await createStagingUpload(context.workspace.id, input.file);
  return staged.ok ? { ok: true, ...staged.data } : staged;
}

export async function sendStagedVideo(input: {
  workspace: string;
  adAccount: string;
  stagingName: string;
  fileName: string;
}): Promise<{ ok: true; videoId: string } | Failure> {
  const context = await accountSession(input.workspace, input.adAccount);
  if (!context.ok) return context;
  if (!isStagingNameOf(context.workspace.id, input.stagingName)) {
    return { ok: false, message: "Fișierul nu e al spațiului de lucru curent. Urcă-l din nou." };
  }

  const download = await createStagingDownload(input.stagingName);
  if (!download.ok) return download;

  // Numele din bibliotecă = numele fișierului omului, ca să-l recunoască mai târziu.
  const title = input.fileName.replace(/[\\/]/g, " ").replace(/\.(mp4|mov)$/i, "").trim().slice(0, 120) || "Video din portal";

  // Fișierul rămâne în anticameră până când platforma spune „gata” sau
  // „eroare” (vezi `checkVideoUploadStatus`). Uitat, se curăță singur în 6 ore.
  try {
    const { videoId } = await context.adapter.sendVideo(context.workspace, context.adAccount, {
      fileUrl: download.data.url,
      title,
    });
    return { ok: true, videoId };
  } catch (error) {
    return {
      ok: false,
      message: context.adapter.describeError(error, "copierea video-ului în biblioteca contului", context.workspace.tokenEnv),
    };
  }
}

export async function checkVideoUploadStatus(input: {
  workspace: string;
  adAccount: string;
  videoId: string;
  /** Fișierul din anticameră: se șterge când platforma a terminat, cu bine sau cu eroare. */
  stagingName: string;
}): Promise<{ ok: true; status: UploadStatus } | Failure> {
  const context = await accountSession(input.workspace, input.adAccount);
  if (!context.ok) return context;
  if (!/^[A-Za-z0-9_.-]{5,80}$/.test(input.videoId)) return { ok: false, message: "Id de video invalid." };

  try {
    const status = await context.adapter.videoStatus(context.workspace, context.adAccount, input.videoId);
    if ((status.state === "ready" || status.state === "error") && isStagingNameOf(context.workspace.id, input.stagingName)) {
      await removeStaged(input.stagingName);
    }
    return { ok: true, status };
  } catch (error) {
    return { ok: false, message: context.adapter.describeError(error, "citirea stării video-ului", context.workspace.tokenEnv) };
  }
}

// ---------------------------------------------------------------------------
// Sincronizarea cifrelor, la cerere
// ---------------------------------------------------------------------------

export async function syncAdsNow(): Promise<
  { ok: true; status: "ok" | "partial" | "failed"; message: string } | Failure
> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };
  const currentId = await currentWorkspaceId();
  const workspace = findWorkspace(currentId);
  if (!workspace) return { ok: false, message: "Spațiul de lucru nu există." };

  try {
    const outcome = await runAdsSync({ trigger: "manual", workspaceIds: [workspace.id] });
    revalidatePath("/admin/ads", "layout");
    const counted = `${outcome.campaignsSynced === 1 ? "o campanie" : `${outcome.campaignsSynced} campanii`}, ${outcome.rowsWritten === 1 ? "o zi de cifre" : `${outcome.rowsWritten} zile de cifre`}`;
    if (outcome.status === "ok") {
      return {
        ok: true,
        status: "ok",
        message: outcome.skipped.length > 0 ? outcome.skipped.join(" ") : `Gata: ${counted}.`,
      };
    }
    return {
      ok: true,
      status: outcome.status,
      message: `${outcome.status === "partial" ? `Parțial (${counted}). ` : ""}${outcome.problems.join(" ")}`,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Sincronizarea n-a pornit." };
  }
}

// ---------------------------------------------------------------------------
// Contextul conturilor, pentru conversația cu Claude
// ---------------------------------------------------------------------------

export interface ClaudeContextSummary {
  workspaceId: string;
  name: string;
  accounts: number;
  identities: number;
  conversions: number;
  videos: number;
  notes: string[];
}

/**
 * Citește, cu tokenul fiecărui spațiu al proprietarului de pe ecran, ce id-uri
 * poate folosi un plan, și le pune în textul de dat conversației. Doar citiri.
 */
export async function readClaudeContext(input: {
  screenWorkspace: string;
  tiktokAccounts: Record<string, string[]>;
}): Promise<{ ok: true; text: string; summary: ClaudeContextSummary[] } | Failure> {
  const screen = await session(input.screenWorkspace);
  if (!screen.ok) return screen;

  const workspaces = WORKSPACES.filter(
    (workspace) => workspace.owner === screen.workspace.owner && workspaceToken(workspace) !== null
  ) as AdsWorkspace[];
  const contexts = [];
  for (const workspace of workspaces) {
    const typed = (input.tiktokAccounts[workspace.id] ?? []).map((id) => id.trim()).filter((id) => /^\d{5,25}$/.test(id));
    const hints = workspace.platform === "tiktok" ? (typed.length > 0 ? typed : await knownAccounts(workspace.id)) : [];
    contexts.push(await readAccountContext(workspace, hints));
  }

  const siteNotes = [
    `Site-ul agenției: ${SITE_URL}. Pentru reclamele care duc pe site, folosește pixelul Meta ${SITE_META_PIXEL_ID}, pixelul TikTok ${SITE_TIKTOK_PIXEL_CODE}${
      GOOGLE_ADS_LEAD_SEND_TO ? ` și, pe Google, acțiunea de conversie cu eticheta ${GOOGLE_ADS_LEAD_SEND_TO}` : "; pe Google, tag-ul de conversie nu e încă pus pe site (NEXT_PUBLIC_GOOGLE_ADS_LEAD)"
    }.`,
    "Site-ul trimite: pe Meta — Lead (formular), Contact, Schedule, ViewContent; pe TikTok — SubmitForm (lead), Contact, ViewContent; pe Google — conversia „Lead” la formular trimis.",
    "Spațiile fără token nu apar aici: pentru ele, cere-i omului id-urile.",
  ];
  return {
    ok: true,
    text: contextForClaude(contexts, siteNotes),
    summary: contexts.map((context) => ({
      workspaceId: context.workspaceId,
      name: context.workspaceName,
      accounts: context.accounts.length,
      identities: context.identities.length,
      conversions: context.conversions.length,
      videos: context.videos.length,
      notes: context.notes,
    })),
  };
}

// ---------------------------------------------------------------------------
// Biblioteca video
// ---------------------------------------------------------------------------

export async function listLibraryVideos(input: { workspace: string; adAccount: string }): Promise<LibraryResponse> {
  const context = await accountSession(input.workspace, input.adAccount);
  if (!context.ok) return context;

  try {
    const library = await context.adapter.listLibrary(context.workspace, context.adAccount);
    return { ok: true, ...library };
  } catch (error) {
    return { ok: false, message: context.adapter.describeError(error, "citirea bibliotecii video", context.workspace.tokenEnv) };
  }
}


// ---------------------------------------------------------------------------
// Contul Google existent (faza 11): pauza și negativele
// ---------------------------------------------------------------------------

type GoogleAccountSession =
  | { ok: true; user: { id: string; email: string | null }; workspace: AdsWorkspace; account: GoogleAccount }
  | Failure;

/** Sesiune + spațiul de pe ecran (Google, cu cheie) + contul, cum îl vede cheia. */
async function googleAccountSession(workspaceId: string, adAccountInput: string): Promise<GoogleAccountSession> {
  const context = await session(workspaceId);
  if (!context.ok) return context;
  if (context.workspace.platform !== "google") return { ok: false, message: "Contul se întreține doar în spațiile Google. Schimbă spațiul din selectorul de sus." };
  const adAccount = adAccountInput.replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(adAccount)) return { ok: false, message: `„${adAccountInput}” nu e un cont Google Ads (10 cifre).` };
  try {
    const account = await findGoogleAccount(context.workspace, adAccount);
    if (!account) return { ok: false, message: `Cheia spațiului ${workspaceName(context.workspace)} nu vede contul ${adAccount}.` };
    if (account.manager) return { ok: false, message: `${account.info.name} e un cont manager (MCC); alege contul clientului de sub el.` };
    return { ok: true, user: context.user, workspace: context.workspace, account };
  } catch (error) {
    return { ok: false, message: describeGoogleError(error, "citirea contului", context.workspace.tokenEnv) };
  }
}

function journalWarning(result: Awaited<ReturnType<typeof recordChange>>): string | null {
  return result.ok
    ? null
    : `S-a făcut în Google Ads, dar n-a putut fi notat în jurnalul portalului (${STORE_FAILURE_MESSAGE[result.reason]}).`;
}

export async function pauseAccountCampaigns(input: { workspace: string; adAccount: string; campaignIds: string[] }): Promise<PauseResponse> {
  const context = await googleAccountSession(input.workspace, input.adAccount);
  if (!context.ok) return context;
  const ids = [...new Set(input.campaignIds.filter((id) => /^\d+$/.test(id)))];
  if (ids.length === 0) return { ok: false, message: "Nicio campanie aleasă." };
  if (ids.length > 500) return { ok: false, message: "Cel mult 500 de campanii odată." };

  let outcome: Awaited<ReturnType<typeof pauseCampaigns>>;
  try {
    outcome = await pauseCampaigns(context.workspace, context.account, ids);
  } catch (error) {
    return { ok: false, message: describeGoogleError(error, "pauza", context.workspace.tokenEnv) };
  }
  let warning: string | null = null;
  if (outcome.paused.length > 0) {
    await markPortalPaused(context.account.info.id, outcome.paused.map((item) => item.id));
    warning = journalWarning(
      await recordChange({
        workspace: context.workspace.id,
        adAccount: context.account.info.id,
        kind: "pause",
        summary: `${outcome.paused.length === 1 ? "O campanie pusă" : `${outcome.paused.length} campanii puse`} pe pauză`,
        detail: { paused: outcome.paused, skipped: outcome.skipped },
        operations: outcome.paused.length,
        user: context.user,
      })
    );
  }
  revalidatePath("/admin/ads/cont");
  return { ok: true, paused: outcome.paused, skipped: outcome.skipped, journalWarning: warning };
}

export async function previewAccountNegatives(input: { workspace: string; adAccount: string; request: NegativesRequest }): Promise<NegativesResponse> {
  const context = await googleAccountSession(input.workspace, input.adAccount);
  if (!context.ok) return context;
  try {
    const prepared = await prepareNegatives(context.workspace, context.account, input.request);
    return { ok: true, preview: prepared.preview };
  } catch (error) {
    return { ok: false, message: describeGoogleError(error, "pregătirea negativelor", context.workspace.tokenEnv) };
  }
}

export async function addAccountNegatives(input: {
  workspace: string;
  adAccount: string;
  request: NegativesRequest;
  fingerprint: string;
}): Promise<{ ok: true; operations: number; journalWarning: string | null } | { ok: false; message: string; recheck?: boolean }> {
  const context = await googleAccountSession(input.workspace, input.adAccount);
  if (!context.ok) return context;
  try {
    // Totul se reface pe server: conflictele, validateOnly, amprenta.
    const prepared = await prepareNegatives(context.workspace, context.account, input.request);
    if (!prepared.preview.ok) return { ok: false, message: prepared.preview.errors[0] ?? "Previzualizarea are probleme. Previzualizează din nou.", recheck: true };
    if (prepared.preview.fingerprint !== input.fingerprint) {
      return { ok: false, message: "Ceva s-a schimbat în cont sau în listă de la previzualizare. Previzualizează din nou.", recheck: true };
    }
    const operations = await applyNegatives(context.workspace, context.account, prepared);
    const mode = input.request.mode;
    const added = prepared.preview.additions.reduce((sum, item) => sum + item.keywords.length, 0);
    const warning = journalWarning(
      await recordChange({
        workspace: context.workspace.id,
        adAccount: context.account.info.id,
        kind: mode === "link" ? "negative_list_link" : "negatives",
        summary:
          mode === "link"
            ? `Lista de negative legată de ${added === 1 ? "o campanie" : `${added} campanii`}`
            : `${operations === 1 ? "Un negativ adăugat" : `${operations} negative adăugate`} ${mode === "list" ? "în lista comună" : "pe campanii"}`,
        detail: { mode, additions: prepared.preview.additions, listId: input.request.listId, campaignIds: input.request.campaignIds },
        operations,
        user: context.user,
      })
    );
    revalidatePath("/admin/ads/cont");
    return { ok: true, operations, journalWarning: warning };
  } catch (error) {
    return { ok: false, message: describeGoogleError(error, "adăugarea negativelor", context.workspace.tokenEnv) };
  }
}
