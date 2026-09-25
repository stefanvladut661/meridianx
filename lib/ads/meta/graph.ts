import "server-only";

import type { AdsWorkspace } from "../workspaces";
import { workspaceToken } from "../workspaces.server";
import { assertPaused, type CreateEdge } from "./paused";

/**
 * Clientul Graph API al portalului — SINGURUL loc care vorbește cu Meta.
 *
 * Ce poate face, intenționat, și nimic mai mult:
 *   - `metaGet`    — citiri (conturi, bibliotecă video, căutări de targetare);
 *   - `metaCreate` — creare pe muchiile unui cont de reclame (campanii,
 *                    seturi, creative, reclame);
 *   - `metaUploadImage` — coperta video-ului, în biblioteca de imagini a
 *                    contului.
 * Amândouă trec prin `metaPost`, care rulează `assertPaused` pe fiecare
 * corp de cerere ÎNAINTE de rețea.
 *
 * Nu există funcție de actualizare (`POST /{id}`) și nici de ștergere: o
 * actualizare e drumul prin care o campanie se pornește. Activarea o face
 * omul, în Ads Manager.
 *
 * Tokenul: citit în funcția care face apelul, trimis în antet (nu în URL —
 * URL-urile ajung în loguri), niciodată logat, niciodată întors. Dacă un
 * mesaj de eroare de la Meta l-ar conține, e înlocuit înainte să iasă de aici.
 */

/**
 * Versiunea Graph API. v26.0 a apărut pe 2026-07-29; v24.0 se oprește pe
 * 2026-10-06, v25.0 n-are încă dată de retragere. Meta retrage o versiune
 * la ~2 ani după lansare: la schimbare, se reverifică maparea din
 * `build.ts` pe changelog și lista `META_CREATIVE_FEATURES` pe SDK-ul oficial.
 */
export const META_API_VERSION = "v26.0";

/**
 * Adresa Graph API. `META_GRAPH_URL` există doar pentru testele cu un Meta
 * fals pe calculatorul de dezvoltare și e ignorată dacă nu arată spre
 * `localhost` / `127.0.0.1` — o variabilă setată greșit în Vercel nu poate
 * trimite tokenul spre alt server.
 */
function graphBase(): string {
  const override = process.env.META_GRAPH_URL?.trim();
  if (override && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(override)) {
    return `${override}/${META_API_VERSION}`;
  }
  return `https://graph.facebook.com/${META_API_VERSION}`;
}
const TIMEOUT_MS = 25_000;

export interface MetaErrorInfo {
  /** Statusul HTTP; 0 = cererea n-a ajuns la Meta (rețea, timp expirat). */
  status: number;
  code: number | null;
  subcode: number | null;
  /** Mesajul tehnic, în engleză. */
  message: string;
  /** Titlul și mesajul pentru om, când Meta le trimite. */
  userTitle: string | null;
  userMessage: string | null;
  fbtraceId: string | null;
}

export class MetaApiError extends Error {
  readonly info: MetaErrorInfo;

  constructor(info: MetaErrorInfo) {
    super(info.message);
    this.name = "MetaApiError";
    this.info = info;
  }
}

export class MetaTokenMissingError extends Error {
  readonly tokenEnv: string;

  constructor(tokenEnv: string) {
    super(`Tokenul ${tokenEnv} nu e setat.`);
    this.name = "MetaTokenMissingError";
    this.tokenEnv = tokenEnv;
  }
}

type Params = Record<string, unknown>;

function encode(params: Params): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    // Obiectele și listele merg ca JSON — forma documentată de Graph API.
    search.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  return search;
}

