/**
 * Instagram API with Instagram Login (graph.instagram.com), doar ce trebuie
 * pentru a publica Reels pe contul propriu. Formatul cererilor și al
 * răspunsurilor e cel din documentația oficială
 * (developers.facebook.com/docs/instagram-platform/…):
 *
 *   GET  /v26.0/me?fields=user_id,username                → { user_id, username } (uneori în data[0])
 *   GET  /refresh_access_token?grant_type=ig_refresh_token → { access_token, token_type, expires_in }
 *   POST /v26.0/<IG_ID>/media  { media_type: "REELS", video_url, caption, share_to_feed, thumb_offset, trial_params } → { id }
 *   GET  /v26.0/<CONTAINER_ID>?fields=status_code,status    → { status_code: EXPIRED|ERROR|FINISHED|IN_PROGRESS|PUBLISHED, status }
 *   POST /v26.0/<IG_ID>/media_publish { creation_id }       → { id }
 *   GET  /v26.0/<MEDIA_ID>?fields=permalink,timestamp,media_product_type
 *   GET  /v26.0/<IG_ID>/media?fields=…                      → { data: [ … ] }
 *   GET  /v26.0/<IG_ID>/content_publishing_limit?fields=quota_usage,config → { data: [{ quota_usage, config: { quota_total, quota_duration } }] }
 *
 * Nu există aici nicio funcție de ștergere sau de editare a unei postări:
 * postările publicate le gestionezi tu, în aplicație.
 *
 * POSTARI_INSTAGRAM_API_URL (opțional) e doar pentru testele cu un Instagram simulat.
 */

export const IG_VERSION = "v26.0";
const BASE = () => (process.env.POSTARI_INSTAGRAM_API_URL ?? "https://graph.instagram.com").replace(/\/$/, "");

export class IgError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: number | null,
    readonly subcode: number | null,
    readonly transient: boolean,
    /** Răspunsul nu a venit deloc (rețea, timeout): nu se știe dacă cererea a avut efect. */
    readonly noResponse = false
  ) {
    super(message);
  }
}

type Json = Record<string, unknown>;

async function call(method: "GET" | "POST", path: string, token: string, input: { query?: Record<string, string>; body?: Json; versioned?: boolean } = {}): Promise<Json> {
  const url = new URL(`${BASE()}${input.versioned === false ? "" : `/${IG_VERSION}`}${path}`);
  for (const [key, value] of Object.entries(input.query ?? {})) url.searchParams.set(key, value);
  url.searchParams.set("access_token", token);
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: input.body ? { "Content-Type": "application/json" } : undefined,
      body: input.body ? JSON.stringify(input.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new IgError("Instagram n-a răspuns (rețea sau timp depășit).", 0, null, null, true, true);
  }
  let data: Json = {};
  try {
    data = (await response.json()) as Json;
  } catch {
    data = {};
  }
  if (!response.ok || data.error) {
    const error = (data.error ?? {}) as Json;
    const code = typeof error.code === "number" ? error.code : null;
    const subcode = typeof error.error_subcode === "number" ? error.error_subcode : null;
    const message = String(error.error_user_msg ?? error.message ?? `Instagram a răspuns ${response.status}.`);
    throw new IgError(message, response.status, code, subcode, error.is_transient === true || response.status >= 500);
  }
  return data;
}

export async function getMe(token: string): Promise<{ userId: string; username: string | null }> {
  const data = await call("GET", "/me", token, { query: { fields: "user_id,username" } });
  // Documentația arată răspunsul în `data[0]`; referința contului îl arată plat. Le primim pe amândouă.
  const row = (Array.isArray(data.data) ? (data.data[0] as Json | undefined) : data) ?? {};
  const userId = row.user_id ?? row.id;
  if (typeof userId !== "string" && typeof userId !== "number") throw new IgError("Instagram n-a dat id-ul contului (user_id).", 200, null, null, false);
  return { userId: String(userId), username: typeof row.username === "string" ? row.username : null };
}

export async function refreshToken(token: string): Promise<{ token: string; expiresIn: number | null }> {
  const data = await call("GET", "/refresh_access_token", token, { query: { grant_type: "ig_refresh_token" }, versioned: false });
  if (typeof data.access_token !== "string") throw new IgError("Instagram n-a dat tokenul reînnoit.", 200, null, null, true);
  return { token: data.access_token, expiresIn: typeof data.expires_in === "number" ? data.expires_in : null };
}

