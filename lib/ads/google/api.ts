import "server-only";

import { createSign } from "node:crypto";
import type { AdsWorkspace } from "../workspaces";
import { workspaceToken } from "../workspaces.server";
import { GOOGLE_PAUSED, assertGooglePauseOnly, assertGooglePaused } from "../meta/paused";

/**
 * Clientul Google Ads API (REST, v26) — SINGURUL loc care vorbește cu Google.
 *
 * Ce poate face, intenționat, și nimic mai mult:
 *   - `googleSearch`  — citiri GAQL (contul, conversiile, video-urile,
 *                       interesele, cifrele);
 *   - `googleGet` / `googleReadPost` pe căile de citire fără efect
 *                       (`customers:listAccessibleCustomers`,
 *                       `geoTargetConstants:suggest`, volumele din Keyword
 *                       Planner — `generateKeywordHistoricalMetrics`);
 *   - `googleMutate`  — `googleAds:mutate`, ATOMIC (fără `partialFailure`),
 *                       cu `assertGooglePaused` rulat pe toate operațiile
 *                       ÎNAINTE de rețea. Cu `validateOnly`, Google verifică
 *                       tot lanțul fără să creeze nimic — așa arată
 *                       „Verifică în Google".
 *   - `googlePause`   — din faza 9, singura actualizare: `status: PAUSED` pe
 *                       campanii sau grupuri existente, cu garda ei
 *                       (`assertGooglePauseOnly`), pe aceeași cerere atomică.
 *
 * Nu există altă actualizare și nicio ștergere: garda creării refuză orice
 * `update` / `remove`, garda pauzei refuză orice altceva decât pauza, iar o
 * campanie nouă pleacă `PAUSED` (implicit Google ar porni-o — ENABLED).
 * Activarea o face omul, în Google Ads.
 *
 * AUTENTIFICAREA (din 2026-09-09 nu mai există developer token): variabila
 * spațiului (`GOOGLE_ADS_MERIDIAN`) conține fișierul JSON al unui cont de
 * serviciu Google Cloud (`"type": "service_account"`), adăugat ca utilizator
 * în contul Google Ads — echivalentul System User-ului de la Meta, fără
 * expirare. Merge și JSON-ul `authorized_user` (refresh token) dat de
 * `gcloud auth application-default login`. Cheia nu se loghează, nu se
 * întoarce spre browser; tokenul de acces (o oră) stă doar în memoria
 * procesului.
 */

export const GOOGLE_ADS_API_VERSION = "v26";

/**
 * `GOOGLE_ADS_API_URL` există doar pentru testele cu un Google fals pe
 * calculatorul de dezvoltare și e ignorată dacă nu arată spre localhost —
 * o variabilă greșită în Vercel nu poate trimite cheia spre alt server.
 */
function localOverride(): string | null {
  const override = process.env.GOOGLE_ADS_API_URL?.trim();
  return override && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(override) ? override : null;
}

