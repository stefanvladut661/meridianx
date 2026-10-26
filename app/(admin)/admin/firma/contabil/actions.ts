"use server";

import { revalidatePath } from "next/cache";
import { actorEmail, SESSION_EXPIRED } from "@/lib/firma/db";
import { buildPackage, packageDownload, sendPackage, type ZipOutcome } from "@/lib/firma/contabil";
import { firstIssue, invoiceEmailSchema } from "@/lib/firma/schemas";
import { isMonth } from "@/lib/firma/format";

const PATH = "/admin/firma/contabil";

export async function buildPackageAction(month: string, force: boolean): Promise<{ ok: true; outcome: ZipOutcome } | { ok: false; message: string }> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  if (!isMonth(month)) return { ok: false, message: "Luna nu e validă." };
  const result = await buildPackage(month, force, actor);
  revalidatePath(PATH);
  if (!result.ok) return result;
  return { ok: true, outcome: result.data };
}

export async function sendPackageAction(month: string, raw: unknown): Promise<{ ok: true; message: string } | { ok: false; field?: string; message: string }> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const parsed = invoiceEmailSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };
  const result = await sendPackage(month, parsed.data, actor);
  revalidatePath(PATH);
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, message: `Emailul a plecat către ${parsed.data.to.join(", ")}${result.data.attached ? ", cu zip-ul atașat" : ", cu linkul spre zip"}.` };
}

export async function downloadPackageAction(month: string): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const result = await packageDownload(month);
  if (!result.ok) return result;
  return { ok: true, url: result.data.url };
}
