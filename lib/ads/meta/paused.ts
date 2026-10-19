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
 *
 * Din faza 9 (căutarea și întreținerea contului), lista are și listele
 * comune de negative, legăturile lor, legarea materialelor de campanii și
 * acțiunile de conversie — fiecare cu regula ei, mai jos.
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
  "sharedSetOperation",
  "sharedCriterionOperation",
  "campaignSharedSetOperation",
  "campaignAssetOperation",
  "conversionActionOperation",
] as const;

/** Operațiile al căror obiect are status de livrare — acolo trebuie PAUSED. */
const GOOGLE_OPERATIONS_WITH_STATUS: readonly string[] = ["campaignOperation", "adGroupOperation", "adGroupAdOperation"];

/** Singurul tip de listă comună pe care îl creează sau îl leagă portalul: negative. */
export const GOOGLE_NEGATIVE_LIST_TYPE = "NEGATIVE_KEYWORDS" as const;

/**
 * Ce știe garda despre cont, dincolo de cerere: listele comune de negative
 * EXISTENTE, citite chiar înainte de trimitere (`shared_set.type =
 * NEGATIVE_KEYWORDS`). Doar de ele se pot lega campanii și doar în ele se pot
 * adăuga cuvinte; orice altă listă existentă e refuzată.
 */
export interface GoogleGuardContext {
  negativeSharedSets?: readonly string[];
}

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

/** Un id temporar (negativ) — resursa se creează în aceeași cerere. */
const TEMPORARY = /^customers\/\d{10}\/[A-Za-z]+\/-\d+$/;

/** Câmpurile unui criteriu care fac din el un criteriu de targetare (pozitiv sau negativ). */
const CRITERION_FIELDS = [
  "keyword",
  "location",
  "language",
  "adSchedule",
  "proximity",
  "audience",
  "ageRange",
  "gender",
  "placement",
  "userList",
  "userInterest",
  "topic",
  "webpage",
  "device",
  "brandList",
  "keywordTheme",
  "listingScope",
  "contentLabel",
  "ipBlock",
  "mobileAppCategory",
  "mobileApplication",
  "youtubeVideo",
  "youtubeChannel",
  "operatingSystemVersion",
  "carrier",
  "incomeRange",
  "parentalStatus",
  "localServiceId",
  "searchThemeMatchingSetting",
];

function createdIn(operations: ReadonlyArray<Record<string, unknown>>, kind: string): Map<string, Record<string, unknown>> {
  const created = new Map<string, Record<string, unknown>>();
  for (const operation of operations) {
    const create = (operation?.[kind] as { create?: Record<string, unknown> } | undefined)?.create;
    const resourceName = create?.resourceName;
    if (create && typeof resourceName === "string" && TEMPORARY.test(resourceName)) created.set(resourceName, create);
  }
  return created;
}

/**
 * Garda scrierilor de creare spre Google (`googleMutate`). Pe lângă regula de
 * la faza 6 (doar `create`, doar tipurile din listă, campanie / grup /
 * anunț cu PAUSED, niciun alt status, totul în contul din URL), din faza 9:
 *
 *   - un grup se creează doar într-o campanie creată în ACEEAȘI cerere; un
 *     anunț și un criteriu de grup, doar într-un grup creat în aceeași cerere;
 *     legarea materialelor, doar de o campanie creată în aceeași cerere;
 *   - pe o campanie EXISTENTĂ, singurul criteriu permis e un cuvânt cheie
 *     negativ (`negative: true` + `keyword`) — o campanie care rulează nu-și
 *     poate lărgi publicul din portal;
 *   - listele comune: doar de negative (`NEGATIVE_KEYWORDS`), create în
 *     cerere sau existente și citite din cont chiar înainte (`context`);
 *     cuvintele din ele, doar cuvinte; legarea lor de campanii, doar a lor;
 *   - acțiunile de conversie se creează fără status (nu cheltuie bani).
 */