function apiBase(): string {
  const local = localOverride();
  return local ? `${local}/${GOOGLE_ADS_API_VERSION}` : `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
}

function tokenEndpoint(): string {
  const local = localOverride();
  return local ? `${local}/token` : "https://oauth2.googleapis.com/token";
}

const TIMEOUT_MS = 30_000;
const SCOPE = "https://www.googleapis.com/auth/adwords";

// ---------------------------------------------------------------------------
// Erorile
// ---------------------------------------------------------------------------

export interface GoogleAdsErrorItem {
  /** `requestError: REQUIRED_FIELD_MISSING` — tipul și codul, cum le dă Google. */
  code: string;
  message: string;
  /** Calea câmpului în cerere: `mutate_operations[3].ad_group_ad.ad.demand_gen_video_responsive_ad.headlines[0].text`. */
  field: string | null;
  /** Indexul operației din `mutateOperations`, când Google îl dă. */
  operationIndex: number | null;
  trigger: string | null;
}

export interface GoogleAdsErrorInfo {
  /** Statusul HTTP; 0 = cererea n-a ajuns la Google. */
  status: number;
  /** `INVALID_ARGUMENT`, `PERMISSION_DENIED`, `UNAUTHENTICATED`… */
  reason: string | null;
  message: string;
  errors: GoogleAdsErrorItem[];
  requestId: string | null;
}

export class GoogleAdsApiError extends Error {
  readonly info: GoogleAdsErrorInfo;

  constructor(info: GoogleAdsErrorInfo) {
    super(info.message);
    this.name = "GoogleAdsApiError";
    this.info = info;
  }

  /** Are o eroare cu codul ăsta (`USER_PERMISSION_DENIED`, `CUSTOMER_NOT_FOUND`…). */
  has(code: string): boolean {
    return this.info.errors.some((error) => error.code.endsWith(`: ${code}`));
  }
}

export class GoogleCredentialsMissingError extends Error {
  readonly tokenEnv: string;

  constructor(tokenEnv: string) {
    super(`Cheia ${tokenEnv} nu e setată.`);
    this.name = "GoogleCredentialsMissingError";
    this.tokenEnv = tokenEnv;
  }
}

export class GoogleCredentialsInvalidError extends Error {
  readonly tokenEnv: string;

  constructor(tokenEnv: string, why: string) {
    super(`${tokenEnv}: ${why}`);
    this.name = "GoogleCredentialsInvalidError";
    this.tokenEnv = tokenEnv;
  }
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function fieldPath(location: unknown): { field: string | null; operationIndex: number | null } {
  const elements = (location as { fieldPathElements?: Array<{ fieldName?: string; index?: number }> } | undefined)
    ?.fieldPathElements;
  if (!Array.isArray(elements) || elements.length === 0) return { field: null, operationIndex: null };
  const field = elements
    .map((element) => `${element.fieldName ?? "?"}${typeof element.index === "number" ? `[${element.index}]` : ""}`)
    .join(".");
  const first = elements[0];
  const operationIndex =
    first?.fieldName === "mutate_operations" || first?.fieldName === "operations"
      ? typeof first.index === "number"
        ? first.index
        : null
      : null;
  return { field, operationIndex };
}

/** `{ requestError: "REQUIRED_FIELD_MISSING" }` → „requestError: REQUIRED_FIELD_MISSING". */
function errorCode(code: unknown): string {
  if (!code || typeof code !== "object") return "unknown";
  const [kind, value] = Object.entries(code as Record<string, unknown>)[0] ?? [];
  return kind ? `${kind}: ${String(value)}` : "unknown";
}

function parseFailure(status: number, body: unknown, headerRequestId: string | null): GoogleAdsErrorInfo {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  // REST: `{ error: { code, message, status, details: [GoogleAdsFailure] } }`.
  const error = record?.error && typeof record.error === "object" ? (record.error as Record<string, unknown>) : record;
  const details = Array.isArray(error?.details) ? (error.details as Array<Record<string, unknown>>) : [];
  const failure = details.find((detail) => String(detail["@type"] ?? "").endsWith("GoogleAdsFailure"));
  const errors: GoogleAdsErrorItem[] = Array.isArray(failure?.errors)
    ? (failure.errors as Array<Record<string, unknown>>).map((item) => ({
        code: errorCode(item.errorCode),
        message: asText(item.message) ?? "",
        ...fieldPath(item.location),
        trigger:
          item.trigger && typeof item.trigger === "object"
            ? (Object.values(item.trigger as Record<string, unknown>)[0] as string | undefined)?.toString() ?? null
            : null,
      }))
    : [];
  return {
    status,
    reason: asText(error?.status),
    message: errors[0]?.message || asText(error?.message) || `HTTP ${status}`,
    errors,
    requestId: asText(failure?.requestId) ?? headerRequestId,
  };
}

// ---------------------------------------------------------------------------
// Cheia și tokenul de acces
// ---------------------------------------------------------------------------

type Credentials =
  | { kind: "service_account"; clientEmail: string; privateKey: string }
  | { kind: "authorized_user"; clientId: string; clientSecret: string; refreshToken: string };

/**
 * Valoarea variabilei: JSON-ul descărcat din Google Cloud, lipit ca atare
 * sau în base64 (unele panouri strică rândurile noi din cheia privată).
 */
function readCredentials(workspace: AdsWorkspace): Credentials {
  const raw = workspaceToken(workspace);
  if (!raw) throw new GoogleCredentialsMissingError(workspace.tokenEnv);

  let text = raw.trim();
  if (!text.startsWith("{")) {
    try {
      text = Buffer.from(text, "base64").toString("utf8").trim();
    } catch {
      /* rămâne textul inițial — eroarea de mai jos spune ce e greșit */
    }
  }
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new GoogleCredentialsInvalidError(
      workspace.tokenEnv,
      "nu e JSON. Pune conținutul întreg al fișierului .json descărcat din Google Cloud (sau același conținut în base64)."
    );
  }

  if (json.type === "service_account") {
    const clientEmail = asText(json.client_email);
    const privateKey = asText(json.private_key)?.replace(/\\n/g, "\n");
    if (!clientEmail || !privateKey?.includes("PRIVATE KEY")) {
      throw new GoogleCredentialsInvalidError(workspace.tokenEnv, "JSON-ul contului de serviciu nu are client_email și private_key.");
    }
    return { kind: "service_account", clientEmail, privateKey };
  }
  if (json.type === "authorized_user") {
    const clientId = asText(json.client_id);
    const clientSecret = asText(json.client_secret);
    const refreshToken = asText(json.refresh_token);
    if (!clientId || !clientSecret || !refreshToken) {
      throw new GoogleCredentialsInvalidError(workspace.tokenEnv, "JSON-ul authorized_user nu are client_id, client_secret și refresh_token.");
    }
    return { kind: "authorized_user", clientId, clientSecret, refreshToken };
  }
  throw new GoogleCredentialsInvalidError(
    workspace.tokenEnv,
    `tipul „${String(json.type ?? "lipsă")}” nu e cunoscut. Portalul primește JSON-ul unui cont de serviciu ("type": "service_account").`
  );
}

/** Adresa contului de serviciu — se arată omului (o adaugă ca utilizator în Google Ads). Nu e secretă. */
export function serviceAccountEmail(workspace: AdsWorkspace): string | null {
  try {
    const credentials = readCredentials(workspace);
    return credentials.kind === "service_account" ? credentials.clientEmail : null;
  } catch {
    return null;
  }
}

const b64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

function signedAssertion(credentials: Extract<Credentials, { kind: "service_account" }>): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({ iss: credentials.clientEmail, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(credentials.privateKey))}`;
}

