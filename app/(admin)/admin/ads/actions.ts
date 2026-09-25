"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/supabase/clients";
import { findWorkspace, isWorkspaceId, workspaceName, type AdsWorkspace } from "@/lib/ads/workspaces";
import { WORKSPACE_COOKIE, currentWorkspaceId } from "@/lib/ads/workspaces.server";
import { normalizeAdAccount, validatePlan } from "@/lib/ads/plan-validate";
import type { Plan } from "@/lib/ads/plan-schema";
import { checkOnMeta } from "@/lib/ads/meta/check";
import { createPausedOnMeta } from "@/lib/ads/meta/create";
import { describeMetaError } from "@/lib/ads/meta/errors";
import { adsManagerCampaignUrl } from "@/lib/ads/meta/links";
import { listAdAccounts, listLibrary } from "@/lib/ads/meta/lookup";
import type { CreateResponse, LibraryResponse, MetaCheckResponse, UploadStatus } from "@/lib/ads/meta/types";
import { readVideoUploadStatus, sendVideoToMeta } from "@/lib/ads/meta/video";
import { createStagingDownload, createStagingUpload, isStagingNameOf, removeStaged } from "@/lib/ads/staging";
import { STORE_FAILURE_MESSAGE, findRecentDuplicate } from "@/lib/ads/store";
import { runAdsSync } from "@/lib/ads/sync";

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
 * NU există nicio acțiune care să pornească, să modifice sau să șteargă o
 * campanie. Portalul creează — oprit — și atât.
 */

const SESSION_EXPIRED = "Sesiunea a expirat. Reîncarcă pagina și intră din nou în panou.";

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
// Pregătirea comună: sesiune, spațiu, plan valid
// ---------------------------------------------------------------------------

type Prepared =
  | { ok: true; user: { id: string; email: string | null }; workspace: AdsWorkspace; plan: Plan }
  | { ok: false; message: string; problems?: { path: string; message: string }[] };

async function prepare(input: { plan: unknown; workspace: string }): Promise<Prepared> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };

  // Spațiul afișat pe ecran = spațiul din cookie. Un al doilea tab deschis
  // pe alt portofoliu nu poate muta o campanie dintr-o parte în alta.
  const currentId = await currentWorkspaceId();
  const workspace = findWorkspace(currentId);
  if (!workspace) return { ok: false, message: "Spațiul de lucru nu există." };
  if (input.workspace !== currentId) {
    return {
      ok: false,
      message: `Între timp ai trecut în ${workspaceName(workspace)} (probabil din alt tab). Reîncarcă pagina ca să vezi spațiul în care lucrezi acum.`,
    };
  }

  const validation = validatePlan(input.plan, { currentWorkspace: currentId });
  if (!validation.ok) {
    return {
      ok: false,
      message: "Planul are greșeli — corectează-le mai sus și verifică din nou.",
      problems: validation.errors,
    };
  }

  if (workspace.platform !== "meta") {
    return { ok: false, message: "Conectarea la TikTok vine în faza 5. Deocamdată portalul creează doar pe Meta." };
  }

  return { ok: true, user, workspace, plan: validation.plan };
}

// ---------------------------------------------------------------------------
// Verificarea pe Meta
// ---------------------------------------------------------------------------

export async function checkPlanOnMeta(input: { plan: unknown; workspace: string }): Promise<MetaCheckResponse> {
  const prepared = await prepare(input);
  if (!prepared.ok) return prepared;

  try {
    const context = await checkOnMeta(prepared.workspace, prepared.plan);
    return { ok: true, check: context.check };
  } catch (error) {
    return { ok: false, message: describeMetaError(error, "verificarea planului", prepared.workspace.tokenEnv) };
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
  const prepared = await prepare(input);
  if (!prepared.ok) return prepared;
  const { workspace, plan, user } = prepared;

  // Verificarea se reface aici, pe server. Amprenta trebuie să fie aceeași
  // cu cea văzută de om: altfel ceva s-a schimbat (planul sau ce a găsit Meta).
  let context: Awaited<ReturnType<typeof checkOnMeta>>;
  try {
    context = await checkOnMeta(workspace, plan);
  } catch (error) {
    return { ok: false, message: describeMetaError(error, "verificarea dinaintea creării", workspace.tokenEnv) };
  }
  if (!context.check.ok) {
    return {
      ok: false,
      message: "Verificarea pe Meta a găsit probleme noi. Verifică din nou planul.",
      problems: context.check.errors,
      recheck: true,
    };
  }
  if (context.check.fingerprint !== input.fingerprint) {
    return {
      ok: false,
      message:
        "Planul sau ce a găsit Meta s-a schimbat de la verificare. Verifică din nou, ca să creezi exact ce vezi pe ecran.",
      recheck: true,
    };
  }

  // Dublul clic și al doilea tab: același plan, creat de curând.
  if (!input.allowDuplicate) {
    const duplicate = await findRecentDuplicate(context.check.fingerprint);
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
          adsManagerUrl: adsManagerCampaignUrl(duplicate.data.adAccount, duplicate.data.platformCampaignId),
          recordId: duplicate.data.id,
        },
      };
    }
  }

  const result = await createPausedOnMeta({ workspace, context, user });
  revalidatePath("/admin/ads");
  return result;
}

// ---------------------------------------------------------------------------
// Video nou: browser → stocarea temporară → Meta
// ---------------------------------------------------------------------------

type Failure = { ok: false; message: string };

