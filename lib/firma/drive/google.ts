import { createSign } from "node:crypto";

/**
 * Google Drive API v3 (https://developers.google.com/workspace/drive/api),
 * după documentația oficială:
 *   - token OAuth 2.0: `POST https://oauth2.googleapis.com/token`, fie cu
 *     `grant_type=refresh_token` (OAuth ca utilizator), fie cu
 *     `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer` și un JWT RS256
 *     semnat cu cheia contului de serviciu (scope `…/auth/drive`);
 *   - `files.list` cu `q`, `files.create` (folder: mimeType
 *     `application/vnd.google-apps.folder`), încărcare `uploadType=multipart`
 *     (sub 5 MB) sau `uploadType=resumable` (peste);
 *   - `supportsAllDrives=true` peste tot, ca să meargă și într-un Shared Drive.
 *
 * Două moduri, după ce e pus în Vercel (OAuth are întâietate):
 *   - OAuth ca tine: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET,
 *     GOOGLE_DRIVE_REFRESH_TOKEN — fișierele sunt ale tale (merge în „My Drive”);
 *   - cont de serviciu: GOOGLE_SERVICE_ACCOUNT_JSON (JSON-ul cheii, ca text sau
 *     base64). Un cont de serviciu nu are spațiu propriu: în „My Drive” poate
 *     face foldere, dar nu poate urca fișiere (`storageQuotaExceeded`) — merge
 *     doar într-un Shared Drive (Google Workspace).
 *
 * GOOGLE_DRIVE_API_URL și GOOGLE_OAUTH_TOKEN_URL sunt doar pentru teste.
 */

const API = (process.env.GOOGLE_DRIVE_API_URL ?? "https://www.googleapis.com").replace(/\/$/, "");
const TOKEN_URL = process.env.GOOGLE_OAUTH_TOKEN_URL ?? "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/drive";
const FOLDER = "application/vnd.google-apps.folder";

export type DriveMode = { kind: "oauth" } | { kind: "service"; email: string };

interface ServiceKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function serviceKey(): ServiceKey | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(text) as ServiceKey;
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function driveMode(): DriveMode | null {
  if (process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN) return { kind: "oauth" };
  const key = serviceKey();
  if (key) return { kind: "service", email: key.client_email };
  return null;
}

export const DRIVE_MISSING =
  "Drive nu e legat: pune în Vercel fie GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET și GOOGLE_DRIVE_REFRESH_TOKEN (Drive personal), fie GOOGLE_SERVICE_ACCOUNT_JSON (Shared Drive). Pașii sunt în README, la „Drive”.";

export class DriveError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

let cached: { token: string; expiresAt: number; mode: string } | null = null;

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function accessToken(): Promise<string> {
  const mode = driveMode();
  if (!mode) throw new DriveError(DRIVE_MISSING, 0);
  const modeKey = mode.kind === "oauth" ? "oauth" : `service:${mode.email}`;
  if (cached && cached.mode === modeKey && cached.expiresAt > Date.now() + 60_000) return cached.token;

  let body: URLSearchParams;
  let url = TOKEN_URL;
  if (mode.kind === "oauth") {
    body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN ?? "",
    });
  } else {
    const key = serviceKey() as ServiceKey;
    url = process.env.GOOGLE_OAUTH_TOKEN_URL ?? key.token_uri ?? TOKEN_URL;
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: url, iat: now, exp: now + 3600 }))}`;
    const signature = createSign("RSA-SHA256").update(unsigned).sign(key.private_key);
    body = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${base64url(signature)}` });
  }

  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  } catch {
    throw new DriveError("Google nu răspunde. Reîncearcă peste un minut.", 0);
  }
  const data = (await response.json().catch(() => null)) as { access_token?: string; expires_in?: number; error?: string; error_description?: string } | null;
  if (!response.ok || !data?.access_token) {
    const why = data?.error === "invalid_grant" ? (mode.kind === "oauth" ? "tokenul de reîmprospătare a expirat sau a fost revocat — fă altul (README → Drive)" : "cheia contului de serviciu nu mai e validă") : (data?.error_description ?? data?.error ?? `HTTP ${response.status}`);
    throw new DriveError(`Google a refuzat autentificarea: ${why}.`, response.status);
  }
  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000, mode: modeKey };
  return data.access_token;
}

async function driveFetch(path: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
  const token = await accessToken();
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  } catch {
    throw new DriveError("Google Drive nu răspunde. Reîncearcă peste un minut.", 0);
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: { message?: string; errors?: { reason?: string }[] } } | null;
    const reason = data?.error?.errors?.[0]?.reason ?? "";
    if (reason === "storageQuotaExceeded") {
      throw new DriveError("Drive a refuzat fișierul: contul de serviciu nu are spațiu propriu și nu poate urca în „My Drive”. Mută folderul într-un Shared Drive sau leagă Drive-ul prin OAuth (README → Drive).", 403);
    }
    if (response.status === 404) throw new DriveError("Folderul nu există sau contul legat nu are acces la el. Verifică folderul din Setări și partajarea lui.", 404);
    if (response.status === 403) throw new DriveError(`Drive a refuzat: ${data?.error?.message ?? "fără drept de scriere în folder"}. Dă contului legat acces de editor la folderul rădăcină.`, 403);
    throw new DriveError(`Drive: ${data?.error?.message ?? `HTTP ${response.status}`}`, response.status);
  }
  return response;
}

