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
import { listLibrary } from "@/lib/ads/meta/lookup";
import type { CreateResponse, LibraryResponse, MetaCheckResponse } from "@/lib/ads/meta/types";
import { STORE_FAILURE_MESSAGE, findRecentDuplicate } from "@/lib/ads/store";

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