/** Sesiune + spațiul de pe ecran = cel din cookie + Meta + cont de forma corectă. */
async function uploadContext(
  workspaceId: string,
  adAccountInput: string
): Promise<{ ok: true; workspace: AdsWorkspace; adAccount: string } | Failure> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };

  const currentId = await currentWorkspaceId();
  const workspace = findWorkspace(currentId);
  if (!workspace || workspaceId !== currentId) {
    return { ok: false, message: "Spațiul de lucru s-a schimbat între timp. Reîncarcă pagina." };
  }
  if (workspace.platform !== "meta") {
    return { ok: false, message: "Urcarea pe TikTok vine în faza 5." };
  }
  const adAccount = normalizeAdAccount("meta", adAccountInput);
  if (!/^act_\d{5,25}$/.test(adAccount)) {
    return { ok: false, message: `„${adAccountInput}” nu e un cont de reclame Meta (act_ urmat de cifre).` };
  }
  return { ok: true, workspace, adAccount };
}

export async function prepareVideoUpload(input: {
  workspace: string;
  adAccount: string;
  file: { name: string; size: number; type: string };
}): Promise<{ ok: true; uploadUrl: string; name: string } | Failure> {
  const context = await uploadContext(input.workspace, input.adAccount);
  if (!context.ok) return context;

  // Înainte de 50 MB urcați degeaba: tokenul trebuie să vadă contul.
  try {
    const accounts = await listAdAccounts(context.workspace);
    if (!accounts.some((account) => account.id === context.adAccount)) {
      return {
        ok: false,
        message: `Tokenul spațiului ${workspaceName(context.workspace)} nu vede contul ${context.adAccount}, deci n-ar putea pune video-ul în biblioteca lui. Verifică contul din plan.`,
      };
    }
  } catch (error) {
    return { ok: false, message: describeMetaError(error, "verificarea contului", context.workspace.tokenEnv) };
  }

  const staged = await createStagingUpload(context.workspace.id, input.file);
  return staged.ok ? { ok: true, ...staged.data } : staged;
}

export async function sendStagedVideoToMeta(input: {
  workspace: string;
  adAccount: string;
  stagingName: string;
  fileName: string;
}): Promise<{ ok: true; videoId: string } | Failure> {
  const context = await uploadContext(input.workspace, input.adAccount);
  if (!context.ok) return context;
  if (!isStagingNameOf(context.workspace.id, input.stagingName)) {
    return { ok: false, message: "Fișierul nu e al spațiului de lucru curent. Urcă-l din nou." };
  }

  const download = await createStagingDownload(input.stagingName);
  if (!download.ok) return download;

  // Numele din bibliotecă = numele fișierului omului, ca să-l recunoască mai târziu.
  const title = input.fileName.replace(/[\\/]/g, " ").replace(/\.(mp4|mov)$/i, "").trim().slice(0, 120) || "Video din portal";

  // Fișierul rămâne în anticameră până când Meta spune „gata” sau „eroare”
  // (vezi `checkVideoUploadStatus`): nu e documentat dacă Meta îl descarcă
  // înainte să răspundă sau după. Uitat, se curăță singur în 6 ore.
  try {
    const { videoId } = await sendVideoToMeta(context.workspace, context.adAccount, { fileUrl: download.data.url, title });
    return { ok: true, videoId };
  } catch (error) {
    return { ok: false, message: describeMetaError(error, "copierea video-ului în biblioteca contului", context.workspace.tokenEnv) };
  }
}

export async function checkVideoUploadStatus(input: {
  workspace: string;
  videoId: string;
  /** Fișierul din anticameră: se șterge când Meta a terminat, cu bine sau cu eroare. */
  stagingName: string;
}): Promise<{ ok: true; status: UploadStatus } | Failure> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };
  const currentId = await currentWorkspaceId();
  const workspace = findWorkspace(currentId);
  if (!workspace || input.workspace !== currentId || workspace.platform !== "meta") {
    return { ok: false, message: "Spațiul de lucru s-a schimbat între timp. Reîncarcă pagina." };
  }
  if (!/^\d{5,25}$/.test(input.videoId)) return { ok: false, message: "Id de video invalid." };

  try {
    const status = await readVideoUploadStatus(workspace, input.videoId);
    if ((status.state === "ready" || status.state === "error") && isStagingNameOf(workspace.id, input.stagingName)) {
      await removeStaged(input.stagingName);
    }
    return { ok: true, status };
  } catch (error) {
    return { ok: false, message: describeMetaError(error, "citirea stării video-ului", workspace.tokenEnv) };
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
  if (workspace.platform !== "meta") return { ok: false, message: "Cifrele TikTok vin în faza 5." };

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
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };

  const currentId = await currentWorkspaceId();
  const workspace = findWorkspace(currentId);
  if (!workspace || input.workspace !== currentId) {
    return { ok: false, message: "Spațiul de lucru s-a schimbat între timp. Reîncarcă pagina." };
  }
  if (workspace.platform !== "meta") {
    return { ok: false, message: "Biblioteca TikTok vine în faza 5." };
  }

  const adAccount = normalizeAdAccount("meta", input.adAccount);
  if (!/^act_\d{5,25}$/.test(adAccount)) {
    return { ok: false, message: `„${input.adAccount}” nu e un cont de reclame Meta (act_ urmat de cifre).` };
  }

  try {
    const library = await listLibrary(workspace, adAccount);
    return { ok: true, ...library };
  } catch (error) {
    return { ok: false, message: describeMetaError(error, "citirea bibliotecii video", workspace.tokenEnv) };
  }
}
