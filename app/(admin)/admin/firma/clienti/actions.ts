"use server";

import { revalidatePath } from "next/cache";
import { actorEmail, SESSION_EXPIRED } from "@/lib/firma/db";
import { logEvent } from "@/lib/firma/istoric";
import { deleteContact, insertClient, insertContact, saveContract, setAdsLink, setClientArchived, updateClient } from "@/lib/firma/clienti";
import { overlappingPrices } from "@/lib/firma/contracte-shared";
import { clientSchema, contactSchema, contractSchema, firstIssue } from "@/lib/firma/schemas";
import { OblioError, oblioClients, OBLIO_MISSING, isOblioConfigured, type OblioClient } from "@/lib/firma/oblio/api";

export type ActionResult = { ok: true; id?: string } | { ok: false; field?: string; message: string };

const PATH = "/admin/firma/clienti";

export async function saveClientAction(id: string | null, raw: unknown, fromOblio: boolean): Promise<ActionResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };
  const result = id ? await updateClient(id, parsed.data, fromOblio) : await insertClient(parsed.data, actor, fromOblio);
  const targetId = id ?? (result.ok && result.data ? (result.data as { id: string }).id : null);
  await logEvent({
    actor,
    zona: "clienti",
    actiune: id ? "client modificat" : "client adăugat",
    tinta: targetId,
    rezultat: result.ok ? "ok" : "eroare",
    mesaj: result.ok ? `${parsed.data.nume}${fromOblio ? " (date din Oblio)" : ""}` : result.message,
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(PATH);
  return { ok: true, id: targetId ?? undefined };
}

export async function archiveClientAction(id: string, archived: boolean): Promise<ActionResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const result = await setClientArchived(id, archived);
  await logEvent({ actor, zona: "clienti", actiune: archived ? "client arhivat" : "client scos din arhivă", tinta: id, rezultat: result.ok ? "ok" : "eroare", mesaj: result.ok ? null : result.message });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function addContactAction(clientId: string, raw: unknown): Promise<ActionResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };
  const result = await insertContact(clientId, parsed.data);
  await logEvent({ actor, zona: "clienti", actiune: "persoană de contact adăugată", tinta: clientId, rezultat: result.ok ? "ok" : "eroare", mesaj: result.ok ? parsed.data.nume : result.message });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(PATH);
  return { ok: true, id: result.data.id };
}

export async function deleteContactAction(clientId: string, contactId: string): Promise<ActionResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const result = await deleteContact(contactId);
  await logEvent({ actor, zona: "clienti", actiune: "persoană de contact scoasă", tinta: clientId, rezultat: result.ok ? "ok" : "eroare", mesaj: result.ok ? null : result.message });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function saveContractAction(clientId: string, contractId: string | null, raw: unknown): Promise<ActionResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const parsed = contractSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };
  const periods = parsed.data.preturi.map((price) => ({ deLa: `${price.deLa}-01`, panaLa: price.panaLa === "" ? null : `${price.panaLa}-28` }));
  if (overlappingPrices(periods)) return { ok: false, field: "preturi", message: "Două prețuri acoperă aceeași lună. Fiecare lună trebuie să aibă un singur preț." };
  const result = await saveContract(clientId, contractId, parsed.data);
  await logEvent({
    actor,
    zona: "clienti",
    actiune: contractId ? "contract modificat" : "contract adăugat",
    tinta: result.ok ? result.data.id : clientId,
    rezultat: result.ok ? "ok" : "eroare",
    mesaj: result.ok ? `${parsed.data.servicii.slice(0, 80)} · ${parsed.data.preturi.length} ${parsed.data.preturi.length === 1 ? "preț" : "prețuri"}` : result.message,
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(PATH);
  return { ok: true, id: result.data.id };
}

export async function linkAdsAction(clientId: string, adsClientId: string | null): Promise<ActionResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const result = await setAdsLink(clientId, adsClientId);
  await logEvent({ actor, zona: "clienti", actiune: adsClientId ? "legat de portalul de reclame" : "legătura cu reclamele scoasă", tinta: clientId, rezultat: result.ok ? "ok" : "eroare", mesaj: result.ok ? null : result.message });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(PATH);
  return { ok: true };
}

export type OblioSearchResult = { ok: true; clients: OblioClient[] } | { ok: false; message: string };

/** Caută în lista de clienți din Oblio: după CUI dacă sunt cifre, altfel după nume. Doar citire. */
export async function searchOblioAction(query: string): Promise<OblioSearchResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  if (!isOblioConfigured()) return { ok: false, message: OBLIO_MISSING };
  const term = query.trim();
  if (term.length < 2) return { ok: false, message: "Scrie măcar două caractere din nume sau CUI-ul." };
  const digits = term.replace(/^RO/i, "").replace(/\s/g, "");
  try {
    const clients = /^\d{2,10}$/.test(digits) ? await oblioClients({ clientCif: digits }) : await oblioClients({ name: term });
    return { ok: true, clients: clients.slice(0, 20) };
  } catch (error) {
    const message = error instanceof OblioError ? error.message : "Oblio n-a răspuns. Reîncearcă.";
    await logEvent({ actor, zona: "clienti", actiune: "căutare în Oblio", rezultat: "eroare", mesaj: message });
    return { ok: false, message };
  }
}
