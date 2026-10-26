/**
 * Oblio (https://www.oblio.eu/api), după documentația oficială:
 *   - token: POST /authorize/token, form `client_id` (emailul contului) și
 *     `client_secret` (Setări → Date cont; se schimbă când se resetează parola);
 *     răspuns `access_token`, `expires_in` (3600), `token_type` Bearer;
 *   - răspunsurile: HTTP 200 cu `status`, `statusMessage`, `data`; eroare 400/401;
 *   - limite: 30 de cereri / 100 s pentru cele care emit documente, 30 / 10 s în rest.
 *
 * REGULA MODULULUI: adminul nu anulează, nu restaurează, nu șterge și nu
 * stornează facturi. Aici nu există funcții pentru `/cancel`, `/restore` sau
 * `DELETE`, iar `call()` acceptă doar perechile metodă + cale din `Allowed`.
 * `lib/firma/verify-oblio.mjs` pică dacă apare altceva.
 *
 * Cheile stau doar în Vercel: OBLIO_EMAIL, OBLIO_API_SECRET, OBLIO_CIF.
 * OBLIO_API_URL (opțional) e doar pentru testele cu un Oblio simulat.
 */

const BASE = (process.env.OBLIO_API_URL ?? "https://www.oblio.eu/api").replace(/\/$/, "");

export const OBLIO_MISSING =
  "Oblio nu e legat: lipsesc OBLIO_EMAIL, OBLIO_API_SECRET sau OBLIO_CIF în Vercel (pașii sunt în lib/firma/README.md → „Oblio”).";

interface OblioConfig {
  email: string;
  secret: string;
  cif: string;
}

export function oblioConfig(): OblioConfig | null {
  const email = process.env.OBLIO_EMAIL?.trim();
  const secret = process.env.OBLIO_API_SECRET?.trim();
  const cif = process.env.OBLIO_CIF?.trim();
  if (!email || !secret || !cif) return null;
  return { email, secret, cif };
}

export function isOblioConfigured(): boolean {
  return oblioConfig() !== null;
}

export class OblioError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Limita de cereri sau o problemă de rețea: se poate relua mai târziu. */
    readonly retryable: boolean
  ) {
    super(message);
  }
}

/** Singurele cereri pe care modulul le poate face. */
type Allowed =
  | { method: "GET"; path: "/nomenclature/companies" | "/nomenclature/clients" | "/nomenclature/series" | "/nomenclature/vat_rates" | "/docs/invoice" | "/docs/invoice/list" }
  | { method: "POST"; path: "/docs/invoice" | "/docs/proforma" | "/docs/einvoice" }
  | { method: "PUT"; path: "/docs/invoice/collect" };

let cachedToken: { value: string; expiresAt: number; email: string } | null = null;

