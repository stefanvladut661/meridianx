import { db, failure, NO_DB, type Result } from "../db";
import { LUNI, monthStart } from "../format";
import { logEvent } from "../istoric";
import { readSettings } from "../setari";
import { checkFolder, createFolder, DriveError, driveMode, DRIVE_MISSING, findChild, uploadFile, type DriveMode } from "./google";

/**
 * Folderul lunii și fișierele urcate (migrarea 18). Folderul rădăcină și
 * modelul de nume vin din Setări; fără rădăcină, nimic nu se scrie pe Drive.
 * Un fișier (factură, cheltuială, extras, pachet) se urcă o singură dată.
 */

const MIGRATION = "18 (00000000000018_firma_drive.sql)";
export const NO_ROOT = "Folderul de pe Drive nu e ales: pune-l în Firmă → Setări.";

/** „{luna} {an}” → „aprilie 2026”; „{ll}” → „04”. */
export function monthFolderName(month: string, pattern: string): string {
  const [year, mm] = month.split("-");
  return pattern.replace(/\{luna\}/g, LUNI[Number(mm) - 1]).replace(/\{Luna\}/g, LUNI[Number(mm) - 1].replace(/^./, (c) => c.toUpperCase())).replace(/\{an\}/g, year).replace(/\{ll\}/g, mm).trim();
}

export interface DriveStatus {
  mode: DriveMode | null;
  root: string | null;
  pattern: string;
  rootName: string | null;
  ok: boolean;
  message: string | null;
}

/** Legătura e pusă? Rădăcina e aleasă și se poate scrie în ea? (o citire la Google) */
export async function driveStatus(check: boolean): Promise<DriveStatus> {
  const mode = driveMode();
  const settings = await readSettings();
  const root = settings.ok ? settings.data.driveRadacina : null;
  const pattern = settings.ok ? settings.data.driveModelLuna : "{luna} {an}";
  if (!mode) return { mode, root, pattern, rootName: null, ok: false, message: DRIVE_MISSING };
  if (!root) return { mode, root, pattern, rootName: null, ok: false, message: NO_ROOT };
  if (!check) return { mode, root, pattern, rootName: null, ok: true, message: null };
  try {
    const folder = await checkFolder(root);
    if (!folder.canAdd) return { mode, root, pattern, rootName: folder.name, ok: false, message: "Contul legat vede folderul, dar nu poate scrie în el: dă-i acces de editor." };
    return { mode, root, pattern, rootName: folder.name, ok: true, message: null };
  } catch (error) {
    return { mode, root, pattern, rootName: null, ok: false, message: error instanceof DriveError ? error.message : "Drive n-a răspuns." };
  }
}

export interface MonthFolder {
  id: string;
  name: string;
  link: string | null;
}

/** Folderul lunii: din bază dacă e știut pentru rădăcina actuală, altfel găsit după nume sau creat. */
export async function ensureMonthFolder(month: string, actor: string): Promise<Result<MonthFolder>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  if (!driveMode()) return { ok: false, message: DRIVE_MISSING };
  const settings = await readSettings();
  if (!settings.ok) return settings;
  const root = settings.data.driveRadacina;
  if (!root) return { ok: false, message: NO_ROOT };

  const { data: known, error } = await admin.from("firma_luni_drive").select("*").eq("luna", monthStart(month)).maybeSingle();
  if (error) return failure(error, MIGRATION);
  if (known && known.radacina === root) return { ok: true, data: { id: String(known.folder_id), name: String(known.folder_nume), link: (known.link as string | null) ?? null } };

  const name = monthFolderName(month, settings.data.driveModelLuna);
  try {
    const existing = await findChild(root, name, true);
    const folder = existing ?? (await createFolder(root, name));
    const { error: saveError } = await admin.from("firma_luni_drive").upsert({ luna: monthStart(month), folder_id: folder.id, folder_nume: folder.name || name, link: folder.link, radacina: root }, { onConflict: "luna" });
    if (saveError) return failure(saveError, MIGRATION);
    if (!existing) await logEvent({ actor, zona: "drive", actiune: "folderul lunii creat", tinta: folder.id, rezultat: "ok", mesaj: name });
    return { ok: true, data: { id: folder.id, name: folder.name || name, link: folder.link } };
  } catch (caught) {
    const message = caught instanceof DriveError ? caught.message : "Drive n-a răspuns.";
    await logEvent({ actor, zona: "drive", actiune: "folderul lunii n-a putut fi făcut", rezultat: "eroare", mesaj: `${name}: ${message}` });
    return { ok: false, message };
  }
}

export type FileKind = "factura" | "cheltuiala" | "extras" | "pachet";

export interface SavedFile {
  fileId: string;
  link: string | null;
  /** Era deja pe Drive (urcat înainte sau pus de mână cu același nume). */
  existed: boolean;
}

/** Un fișier în folderul lunii, o singură dată pe (fel, sursă). */
export async function saveToDrive(input: { month: string; kind: FileKind; sourceId: string; name: string; bytes: Buffer; mimeType: string; actor: string }): Promise<Result<SavedFile>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data: known, error } = await admin.from("firma_fisiere").select("drive_file_id, link").eq("felul", input.kind).eq("sursa_id", input.sourceId).maybeSingle();
  if (error) return failure(error, MIGRATION);
  if (known) return { ok: true, data: { fileId: String(known.drive_file_id), link: (known.link as string | null) ?? null, existed: true } };

  const folder = await ensureMonthFolder(input.month, input.actor);
  if (!folder.ok) return folder;
  const safeName = input.name.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 250);
  try {
    const sameName = await findChild(folder.data.id, safeName, false);
    const file = sameName ?? (await uploadFile(folder.data.id, safeName, input.bytes, input.mimeType));
    const { error: saveError } = await admin
      .from("firma_fisiere")
      .insert({ luna: monthStart(input.month), felul: input.kind, sursa_id: input.sourceId, nume: safeName, drive_file_id: file.id, link: file.link, marime: input.bytes.length, created_by: input.actor });
    if (saveError && saveError.code !== "23505") return failure(saveError, MIGRATION);
    return { ok: true, data: { fileId: file.id, link: file.link, existed: Boolean(sameName) } };
  } catch (caught) {
    return { ok: false, message: caught instanceof DriveError ? caught.message : "Drive n-a răspuns." };
  }
}

/** Fișierele urcate într-o lună (pentru pachetul contabilului). */
export async function filesOfMonth(month: string): Promise<Result<{ kind: FileKind; sourceId: string; name: string; fileId: string; link: string | null; size: number | null }[]>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data, error } = await admin.from("firma_fisiere").select("*").eq("luna", monthStart(month)).limit(2000);
  if (error) return failure(error, MIGRATION);
  return {
    ok: true,
    data: (data ?? []).map((row) => ({ kind: row.felul as FileKind, sourceId: String(row.sursa_id), name: String(row.nume), fileId: String(row.drive_file_id), link: (row.link as string | null) ?? null, size: row.marime === null ? null : Number(row.marime) })),
  };
}