/** Tokenul de acces, pe spațiu, cât mai are cel puțin un minut. Doar în memoria procesului. */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function accessToken(workspace: AdsWorkspace): Promise<string> {
  const cached = tokenCache.get(workspace.id);
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;

  const credentials = readCredentials(workspace);
  let body: URLSearchParams;
  if (credentials.kind === "service_account") {
    let assertion: string;
    try {
      assertion = signedAssertion(credentials);
    } catch {
      throw new GoogleCredentialsInvalidError(workspace.tokenEnv, "cheia privată din JSON nu se poate folosi la semnare (e trunchiată sau stricată).");
    }
    body = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion });
  } else {
    body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
    });
  }

  let response: Response;
  try {
    response = await fetch(tokenEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new GoogleAdsApiError({ status: 0, reason: null, message: timedOut ? "timeout" : "network", errors: [], requestId: null });
  }
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const token = asText(json?.access_token);
  if (!response.ok || !token) {
    // `invalid_grant` = cheie retrasă / refresh token expirat; mesajul Google o spune.
    throw new GoogleCredentialsInvalidError(
      workspace.tokenEnv,
      `Google a refuzat cheia (${asText(json?.error) ?? `HTTP ${response.status}`}${asText(json?.error_description) ? `: ${asText(json?.error_description)}` : ""}).`
    );
  }
  const expiresIn = typeof json?.expires_in === "number" ? json.expires_in : 3600;
  tokenCache.set(workspace.id, { token, expiresAt: Date.now() + expiresIn * 1000 });
  return token;
}

// ---------------------------------------------------------------------------
// Cererile
// ---------------------------------------------------------------------------

export interface RequestOptions {
  /** Contul manager prin care tokenul vede contul din URL (doar cifre). */
  loginCustomerId?: string | null;
}

async function request<T>(
  workspace: AdsWorkspace,
  method: "GET" | "POST",
  path: string,
  body: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const token = await accessToken(workspace);
  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.loginCustomerId ? { "login-customer-id": options.loginCustomerId } : {}),
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new GoogleAdsApiError({ status: 0, reason: null, message: timedOut ? "timeout" : "network", errors: [], requestId: null });
  }

  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    /* HTML de la un proxy — tratat ca eroare */
  }
  const headerRequestId = response.headers.get("request-id") ?? response.headers.get("google-ads-request-id");
  if (!response.ok || json === null) {
    if (response.status === 401) tokenCache.delete(workspace.id);
    throw new GoogleAdsApiError(parseFailure(response.status, json, headerRequestId));
  }
  return json as T;
}

