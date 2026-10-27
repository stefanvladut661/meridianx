"use server";

import { revalidatePath } from "next/cache";
import { actorEmail, SESSION_EXPIRED } from "@/lib/firma/db";
import { expensePreview, finishExpenseUpload, hideExpense, prepareExpenseUpload, rereadExpense, saveExpense } from "@/lib/firma/cheltuieli";
import { expenseSchema, firstIssue } from "@/lib/firma/schemas";

export type ExpenseResult = { ok: true; message?: string; warning?: string | null } | { ok: false; field?: string; message: string };
const PATH = "/admin/firma/cheltuieli";

export async function prepareUploadAction(type: string, size: number): Promise<{ ok: true; path: string; uploadUrl: string } | { ok: false; message: string }> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const result = await prepareExpenseUpload(type, size);
  if (!result.ok) return result;
  return { ok: true, ...result.data };
}

export async function finishUploadAction(input: { path: string; name: string; type: string }): Promise<ExpenseResult & { id?: string }> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const result = await finishExpenseUpload(input, actor);
  revalidatePath(PATH);
  if (!result.ok) return { ok: false, message: result.message };
  const { read, readMessage, driveMessage } = result.data;
  return { ok: true, id: result.data.id, message: read === "ok" ? "Citit — verifică datele." : (readMessage ?? "Urcat."), warning: driveMessage ? `Drive: ${driveMessage}` : null };
}

export async function saveExpenseAction(id: string, raw: unknown): Promise<ExpenseResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const parsed = expenseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };
  const result = await saveExpense(id, parsed.data, actor);
  revalidatePath(PATH);
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, message: "Salvat.", warning: result.data.driveMessage ? `Drive: ${result.data.driveMessage}` : null };
}

export async function rereadAction(id: string): Promise<ExpenseResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const result = await rereadExpense(id, actor);
  revalidatePath(PATH);
  if (!result.ok) return { ok: false, message: result.message };
  return result.data.read === "ok" ? { ok: true, message: "Citit din nou — verifică datele." } : { ok: false, message: result.data.message ?? "Citirea n-a mers." };
}

export async function hideAction(id: string): Promise<ExpenseResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const result = await hideExpense(id, actor);
  revalidatePath(PATH);
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true };
}

export async function previewAction(id: string): Promise<{ ok: true; url: string; type: string } | { ok: false; message: string }> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const result = await expensePreview(id);
  if (!result.ok) return result;
  return { ok: true, ...result.data };
}
