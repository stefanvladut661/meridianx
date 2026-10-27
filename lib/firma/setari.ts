import { db, failure, NO_DB, type Result } from "./db";

/**
 * Setările modulului (`firma_setari`, un rând). Ce ține de chei (Oblio,
 * Google) nu stă aici, ci în Vercel.
 */
export interface Setari {
  serieFactura: string | null;
  emailContabil: string | null;
  driveRadacina: string | null;
  driveModelLuna: string;
  /** Unde pleacă rezumatul de dimineață (doar în zilele cu alerte). Migrarea 23. */
  emailRezumat: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export const DEFAULT_SETARI: Setari = { serieFactura: null, emailContabil: null, driveRadacina: null, driveModelLuna: "{luna} {an}", emailRezumat: null, updatedAt: null, updatedBy: null };

export async function readSettings(): Promise<Result<Setari>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const { data, error } = await admin.from("firma_setari").select("*").eq("id", 1).maybeSingle();
  if (error) return failure(error, "16 (00000000000016_firma_baza.sql)");
  if (!data) return { ok: true, data: DEFAULT_SETARI };
  return {
    ok: true,
    data: {
      serieFactura: (data.serie_factura as string | null) ?? null,
      emailContabil: (data.email_contabil as string | null) ?? null,
      driveRadacina: (data.drive_radacina as string | null) ?? null,
      driveModelLuna: (data.drive_model_luna as string | null) ?? DEFAULT_SETARI.driveModelLuna,
      emailRezumat: (data.email_rezumat as string | null | undefined) ?? null,
      updatedAt: (data.updated_at as string | null) ?? null,
      updatedBy: (data.updated_by as string | null) ?? null,
    },
  };
}

export async function updateSettings(patch: Partial<Pick<Setari, "serieFactura" | "emailContabil" | "driveRadacina" | "driveModelLuna" | "emailRezumat">>, actor: string): Promise<Result<null>> {
  const admin = db();
  if (!admin) return { ok: false, message: NO_DB };
  const row: Record<string, unknown> = { id: 1, updated_by: actor };
  if (patch.serieFactura !== undefined) row.serie_factura = patch.serieFactura;
  if (patch.emailContabil !== undefined) row.email_contabil = patch.emailContabil;
  if (patch.driveRadacina !== undefined) row.drive_radacina = patch.driveRadacina;
  if (patch.driveModelLuna !== undefined) row.drive_model_luna = patch.driveModelLuna;
  if (patch.emailRezumat !== undefined) row.email_rezumat = patch.emailRezumat;
  const { error } = await admin.from("firma_setari").upsert(row, { onConflict: "id" });
  if (error) return failure(error, "16 (00000000000016_firma_baza.sql)");
  return { ok: true, data: null };
}
