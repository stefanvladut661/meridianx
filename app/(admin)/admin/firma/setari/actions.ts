"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actorEmail, SESSION_EXPIRED } from "@/lib/firma/db";
import { logEvent } from "@/lib/firma/istoric";
import { updateSettings } from "@/lib/firma/setari";
import { firstIssue } from "@/lib/firma/schemas";
import { ensureMonthFolder } from "@/lib/firma/drive";
import { currentMonth } from "@/lib/firma/format";

export type SettingsResult = { ok: true } | { ok: false; field?: string; message: string };

const settingsSchema = z.object({
  serieFactura: z
    .string()
    .trim()
    .max(20, "Seria: cel mult 20 de caractere.")
    .transform((value) => (value === "" ? null : value)),
  emailContabil: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value.toLowerCase()))
    .refine((value) => value === null || z.email().safeParse(value).success, "Emailul contabilului nu arată bine."),
  // Id-ul folderului din adresa lui (drive.google.com/drive/folders/<id>) sau adresa întreagă.
  driveRadacina: z
    .string()
    .trim()
    .transform((value) => {
      const match = value.match(/folders\/([A-Za-z0-9_-]{10,})/);
      return value === "" ? null : (match?.[1] ?? value);
    })
    .refine((value) => value === null || /^[A-Za-z0-9_-]{10,200}$/.test(value), "Lipește adresa folderului din Drive sau id-ul lui."),
  driveModelLuna: z
    .string()
    .trim()
    .min(1, "Scrie modelul de nume al lunii.")
    .max(80)
    .refine((value) => value.includes("{luna}") || value.includes("{ll}"), "Modelul trebuie să conțină {luna} sau {ll}, ca lunile să aibă nume diferite."),
});

/** Folderul lunii curente pe Drive, acum (altfel îl face cron-ul la începutul lunii). */
export async function createMonthFolderAction(): Promise<{ ok: true; message: string; link: string | null } | { ok: false; message: string }> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const month = currentMonth();
  const result = await ensureMonthFolder(month, actor);
  if (!result.ok) return result;
  return { ok: true, message: `Folderul „${result.data.name}” e pe Drive.`, link: result.data.link };
}

export async function saveSettingsAction(raw: unknown): Promise<SettingsResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };
  const result = await updateSettings(parsed.data, actor);
  await logEvent({ actor, zona: "setari", actiune: "setări salvate", rezultat: result.ok ? "ok" : "eroare", mesaj: result.ok ? null : result.message });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/admin/firma", "layout");
  return { ok: true };
}