export interface ReelInput {
  videoUrl: string;
  caption: string;
  /** Doar la Reel: apare și în feed. */
  shareToFeed: boolean | null;
  thumbOffsetMs: number | null;
  /** Trial Reel: MANUAL (îl treci tu la urmăritori) sau SS_PERFORMANCE (trece singur dacă merge bine). */
  trial: "MANUAL" | "SS_PERFORMANCE" | null;
}

export async function createReelContainer(igId: string, token: string, input: ReelInput): Promise<string> {
  const body: Json = { media_type: "REELS", video_url: input.videoUrl, caption: input.caption };
  if (input.trial) body.trial_params = { graduation_strategy: input.trial };
  else if (input.shareToFeed !== null) body.share_to_feed = input.shareToFeed;
  if (input.thumbOffsetMs !== null) body.thumb_offset = input.thumbOffsetMs;
  const data = await call("POST", `/${encodeURIComponent(igId)}/media`, token, { body });
  if (typeof data.id !== "string" && typeof data.id !== "number") throw new IgError("Instagram n-a dat id-ul containerului.", 200, null, null, true);
  return String(data.id);
}

export type ContainerStatus = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";

export async function containerStatus(containerId: string, token: string): Promise<{ statusCode: ContainerStatus | string; status: string | null }> {
  const data = await call("GET", `/${encodeURIComponent(containerId)}`, token, { query: { fields: "status_code,status" } });
  return { statusCode: String(data.status_code ?? ""), status: typeof data.status === "string" ? data.status : null };
}

export async function publishContainer(igId: string, token: string, containerId: string): Promise<{ mediaId: string; configIssue: string | null }> {
  const data = await call("POST", `/${encodeURIComponent(igId)}/media_publish`, token, { body: { creation_id: containerId } });
  if (typeof data.id !== "string" && typeof data.id !== "number") throw new IgError("Instagram n-a dat id-ul postării publicate.", 200, null, null, false, true);
  const issue = data.config_issue;
  return { mediaId: String(data.id), configIssue: issue ? (typeof issue === "string" ? issue : JSON.stringify(issue)).slice(0, 200) : null };
}

export async function mediaInfo(mediaId: string, token: string): Promise<{ permalink: string | null; timestamp: string | null }> {
  const data = await call("GET", `/${encodeURIComponent(mediaId)}`, token, { query: { fields: "permalink,timestamp,media_product_type" } });
  return { permalink: typeof data.permalink === "string" ? data.permalink : null, timestamp: typeof data.timestamp === "string" ? data.timestamp : null };
}

export async function recentReels(igId: string, token: string): Promise<{ id: string; permalink: string | null; timestamp: string | null; productType: string | null }[]> {
  const data = await call("GET", `/${encodeURIComponent(igId)}/media`, token, { query: { fields: "id,permalink,timestamp,media_product_type", limit: "10" } });
  const list = Array.isArray(data.data) ? (data.data as Json[]) : [];
  return list.map((item) => ({ id: String(item.id), permalink: typeof item.permalink === "string" ? item.permalink : null, timestamp: typeof item.timestamp === "string" ? item.timestamp : null, productType: typeof item.media_product_type === "string" ? item.media_product_type : null }));
}

export async function publishingLimit(igId: string, token: string): Promise<{ used: number; total: number | null }> {
  const data = await call("GET", `/${encodeURIComponent(igId)}/content_publishing_limit`, token, { query: { fields: "quota_usage,config" } });
  const row = (Array.isArray(data.data) ? (data.data[0] as Json | undefined) : data) ?? {};
  const config = (row.config ?? {}) as Json;
  return { used: Number(row.quota_usage ?? 0), total: typeof config.quota_total === "number" ? config.quota_total : null };
}

// ---------------------------------------------------------------------------
// Ce înseamnă o eroare pentru coadă
// ---------------------------------------------------------------------------

export type IgVerdict =
  /** Tokenul nu mai e bun: coada se oprește, contul trebuie reconectat. */
  | { kind: "token"; message: string }
  /** Contul nu poate publica acum (restricționat, posibil spam): coada se oprește. */
  | { kind: "account"; message: string }
  /** Limita de cereri sau plafonul de postări: se așteaptă, fără încercare consumată. */
  | { kind: "limit"; message: string; ms: number }
  /** Clipul sau descrierea nu sunt primite: nu are rost să reîncerce. */
  | { kind: "permanent"; message: string }
  /** Trecătoare; `newContainer`: containerul de acum nu mai e bun, se face altul. */
  | { kind: "transient"; message: string; newContainer: boolean }
  /** Clipul încă se procesează. */
  | { kind: "not_ready"; message: string };

