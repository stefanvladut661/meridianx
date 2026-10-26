import { db, failure, NO_DB, type Result } from "./db";
import { RO_TZ } from "./timp";

/**
 * Setările modulului (`postari_setari`, un rând). Cheile și tokenurile nu stau
 * aici: cheile sunt în Vercel, tokenurile în `postari_conturi`, criptate.
 */
export interface Setari {
  driveFolderId: string | null;
  driveFolderNume: string | null;
  sloturiOre: string[];
  sloturiFus: string;
  plafonInstagram: number;
  plafonTiktok: number;
  distantaMinimaMin: number;
  stocareLimitaMb: number;
  emailAlerte: string | null;
  coadaPornita: boolean;
  coadaMotiv: string | null;
  coadaSchimbataLa: string | null;
  coadaSchimbataDe: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export const DEFAULT_SETARI: Setari = {
  driveFolderId: null,
  driveFolderNume: null,
  sloturiOre: ["12:30", "19:00"],
  sloturiFus: RO_TZ,
  plafonInstagram: 50,
  plafonTiktok: 5,
  distantaMinimaMin: 15,
  stocareLimitaMb: 50,
  emailAlerte: null,
  coadaPornita: true,
  coadaMotiv: null,
  coadaSchimbataLa: null,
  coadaSchimbataDe: null,
  updatedAt: null,
  updatedBy: null,
};

const MIGRATION = "24 (00000000000024_postari_baza.sql)";

export async function readSettings(): Promise<Result<Setari>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data, error } = await admin.from("postari_setari").select("*").eq("id", 1).maybeSingle();
  if (error) return failure(error, MIGRATION);
  if (!data) return { ok: true, data: DEFAULT_SETARI };
  return {
    ok: true,
    data: {
      driveFolderId: (data.drive_folder_id as string | null) ?? null,
      driveFolderNume: (data.drive_folder_nume as string | null) ?? null,
      sloturiOre: Array.isArray(data.sloturi_ore) && data.sloturi_ore.length ? (data.sloturi_ore as string[]) : DEFAULT_SETARI.sloturiOre,
      sloturiFus: (data.sloturi_fus as string | null) ?? RO_TZ,
      plafonInstagram: Number(data.plafon_instagram ?? DEFAULT_SETARI.plafonInstagram),
      plafonTiktok: Number(data.plafon_tiktok ?? DEFAULT_SETARI.plafonTiktok),
      distantaMinimaMin: Number(data.distanta_minima_min ?? DEFAULT_SETARI.distantaMinimaMin),
      stocareLimitaMb: Number(data.stocare_limita_mb ?? DEFAULT_SETARI.stocareLimitaMb),
      emailAlerte: (data.email_alerte as string | null) ?? null,
      coadaPornita: data.coada_pornita !== false,
      coadaMotiv: (data.coada_motiv as string | null) ?? null,
      coadaSchimbataLa: (data.coada_schimbata_la as string | null) ?? null,
      coadaSchimbataDe: (data.coada_schimbata_de as string | null) ?? null,
      updatedAt: (data.updated_at as string | null) ?? null,
      updatedBy: (data.updated_by as string | null) ?? null,
    },
  };
}

export type SettingsPatch = Partial<Pick<Setari, "driveFolderId" | "driveFolderNume" | "sloturiOre" | "sloturiFus" | "plafonInstagram" | "plafonTiktok" | "distantaMinimaMin" | "stocareLimitaMb" | "emailAlerte">>;

export async function updateSettings(patch: SettingsPatch, actor: string): Promise<Result<null>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const row: Record<string, unknown> = { id: 1, updated_by: actor, updated_at: new Date().toISOString() };
  if (patch.driveFolderId !== undefined) row.drive_folder_id = patch.driveFolderId;
  if (patch.driveFolderNume !== undefined) row.drive_folder_nume = patch.driveFolderNume;
  if (patch.sloturiOre !== undefined) row.sloturi_ore = patch.sloturiOre;
  if (patch.sloturiFus !== undefined) row.sloturi_fus = patch.sloturiFus;
  if (patch.plafonInstagram !== undefined) row.plafon_instagram = patch.plafonInstagram;
  if (patch.plafonTiktok !== undefined) row.plafon_tiktok = patch.plafonTiktok;
  if (patch.distantaMinimaMin !== undefined) row.distanta_minima_min = patch.distantaMinimaMin;
  if (patch.stocareLimitaMb !== undefined) row.stocare_limita_mb = patch.stocareLimitaMb;
  if (patch.emailAlerte !== undefined) row.email_alerte = patch.emailAlerte;
  const { error } = await admin.from("postari_setari").upsert(row, { onConflict: "id" });
  if (error) return failure(error, MIGRATION);
  return { ok: true, data: null };
}

/**
 * Pornește sau oprește coada. `onlyIfRunning`: oprirea automată (token expirat)
 * nu suprascrie o oprire făcută de om, cu motivul lui.
 */
export async function setQueueRunning(running: boolean, reason: string | null, actor: string, onlyIfRunning = false): Promise<Result<{ changed: boolean }>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  let query = admin
    .from("postari_setari")
    .update({ coada_pornita: running, coada_motiv: running ? null : reason, coada_schimbata_la: new Date().toISOString(), coada_schimbata_de: actor })
    .eq("id", 1);
  if (onlyIfRunning) query = query.eq("coada_pornita", true);
  const { data, error } = await query.select("id");
  if (error) return failure(error, MIGRATION);
  return { ok: true, data: { changed: (data ?? []).length > 0 } };
}