async function accessToken(config: OblioConfig, force = false): Promise<string> {
  if (!force && cachedToken && cachedToken.email === config.email && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  let response: Response;
  try {
    response = await fetch(`${BASE}/authorize/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: config.email, client_secret: config.secret }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    throw new OblioError("Oblio nu răspunde. Reîncearcă peste un minut.", 0, true);
  }
  const body = (await response.json().catch(() => null)) as { access_token?: string; expires_in?: string | number; statusMessage?: string } | null;
  if (!response.ok || !body?.access_token) {
    throw new OblioError(
      response.status === 400 || response.status === 401
        ? "Oblio a refuzat cheia: verifică OBLIO_EMAIL și OBLIO_API_SECRET. Secretul se schimbă când se resetează parola contului Oblio."
        : `Oblio n-a dat un token (HTTP ${response.status}).`,
      response.status,
      response.status >= 500
    );
  }
  cachedToken = { value: body.access_token, expiresAt: Date.now() + Number(body.expires_in ?? 3600) * 1000, email: config.email };
  return body.access_token;
}

/** Formular în stilul PHP (`collect[type]=…`), cum îl cere `PUT /docs/invoice/collect`. */
function formEncode(params: Record<string, unknown>, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object") formEncode(value as Record<string, unknown>, name, out);
    else out.append(name, String(value));
  }
  return out;
}

async function call<T>(request: Allowed, params: Record<string, unknown>, retried = false): Promise<T> {
  const config = oblioConfig();
  if (!config) throw new OblioError(OBLIO_MISSING, 0, false);
  const token = await accessToken(config, retried);
  const withCif = { cif: config.cif, ...params };

  let url = `${BASE}${request.path}`;
  const init: RequestInit = { method: request.method, headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000), cache: "no-store" };
  if (request.method === "GET") {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(withCif)) if (value !== undefined && value !== null) query.append(key, String(value));
    url += `?${query.toString()}`;
  } else if (request.method === "PUT") {
    init.headers = { ...init.headers, "Content-Type": "application/x-www-form-urlencoded" };
    init.body = formEncode(withCif);
  } else {
    init.headers = { ...init.headers, "Content-Type": "application/json" };
    init.body = JSON.stringify(withCif);
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new OblioError("Oblio nu răspunde. Reîncearcă peste un minut.", 0, true);
  }
  if (response.status === 401 && !retried) return call<T>(request, params, true);
  const body = (await response.json().catch(() => null)) as { status?: number; statusMessage?: string; data?: unknown } | null;
  if (response.status === 429) throw new OblioError("Oblio a atins limita de cereri. Reîncearcă peste două minute.", 429, true);
  if (!response.ok || !body || (body.status !== undefined && Number(body.status) !== 200)) {
    const detail = body?.statusMessage ? String(body.statusMessage).slice(0, 300) : `HTTP ${response.status}`;
    throw new OblioError(`Oblio: ${detail}`, response.status, response.status >= 500);
  }
  return body.data as T;
}

// ---------------------------------------------------------------- citiri

export interface OblioClient {
  cif: string | null;
  name: string;
  rc: string | null;
  address: string | null;
  state: string | null;
  city: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  contact: string | null;
}

/** `GET /nomenclature/clients` — după nume sau CIF (pagini de 250; prima e destul pentru o căutare). */
export async function oblioClients(filter: { name?: string; clientCif?: string }): Promise<OblioClient[]> {
  const data = await call<Record<string, unknown>[]>({ method: "GET", path: "/nomenclature/clients" }, { name: filter.name, clientCif: filter.clientCif });
  const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  return (data ?? []).map((row) => ({
    cif: str(row.cif),
    name: str(row.name) ?? "",
    rc: str(row.rc),
    address: str(row.address),
    state: str(row.state),
    city: str(row.city),
    country: str(row.country),
    email: str(row.email),
    phone: str(row.phone),
    contact: str(row.contact),
  }));
}

export interface OblioSeries {
  type: string;
  name: string;
  next: number | null;
  default: boolean;
}

/** `GET /nomenclature/series` — seriile firmei (factură, proformă…). */
export async function oblioSeries(): Promise<OblioSeries[]> {
  const data = await call<Record<string, unknown>[]>({ method: "GET", path: "/nomenclature/series" }, {});
  return (data ?? []).map((row) => ({
    type: String(row.type ?? ""),
    name: String(row.name ?? ""),
    next: row.next === undefined || row.next === null ? null : Number(row.next),
    default: row.default === true || row.default === 1 || row.default === "1",
  }));
}

// ---------------------------------------------------------------- documente

export interface OblioDocClient {
  name: string;
  cif?: string | null;
  rc?: string | null;
  address?: string | null;
  state?: string | null;
  city?: string | null;
  country?: string | null;
  email?: string | null;
}

export interface OblioDocProduct {
  name: string;
  description?: string;
  price: number;
  quantity: number;
  measuringUnit: string;
}

export interface OblioDocInput {
  seriesName: string;
  issueDate: string;
  dueDate: string;
  currency: "RON" | "EUR";
  client: OblioDocClient;
  products: OblioDocProduct[];
  mentions?: string;
  /** Același cheie de două ori = același document (Oblio nu emite a doua oară). */
  idempotencyKey: string;
}

export interface OblioDocCreated {
  seriesName: string;
  number: string;
  link: string;
}

function docPayload(input: OblioDocInput) {
  const blank = (value: string | null | undefined) => (value ? value : undefined);
  return {
    seriesName: input.seriesName,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    currency: input.currency,
    language: "RO",
    precision: 2,
    idempotencyKey: input.idempotencyKey,
    mentions: blank(input.mentions),
    client: {
      name: input.client.name,
      cif: blank(input.client.cif),
      rc: blank(input.client.rc),
      address: blank(input.client.address),
      state: blank(input.client.state),
      city: blank(input.client.city),
      country: blank(input.client.country),
      email: blank(input.client.email),
      save: 1,
    },
    // Firma nu e plătitoare de TVA: prețul e final, fără cotă. Oblio aplică regimul firmei.
    products: input.products.map((product) => ({
      name: product.name,
      description: blank(product.description),
      price: product.price,
      quantity: product.quantity,
      measuringUnit: product.measuringUnit,
      productType: "Serviciu",
      vatIncluded: 1,
      save: 0,
    })),
  };
}

/** `POST /docs/invoice` — emite factura. Doar din aprobarea omului. */
export async function createInvoice(input: OblioDocInput): Promise<OblioDocCreated> {
  const data = await call<Record<string, unknown>>({ method: "POST", path: "/docs/invoice" }, docPayload(input));
  return { seriesName: String(data?.seriesName ?? input.seriesName), number: String(data?.number ?? ""), link: String(data?.link ?? "") };
}

/**
 * `POST /docs/proforma` — doar pentru testul emiterii cu cheile reale: o
 * proformă marcată „TEST — NU SE PLĂTEȘTE”, ștearsă apoi de om, din Oblio.
 */
export async function createProforma(input: OblioDocInput): Promise<OblioDocCreated> {
  const data = await call<Record<string, unknown>>({ method: "POST", path: "/docs/proforma" }, docPayload(input));
  return { seriesName: String(data?.seriesName ?? input.seriesName), number: String(data?.number ?? ""), link: String(data?.link ?? "") };
}

export interface EinvoiceStatus {
  text: string;
  sent: boolean;
  /** -1 netrimisă, 2 cu erori (netrimisă), 0 primită de SPV (în procesare), 1 trimisă cu succes. */
  code: number;
}

/** `POST /docs/einvoice` — trimite factura în SPV (e-Factura), prin Oblio. */
export async function sendEinvoice(seriesName: string, number: string): Promise<EinvoiceStatus> {
  const data = await call<Record<string, unknown>>({ method: "POST", path: "/docs/einvoice" }, { seriesName, number });
  return { text: String(data?.text ?? ""), sent: data?.sent === true || data?.sent === 1 || data?.sent === "1", code: Number(data?.code ?? -1) };
}

export interface OblioCollect {
  issueDate: string;
  type: string;
  number: string;
  value: number;
}

/** `GET /docs/invoice` — factura, cu linkul și încasările ei. */
export async function viewInvoice(seriesName: string, number: string): Promise<{ link: string; collects: OblioCollect[] }> {
  const data = await call<Record<string, unknown>>({ method: "GET", path: "/docs/invoice" }, { seriesName, number });
  const collects = Array.isArray(data?.collects) ? (data.collects as Record<string, unknown>[]) : [];
  return {
    link: String(data?.link ?? ""),
    collects: collects.map((row) => ({ issueDate: String(row.issueDate ?? ""), type: String(row.type ?? ""), number: String(row.number ?? ""), value: Number(row.value ?? 0) })),
  };
}

/** `PUT /docs/invoice/collect` — marchează factura încasată (ordin de plată). */
export async function collectInvoice(
  seriesName: string,
  number: string,
  collect: { documentNumber: string; value: number; issueDate: string; mentions?: string }
): Promise<{ collects: OblioCollect[] }> {
  const data = await call<Record<string, unknown>>(
    { method: "PUT", path: "/docs/invoice/collect" },
    { seriesName, number, collect: { type: "Ordin de plata", documentNumber: collect.documentNumber, value: collect.value, issueDate: collect.issueDate, mentions: collect.mentions } }
  );
  const collects = Array.isArray(data?.collects) ? (data.collects as Record<string, unknown>[]) : [];
  return { collects: collects.map((row) => ({ issueDate: String(row.issueDate ?? ""), type: String(row.type ?? ""), number: String(row.number ?? ""), value: Number(row.value ?? 0) })) };
}

export interface OblioListedInvoice {
  seriesName: string;
  number: string;
  issueDate: string;
  dueDate: string | null;
  total: number;
  canceled: boolean;
  draft: boolean;
  link: string;
  einvoice: EinvoiceStatus | null;
  collected: number;
  collects: OblioCollect[];
}

/** `GET /docs/invoice/list` — facturile dintr-un interval, cu starea e-Factura și încasările (max 100 pe pagină). */
export async function listInvoices(filter: { issuedAfter: string; issuedBefore: string; offset?: number }): Promise<OblioListedInvoice[]> {
  const data = await call<Record<string, unknown>[]>(
    { method: "GET", path: "/docs/invoice/list" },
    { issuedAfter: filter.issuedAfter, issuedBefore: filter.issuedBefore, withEinvoiceStatus: 1, withCollects: 1, limitPerPage: 100, offset: filter.offset ?? 0, orderBy: "issueDate", orderDir: "ASC" }
  );
  return (data ?? []).map((row) => {
    const status = row.einvoiceStatus as Record<string, unknown> | undefined;
    const collects = Array.isArray(row.collects) ? (row.collects as Record<string, unknown>[]) : [];
    return {
      seriesName: String(row.seriesName ?? ""),
      number: String(row.number ?? ""),
      issueDate: String(row.issueDate ?? ""),
      dueDate: row.dueDate ? String(row.dueDate) : null,
      total: Number(row.total ?? 0),
      canceled: row.canceled === true || row.canceled === 1 || row.canceled === "1",
      draft: row.draft === true || row.draft === 1 || row.draft === "1",
      link: String(row.link ?? ""),
      einvoice: status ? { text: String(status.text ?? ""), sent: status.sent === true || status.sent === 1, code: Number(status.code ?? -1) } : null,
      collected: collects.reduce((sum, item) => sum + Number(item.value ?? 0), 0),
      collects: collects.map((item) => ({ issueDate: String(item.issueDate ?? ""), type: String(item.type ?? ""), number: String(item.number ?? ""), value: Number(item.value ?? 0) })),
    };
  });
}
