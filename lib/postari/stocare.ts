import { db } from "./db";

/**
 * Copia temporară a clipului pentru Instagram, în bucket-ul privat
 * `postari-temp` (migrarea 27). Instagram ia clipul de la o adresă publică
 * (`video_url`); cu Instagram Login nu există urcare directă la Meta.
 *
 * Urcarea e pe bucăți, prin protocolul TUS al Supabase Storage
 * (supabase.com/docs/guides/storage/uploads/resumable-uploads):
 *   - adresa directă a stocării, `https://<proiect>.storage.supabase.co/storage/v1/upload/resumable`;
 *   - bucăți de exact 6 MB („it must be set to 6MB (for now) do not change it”);
 *   - adresa urcării e valabilă 24 de ore, iar o urcare întreruptă se reia de la
 *     octetul confirmat (HEAD → `Upload-Offset`).
 * Numele din bucket e id-ul postării, nu numele clipului (nu ajunge în linkuri).
 */

export const TEMP_BUCKET = "postari-temp";
export const TUS_CHUNK = 6 * 1024 * 1024;
/** Cât trăiește linkul dat lui Instagram: destul pentru descărcare și procesare. */
const SIGNED_URL_SECONDS = 2 * 60 * 60;

export const tempPath = (postId: string) => `${postId}.mp4`;

export class StorageError extends Error {
  constructor(
    message: string,
    readonly transient: boolean
  ) {
    super(message);
  }
}

function credentials(): { base: string; key: string } {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new StorageError("Supabase nu e configurat (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).", false);
  return { base, key };
}

/** Adresa TUS: pe Supabase, hostname-ul direct al stocării; altfel (teste, self-hosted) adresa proiectului. */
export function tusEndpoint(base: string): string {
  const match = base.match(/^https:\/\/([a-z0-9]+)\.supabase\.co$/i);
  return match ? `https://${match[1]}.storage.supabase.co/storage/v1/upload/resumable` : `${base}/storage/v1/upload/resumable`;
}

const b64 = (value: string) => Buffer.from(value, "utf8").toString("base64");

function headers(key: string, extra: Record<string, string> = {}): Record<string, string> {
  return { "Tus-Resumable": "1.0.0", authorization: `Bearer ${key}`, apikey: key, ...extra };
}

async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new StorageError("Stocarea Supabase n-a răspuns. Se reîncearcă.", true);
  }
}

function statusError(status: number, what: string): StorageError {
  if (status === 413) return new StorageError(`Stocarea temporară a refuzat clipul ca prea mare (${what}). Limita e la Setări → „Limita stocării temporare” și în bucket-ul postari-temp.`, false);
  if (status === 401 || status === 403) return new StorageError(`Stocarea temporară a refuzat cheia (${what}): verifică SUPABASE_SERVICE_ROLE_KEY în Vercel.`, false);
  if (status === 404 && what === "creare") return new StorageError("Bucket-ul postari-temp lipsește: rulează migrarea 27 în Supabase → SQL Editor.", false);
  return new StorageError(`Stocarea temporară a răspuns ${status} la ${what}. Se reîncearcă.`, status >= 500 || status === 409 || status === 429);
}

/** Pornește o urcare TUS nouă; întoarce adresa ei. */
async function createUpload(path: string, length: number): Promise<string> {
  const { base, key } = credentials();
  const endpoint = tusEndpoint(base);
  const response = await request(endpoint, {
    method: "POST",
    headers: headers(key, {
      "Upload-Length": String(length),
      "Upload-Metadata": [`bucketName ${b64(TEMP_BUCKET)}`, `objectName ${b64(path)}`, `contentType ${b64("video/mp4")}`, `cacheControl ${b64("3600")}`].join(","),
      "x-upsert": "true",
    }),
  });
  if (response.status !== 201) throw statusError(response.status, "creare");
  const location = response.headers.get("location");
  if (!location) throw new StorageError("Stocarea n-a dat adresa urcării. Se reîncearcă.", true);
  return new URL(location, endpoint).toString();
}

/** Câți octeți a confirmat stocarea; `null` = urcarea nu mai există (expirată, ștearsă). */
async function uploadOffset(uploadUrl: string): Promise<number | null> {
  const { key } = credentials();
  const response = await request(uploadUrl, { method: "HEAD", headers: headers(key) });
  if (response.status === 404 || response.status === 410 || response.status === 403) return null;
  if (!response.ok) throw statusError(response.status, "verificarea urcării");
  const offset = Number(response.headers.get("upload-offset"));
  return Number.isFinite(offset) ? offset : null;
}

export interface UploadProgress {
  uploadUrl: string;
  offset: number;
  done: boolean;
}

/**
 * Urcă clipul (sau restul lui) cât ține timpul. `onChunk` primește progresul
 * după fiecare bucată confirmată, ca să fie scris în rând: o rulare întreruptă
 * reia de acolo.
 */
export async function uploadResumable(input: { path: string; bytes: Buffer; uploadUrl: string | null; deadline: number; onChunk: (progress: UploadProgress) => Promise<boolean> }): Promise<UploadProgress> {
  const { key } = credentials();
  const total = input.bytes.length;
  let uploadUrl = input.uploadUrl;
  let offset = uploadUrl ? await uploadOffset(uploadUrl) : null;
  if (uploadUrl === null || offset === null) {
    uploadUrl = await createUpload(input.path, total);
    offset = 0;
    if (!(await input.onChunk({ uploadUrl, offset, done: false }))) return { uploadUrl, offset, done: false };
  }
  while (offset < total) {
    if (Date.now() > input.deadline - 10_000) return { uploadUrl, offset, done: false };
    const chunk = input.bytes.subarray(offset, Math.min(offset + TUS_CHUNK, total));
    const response = await request(uploadUrl, {
      method: "PATCH",
      headers: headers(key, { "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" }),
      body: new Uint8Array(chunk),
    });
    if (response.status === 409) {
      // Offsetul nostru nu mai e al stocării (o bucată confirmată, dar nescrisă în rând): citim din nou unde e.
      const actual = await uploadOffset(uploadUrl);
      if (actual === null) throw new StorageError("Urcarea temporară a expirat. Se reia de la început.", true);
      offset = actual;
      continue;
    }
    if (response.status !== 204) throw statusError(response.status, "urcare");
    const next = Number(response.headers.get("upload-offset"));
    offset = Number.isFinite(next) && next > offset ? next : offset + chunk.length;
    const keep = await input.onChunk({ uploadUrl, offset, done: offset >= total });
    if (!keep) return { uploadUrl, offset, done: offset >= total };
  }
  return { uploadUrl, offset, done: true };
}

/** Linkul semnat, valabil 2 ore, pe care îl primește Instagram. */
export async function signedUrl(path: string): Promise<string> {
  const admin = db();
  if (!admin) throw new StorageError("Supabase nu e configurat.", false);
  const { data, error } = await admin.storage.from(TEMP_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) throw new StorageError(`Stocarea n-a dat linkul semnat: ${error?.message ?? "fără răspuns"}. Se reîncearcă.`, true);
  return data.signedUrl;
}

/** Șterge copia temporară. `true` = ștearsă sau deja lipsă. */
export async function removeTemp(path: string): Promise<boolean> {
  const admin = db();
  if (!admin) return false;
  const { error } = await admin.storage.from(TEMP_BUCKET).remove([path]);
  return !error;
}