export interface DriveFile {
  id: string;
  name: string;
  link: string | null;
}

const FIELDS = "id,name,webViewLink";
const toFile = (data: Record<string, unknown>): DriveFile => ({ id: String(data.id), name: String(data.name ?? ""), link: typeof data.webViewLink === "string" ? data.webViewLink : null });
const quote = (value: string) => `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

/** Folderul rădăcină: există, e folder, se pot adăuga lucruri în el? */
export async function checkFolder(id: string): Promise<{ name: string; canAdd: boolean }> {
  const response = await driveFetch(`/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,capabilities(canAddChildren)&supportsAllDrives=true`);
  const data = (await response.json()) as { name?: string; mimeType?: string; capabilities?: { canAddChildren?: boolean } };
  if (data.mimeType !== FOLDER) throw new DriveError("Id-ul din Setări nu e al unui folder.", 400);
  return { name: String(data.name ?? ""), canAdd: data.capabilities?.canAddChildren !== false };
}

/** Un copil al folderului, după nume exact (folder sau fișier). */
export async function findChild(parentId: string, name: string, folderOnly: boolean): Promise<DriveFile | null> {
  const q = [`${quote(parentId)} in parents`, `name = ${quote(name)}`, "trashed = false", folderOnly ? `mimeType = '${FOLDER}'` : null].filter(Boolean).join(" and ");
  const response = await driveFetch(`/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(${FIELDS})&pageSize=10&supportsAllDrives=true&includeItemsFromAllDrives=true`);
  const data = (await response.json()) as { files?: Record<string, unknown>[] };
  const first = data.files?.[0];
  return first ? toFile(first) : null;
}

export async function createFolder(parentId: string, name: string): Promise<DriveFile> {
  const response = await driveFetch(`/drive/v3/files?supportsAllDrives=true&fields=${FIELDS}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER, parents: [parentId] }),
  });
  return toFile((await response.json()) as Record<string, unknown>);
}

/** Mută un fișier din folderul unei luni în altul (`files.update` cu addParents/removeParents). */
export async function moveFile(fileId: string, toParent: string, fromParent: string): Promise<DriveFile> {
  const query = `addParents=${encodeURIComponent(toParent)}&removeParents=${encodeURIComponent(fromParent)}&supportsAllDrives=true&fields=${FIELDS}`;
  const response = await driveFetch(`/drive/v3/files/${encodeURIComponent(fileId)}?${query}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
  return toFile((await response.json()) as Record<string, unknown>);
}

/** Redenumește un fișier (ex. furnizorul unei cheltuieli corectat). */
export async function renameFile(fileId: string, name: string): Promise<DriveFile> {
  const response = await driveFetch(`/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=${FIELDS}`, { method: "PATCH", headers: { "Content-Type": "application/json; charset=UTF-8" }, body: JSON.stringify({ name }) });
  return toFile((await response.json()) as Record<string, unknown>);
}

const SIMPLE_LIMIT = 5 * 1024 * 1024;

/** Urcă un fișier în folder: multipart sub 5 MB, resumable peste. */
export async function uploadFile(parentId: string, name: string, bytes: Buffer, mimeType: string): Promise<DriveFile> {
  const metadata = JSON.stringify({ name, parents: [parentId] });
  if (bytes.length <= SIMPLE_LIMIT) {
    const boundary = `meridian-${Date.now().toString(36)}`;
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
      bytes,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const response = await driveFetch(`/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=${FIELDS}`, {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    return toFile((await response.json()) as Record<string, unknown>);
  }
  const start = await driveFetch(`/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=${FIELDS}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": mimeType, "X-Upload-Content-Length": String(bytes.length) },
    body: metadata,
  });
  const location = start.headers.get("location");
  if (!location) throw new DriveError("Drive n-a dat adresa de încărcare.", 500);
  const token = await accessToken();
  let response: Response;
  try {
    response = await fetch(location, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": mimeType, "Content-Length": String(bytes.length) }, body: new Uint8Array(bytes), signal: AbortSignal.timeout(120_000) });
  } catch {
    throw new DriveError("Încărcarea pe Drive s-a întrerupt. Reîncearcă.", 0);
  }
  if (!response.ok) throw new DriveError(`Drive a refuzat încărcarea (HTTP ${response.status}).`, response.status);
  return toFile((await response.json()) as Record<string, unknown>);
}
