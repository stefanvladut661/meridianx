/**
 * TikTok — doar trimiterea în ciorne (Content Posting API, „Upload”, scope
 * `video.upload`) și conectarea contului (Login Kit for Web). Formatul e cel
 * din documentația oficială (developers.tiktok.com):
 *
 *   GET  www.tiktok.com/v2/auth/authorize/?client_key&scope&response_type=code&redirect_uri&state
 *   POST /v2/oauth/token/  (form)  grant_type=authorization_code | refresh_token
 *        → { access_token, expires_in, open_id, refresh_expires_in, refresh_token, scope, token_type }
 *   POST /v2/oauth/revoke/ (form)  → {}
 *   GET  /v2/user/info/?fields=open_id,display_name,avatar_url → { data: { user }, error: { code: "ok" } }
 *   POST /v2/post/publish/inbox/video/init/ { source_info: { source: "FILE_UPLOAD", video_size, chunk_size, total_chunk_count } }
 *        → { data: { publish_id, upload_url }, error }
 *   PUT  <upload_url>  Content-Range: bytes a-b/total → 206 (mai sunt bucăți) / 201 (toate)
 *   POST /v2/post/publish/status/fetch/ { publish_id }
 *        → { data: { status, fail_reason, publicaly_available_post_id, uploaded_bytes } }
 *
 * Ciornele primesc doar clipul: `inbox/video/init` n-are câmp de titlu sau
 * descriere (doar postarea directă are `post_info`). Descrierea o copiezi din
 * „De publicat pe TikTok”. Nu există aici postare directă, ștergere sau editare.
 *
 * POSTARI_TIKTOK_API_URL și POSTARI_TIKTOK_AUTH_URL (opționale) sunt doar pentru teste.
 */

import { SITE_URL } from "@/lib/site-url";
import { chunkPlan, chunkRange, contentRange } from "./tiktok-chunks";

const API =() => (process.env.POSTARI_TIKTOK_API_URL ?? "https://open.tiktokapis.com").replace(/\/$/, "");
const AUTH = () => (process.env.POSTARI_TIKTOK_AUTH_URL ?? "https://www.tiktok.com").replace(/\/$/, "");
export const TIKTOK_SCOPES = ["user.info.basic", "video.upload"];

export const TIKTOK_MISSING = "TikTok nu e configurat: lipsesc TIKTOK_CLIENT_KEY și TIKTOK_CLIENT_SECRET în Vercel (aplicația de dezvoltator TikTok). Pașii sunt în README, la „TikTok”.";

export function tiktokConfigured(): boolean {
  return Boolean(process.env.TIKTOK_CLIENT_KEY?.trim() && process.env.TIKTOK_CLIENT_SECRET?.trim());
}

/** Adresa de întoarcere din TikTok: statică, înregistrată în aplicația de dezvoltator. */
export function redirectUri(): string {
  return process.env.TIKTOK_REDIRECT_URI?.trim() || `${SITE_URL}/admin/postari/conturi/tiktok/callback`;
}

export class TtError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
    readonly noResponse = false
  ) {
    super(message);
  }
}

type Json = Record<string, unknown>;

async function send(url: string, init: RequestInit, timeoutMs = 25_000): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new TtError("TikTok n-a răspuns (rețea sau timp depășit).", 0, null, true);
  }
}

async function readJson(response: Response): Promise<Json> {
  try {
    return (await response.json()) as Json;
  } catch {
    return {};
  }
}