export function assertGooglePaused(
  customerId: string,
  operations: ReadonlyArray<Record<string, unknown>>,
  context: GoogleGuardContext = {}
): void {
  if (!/^\d{10}$/.test(customerId)) throw new NotPausedError(`Contul Google „${customerId}” nu are forma de 10 cifre.`);
  if (!Array.isArray(operations) || operations.length === 0) throw new NotPausedError("Nicio operație de trimis spre Google.");

  const newCampaigns = createdIn(operations, "campaignOperation");
  const newAdGroups = createdIn(operations, "adGroupOperation");
  const newSharedSets = createdIn(operations, "sharedSetOperation");
  const knownNegativeSets = new Set(context.negativeSharedSets ?? []);
  const isNegativeSet = (value: unknown) =>
    typeof value === "string" &&
    ((newSharedSets.has(value) && newSharedSets.get(value)?.type === GOOGLE_NEGATIVE_LIST_TYPE) ||
      (!TEMPORARY.test(value) && value.startsWith(`customers/${customerId}/sharedSets/`) && knownNegativeSets.has(value)));

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
        `${kind} (${index}): portalul doar creează — nu actualizează, nu șterge (${verbs.join(", ") || "gol"}). Pauza are calea ei, googlePause.`
      );
    }
    const created = (body as { create?: unknown }).create;
    if (!created || typeof created !== "object" || Array.isArray(created)) {
      throw new NotPausedError(`${kind} (${index}): obiectul de creat lipsește.`);
    }
    const fields = created as Record<string, unknown>;
    for (const value of Object.values(fields)) {
      if (typeof value === "string" && value.startsWith("customers/") && !value.startsWith(`customers/${customerId}/`)) {
        throw new NotPausedError(`${kind} (${index}): resursa ${value} nu e în contul ${customerId}.`);
      }
    }
    if (GOOGLE_OPERATIONS_WITH_STATUS.includes(kind)) {
      const status = fields.status;
      if (status !== GOOGLE_PAUSED) {
        throw new NotPausedError(
          `${kind} (${index}): status lipsă sau diferit de ${GOOGLE_PAUSED} (${JSON.stringify(status)}). Google ar porni-o.`
        );
      }
    }

    switch (kind) {
      case "adGroupOperation":
        if (!newCampaigns.has(String(fields.campaign))) {
          throw new NotPausedError(`adGroupOperation (${index}): un grup nou doar într-o campanie creată în aceeași cerere, nu în ${String(fields.campaign)}.`);
        }
        break;
      case "adGroupAdOperation":
      case "adGroupCriterionOperation":
        if (!newAdGroups.has(String(fields.adGroup))) {
          throw new NotPausedError(`${kind} (${index}): doar într-un grup creat în aceeași cerere, nu în ${String(fields.adGroup)}.`);
        }
        break;
      case "campaignAssetOperation":
        if (!newCampaigns.has(String(fields.campaign))) {
          throw new NotPausedError(`campaignAssetOperation (${index}): materialele se leagă doar de o campanie creată în aceeași cerere.`);
        }
        break;
      case "campaignCriterionOperation": {
        if (newCampaigns.has(String(fields.campaign))) break;
        const targeting = CRITERION_FIELDS.filter((field) => fields[field] !== undefined);
        const extra = Object.keys(fields).filter((field) => !["resourceName", "campaign", "negative", "keyword"].includes(field));
        if (fields.negative !== true || targeting.length !== 1 || targeting[0] !== "keyword" || extra.length > 0) {
          throw new NotPausedError(
            `campaignCriterionOperation (${index}): pe o campanie existentă (${String(fields.campaign)}) portalul adaugă doar cuvinte cheie NEGATIVE — un criteriu pozitiv (${targeting.join(", ") || "necunoscut"}${fields.negative === true ? "" : ", fără negative: true"}) ar lărgi publicul.`
          );
        }
        break;
      }
      case "sharedSetOperation":
        if (fields.type !== GOOGLE_NEGATIVE_LIST_TYPE) {
          throw new NotPausedError(`sharedSetOperation (${index}): portalul creează doar liste de negative (${GOOGLE_NEGATIVE_LIST_TYPE}), nu ${JSON.stringify(fields.type)}.`);
        }
        break;
      case "sharedCriterionOperation": {
        const extra = Object.keys(fields).filter((field) => !["resourceName", "sharedSet", "keyword"].includes(field));
        if (fields.keyword === undefined || extra.length > 0) {
          throw new NotPausedError(`sharedCriterionOperation (${index}): într-o listă comună portalul pune doar cuvinte cheie (${extra.join(", ") || "fără keyword"}).`);
        }
        if (!isNegativeSet(fields.sharedSet)) {
          throw new NotPausedError(`sharedCriterionOperation (${index}): lista ${String(fields.sharedSet)} nu e o listă de negative creată acum sau citită din cont ca listă de negative.`);
        }
        break;
      }
      case "campaignSharedSetOperation":
        if (!isNegativeSet(fields.sharedSet)) {
          throw new NotPausedError(`campaignSharedSetOperation (${index}): de o campanie se leagă doar liste de negative (${String(fields.sharedSet)} nu e una verificată).`);
        }
        break;
      default:
        break;
    }
    walkGoogle(created, `${kind}.create`, GOOGLE_OPERATIONS_WITH_STATUS.includes(kind));
  });
}

