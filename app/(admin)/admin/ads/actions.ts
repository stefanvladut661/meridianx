"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/supabase/clients";
import { PLATFORM_LABEL } from "@/lib/ads/constants";
import { campaignUrl } from "@/lib/ads/links";
import { adapterFor, type PlatformAdapter } from "@/lib/ads/platform";
import type { Plan } from "@/lib/ads/plan-schema";
import { validatePlan } from "@/lib/ads/plan-validate";
import { createStagingDownload, createStagingUpload, isStagingNameOf, removeStaged } from "@/lib/ads/staging";
import { STORE_FAILURE_MESSAGE, findRecentDuplicate } from "@/lib/ads/store";
import { runAdsSync } from "@/lib/ads/sync";
import type { CheckResponse, CreateResponse, LibraryResponse, UploadStatus } from "@/lib/ads/types";
import { findWorkspace, isWorkspaceId, workspaceName, type AdsWorkspace } from "@/lib/ads/workspaces";
import { WORKSPACE_COOKIE, currentWorkspaceId } from "@/lib/ads/workspaces.server";

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

export async function checkPlan(input: { plan: unknown; workspace: string }): Promise<CheckResponse> {
  const prepared = await preparePlan(input);
  if (!prepared.ok) return prepared;

  try {
    const { check } = await prepared.adapter.prepare(prepared.workspace, prepared.plan);
    return { ok: true, check };
  } catch (error) {
    return { ok: false, message: prepared.adapter.describeError(error, "verificarea planului", prepared.workspace.tokenEnv) };
  }
}

// ---------------------------------------------------------------------------
// Crearea pe pauză
// ---------------------------------------------------------------------------

export async function createPausedCampaign(input: {
  plan: unknown;
  workspace: string;
  fingerprint: string;
  allowDuplicate: boolean;
}): Promise<CreateResponse> {
  const prepared = await preparePlan(input);
  if (!prepared.ok) return prepared;
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
  if (creation.check.fingerprint !== input.fingerprint) {
    return {
      ok: false,
      message: `Planul sau ce a găsit ${label} s-a schimbat de la verificare. Verifică din nou, ca să creezi exact ce vezi pe ecran.`,
      recheck: true,
    };
  }

  // Dublul clic și al doilea tab: același plan, creat de curând.
  if (!input.allowDuplicate) {
    const duplicate = await findRecentDuplicate(creation.check.fingerprint);
    if (!duplicate.ok) {
      return { ok: false, message: STORE_FAILURE_MESSAGE[duplicate.reason] };
    }
    if (duplicate.data) {
      const minutes = Math.max(1, Math.round((Date.now() - Date.parse(duplicate.data.createdAt)) / 60_000));
      return {
        ok: false,
        message: `Exact planul ăsta a fost creat acum ${minutes === 1 ? "un minut" : `${minutes} minute`}${duplicate.data.createdByEmail ? `, de ${duplicate.data.createdByEmail}` : ""}. Încă o creare înseamnă a doua campanie cu același buget.`,
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

