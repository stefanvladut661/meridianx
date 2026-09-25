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
