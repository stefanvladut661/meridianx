"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actorEmail, SESSION_EXPIRED } from "@/lib/postari/db";
import { checkRoot, listFolder, resolveFolder } from "@/lib/postari/drive";
import { logEvent } from "@/lib/postari/istoric";
import { readSettings, updateSettings } from "@/lib/postari/setari";
import { isTime, isTimeZone } from "@/lib/postari/timp";

export type SettingsResult = { ok: true; message: string } | { ok: false; field?: string; message: string };

const settingsSchema = z.object({
  // Adresa folderului (drive.google.com/drive/folders/<id>) sau doar id-ul.
  driveFolder: z
    .string()
    .trim()
    .transform((value) => {
      const match = value.match(/folders\/([A-Za-z0-9_-]{10,})/) ?? value.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
      return value === "" ? null : (match?.[1] ?? value);
    })
    .refine((value) => value === null || /^[A-Za-z0-9_-]{10,200}$/.test(value), "Lipește adresa folderului din Drive sau id-ul lui."),
  sloturiOre: z
    .string()
    .trim()
    .transform((value) => value.split(/[,;\s]+/).map((item) => item.trim()).filter(Boolean).map((item) => (/^\d:\d\d$/.test(item) ? `0${item}` : item)))
    .refine((list) => list.length >= 1 && list.length <= 24, "Scrie cel puțin o oră (cel mult 24), ex. „12:30, 19:00”.")
    .refine((list) => list.every(isTime), "Orele se scriu HH:MM, ex. „12:30, 19:00”.")
    .transform((list) => [...new Set(list)].sort()),
  sloturiFus: z.string().trim().refine(isTimeZone, "Fusul orar nu e cunoscut. Scrie-l ca „Europe/Bucharest”."),
  plafonInstagram: z.coerce.number().int("Plafonul e un număr întreg.").min(1, "Plafonul Instagram: între 1 și 100.").max(100, "Plafonul Instagram: între 1 și 100."),
  plafonTiktok: z.coerce.number().int("Plafonul e un număr întreg.").min(1, "Plafonul TikTok: între 1 și 5.").max(5, "TikTok primește cel mult 5 ciorne nepublicate în 24 de ore."),
  distantaMinimaMin: z.coerce.number().int("Distanța e un număr întreg de minute.").min(0, "Distanța: între 0 și 720 de minute.").max(720, "Distanța: între 0 și 720 de minute."),
  stocareLimitaMb: z.coerce.number().int("Limita e un număr întreg de MB.").min(1, "Limita: între 1 și 5000 MB.").max(5000, "Limita: între 1 și 5000 MB."),
  emailAlerte: z
    .string()
    .trim()
    .transform((value) => value.split(/[,;\s]+/).map((item) => item.trim().toLowerCase()).filter(Boolean))
    .refine((list) => list.length <= 5 && list.every((item) => z.email().safeParse(item).success), "Adresele pentru alerte nu arată bine (cel mult cinci, despărțite prin virgulă).")
    .transform((list) => (list.length ? list.join(", ") : null)),
});

function firstIssue(error: z.ZodError): { field?: string; message: string } {
  const issue = error.issues[0];
  return { field: typeof issue?.path[0] === "string" ? issue.path[0] : undefined, message: issue?.message ?? "Datele nu sunt bune." };
}

export async function saveSettingsAction(raw: unknown): Promise<SettingsResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };
  const { driveFolder, ...rest } = parsed.data;

  const current = await readSettings();
  if (!current.ok) return { ok: false, message: current.message };
  let folderName = current.data.driveFolderId === driveFolder ? current.data.driveFolderNume : null;
  // Un folder nou se citește la Google: există, e folder, se vede cu contul legat?
  if (driveFolder && driveFolder !== current.data.driveFolderId) {
    const check = await checkRoot(driveFolder);
    if (!check.ok) return { ok: false, field: "driveFolder", message: check.message };
    folderName = check.data.name;
  }

  const result = await updateSettings({ ...rest, driveFolderId: driveFolder, driveFolderNume: driveFolder ? folderName : null }, actor);
  await logEvent({
    actor,
    zona: "setari",
    actiune: "setări salvate",
    rezultat: result.ok ? "ok" : "eroare",
    mesaj: result.ok ? (driveFolder !== current.data.driveFolderId ? `Folderul principal: ${folderName ?? "niciunul"}.` : null) : result.message,
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/admin/postari", "layout");
  return { ok: true, message: folderName && driveFolder !== current.data.driveFolderId ? `Salvat. Folderul principal e „${folderName}”.` : "Salvat." };
}

/**
 * „Testează conexiunea”: folderul salvat în setări răspunde cu contul legat?
 * Doar citire, fără scrieri și fără istoric; spune și câte loturi și clipuri
 * are la rădăcină.
 */
export async function checkDriveAction(): Promise<SettingsResult> {
  const actor = await actorEmail();
  if (!actor) return { ok: false, message: SESSION_EXPIRED };
  const current = await readSettings();
  if (!current.ok) return { ok: false, message: current.message };
  if (!current.data.driveFolderId) return { ok: false, message: "Folderul principal nu e ales. Lipește adresa lui, salvează setările și testează din nou." };
  const check = await checkRoot(current.data.driveFolderId);
  if (!check.ok) return { ok: false, message: check.message };
  const root = await resolveFolder("");
  const listing = root.ok ? await listFolder(root.data) : null;
  if (listing?.ok) {
    const lots = listing.data.subfolders.length;
    return { ok: true, message: `Folderul „${check.data.name}” răspunde. ${lots} ${lots === 1 ? "lot" : "loturi"} și ${listing.data.clips.length} ${listing.data.clips.length === 1 ? "clip" : "clipuri"} la rădăcină.` };
  }
  return { ok: true, message: `Folderul „${check.data.name}” răspunde.` };
}
