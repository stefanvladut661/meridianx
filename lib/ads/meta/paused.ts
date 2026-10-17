/**
 * Garda regulii care nu se negociază: portalul creează DOAR pe pauză.
 *
 * Singura valoare de status pe care o cunoaște codul portalului e cea de
 * mai jos. Nicăieri în `lib/ads` nu apare alt status scris de noi, iar
 * `metaCreate` (singura cale de scriere spre Meta) cheamă `assertPaused` pe
 * fiecare corp de cerere, înainte de rețea.
 *
 * Garda nu se bazează pe constructorii din `build.ts` — îi verifică. Caută
 * ORICE câmp de status, la orice adâncime, inclusiv în valorile deja
 * serializate ca JSON, și refuză tot ce nu e PAUSED. Un câmp de status
 * lipsă pe campanie, set sau reclamă e tot o eroare: Meta ar alege singur
 * valoarea implicită, iar noi nu lăsăm asta la voia platformei.
 *
 * Fișier fără dependențe (nici server-only), ca verificarea din
 * `verify-paused.ts` să-l poată rula direct.
 */

export const PAUSED = "PAUSED" as const;

/**
 * Muchiile contului pe care portalul scrie. `adimages` = coperta video-ului,
 * `advideos` = un video nou în bibliotecă (faza 3). Niciuna nu modifică un
 * obiect existent.
 */
export const CREATE_EDGES = ["campaigns", "adsets", "adcreatives", "ads", "adimages", "advideos"] as const;
export type CreateEdge = (typeof CREATE_EDGES)[number];

/** Muchiile pe care obiectul creat are status de livrare. */
const EDGES_WITH_STATUS: readonly CreateEdge[] = ["campaigns", "adsets", "ads"];

/** Numele câmpurilor de status acceptate de Marketing API. */
const STATUS_KEYS = new Set(["status", "configured_status", "effective_status"]);

export class NotPausedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotPausedError";
  }
}

function parseMaybeJson(value: string): unknown {
  const trimmed = value.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function walk(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const itemPath = path ? `${path}.${key}` : key;
      if (STATUS_KEYS.has(key) && item !== PAUSED) {
        throw new NotPausedError(`${itemPath} trebuie să fie ${PAUSED}, nu ${JSON.stringify(item)}.`);
      }
      walk(item, itemPath);
    }
    return;
  }
  if (typeof value === "string") {
    const parsed = parseMaybeJson(value);
    if (parsed !== undefined) walk(parsed, path);
  }
}

export function assertPaused(edge: string, payload: Record<string, unknown>): void {
  if (!(CREATE_EDGES as readonly string[]).includes(edge)) {
    throw new NotPausedError(`Muchia „${edge}” nu e una de creare a portalului.`);
  }
  if ((EDGES_WITH_STATUS as readonly string[]).includes(edge) && payload.status !== PAUSED) {
    throw new NotPausedError(
      `${edge}: status lipsă sau diferit de ${PAUSED} (${JSON.stringify(payload.status)}). Portalul creează doar pe pauză.`
    );
  }
  walk(payload, "");
}

// ---------------------------------------------------------------------------
// TikTok: aceeași regulă, alt vocabular
// ---------------------------------------------------------------------------

/**
 * Pe TikTok, „oprit” se scrie `operation_status: "DISABLE"`. Singura valoare
 * de status pe care o scrie portalul pe TikTok e cea de mai jos.
 */
export const TIKTOK_DISABLED = "DISABLE" as const;

/** Singurele căi TikTok pe care portalul scrie. Niciuna nu modifică un obiect existent. */
export const TIKTOK_CREATE_PATHS = [
  "/campaign/create/",
  "/adgroup/create/",
  "/ad/create/",
  "/file/video/ad/upload/",
  "/file/image/ad/upload/",
] as const;
export type TikTokCreatePath = (typeof TIKTOK_CREATE_PATHS)[number];

const TIKTOK_PATHS_WITH_STATUS: readonly string[] = ["/campaign/create/", "/adgroup/create/", "/ad/create/"];
const TIKTOK_STATUS_KEYS = new Set(["operation_status", "opt_status", "status", "secondary_status"]);

function walkTikTok(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkTikTok(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const itemPath = path ? `${path}.${key}` : key;
      if (TIKTOK_STATUS_KEYS.has(key) && item !== TIKTOK_DISABLED) {
        throw new NotPausedError(`${itemPath} trebuie să fie ${TIKTOK_DISABLED}, nu ${JSON.stringify(item)}.`);
      }
      walkTikTok(item, itemPath);
    }
    return;
  }
  if (typeof value === "string") {
    const parsed = parseMaybeJson(value);
    if (parsed !== undefined) walkTikTok(parsed, path);
  }
}

// ---------------------------------------------------------------------------
// Google Ads: aceeași regulă, într-o singură cerere atomică
// ---------------------------------------------------------------------------

/**
 * Pe Google, „oprit” se scrie `status: "PAUSED"` pe campanie, grup și
 * reclamă. Implicit Google pornește o campanie nouă (ENABLED), deci câmpul
 * trebuie trimis, nu lăsat la voia platformei.
 */