/** Cifrele contului, fără cratime: „123-456-7890" → „1234567890". */
export function customerDigits(input: string): string {
  return input.replace(/[\s-]/g, "");
}

/** Toate rândurile unei interogări GAQL (paginile de câte 10.000 se cer singure). */
export async function googleSearch<T>(
  workspace: AdsWorkspace,
  customerId: string,
  query: string,
  options: RequestOptions = {}
): Promise<T[]> {
  const rows: T[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const data = await request<{ results?: T[]; nextPageToken?: string }>(
      workspace,
      "POST",
      `/customers/${customerDigits(customerId)}/googleAds:search`,
      pageToken ? { query, pageToken } : { query },
      options
    );
    rows.push(...(data.results ?? []));
    pageToken = data.nextPageToken || undefined;
    if (!pageToken) break;
  }
  return rows;
}

/** Citiri fără efect, pe căile care nu sunt GAQL. */
export function googleGet<T>(workspace: AdsWorkspace, path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(workspace, "GET", path, undefined, options);
}

/**
 * POST-urile fără efect: sugestiile de locații și, din faza 14, volumele de
 * căutare din Keyword Planner (`KeywordPlanIdeaService`, doar citire; cere
 * nivelul de acces Basic al proiectului Google Cloud).
 */
const READ_ONLY_POSTS = [/^\/geoTargetConstants:suggest$/, /^\/customers\/\d{10}:generateKeywordHistoricalMetrics$/];

export function googleReadPost<T>(workspace: AdsWorkspace, path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
  if (!READ_ONLY_POSTS.some((pattern) => pattern.test(path))) {
    throw new Error(`Calea Google „${path}” nu e o citire cunoscută a portalului.`);
  }
  return request<T>(workspace, "POST", path, body, options);
}

export interface MutateResult {
  /** Numele resurselor create, în ordinea operațiilor (`customers/1/campaigns/2`). */
  resourceNames: Array<string | null>;
}

/**
 * Cererea `googleAds:mutate` însăși, atomică (`partialFailure: false`). NU se
 * exportă: o cheamă doar `googleMutate` și `googlePause`, fiecare DUPĂ garda
 * lui. Nicio altă cale din portal nu ajunge aici.
 */
async function sendMutate(
  workspace: AdsWorkspace,
  customer: string,
  operations: Array<Record<string, unknown>>,
  options: RequestOptions & { validateOnly: boolean }
): Promise<MutateResult> {
  const data = await request<{ mutateOperationResponses?: Array<Record<string, unknown>> }>(
    workspace,
    "POST",
    `/customers/${customer}/googleAds:mutate`,
    { mutateOperations: operations, validateOnly: options.validateOnly, partialFailure: false },
    options
  );
  const resourceNames = (data.mutateOperationResponses ?? []).map((response) => {
    const result = Object.values(response)[0] as { resourceName?: string } | undefined;
    return result?.resourceName ?? null;
  });
  return { resourceNames };
}

/**
 * Scrierea de creare spre Google: `googleAds:mutate`, atomic (o operație
 * refuzată = nimic creat). Operațiile trec prin `assertGooglePaused` înainte
 * de orice apel; cu `validateOnly`, Google le verifică pe toate și nu
 * creează nimic. `negativeSharedSets` = listele de negative existente, citite
 * din cont chiar înainte — doar de ele se pot lega campanii (faza 9).
 */
export async function googleMutate(
  workspace: AdsWorkspace,
  customerId: string,
  operations: Array<Record<string, unknown>>,
  options: RequestOptions & { validateOnly: boolean; negativeSharedSets?: readonly string[] }
): Promise<MutateResult> {
  const customer = customerDigits(customerId);
  if (!/^\d{10}$/.test(customer)) throw new Error(`Cont Google Ads invalid pentru creare: ${customerId}`);
  assertGooglePaused(customer, operations, { negativeSharedSets: options.negativeSharedSets });
  return sendMutate(workspace, customer, operations, options);
}

/**
 * Pauza — SINGURA actualizare pe care o poate trimite portalul. Construiește
 * ea operațiile (`update` cu `status: PAUSED`, `updateMask: "status"`) din
 * numele resurselor și le trece prin `assertGooglePauseOnly` înainte de
 * rețea. Poate doar să oprească cheltuiala: altă valoare, alt câmp, altă
 * resursă sau o creare amestecată sunt refuzate de gardă.
 */
