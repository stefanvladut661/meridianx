import "server-only";

import type { AdsWorkspace } from "../workspaces";
import { workspaceToken } from "../workspaces.server";
import { assertTikTokDisabled, type TikTokCreatePath } from "../meta/paused";

/**
 * Clientul TikTok API for Business (v1.3) — SINGURUL loc care vorbește cu TikTok.
 *
 * Ce poate face, intenționat, și nimic mai mult:
 *   - `tiktokGet`    — citiri (conturi, identități, pixeli, video-uri,
 *                      căutări de targetare, rapoarte);
 *   - `tiktokCreate` — creare pe căile din `TIKTOK_CREATE_PATHS` (campanie,
 *                      grup de reclame, reclame, video/imagine din URL), cu
 *                      `assertTikTokDisabled` rulat pe fiecare corp ÎNAINTE de rețea.
 *
 * Nu există funcție de actualizare (`/…/update/`, `/…/status/update/`) și nici
 * de ștergere: pe acolo s-ar porni o campanie. Activarea o face omul, în
 * TikTok Ads Manager.
 *
 * Tokenul: citit în funcția care face apelul, trimis în antetul
 * `Access-Token`, niciodată logat, niciodată întors.
 */

export const TIKTOK_API_VERSION = "v1.3";

/**
 * `TIKTOK_API_URL` există doar pentru testele cu un TikTok fals pe
 * calculatorul de dezvoltare și e ignorată dacă nu arată spre localhost.
 */
function apiBase(): string {
  const override = process.env.TIKTOK_API_URL?.trim();
  if (override && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(override)) {
    return `${override}/open_api/${TIKTOK_API_VERSION}`;
  }
  return `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}`;
}

const TIMEOUT_MS = 25_000;

export interface TikTokErrorInfo {
  /** Statusul HTTP; 0 = cererea n-a ajuns la TikTok. */
  status: number;
  /** Codul TikTok din corpul răspunsului (0 = succes). */
  code: number | null;
  message: string;
  requestId: string | null;
}

export class TikTokApiError extends Error {
  readonly info: TikTokErrorInfo;

  constructor(info: TikTokErrorInfo) {
    super(info.message);
    this.name = "TikTokApiError";
    this.info = info;
  }
}

export class TikTokTokenMissingError extends Error {
  readonly tokenEnv: string;

  constructor(tokenEnv: string) {
    super(`Tokenul ${tokenEnv} nu e setat.`);
    this.name = "TikTokTokenMissingError";
    this.tokenEnv = tokenEnv;
  }
}

type Params = Record<string, unknown>;

/** În query, listele și obiectele merg ca JSON — forma cerută de TikTok. */
function encodeQuery(params: Params): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    search.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  return search;
}

/**
 * Id-urile TikTok au 19 cifre, peste ce ține exact un număr JavaScript
 * (2^53). La trimitere, un BigInt devine număr JSON cu toate cifrele; la
 * citire, un număr întreg prea mare rămâne textul lui din răspuns, nu o
 * aproximare (`context.source`, Node 22+).
 */
function serialize(params: Params): string {
  const marked = JSON.stringify(params, (_key, value: unknown) =>
    typeof value === "bigint" ? `__bigint__${value.toString()}` : value
  );
  return marked.replace(/"__bigint__(-?\d+)"/g, "$1");
}

function keepBigIntegers(_key: string, value: unknown, context?: { source?: string }): unknown {
  if (typeof value === "number" && !Number.isSafeInteger(value) && context?.source && /^-?\d+$/.test(context.source)) {
    return context.source;
  }
  return value;
}

function redact(text: string, token: string): string {
  return token && text.includes(token) ? text.split(token).join("[token]") : text;
}

async function request<T>(workspace: AdsWorkspace, method: "GET" | "POST", path: string, params: Params): Promise<T> {
  const token = workspaceToken(workspace);
  if (!token) throw new TikTokTokenMissingError(workspace.tokenEnv);

  const base = apiBase();
  const query = method === "GET" ? encodeQuery(params) : null;
  const url = query && query.size > 0 ? `${base}${path}?${query}` : `${base}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        "Access-Token": token,
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: method === "POST" ? serialize(params) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new TikTokApiError({ status: 0, code: null, message: timedOut ? "timeout" : "network", requestId: null });
  }

  let json: unknown = null;
  try {
    json = JSON.parse(await response.text(), keepBigIntegers as (key: string, value: unknown) => unknown);
  } catch {
    /* corp gol sau HTML — tratat mai jos ca eroare */
  }
  const record = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  const code = typeof record?.code === "number" ? record.code : null;

  if (!response.ok || !record || code !== 0) {
    throw new TikTokApiError({
      status: response.status,
      code,
      message: redact(typeof record?.message === "string" ? record.message : `HTTP ${response.status}`, token),
      requestId: typeof record?.request_id === "string" ? record.request_id : null,
    });
  }
  return (record.data ?? {}) as T;
}

/** Citire. `path` începe și se termină cu `/` (`/advertiser/info/`). */
export function tiktokGet<T>(workspace: AdsWorkspace, path: string, params: Params = {}): Promise<T> {
  return request<T>(workspace, "GET", path, params);
}

/**
 * SINGURA scriere spre TikTok. Corpul trece prin `assertTikTokDisabled`
 * înainte de orice apel: dacă `operation_status` nu e DISABLE (sau o cale nu
 * e de creare), funcția aruncă și nimic nu pleacă spre TikTok.
 */
export async function tiktokCreate<T>(workspace: AdsWorkspace, path: TikTokCreatePath, payload: Params): Promise<T> {
  if (!/^\d{5,25}$/.test(String(payload.advertiser_id ?? ""))) {
    throw new Error(`Cont TikTok invalid pentru creare: ${String(payload.advertiser_id)}`);
  }
  assertTikTokDisabled(path, payload);
  return request<T>(workspace, "POST", path, payload);
}

/** Toate paginile unei liste (`page` / `page_size` + `page_info.total_page`), cu o limită. */
export async function tiktokGetAll<T>(
  workspace: AdsWorkspace,
  path: string,
  params: Params,
  listKey: string,
  maxItems: number,
  pageSize = 100
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; items.length < maxItems; page += 1) {
    const data = await tiktokGet<Record<string, unknown>>(workspace, path, { ...params, page, page_size: pageSize });
    const list = Array.isArray(data[listKey]) ? (data[listKey] as T[]) : [];
    items.push(...list);
    const info = data.page_info as { total_page?: number } | undefined;
    if (!info?.total_page || page >= info.total_page || list.length === 0) break;
  }
  return items.slice(0, maxItems);
}