// ---------------------------------------------------------------------------
// Google Ads: pauza — singura actualizare, cu garda ei
// ---------------------------------------------------------------------------

/** Ce se poate pune pe pauză: campanii și grupuri. Nimic altceva. */
export const GOOGLE_PAUSE_OPERATIONS = { campaignOperation: "campaigns", adGroupOperation: "adGroups" } as const;

/**
 * Garda lui `googlePause`: fiecare operație e EXACT
 * `{ campaignOperation | adGroupOperation: { update: { resourceName, status: "PAUSED" }, updateMask: "status" } }`,
 * pe o resursă existentă din contul din URL. Refuză orice alt câmp în mască
 * sau în obiect, orice altă valoare, orice altă resursă, orice `create` sau
 * `remove`. Pauza poate doar să oprească cheltuiala.
 */
export function assertGooglePauseOnly(customerId: string, operations: ReadonlyArray<Record<string, unknown>>): void {
  if (!/^\d{10}$/.test(customerId)) throw new NotPausedError(`Contul Google „${customerId}” nu are forma de 10 cifre.`);
  if (!Array.isArray(operations) || operations.length === 0) throw new NotPausedError("Nicio campanie de pus pe pauză.");

  operations.forEach((operation, index) => {
    const kinds = Object.keys(operation ?? {});
    const kind = kinds[0] as keyof typeof GOOGLE_PAUSE_OPERATIONS;
    if (kinds.length !== 1 || !(kind in GOOGLE_PAUSE_OPERATIONS)) {
      throw new NotPausedError(`Pauza (${index}): doar campanii și grupuri se pun pe pauză, nu ${kinds.join(", ") || "nimic"}.`);
    }
    const body = operation[kind] as Record<string, unknown> | null;
    const keys = body && typeof body === "object" ? Object.keys(body).sort() : [];
    if (keys.join(",") !== "update,updateMask") {
      throw new NotPausedError(`Pauza (${index}): operația are doar „update” și „updateMask”, nu ${keys.join(", ") || "nimic"}.`);
    }
    if (body?.updateMask !== "status") {
      throw new NotPausedError(`Pauza (${index}): updateMask trebuie să fie exact „status”, nu ${JSON.stringify(body?.updateMask)}.`);
    }
    const update = body.update as Record<string, unknown> | null;
    const fields = update && typeof update === "object" && !Array.isArray(update) ? Object.keys(update).sort() : [];
    if (fields.join(",") !== "resourceName,status") {
      throw new NotPausedError(`Pauza (${index}): se trimit doar resourceName și status, nu ${fields.join(", ") || "nimic"}.`);
    }
    if (update?.status !== GOOGLE_PAUSED) {
      throw new NotPausedError(`Pauza (${index}): statusul trimis poate fi doar ${GOOGLE_PAUSED}, nu ${JSON.stringify(update?.status)}.`);
    }
    const pattern = new RegExp(`^customers/${customerId}/${GOOGLE_PAUSE_OPERATIONS[kind]}/\\d+$`);
    if (typeof update.resourceName !== "string" || !pattern.test(update.resourceName)) {
      throw new NotPausedError(`Pauza (${index}): ${String(update.resourceName)} nu e o resursă existentă de tipul ${GOOGLE_PAUSE_OPERATIONS[kind]} din contul ${customerId}.`);
    }
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
