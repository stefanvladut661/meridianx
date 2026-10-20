"use server";

import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/supabase/clients";
import { PLATFORM_LABEL } from "@/lib/ads/constants";
import type { AdAccountInfo } from "@/lib/ads/types";
import { findWorkspace, workspaceName } from "@/lib/ads/workspaces";
import { checkAccount, visibleAccounts } from "@/lib/ads/model/discover";
import {
  addAccountRecord,
  archiveClientRecord,
  clientById,
  createClientRecord,
  renameClientRecord,
  setAccountSyncRecord,
} from "@/lib/ads/model/store";
import { runModelSync } from "@/lib/ads/model/sync";
import { createAdminClient } from "@/lib/supabase/clients";

/**
 * Acțiunile paginii „Clienți” (portalul v2): clienții și conturile lor.
 *
 * Fiecare își reverifică sesiunea — o acțiune de server e un POST care poate fi
 * apelat direct. Nimic de aici nu scrie pe platforme: doar citește conturile pe
 * care le vede tokenul și ține evidența în Supabase.
 */

const SESSION_EXPIRED = "Sesiunea a expirat. Reîncarcă pagina și intră din nou în panou.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Failure = { ok: false; message: string };

function cleanName(input: unknown): string | null {
  const name = typeof input === "string" ? input.replace(/\s+/g, " ").trim() : "";
  return name.length >= 1 && name.length <= 80 ? name : null;
}

export async function createClientAction(input: { name: string; owner: string }): Promise<{ ok: true; id: string } | Failure> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };
  const name = cleanName(input.name);
  if (!name) return { ok: false, message: "Scrie numele clientului (cel mult 80 de caractere)." };
  if (input.owner !== "agentie" && input.owner !== "clienti") return { ok: false, message: "Alege ai cui sunt banii: ai agenției sau ai clientului." };
  const created = await createClientRecord({ name, owner: input.owner }, user);
  if (!created.ok) return created;
  revalidatePath("/admin/ads", "layout");
  return { ok: true, id: created.data.id };
}

export async function renameClientAction(input: { id: string; name: string }): Promise<{ ok: true } | Failure> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };
  const name = cleanName(input.name);
  if (!UUID.test(input.id) || !name) return { ok: false, message: "Scrie numele clientului (cel mult 80 de caractere)." };
  const renamed = await renameClientRecord(input.id, name);
  if (!renamed.ok) return renamed;
  revalidatePath("/admin/ads", "layout");
  return { ok: true };
}

export async function archiveClientAction(input: { id: string }): Promise<{ ok: true } | Failure> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };
  if (!UUID.test(input.id)) return { ok: false, message: "Clientul nu există." };
  const archived = await archiveClientRecord(input.id);
  if (!archived.ok) return archived;
  revalidatePath("/admin/ads", "layout");
  return { ok: true };
}

export async function visibleAccountsAction(input: { workspace: string }): Promise<{ ok: true; accounts: AdAccountInfo[]; note: string | null } | Failure> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };
  const workspace = findWorkspace(input.workspace);
  if (!workspace) return { ok: false, message: "Spațiul de lucru nu există." };
  const visible = await visibleAccounts(workspace);
  return { ok: true, accounts: visible.accounts, note: visible.note };
}

export async function addAccountAction(input: {
  clientId: string;
  workspace: string;
  adAccount: string;
}): Promise<{ ok: true; note: string | null } | Failure> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Supabase nu e configurat pe server." };
  if (!UUID.test(input.clientId)) return { ok: false, message: "Clientul nu există." };
  const client = await clientById(admin, input.clientId);
  if (!client) return { ok: false, message: "Clientul nu există sau a fost arhivat." };
  const workspace = findWorkspace(input.workspace);
  if (!workspace) return { ok: false, message: "Spațiul de lucru nu există." };
  // Banii agenției și banii clienților nu se amestecă: plafonul vine din spațiu.
  if (workspace.owner !== client.owner) {
    return {
      ok: false,
      message: `${client.name} e un client cu ${client.owner === "agentie" ? "banii agenției" : "banii clientului"}; contul trebuie adăugat printr-un spațiu ${client.owner === "agentie" ? "Meridian" : "Clienți"}, nu prin ${workspaceName(workspace)}.`,
    };
  }
  const checked = await checkAccount(workspace, input.adAccount);
  if (!checked.ok) return checked;
  const added = await addAccountRecord(
    {
      clientId: client.id,
      platform: workspace.platform,
      workspace: workspace.id,
      adAccount: checked.adAccount,
      name: checked.info?.name ?? null,
      currency: checked.info?.currency ?? null,
    },
    user
  );
  if (!added.ok) return added;
  revalidatePath("/admin/ads", "layout");
  return {
    ok: true,
    note: checked.checked
      ? checked.info && !checked.info.usable
        ? `Contul e adăugat, dar ${PLATFORM_LABEL[workspace.platform]} spune că e ${checked.info.state}.`
        : null
      : `Contul e adăugat fără verificare: ${workspace.tokenEnv} nu e setat. Cifrele apar după ce pui tokenul și apeși „Actualizează”.`,
  };
}

export async function setAccountSyncAction(input: { accountId: string; enabled: boolean }): Promise<{ ok: true } | Failure> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };
  if (!UUID.test(input.accountId)) return { ok: false, message: "Contul nu există." };
  const saved = await setAccountSyncRecord(input.accountId, input.enabled === true);
  if (!saved.ok) return saved;
  revalidatePath("/admin/ads", "layout");
  return { ok: true };
}

/** „Actualizează”: structura și cifrele conturilor unui client, acum. */
export async function syncClientAction(input: { clientId: string }): Promise<{ ok: true; summary: string; problems: string[] } | Failure> {
  const user = await getAdminUser();
  if (!user) return { ok: false, message: SESSION_EXPIRED };
  if (!UUID.test(input.clientId)) return { ok: false, message: "Clientul nu există." };
  try {
    const outcome = await runModelSync({ trigger: "manual", clientId: input.clientId, budgetMs: 45_000 });
    revalidatePath("/admin/ads", "layout");
    const parts: string[] = [];
    if (outcome.accounts > 0) parts.push(`${outcome.accounts === 1 ? "Un cont actualizat" : `${outcome.accounts} conturi actualizate`}`);
    if (outcome.fresh > 0) parts.push(`${outcome.fresh === 1 ? "unul era" : `${outcome.fresh} erau`} actualizat${outcome.fresh === 1 ? "" : "e"} de mai puțin de două minute`);
    if (outcome.accounts === 0 && outcome.fresh === 0 && outcome.problems.length === 0) parts.push("Clientul n-are conturi cu sincronizarea pornită");
    return { ok: true, summary: `${parts.join("; ") || "Nimic de actualizat"}.`, problems: outcome.problems };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Actualizarea n-a pornit." };
  }
}
