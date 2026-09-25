import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/clients";
import { VIDEO_UPLOAD_MAX_BYTES, VIDEO_UPLOAD_TYPES, type VideoUploadType } from "./constants";

/**
 * Anticamera video-urilor noi: bucket-ul privat `ads-uploads` (migrarea 7).
 *
 * Browserul urcă fișierul aici printr-un URL semnat valabil pentru UN
 * fișier (nu vede nicio cheie cu putere și niciun token Meta); serverul îi
 * dă apoi Meta un link de descărcare semnat, pe termen scurt, și șterge
 * fișierul când Meta spune că video-ul e gata (sau că a eșuat). Ce rămâne
 * în urmă (o urcare abandonată) se curăță la următoarea pregătire: nimic
 * mai vechi de 6 ore.
 *
 * Toate apelurile merg cu service role, DOAR din acțiuni care au verificat
 * deja sesiunea de admin.
 */

export const STAGING_BUCKET = "ads-uploads";

/** Cât trăiește în anticameră un fișier uitat. */
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;
/** Cât trăiește linkul dat lui Meta: destul pentru o descărcare întârziată, mai puțin decât curățenia. */
const DOWNLOAD_LINK_SECONDS = 3 * 60 * 60;

export type StagingResult<T> = { ok: true; data: T } | { ok: false; message: string };

const EXTENSION: Record<VideoUploadType, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

/**
 * Numele din anticameră: spațiul de lucru, momentul și un id aleator. Nu
 * conține numele fișierului omului — ar ajunge în URL-uri și în loguri.
 */
function stagingName(workspaceId: string, type: VideoUploadType): string {
  return `${workspaceId}--${Date.now()}--${randomUUID()}.${EXTENSION[type]}`;
}

/** Un nume venit înapoi din browser e acceptat doar dacă e al spațiului ăsta. */
export function isStagingNameOf(workspaceId: string, name: string): boolean {
  const escaped = workspaceId.replace(/[^a-z0-9-]/g, "");
  return new RegExp(`^${escaped}--\\d{13}--[0-9a-f-]{36}\\.(mp4|mov)$`).test(name);
}

function missingBucket(message: string): boolean {
  return /bucket not found|not found/i.test(message);
}

const NO_BUCKET =
  "Stocarea temporară lipsește: aplică migrarea 7 (supabase/migrations/00000000000007_ads_uploads.sql) în SQL editor.";

/** Șterge urcările uitate. Nu blochează nimic dacă pică. */
async function sweepStale(): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  try {
    const { data } = await supabase.storage
      .from(STAGING_BUCKET)
      .list("", { limit: 100, sortBy: { column: "created_at", order: "asc" } });
    const cutoff = Date.now() - STALE_AFTER_MS;
    const stale = (data ?? [])
      .filter((item) => item.created_at && Date.parse(item.created_at) < cutoff)
      .map((item) => item.name);
    if (stale.length > 0) await supabase.storage.from(STAGING_BUCKET).remove(stale);
  } catch {
    /* curățenia se reîncearcă la următoarea urcare */
  }
}

export function validateUpload(input: { size: number; type: string }): string | null {
  if (!(VIDEO_UPLOAD_TYPES as readonly string[]).includes(input.type)) {
    return "Fișierul trebuie să fie video MP4 sau MOV. Exportă-l ca MP4 (H.264) și încearcă din nou.";
  }
  if (!Number.isFinite(input.size) || input.size <= 0) return "Fișierul e gol.";
  if (input.size > VIDEO_UPLOAD_MAX_BYTES) {
    return `Fișierul are ${Math.ceil(input.size / 1024 / 1024)} MB; portalul primește cel mult ${VIDEO_UPLOAD_MAX_BYTES / 1024 / 1024} MB. Exportă-l mai mic sau urcă-l din Ads Manager și alege-l apoi din bibliotecă.`;
  }
  return null;
}

/** URL-ul semnat pe care browserul urcă fișierul (un singur fișier, fără suprascriere). */
export async function createStagingUpload(
  workspaceId: string,
  file: { size: number; type: string }
): Promise<StagingResult<{ uploadUrl: string; name: string }>> {
  const invalid = validateUpload(file);
  if (invalid) return { ok: false, message: invalid };

  const supabase = createAdminClient();
  if (!supabase) return { ok: false, message: "Supabase nu e configurat pe server." };

  await sweepStale();

  const name = stagingName(workspaceId, file.type as VideoUploadType);
  const { data, error } = await supabase.storage.from(STAGING_BUCKET).createSignedUploadUrl(name);
  if (error || !data) {
    const message = error?.message ?? "";
    return { ok: false, message: missingBucket(message) ? NO_BUCKET : `Stocarea temporară a refuzat: ${message}` };
  }
  return { ok: true, data: { uploadUrl: data.signedUrl, name } };
}

/** Linkul de descărcare pentru Meta, valabil trei ore. */
export async function createStagingDownload(name: string): Promise<StagingResult<{ url: string; size: number | null }>> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, message: "Supabase nu e configurat pe server." };

  const bucket = supabase.storage.from(STAGING_BUCKET);
  const { data: info } = await bucket.info(name).catch(() => ({ data: null }));
  const { data, error } = await bucket.createSignedUrl(name, DOWNLOAD_LINK_SECONDS);
  if (error || !data) {
    const message = error?.message ?? "";
    return {
      ok: false,
      message: /not found/i.test(message)
        ? "Fișierul nu mai e în stocarea temporară (urcarea n-a terminat sau a trecut prea mult timp). Urcă-l din nou."
        : `Stocarea temporară a refuzat linkul de descărcare: ${message}`,
    };
  }
  return { ok: true, data: { url: data.signedUrl, size: typeof info?.size === "number" ? info.size : null } };
}

export async function removeStaged(name: string): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  try {
    await supabase.storage.from(STAGING_BUCKET).remove([name]);
  } catch {
    /* rămâne pentru curățenia de 6 ore */
  }
}