/** Răspunsurile API-ului de conținut: `error.code` = "ok" înseamnă reușită. */
async function api(method: "GET" | "POST", path: string, token: string, body?: Json): Promise<Json> {
  const response = await send(`${API()}${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json; charset=UTF-8" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await readJson(response);
  const error = (data.error ?? {}) as Json;
  const code = typeof error.code === "string" ? error.code : null;
  if (!response.ok || (code && code !== "ok")) throw new TtError(String(error.message || `TikTok a răspuns ${response.status}.`), response.status, code ?? (response.status >= 500 ? "internal_error" : null));
  return (data.data ?? {}) as Json;
}

/** Endpoint-urile OAuth: corp `application/x-www-form-urlencoded`, eroare ca `{ error, error_description }`. */
async function oauth(path: string, form: Record<string, string>): Promise<Json> {
  const response = await send(`${API()}${path}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" }, body: new URLSearchParams(form).toString() });
  const data = await readJson(response);
  if (!response.ok || typeof data.error === "string") throw new TtError(String(data.error_description || data.error || `TikTok a răspuns ${response.status}.`), response.status, typeof data.error === "string" ? data.error : null);
  return data;
}

export function authorizeUrl(state: string): string {
  const url = new URL(`${AUTH()}/v2/auth/authorize/`);
  url.searchParams.set("client_key", process.env.TIKTOK_CLIENT_KEY?.trim() ?? "");
  url.searchParams.set("scope", TIKTOK_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

export interface TtTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
  openId: string;
  scope: string;
}

function toTokens(data: Json): TtTokens {
  if (typeof data.access_token !== "string" || typeof data.refresh_token !== "string") throw new TtError("TikTok n-a dat tokenurile.", 200, null);
  return {
    accessToken: data.access_token,
    expiresIn: Number(data.expires_in ?? 86400),
    refreshToken: data.refresh_token,
    refreshExpiresIn: Number(data.refresh_expires_in ?? 31536000),
    openId: String(data.open_id ?? ""),
    scope: String(data.scope ?? ""),
  };
}

export async function exchangeCode(code: string): Promise<TtTokens> {
  return toTokens(await oauth("/v2/oauth/token/", { client_key: process.env.TIKTOK_CLIENT_KEY?.trim() ?? "", client_secret: process.env.TIKTOK_CLIENT_SECRET?.trim() ?? "", code, grant_type: "authorization_code", redirect_uri: redirectUri() }));
}

/** „The returned refresh_token may be different than the one passed in the payload”: se salvează cel nou. */
export async function refreshTokens(refreshToken: string): Promise<TtTokens> {
  return toTokens(await oauth("/v2/oauth/token/", { client_key: process.env.TIKTOK_CLIENT_KEY?.trim() ?? "", client_secret: process.env.TIKTOK_CLIENT_SECRET?.trim() ?? "", grant_type: "refresh_token", refresh_token: refreshToken }));
}

export async function revokeToken(token: string): Promise<void> {
  await oauth("/v2/oauth/revoke/", { client_key: process.env.TIKTOK_CLIENT_KEY?.trim() ?? "", client_secret: process.env.TIKTOK_CLIENT_SECRET?.trim() ?? "", token });
}

export async function userInfo(token: string): Promise<{ openId: string; displayName: string | null }> {
  const data = await api("GET", "/v2/user/info/?fields=open_id,display_name,avatar_url", token);
  const user = (data.user ?? {}) as Json;
  return { openId: String(user.open_id ?? ""), displayName: typeof user.display_name === "string" ? user.display_name : null };
}

// Regulile bucăților stau în ./tiktok-chunks (fișier pur, cu test); handlerul le importă tot de aici.
export { chunkPlan, chunkRange };

export async function initInbox(token: string, size: number): Promise<{ publishId: string; uploadUrl: string; chunkSize: number; total: number }> {
  const plan = chunkPlan(size);
  const data = await api("POST", "/v2/post/publish/inbox/video/init/", token, { source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: plan.chunkSize, total_chunk_count: plan.total } });
  if (typeof data.publish_id !== "string" || typeof data.upload_url !== "string") throw new TtError("TikTok n-a dat adresa de urcare.", 200, null);
  return { publishId: data.publish_id, uploadUrl: data.upload_url, ...plan };
}

/** O bucată, în ordine. `true` = TikTok are tot clipul (201). */
export async function uploadChunk(uploadUrl: string, bytes: Buffer, range: { start: number; end: number }): Promise<boolean> {
  const chunk = bytes.subarray(range.start, range.end + 1);
  const response = await send(uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4", "Content-Length": String(chunk.length), "Content-Range": contentRange(range, bytes.length) }, body: new Uint8Array(chunk) }, 60_000);
  if (response.status === 201) return true;
  if (response.status === 206) return false;
  const code = response.status === 403 ? "upload_url_expired" : response.status === 416 ? "range_mismatch" : response.status === 404 ? "upload_not_found" : response.status >= 500 ? "internal_error" : "upload_rejected";
  throw new TtError(`TikTok a răspuns ${response.status} la urcarea bucății.`, response.status, code);
}

export interface TtStatus {
  status: string;
  failReason: string | null;
  postIds: string[];
  uploadedBytes: number | null;
}

export async function fetchStatus(token: string, publishId: string): Promise<TtStatus> {
  const data = await api("POST", "/v2/post/publish/status/fetch/", token, { publish_id: publishId });
  return {
    status: String(data.status ?? ""),
    failReason: typeof data.fail_reason === "string" && data.fail_reason ? data.fail_reason : null,
    postIds: Array.isArray(data.publicaly_available_post_id) ? (data.publicaly_available_post_id as unknown[]).map(String) : [],
    uploadedBytes: typeof data.uploaded_bytes === "number" ? data.uploaded_bytes : null,
  };
}

// ---------------------------------------------------------------------------
// Ce înseamnă o eroare pentru coadă
// ---------------------------------------------------------------------------

export type TtVerdict =
  | { kind: "token"; message: string }
  | { kind: "account"; message: string }
  | { kind: "limit"; message: string; ms: number }
  | { kind: "permanent"; message: string }
  /** `restart`: trimiterea de acum nu mai e bună (adresă expirată, ordine pierdută); se pornește alta. */
  | { kind: "transient"; message: string; restart: boolean };

const FAIL_REASON: Record<string, TtVerdict> = {
  file_format_check_failed: { kind: "permanent", message: "TikTok nu primește formatul clipului. Exportă-l MP4, H.264, după cerințele din README." },
  duration_check_failed: { kind: "permanent", message: "TikTok nu primește durata clipului (prin API, cel mult 10 minute)." },
  frame_rate_check_failed: { kind: "permanent", message: "TikTok nu primește cadrele pe secundă ale clipului (între 23 și 60)." },
  picture_size_check_failed: { kind: "permanent", message: "TikTok nu primește dimensiunile clipului (între 360 și 4096 px pe latură)." },
  internal: { kind: "transient", message: "Eroare internă la TikTok. Se reîncearcă, cu o trimitere nouă.", restart: true },
  publish_cancelled: { kind: "permanent", message: "Trimiterea a fost anulată în TikTok." },
  auth_removed: { kind: "token", message: "Accesul adminului la contul TikTok a fost scos (din aplicația TikTok). Coada s-a oprit: conectează TikTok din nou, în Setări → Conturi." },
  spam_risk_too_many_posts: { kind: "limit", message: "TikTok spune că s-au trimis prea multe clipuri azi. Clipul așteaptă.", ms: 6 * 60 * 60_000 },
  spam_risk_user_banned_from_posting: { kind: "account", message: "TikTok a blocat publicarea pentru cont. Coada s-a oprit; verifică notificările din aplicația TikTok." },
  spam_risk_text: { kind: "account", message: "TikTok a marcat trimiterea ca posibil spam. Coada s-a oprit, ca să nu insiste." },
  spam_risk: { kind: "account", message: "TikTok a marcat trimiterea ca posibil spam. Coada s-a oprit, ca să nu insiste." },
};

export function failReasonVerdict(reason: string | null): TtVerdict {
  return (reason && FAIL_REASON[reason]) || { kind: "transient", message: `TikTok n-a putut procesa clipul${reason ? ` (${reason})` : ""}. Se reîncearcă, cu o trimitere nouă.`, restart: true };
}

export function verdict(error: unknown): TtVerdict {
  if (!(error instanceof TtError)) return { kind: "transient", message: "Eroare neașteptată la TikTok. Se reîncearcă.", restart: false };
  switch (error.code) {
    case "access_token_invalid":
    case "invalid_grant":
      return { kind: "token", message: "Tokenul TikTok nu mai e bun și nu s-a putut reînnoi. Coada s-a oprit: conectează TikTok din nou, în Setări → Conturi." };
    case "scope_not_authorized":
    case "scope_permission_missed":
      return { kind: "token", message: "Contul TikTok n-a dat permisiunea de urcare (video.upload). Coada s-a oprit: conectează TikTok din nou și bifează permisiunea." };
    case "spam_risk_too_many_pending_share":
      return { kind: "limit", message: "TikTok primește cel mult 5 ciorne nepublicate în 24 de ore. Publică sau șterge ciornele din aplicație; clipul așteaptă.", ms: 60 * 60_000 };
    case "spam_risk_user_banned_from_posting":
      return FAIL_REASON.spam_risk_user_banned_from_posting;
    case "rate_limit_exceeded":
      return { kind: "limit", message: "TikTok a limitat cererile pentru câteva minute. Clipul așteaptă.", ms: 5 * 60_000 };
    case "upload_url_expired":
    case "range_mismatch":
    case "upload_not_found":
      return { kind: "transient", message: "Trimiterea la TikTok s-a întrerupt (adresa de urcare a expirat sau s-a pierdut ordinea bucăților). Se pornește o trimitere nouă.", restart: true };
    case "invalid_param":
    case "invalid_params":
    case "invalid_file_upload":
    case "upload_rejected":
      return { kind: "permanent", message: `TikTok a refuzat trimiterea: ${error.message.slice(0, 300)}` };
    case "invalid_publish_id":
    case "token_not_authorized_for_specified_publish_id":
      return { kind: "transient", message: "TikTok nu mai recunoaște trimiterea. Se pornește una nouă.", restart: true };
    default:
      return { kind: "transient", message: error.status === 0 ? "TikTok n-a răspuns. Se reîncearcă." : `TikTok a răspuns ${error.status}${error.code ? ` (${error.code})` : ""}. Se reîncearcă.`, restart: false };
  }
}