function redact(text: string, token: string): string {
  return token && text.includes(token) ? text.split(token).join("[token]") : text;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function request<T>(
  workspace: AdsWorkspace,
  method: "GET" | "POST",
  path: string,
  params: Params
): Promise<T> {
  const token = workspaceToken(workspace);
  if (!token) throw new MetaTokenMissingError(workspace.tokenEnv);

  const body = encode(params);
  const base = graphBase();
  const url = method === "GET" && body.size > 0 ? `${base}${path}?${body}` : `${base}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: method === "POST" ? body : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new MetaApiError({
      status: 0,
      code: null,
      subcode: null,
      message: timedOut ? "timeout" : "network",
      userTitle: null,
      userMessage: null,
      fbtraceId: null,
    });
  }

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    /* corp gol sau HTML de la un proxy — tratat mai jos ca eroare */
  }

  const record = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  const error = record?.error && typeof record.error === "object" ? (record.error as Record<string, unknown>) : null;

  if (!response.ok || error || !record) {
    throw new MetaApiError({
      status: response.status,
      code: asInt(error?.code),
      subcode: asInt(error?.error_subcode),
      message: redact(asText(error?.message) ?? `HTTP ${response.status}`, token),
      userTitle: asText(error?.error_user_title),
      userMessage: asText(error?.error_user_msg) ? redact(String(error?.error_user_msg), token) : null,
      fbtraceId: asText(error?.fbtrace_id),
    });
  }

  return record as T;
}

/** Citire. `path` începe cu `/` (`/me/adaccounts`, `/act_…/advideos`). */
export function metaGet<T>(workspace: AdsWorkspace, path: string, params: Params = {}): Promise<T> {
  return request<T>(workspace, "GET", path, params);
}

/**
 * SINGURA scriere spre Meta: POST pe o muchie de creare a contului. Corpul
 * trece prin `assertPaused` înainte de orice apel: dacă un câmp de status
 * nu e PAUSED, funcția aruncă și nimic nu pleacă spre Meta.
 */
async function metaPost(
  workspace: AdsWorkspace,
  adAccount: string,
  edge: CreateEdge,
  payload: Params
): Promise<Record<string, unknown>> {
  if (!/^act_\d{5,25}$/.test(adAccount)) {
    throw new Error(`Cont de reclame invalid pentru creare: ${adAccount}`);
  }
  assertPaused(edge, payload);
  return request<Record<string, unknown>>(workspace, "POST", `/${adAccount}/${edge}`, payload);
}

function missing(what: string): MetaApiError {
  return new MetaApiError({
    status: 200,
    code: null,
    subcode: null,
    message: `Meta nu a întors ${what}.`,
    userTitle: null,
    userMessage: null,
    fbtraceId: null,
  });
}

/** Creare pe o muchie cu obiect: campanie, set, creativ, reclamă. */
export async function metaCreate(
  workspace: AdsWorkspace,
  adAccount: string,
  edge: Exclude<CreateEdge, "adimages" | "advideos">,
  payload: Params
): Promise<{ id: string }> {
  const result = await metaPost(workspace, adAccount, edge, payload);
  const id = asText(result.id);
  if (!id) throw missing(`id-ul obiectului creat (${edge})`);
  return { id };
}

/**
 * O imagine în biblioteca contului — coperta video-ului. Meta cere ca
 * imaginea să fie urcată, nu dată ca link spre propriul CDN. Întoarce
 * `hash`-ul folosit apoi în creativ.
 */
export async function metaUploadImage(
  workspace: AdsWorkspace,
  adAccount: string,
  image: { bytes: string; name: string }
): Promise<{ hash: string }> {
  const result = await metaPost(workspace, adAccount, "adimages", { bytes: image.bytes, name: image.name });
  const images = result.images && typeof result.images === "object" ? Object.values(result.images) : [];
  const hash = asText((images[0] as { hash?: unknown } | undefined)?.hash);
  if (!hash) throw missing("hash-ul imaginii urcate");
  return { hash };
}

/**
 * Un video nou în biblioteca contului: Meta îl descarcă singur de la
 * `fileUrl` (un link semnat, pe termen scurt, din stocarea portalului).
 * Fișierul nu trece prin serverul nostru, iar tokenul nu ajunge în browser.
 */
export async function metaUploadVideoFromUrl(
  workspace: AdsWorkspace,
  adAccount: string,
  video: { fileUrl: string; title: string }
): Promise<{ id: string }> {
  const result = await metaPost(workspace, adAccount, "advideos", { file_url: video.fileUrl, name: video.title });
  const id = asText(result.id);
  if (!id) throw missing("id-ul video-ului urcat");
  return { id };
}

/**
 * Toate paginile unei liste (`data` + `paging.next`), cu o limită, ca o
 * bibliotecă uriașă să nu țină acțiunea minute întregi.
 */
export async function metaGetAll<T>(
  workspace: AdsWorkspace,
  path: string,
  params: Params,
  maxItems: number
): Promise<T[]> {
  const items: T[] = [];
  let after: string | null = null;

  do {
    const page: { data?: T[]; paging?: { cursors?: { after?: string }; next?: string } } = await metaGet(
      workspace,
      path,
      after ? { ...params, after } : params
    );
    items.push(...(page.data ?? []));
    after = page.paging?.next ? (page.paging.cursors?.after ?? null) : null;
  } while (after && items.length < maxItems);

  return items.slice(0, maxItems);
}
