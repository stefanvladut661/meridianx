"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actorEmail, SESSION_EXPIRED } from "@/lib/firma/db";
import { confirmLine, ignoreLine, importStatement, prepareStatementUpload, previewStatement, rematch, type ImportOutcome, type StatementPreview } from "@/lib/firma/incasari";

const PATH = "/admin/firma/incasari";
type Simple = { ok: true; message?: string } | { ok: false; message: string };

export async function prepareStatementAction(type: string, size: number): Promise<{ ok: true; path: string; uploadUrl: string } | { ok: false; message: string }> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const result = await prepareStatementUpload(type, size);
  if (!result.ok) return result;
  return { ok: true, ...result.data };
}

export async function previewStatementAction(path: string): Promise<{ ok: true; preview: StatementPreview } | { ok: false; message: string }> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const result = await previewStatement(path);
  if (!result.ok) return result;
  return { ok: true, preview: result.data };
}

const column = z.number().int().min(0).max(100).nullable();
const importSchema = z
  .object({
    path: z.string().min(1),
    name: z.string().min(1).max(300),
    headerRow: z.number().int().min(0).max(50),
    delimiter: z.enum([",", ";", "tab", "|"]),
    encoding: z.enum(["utf-8", "windows-1250"]),
    formatName: z.string().trim().max(120),
    columns: z.object({ data: z.number().int().min(0).max(100), suma: column, debit: column, credit: column, detalii: z.number().int().min(0).max(100), contrapartida: column, referinta: column, moneda: column }),
  })
  .refine((value) => value.columns.suma !== null || (value.columns.debit !== null && value.columns.credit !== null), { message: "Alege coloana sumei, sau coloanele de debit și credit." });

export async function importStatementAction(raw: unknown): Promise<{ ok: true; outcome: ImportOutcome } | { ok: false; message: string }> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const parsed = importSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Alegerea coloanelor nu e completă." };
  const result = await importStatement(parsed.data, actor);
  revalidatePath(PATH);
  if (!result.ok) return result;
  return { ok: true, outcome: result.data };
}

export async function confirmLineAction(lineId: string, targetId: string): Promise<Simple> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const result = await confirmLine(lineId, targetId, actor);
  revalidatePath(PATH);
  if (!result.ok) return result;
  return { ok: true, message: result.data.oblio ?? "Legat." };
}

export async function ignoreLineAction(lineId: string): Promise<Simple> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const result = await ignoreLine(lineId, actor);
  revalidatePath(PATH);
  if (!result.ok) return result;
  return { ok: true };
}

export async function rematchAction(): Promise<Simple> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const result = await rematch(actor);
  revalidatePath(PATH);
  if (!result.ok) return result;
  return { ok: true, message: `Am verificat ${result.data.checked} rânduri nepotrivite: ${result.data.sure} legate sigur, ${result.data.toConfirm} de confirmat.` };
}
