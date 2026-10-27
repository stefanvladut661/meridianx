"use server";

import { revalidatePath } from "next/cache";
import { actorEmail, SESSION_EXPIRED } from "@/lib/firma/db";
import { logEvent } from "@/lib/firma/istoric";
import { accountSchema, addStarterAccounts, deleteAccount, saveAccount } from "@/lib/firma/accese";
import { firstIssue } from "@/lib/firma/schemas";

export type AccountResult = { ok: true; id?: string; message?: string } | { ok: false; field?: string; message: string };
const PATH = "/admin/firma/accese";

export async function saveAccountAction(id: string | null, raw: unknown): Promise<AccountResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const parsed = accountSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };
  const result = await saveAccount(id, parsed.data, actor);
  // În istoric doar numele contului, nimic din câmpuri.
  await logEvent({ actor, zona: "accese", actiune: id ? "cont modificat" : "cont adăugat", tinta: result.ok ? result.data.id : null, rezultat: result.ok ? "ok" : "eroare", mesaj: result.ok ? parsed.data.nume : result.message });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(PATH);
  return { ok: true, id: result.data.id };
}

export async function deleteAccountAction(id: string, name: string): Promise<AccountResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const result = await deleteAccount(id);
  await logEvent({ actor, zona: "accese", actiune: "cont scos din listă", tinta: id, rezultat: result.ok ? "ok" : "eroare", mesaj: result.ok ? name.slice(0, 120) : result.message });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function addStarterAction(): Promise<AccountResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const result = await addStarterAccounts(actor);
  await logEvent({ actor, zona: "accese", actiune: "lista de bază adăugată", rezultat: result.ok ? "ok" : "eroare", mesaj: result.ok ? `${result.data.added} conturi` : result.message });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(PATH);
  return { ok: true, message: result.data.added === 0 ? "Lista de bază era deja completă." : `${result.data.added} conturi adăugate. Completează-le pe rând.` };
}
