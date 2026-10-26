"use server";

import { revalidatePath } from "next/cache";
import { actorEmail, SESSION_EXPIRED } from "@/lib/firma/db";
import { logEvent } from "@/lib/firma/istoric";
import { approveInvoice, createManual, discardDraft, prepareMonth, refreshFromOblio, saveDraft, sendInvoiceEmail, type PrepareOutcome } from "@/lib/firma/facturi";
import { draftSchema, firstIssue, invoiceEmailSchema, manualSchema } from "@/lib/firma/schemas";
import { isMonth } from "@/lib/firma/format";

export type InvoiceActionResult = { ok: true; id?: string; message?: string; warning?: string | null } | { ok: false; field?: string; message: string };

const PATH = "/admin/firma/facturi";

export async function prepareMonthAction(month: string): Promise<{ ok: true; outcome: PrepareOutcome } | { ok: false; message: string }> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  if (!isMonth(month)) return { ok: false, message: "Luna nu e validă." };
  const result = await prepareMonth(month, actor);
  if (!result.ok) return result;
  revalidatePath(PATH);
  return { ok: true, outcome: result.data };
}

export async function saveDraftAction(id: string, raw: unknown): Promise<InvoiceActionResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };
  const result = await saveDraft(id, parsed.data);
  await logEvent({ actor, zona: "facturi", actiune: "ciornă corectată", tinta: id, rezultat: result.ok ? "ok" : "eroare", mesaj: result.ok ? null : result.message });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function createManualAction(raw: unknown): Promise<InvoiceActionResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const parsed = manualSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };
  const result = await createManual(parsed.data, actor);
  await logEvent({ actor, zona: "facturi", actiune: "ciornă manuală", tinta: result.ok ? result.data.id : null, rezultat: result.ok ? "ok" : "eroare", mesaj: result.ok ? parsed.data.randuri.map((row) => row.denumire).join("; ").slice(0, 200) : result.message });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(PATH);
  return { ok: true, id: result.data.id };
}

export async function discardDraftAction(id: string): Promise<InvoiceActionResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const result = await discardDraft(id);
  await logEvent({ actor, zona: "facturi", actiune: "renunțat la ciornă", tinta: id, rezultat: result.ok ? "ok" : "eroare", mesaj: result.ok ? "nu exista în Oblio" : result.message });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(PATH);
  return { ok: true };
}

/** „Aprobă”: singurul drum spre Oblio și e-Factura. */
export async function approveAction(id: string): Promise<InvoiceActionResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const result = await approveInvoice(id, actor);
  revalidatePath(PATH);
  if (!result.ok) return { ok: false, message: result.message };
  const name = `${result.data.invoice.serie ?? ""} ${result.data.invoice.numar ?? ""}`.trim();
  return { ok: true, message: `Factura ${name} e emisă.`, warning: result.data.warning };
}

export async function sendEmailAction(id: string, raw: unknown): Promise<InvoiceActionResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const parsed = invoiceEmailSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };
  const result = await sendInvoiceEmail(id, parsed.data, actor);
  revalidatePath(PATH);
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, message: `Emailul a plecat către ${parsed.data.to.join(", ")}.` };
}

export async function refreshOblioAction(): Promise<InvoiceActionResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const result = await refreshFromOblio(actor);
  revalidatePath(PATH);
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, message: result.data.checked === 0 ? "Nicio factură deschisă de verificat." : `Am verificat ${result.data.checked} ${result.data.checked === 1 ? "factură" : "facturi"} în Oblio; ${result.data.updated} cu schimbări.` };
}