const SUBCODE: Record<number, IgVerdict> = {
  2207003: { kind: "transient", message: "Instagram a descărcat clipul prea încet. Se reîncearcă, cu un container nou.", newContainer: true },
  2207020: { kind: "transient", message: "Containerul Instagram a expirat. Se face altul.", newContainer: true },
  2207001: { kind: "transient", message: "Eroare de server la Instagram. Se reîncearcă.", newContainer: false },
  2207032: { kind: "transient", message: "Instagram n-a putut crea postarea. Se reîncearcă, cu un container nou.", newContainer: true },
  2207053: { kind: "transient", message: "Eroare necunoscută la urcarea în Instagram. Se reîncearcă, cu un container nou.", newContainer: true },
  2207052: { kind: "transient", message: "Instagram n-a putut lua clipul de la linkul temporar. Se reîncearcă, cu un link nou.", newContainer: true },
  2207008: { kind: "transient", message: "Containerul Instagram nu mai există sau a expirat. Se face altul.", newContainer: true },
  2207006: { kind: "transient", message: "Instagram nu găsește postarea (permisiune sau token expirat). Se reîncearcă.", newContainer: true },
  2207027: { kind: "not_ready", message: "Instagram încă procesează clipul." },
  2207042: { kind: "limit", message: "Instagram spune că ai atins numărul maxim de postări prin API în 24 de ore. Postarea așteaptă.", ms: 60 * 60_000 },
  2207051: { kind: "account", message: "Instagram a marcat postarea ca posibil spam. Coada s-a oprit, ca să nu insiste; verifică contul în aplicație înainte s-o pornești." },
  2207050: { kind: "account", message: "Contul Instagram e restricționat și nu poate publica. Coada s-a oprit; verifică notificările din aplicație." },
  2207026: { kind: "permanent", message: "Instagram nu primește formatul clipului (codec, container sau parametri). Exportă-l din nou după cerințele din README." },
  2207023: { kind: "permanent", message: "Instagram nu recunoaște tipul fișierului." },
  2207057: { kind: "permanent", message: "Cadrul de copertă („coperta_ms”) e în afara clipului." },
  2207010: { kind: "permanent", message: "Descrierea e prea lungă pentru Instagram (cel mult 2200 de caractere, 30 de hashtag-uri, 20 de @)." },
};

export function verdict(error: unknown): IgVerdict {
  if (!(error instanceof IgError)) return { kind: "transient", message: "Eroare neașteptată la Instagram. Se reîncearcă.", newContainer: false };
  if (error.subcode !== null && SUBCODE[error.subcode]) return SUBCODE[error.subcode];
  if (error.code === 190 || error.subcode === 463 || error.subcode === 467) return { kind: "token", message: "Tokenul Instagram a expirat sau a fost revocat. Coada s-a oprit: generează un token nou în panoul Meta și lipește-l în Postări → Setări → Conturi." };
  if (error.code === 10 || error.code === 200 || (error.code !== null && error.code >= 200 && error.code <= 299)) return { kind: "token", message: "Tokenul Instagram nu are permisiunea de publicare (instagram_business_content_publish). Generează altul, cu permisiunea bifată, și lipește-l în Setări → Conturi." };
  if (error.code !== null && [4, 17, 32, 341, 613, 80002].includes(error.code)) return { kind: "limit", message: "Instagram a limitat cererile pentru o vreme. Postarea așteaptă.", ms: 30 * 60_000 };
  if (error.code === 368) return { kind: "account", message: "Instagram a blocat temporar publicarea pentru cont (încălcarea regulilor). Coada s-a oprit; verifică aplicația." };
  if (error.code === 9007) return { kind: "not_ready", message: "Instagram încă procesează clipul." };
  if (error.code === 352) return SUBCODE[2207026];
  if (error.code === 36004) return SUBCODE[2207010];
  if (error.transient || error.status === 0 || error.status >= 500) return { kind: "transient", message: error.status === 0 ? "Instagram n-a răspuns. Se reîncearcă." : `Instagram a răspuns ${error.status}. Se reîncearcă.`, newContainer: false };
  return { kind: "transient", message: `Instagram a refuzat cererea: ${error.message.slice(0, 300)}`, newContainer: true };
}