export async function googlePause(
  workspace: AdsWorkspace,
  customerId: string,
  resourceNames: readonly string[],
  options: RequestOptions & { validateOnly: boolean }
): Promise<MutateResult> {
  const customer = customerDigits(customerId);
  if (!/^\d{10}$/.test(customer)) throw new Error(`Cont Google Ads invalid pentru pauză: ${customerId}`);
  const operations = resourceNames.map((resourceName) => {
    const kind = /\/adGroupAds\/\d+~\d+$/.test(resourceName)
      ? "adGroupAdOperation"
      : /\/adGroups\/\d+$/.test(resourceName)
        ? "adGroupOperation"
        : "campaignOperation";
    return { [kind]: { update: { resourceName, status: GOOGLE_PAUSED }, updateMask: "status" } };
  });
  assertGooglePauseOnly(customer, operations);
  return sendMutate(workspace, customer, operations, options);
}

/**
 * Un video nou pe YouTube, prin Google Ads (`YouTubeVideoUploadService`,
 * din v23.1): pe canalul administrat de Google al contului, NELISTAT —
 * fără canal legat și fără alt permis decât cel de Google Ads. Protocolul e
 * „resumable" în doi pași: sesiunea (metadatele), apoi fișierul întreg,
 * cu `upload, finalize`.
 *
 * E a doua (și ultima) scriere spre Google: creează un video, nu o
 * campanie — nimic de pornit, nimic de plătit. Google îl procesează după;
 * starea se citește cu GAQL din `you_tube_video_upload`.
 */
export async function googleUploadYouTubeVideo(
  workspace: AdsWorkspace,
  customerId: string,
  video: { title: string; bytes: ArrayBuffer; contentType: string },
  options: RequestOptions = {}
): Promise<{ resourceName: string }> {
  const customer = customerDigits(customerId);
  if (!/^\d{10}$/.test(customer)) throw new Error(`Cont Google Ads invalid pentru urcare: ${customerId}`);
  const token = await accessToken(workspace);
  const local = localOverride();
  const base = local ?? "https://googleads.googleapis.com";
  const start = `${base}/resumable/upload/${GOOGLE_ADS_API_VERSION}/customers/${customer}/youTubeVideoUploads:create`;

  let session: Response;
  try {
    session = await fetch(start, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.loginCustomerId ? { "login-customer-id": options.loginCustomerId } : {}),
        "Content-Type": "application/json",
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(video.bytes.byteLength),
        "X-Goog-Upload-Header-Content-Type": video.contentType,
      },
      body: JSON.stringify({
        customerId: customer,
        youTubeVideoUpload: { videoTitle: video.title.replace(/[<>]/g, "").slice(0, 100), videoPrivacy: "UNLISTED" },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new GoogleAdsApiError({ status: 0, reason: null, message: timedOut ? "timeout" : "network", errors: [], requestId: null });
  }
  const uploadUrl = session.headers.get("x-goog-upload-url");
  if (!session.ok || !uploadUrl) {
    const json = await session.json().catch(() => null);
    throw new GoogleAdsApiError(parseFailure(session.status, json, session.headers.get("request-id")));
  }

  let finished: Response;
  try {
    finished = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
        "Content-Type": video.contentType,
      },
      body: video.bytes,
      cache: "no-store",
      // Fișierul întreg (cel mult 50 MB, limita anticamerei): un minut ajunge.
      signal: AbortSignal.timeout(55_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new GoogleAdsApiError({ status: 0, reason: null, message: timedOut ? "timeout" : "network", errors: [], requestId: null });
  }
  const result = (await finished.json().catch(() => null)) as { resourceName?: string } | null;
  if (!finished.ok || !result?.resourceName) {
    throw new GoogleAdsApiError(parseFailure(finished.status, result, finished.headers.get("request-id")));
  }
  return { resourceName: result.resourceName };
}

/** Id-ul de la capătul unui nume de resursă: `customers/1/campaigns/22` → „22". */
export function idOf(resourceName: string | null | undefined): string | null {
  const match = resourceName ? /\/(-?\d+)$/.exec(resourceName) : null;
  return match ? match[1] : null;
}
