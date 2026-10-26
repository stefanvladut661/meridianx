import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/clients";
import type { Result } from "./db";

/**
 * Fișierele urcate în admin (bucket-ul privat `firma-docs`, migrarea 19):
 * bonurile și facturile de la furnizori, extrasele de cont, zip-ul lunii.
 * Browserul urcă direct în stocare, printr-un link semnat (un fișier de câțiva
 * MB nu trece prin acțiunile serverului); serverul citește apoi fișierul de acolo.
 */

export const BUCKET = "firma-docs";
const NO_BUCKET = "Stocarea modulului lipsește: rulează migrarea 19 (bucket-ul `firma-docs`) în Supabase → SQL Editor.";

export type StorageArea = "cheltuieli" | "extrase" | "pachete";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
  "text/csv": "csv",
  "text/plain": "txt",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/zip": "zip",
};

export function isAllowedType(type: string, area: StorageArea): boolean {
  if (area === "cheltuieli") return ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"].includes(type);
  if (area === "extrase") return ["text/csv", "text/plain", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/pdf"].includes(type);
  return type === "application/zip";
}

export function isAreaPath(path: string, area: StorageArea): boolean {
  return new RegExp(`^${area}/[0-9a-f-]{36}\\.[a-z]{3,4}$`).test(path);
}

const missing = (message: string) => /bucket not found|not found/i.test(message);

/** Un loc nou în stocare și linkul semnat cu care browserul urcă fișierul. */
export async function createUpload(area: StorageArea, type: string): Promise<Result<{ path: string; uploadUrl: string }>> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, message: "Supabase nu e configurat pe server." };
  const path = `${area}/${randomUUID()}.${EXTENSIONS[type] ?? "bin"}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, message: missing(error?.message ?? "") ? NO_BUCKET : `Stocarea a refuzat urcarea: ${error?.message ?? "fără motiv"}` };
  return { ok: true, data: { path, uploadUrl: data.signedUrl } };
}

/** Pune direct din server (zip-ul lunii). */
export async function putObject(path: string, bytes: Buffer, type: string): Promise<Result<null>> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, message: "Supabase nu e configurat pe server." };
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: true });
  if (error) return { ok: false, message: missing(error.message) ? NO_BUCKET : `Stocarea a refuzat fișierul: ${error.message}` };
  return { ok: true, data: null };
}

export async function downloadObject(path: string): Promise<Buffer | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/** Link de citire, semnat, valabil o oră (previzualizarea din admin). */
export async function signedLink(path: string, seconds = 3600): Promise<string | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}