export const GOOGLE_PAUSED = "PAUSED" as const;

/**
 * Singurele operații din `googleAds:mutate` pe care le trimite portalul, și
 * doar ca `create`. Niciuna nu modifică un obiect existent.
 */
export const GOOGLE_CREATE_OPERATIONS = [
  "campaignBudgetOperation",
  "campaignOperation",
  "campaignCriterionOperation",
  "adGroupOperation",
  "audienceOperation",
  "adGroupCriterionOperation",
  "assetOperation",
  "adGroupAdOperation",
] as const;

/** Operațiile al căror obiect are status de livrare — acolo trebuie PAUSED. */
const GOOGLE_OPERATIONS_WITH_STATUS: readonly string[] = ["campaignOperation", "adGroupOperation", "adGroupAdOperation"];

/**
 * Orice alt câmp `status` e refuzat: pe criterii (locație, vârstă, limbă)
 * un status „PAUSED” ar OPRI restricția și ar lărgi publicul. Criteriile se
 * trimit fără status — Google le ia active, adică publicul rămâne cel din plan.
 */
function walkGoogle(value: unknown, path: string, statusAllowedHere: boolean): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkGoogle(item, `${path}[${index}]`, false));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const itemPath = path ? `${path}.${key}` : key;
      if (key === "status" && !(statusAllowedHere && item === GOOGLE_PAUSED)) {
        throw new NotPausedError(
          statusAllowedHere
            ? `${itemPath} trebuie să fie ${GOOGLE_PAUSED}, nu ${JSON.stringify(item)}.`
            : `${itemPath}: portalul nu trimite status aici (${JSON.stringify(item)}) — un criteriu oprit ar lărgi publicul.`
        );
      }
      walkGoogle(item, itemPath, false);
    }
    return;
  }
  if (typeof value === "string") {
    const parsed = parseMaybeJson(value);
    if (parsed !== undefined) walkGoogle(parsed, path, false);
  }
}

export function assertGooglePaused(customerId: string, operations: ReadonlyArray<Record<string, unknown>>): void {
  if (!/^\d{10}$/.test(customerId)) throw new NotPausedError(`Contul Google „${customerId}” nu are forma de 10 cifre.`);
  if (!Array.isArray(operations) || operations.length === 0) throw new NotPausedError("Nicio operație de trimis spre Google.");

  operations.forEach((operation, index) => {
    const kinds = Object.keys(operation ?? {});
    if (kinds.length !== 1) throw new NotPausedError(`Operația ${index}: trebuie să aibă exact un tip, nu ${kinds.length}.`);
    const kind = kinds[0];
    if (!(GOOGLE_CREATE_OPERATIONS as readonly string[]).includes(kind)) {
      throw new NotPausedError(`Operația ${index} („${kind}”) nu e una de creare a portalului.`);
    }
    const body = operation[kind];
    const verbs = body && typeof body === "object" ? Object.keys(body as Record<string, unknown>) : [];
    if (verbs.length !== 1 || verbs[0] !== "create") {
      throw new NotPausedError(
        `${kind} (${index}): portalul doar creează — nu actualizează, nu șterge (${verbs.join(", ") || "gol"}).`
      );
    }
    const created = (body as { create?: unknown }).create;
    if (!created || typeof created !== "object" || Array.isArray(created)) {
      throw new NotPausedError(`${kind} (${index}): obiectul de creat lipsește.`);
    }
    const resourceName = (created as { resourceName?: unknown }).resourceName;
    if (typeof resourceName === "string" && !resourceName.startsWith(`customers/${customerId}/`)) {
      throw new NotPausedError(`${kind} (${index}): resursa ${resourceName} nu e în contul ${customerId}.`);
    }
    if (GOOGLE_OPERATIONS_WITH_STATUS.includes(kind)) {
      const status = (created as { status?: unknown }).status;
      if (status !== GOOGLE_PAUSED) {
        throw new NotPausedError(
          `${kind} (${index}): status lipsă sau diferit de ${GOOGLE_PAUSED} (${JSON.stringify(status)}). Google ar porni-o.`
        );
      }
    }
    walkGoogle(created, `${kind}.create`, GOOGLE_OPERATIONS_WITH_STATUS.includes(kind));
  });
}

export function assertTikTokDisabled(path: string, payload: Record<string, unknown>): void {
  if (!(TIKTOK_CREATE_PATHS as readonly string[]).includes(path)) {
    throw new NotPausedError(`Calea TikTok „${path}” nu e una de creare a portalului.`);
  }
  if (TIKTOK_PATHS_WITH_STATUS.includes(path) && payload.operation_status !== TIKTOK_DISABLED) {
    throw new NotPausedError(
      `${path}: operation_status lipsă sau diferit de ${TIKTOK_DISABLED} (${JSON.stringify(payload.operation_status)}). Portalul creează doar oprit.`
    );
  }
  walkTikTok(payload, "");
}
