import type { z } from "zod";
import { CURRENCIES, type Currency } from "../../constants";
import { asArray, asNumber, asRecord, asString, getIn, pathString } from "../../plan-path";
import { countOf, formatMoney } from "../../plan-derive";
import {
  DEFAULT_MESSAGE,
  closest,
  describeValue,
  dropNulls,
  expectedLabel,
  type PlanProblem,
  type ValidationContext,
} from "../../plan-validate";
import { WORKSPACES, findWorkspace, workspaceName } from "../../workspaces";
import { countSearchOperations, scheduleTime } from "./build";
import { campaignLabel, searchLabel } from "./labels";
import {
  BIDDING_LABEL,
  CALLOUTS_MAX,
  CALLOUT_MAX,
  DAY_LABEL,
  KEYWORD_MAX_CHARS,
  KEYWORD_MAX_WORDS,
  LOCATION_MODE_LABEL,
  MATCH_TYPE_LABEL,
  MAX_CPC_SANE,
  MUTATE_OPERATIONS_MAX,
  RSA_DESCRIPTIONS_MAX,
  RSA_DESCRIPTIONS_MIN,
  RSA_DESCRIPTION_MAX,
  RSA_HEADLINES_MAX,
  RSA_HEADLINES_MIN,
  RSA_HEADLINES_RECOMMENDED,
  RSA_HEADLINE_MAX,
  RSA_PATH_MAX,
  SCHEDULE_PER_DAY_MAX,
  SEARCH_PLAN_FORMAT,
  SITELINKS_MAX,
  SITELINKS_RECOMMENDED,
  SITELINK_DESCRIPTION_MAX,
  SITELINK_TEXT_MAX,
  SNIPPETS_MAX,
  SNIPPET_HEADER_LABEL,
  SNIPPET_VALUES_MAX,
  SNIPPET_VALUES_MIN,
  SNIPPET_VALUE_MAX,
  type MatchType,
} from "./limits";
import { findConflicts, keywordNotation, type NegativeSource, type PositiveKeyword } from "./negatives";
import { checkPhone } from "./phone";
import { SEARCH_KNOWN_KEYS, searchPlanSchema, type SearchPlan } from "./schema";
import { cleanText, forbiddenKeywordChars, googleLength, hostOf, keywordKey, keywordWords } from "./text";

/**
 * Validarea planului de căutare, cu mesaje în română — același comportament
 * ca planul video (`plan-validate.ts`): schema (forma), regulile încrucișate,
 * avertismentele; toate problemele odată; `null` = câmp lipsă; „ai vrut…?”
 * la cheile necunoscute.
 *
 * În plus față de planul video, simulează potrivirea negativelor peste
 * cuvintele cheie pozitive ale aceleiași campanii: un cuvânt cheie blocat
 * de propriile negative e o eroare, cu numele listei vinovate.
 *
 * Fișierul e izomorf: rulează în browser la fiecare tastă și din nou pe
 * server, înainte de orice apel spre Google.
 */

export type SearchValidation =
  | { ok: true; plan: SearchPlan; errors: []; warnings: PlanProblem[]; operations: number }
  | { ok: false; plan: null; errors: PlanProblem[]; warnings: PlanProblem[]; operations: number | null };

// ---------------------------------------------------------------------------
// Mesajele pentru erorile de schemă
// ---------------------------------------------------------------------------

const MISSING_HINT: Record<string, string> = {
  workspace: `Scrie spațiul Google: ${WORKSPACES.filter((w) => w.platform === "google").map((w) => w.id).join(" sau ")}.`,
  ad_account: "E id-ul contului Google Ads, 10 cifre (123-456-7890), dreapta sus în Google Ads.",
  currency: "Moneda contului: RON, EUR sau USD.",
  campaigns: 'Cel puțin o campanie: "campaigns": [ { … } ].',
  "campaigns.#.key": 'O cheie scurtă, unică în plan: "key": "auto-local".',
  "campaigns.#.name": "E numele care apare în Google Ads.",
  "campaigns.#.daily_budget": 'Suma pe zi, ca număr, în moneda contului: "daily_budget": 17.',
  "campaigns.#.bidding": '{ "strategy": "maximize_clicks", "max_cpc": 1.5 }',
  "campaigns.#.bidding.strategy": "Variante: maximize_clicks (Maximizează clicurile) sau manual_cpc (CPC manual).",
  "campaigns.#.locations":
    'Fără locație, anunțurile ar apărea oriunde. Exemplu: [{ "type": "region", "name": "Cluj", "country": "RO" }].',
  "campaigns.#.ad_groups": "Cel puțin un grup, cu cuvinte cheie și un anunț.",
  "campaigns.#.ad_groups.#.name": "Numele grupului, unic în campanie.",
  "campaigns.#.ad_groups.#.final_url": "Adresa paginii pe care ajunge omul, cu https://.",
  "campaigns.#.ad_groups.#.keywords": 'Cel puțin un cuvânt cheie: [{ "text": "…", "match": "phrase" }].',
  "campaigns.#.ad_groups.#.ads": 'Un anunț responsiv: { "headlines": [{ "text": "…" }, …], "descriptions": ["…", "…"] }.',
  "campaigns.#.ad_groups.#.ads.#.headlines": `Între ${RSA_HEADLINES_MIN} și ${RSA_HEADLINES_MAX} titluri: [{ "text": "…" }].`,
  "campaigns.#.ad_groups.#.ads.#.descriptions": `Între ${RSA_DESCRIPTIONS_MIN} și ${RSA_DESCRIPTIONS_MAX} descrieri: ["…", "…"].`,
  "shared_negative_lists.#.key": 'O cheie scurtă, folosită în "negative_lists" ale campaniilor.',
  "shared_negative_lists.#.name": "Numele listei în cont (Biblioteca comună → Liste de cuvinte cheie negative).",
  "shared_negative_lists.#.keywords": 'Cel puțin un cuvânt: [{ "text": "…", "match": "broad" }].',
};

const VALUE_LABELS: Record<string, Record<string, string>> = {
  workspace: Object.fromEntries(WORKSPACES.map((w) => [w.id, workspaceName(w)])),
  currency: Object.fromEntries(CURRENCIES.map((c) => [c, c])),
  match: MATCH_TYPE_LABEL,
  strategy: BIDDING_LABEL,
  location_mode: LOCATION_MODE_LABEL,
  days: DAY_LABEL,
  header: SNIPPET_HEADER_LABEL,
};

function patternOf(path: ReadonlyArray<PropertyKey>): string {
  return path.map((part) => (typeof part === "number" ? "#" : String(part))).join(".");
}

function valueLabels(path: ReadonlyArray<PropertyKey>): Record<string, string> | undefined {
  const last = [...path].reverse().find((part) => typeof part === "string");
  return last ? VALUE_LABELS[String(last)] : undefined;
}

function listValues(path: ReadonlyArray<PropertyKey>, values: string[]): string {
  const labels = valueLabels(path);
  return values.map((value) => (labels?.[value] && labels[value] !== value ? `${value} (${labels[value]})` : value)).join(", ");
}

function hintFor(pattern: string): string | undefined {
  return MISSING_HINT[pattern];
}

function formatIssue(issue: z.core.$ZodIssue, raw: unknown, prefix: ReadonlyArray<PropertyKey> = []): PlanProblem[] {
  const fullPath = [...prefix, ...issue.path];
  const path = pathString(fullPath);
  const pattern = patternOf(fullPath);
  const label = searchLabel(raw, fullPath);
  const input = (issue as { input?: unknown }).input;

  if (issue.code === "unrecognized_keys") {
    const known = SEARCH_KNOWN_KEYS[pattern] ?? [];
    const where = path === "" ? "la rădăcina planului" : `în ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
    return issue.keys.map((key) => {
      const guess = closest(key, known);
      return {
        path: path ? `${path}.${key}` : key,
        message: `Câmpul „${key}” nu există ${where}.${guess ? ` Ai vrut „${guess}”?` : ` Câmpuri acceptate: ${known.join(", ")}.`}`,
      };
    });
  }

  if (issue.message !== DEFAULT_MESSAGE) return [{ path, message: `${label} ${issue.message}` }];

  switch (issue.code) {
    case "invalid_type": {
      if (input === undefined) {
        const hint = hintFor(pattern);
        return [{ path, message: `${label}: lipsește.${hint ? ` ${hint}` : ""}` }];
      }
      if (issue.expected === "string" && typeof input === "number" && /(ad_account|conversion_action_id)$/.test(pattern)) {
        return [{ path, message: `${label}: id-urile se scriu ca text, între ghilimele. Ca număr, un id lung se rotunjește.` }];
      }
      if (issue.expected === "number" && typeof input === "string" && /^\s*-?\d+([.,]\d+)?\s*$/.test(input)) {
        return [
          {
            path,
            message: `${label}: „${input}” e scris între ghilimele, deci e text. Scrie numărul fără ghilimele: ${input.trim().replace(",", ".")}.`,
          },
        ];
      }
      if (issue.expected === "boolean" && (input === "true" || input === "false")) {
        return [{ path, message: `${label}: „${input}” e scris între ghilimele. Scrie ${input}, fără ghilimele.` }];
      }
      return [{ path, message: `${label} trebuie să fie ${expectedLabel(issue.expected)}, nu ${describeValue(input)}.` }];
    }

    case "too_small": {
      const minimum = Number(issue.minimum);
      if (issue.origin === "string") {
        return [{ path, message: minimum <= 1 ? `${label}: nu e scris nimic.` : `${label}: prea scurt, minimum ${countOf(minimum, "caractere")}.` }];
      }
      if (issue.origin === "array") {
        const hint = hintFor(pattern);
        return [
          {
            path,
            message:
              minimum <= 1
                ? `${label}: lista e goală.${hint ? ` ${hint}` : " Pune cel puțin un element."}`
                : `${label}: prea puține elemente, minimum ${minimum}.`,
          },
        ];
      }
      return [{ path, message: `${label} trebuie să fie ${issue.inclusive ? "cel puțin" : "mai mare decât"} ${minimum}.` }];
    }

    case "too_big": {
      const maximum = Number(issue.maximum);
      if (issue.origin === "string") {
        const length = typeof input === "string" ? googleLength(input.trim()) : null;
        return [{ path, message: `${label}: ${length === null ? "prea lung" : countOf(length, "caractere")}, maximum ${maximum}.` }];
      }
      if (issue.origin === "array") {
        const length = Array.isArray(input) ? input.length : null;
        return [{ path, message: `${label}: ${length === null ? "prea multe elemente" : countOf(length, "elemente")}, maximum ${maximum}.` }];
      }
      return [{ path, message: `${label} poate fi cel mult ${maximum}.` }];
    }

    case "invalid_value": {
      const values = issue.values.map((value) => String(value));
      if (pattern === "format") {
        return [{ path, message: `Câmpul format trebuie să fie „${SEARCH_PLAN_FORMAT}”.` }];
      }
      if (input === undefined) return [{ path, message: `${label}: lipsește. Variante: ${listValues(fullPath, values)}.` }];
      const guess = typeof input === "string" ? closest(input, values) : null;
      return [
        {
          path,
          message: `${label}: ${describeValue(input)} nu e o valoare acceptată.${guess ? ` Ai vrut „${guess}”?` : ""} Variante: ${listValues(fullPath, values)}.`,
        },
      ];
    }

    case "invalid_union": {
      const union = issue as typeof issue & { discriminator?: string; options?: unknown[] };
      if (union.discriminator) {
        const value = asRecord(input)?.[union.discriminator];
        const options = (union.options ?? []).map(String).join(", ");
        return [
          {
            path,
            message:
              value === undefined
                ? `${label}: lipsește „${union.discriminator}”. Variante: ${options}.`
                : `${label}: ${describeValue(value)} nu e o valoare acceptată. Variante: ${options}.`,
          },
        ];
      }
      const deeper = issue.errors.flat().filter((inner) => inner.path.length > 0);
      if (deeper.length > 0) return deeper.flatMap((inner) => formatIssue(inner, raw, fullPath));
      if (/descriptions\.#$/.test(pattern)) {
        return [{ path, message: `${label}: o descriere e un text ("…") sau { "text": "…", "pin": 1 }.` }];
      }
      return [{ path, message: `${label} nu are o formă acceptată.` }];
    }

    default:
      return [{ path, message: `${label} nu e valid.` }];
  }
}

// ---------------------------------------------------------------------------
// Ajutoare
// ---------------------------------------------------------------------------

const isCurrency = (value: unknown): value is Currency => typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);

interface RawKeyword {
  text: string;
  match: MatchType;
  path: string;
}

/** Cuvintele unei liste brute, doar cele cu formă bună (restul le raportează schema). */
function rawKeywords(raw: unknown, path: string): RawKeyword[] {
  return asArray(getIn(raw, path)).flatMap((item, index) => {
    const record = asRecord(item);
    const text = asString(record?.text);
    const match = record?.match;
    if (!text || (match !== "broad" && match !== "phrase" && match !== "exact")) return [];
    return [{ text, match, path: `${path}.${index}` }];
  });
}

/** Regulile Google pentru textul unui cuvânt cheie (pozitiv sau negativ). */
function keywordTextProblems(raw: unknown, keyword: RawKeyword, negative = false): PlanProblem[] {
  const problems: PlanProblem[] = [];
  const label = searchLabel(raw, keyword.path);
  const text = cleanText(keyword.text);
  const length = googleLength(text);
  if (length > KEYWORD_MAX_CHARS) {
    problems.push({ path: `${keyword.path}.text`, message: `${label}: ${countOf(length, "caractere")}, Google acceptă cel mult ${KEYWORD_MAX_CHARS}.` });
  }
  const words = keywordWords(text).length;
  if (words > KEYWORD_MAX_WORDS) {
    problems.push({ path: `${keyword.path}.text`, message: `${label}: ${countOf(words, "cuvinte")}, Google acceptă cel mult ${KEYWORD_MAX_WORDS}.` });
  }
  const forbidden = forbiddenKeywordChars(text, negative);
  if (forbidden.length > 0) {
    const syntax = forbidden.some((char) => char === "[" || char === "]" || char === '"');
    problems.push({
      path: `${keyword.path}.text`,
      message: `${label}: Google nu acceptă ${forbidden.map((char) => `„${char}”`).join(", ")} într-un cuvânt cheie.${
        syntax ? ' Tipul de potrivire se scrie în "match", nu cu [ ] sau ghilimele în text.' : ""
      }`,
    });
  }
  return problems;
}

/** Dublurile (același text, același tip de potrivire) dintr-o listă. */
function duplicateProblems(raw: unknown, keywords: RawKeyword[]): PlanProblem[] {
  const seen = new Map<string, RawKeyword>();
  const problems: PlanProblem[] = [];
  for (const keyword of keywords) {
    const key = `${keywordKey(keyword.text)}|${keyword.match}`;
    const first = seen.get(key);
    if (first) {
      problems.push({
        path: keyword.path,
        message: `${searchLabel(raw, keyword.path)}: ${keywordNotation(keyword)} apare de două ori în aceeași listă (prima dată: ${searchLabel(raw, first.path).split(" › ").pop()}). Scoate dublura.`,
      });
    } else {
      seen.set(key, keyword);
    }
  }
  return problems;
}

function minutesOf(value: unknown): number | null {
  const parsed = typeof value === "string" ? scheduleTime(value) : null;
  if (!parsed) return null;
  const minute = { ZERO: 0, FIFTEEN: 15, THIRTY: 30, FORTY_FIVE: 45 }[parsed.minute] ?? 0;
  return parsed.hour * 60 + minute;
}

function locationKey(location: unknown): string | null {
  const record = asRecord(location);
  if (!record) return null;
  if (record.type === "country") return asString(record.code) ? `country|${asString(record.code)}` : null;
  const name = asString(record.name);
  return name ? `${String(record.type)}|${keywordKey(name)}|${asString(record.country) ?? ""}` : null;
}

// ---------------------------------------------------------------------------
// Regulile încrucișate
// ---------------------------------------------------------------------------

function crossRules(raw: Record<string, unknown>, context: ValidationContext): PlanProblem[] {
  const errors: PlanProblem[] = [];
  const workspace = findWorkspace(raw.workspace);

  if (workspace && workspace.platform !== "google") {
    errors.push({
      path: "workspace",
      message: `Planul de căutare se creează în Google Ads, iar ${workspaceName(workspace)} e pe altă platformă. Scrie ${WORKSPACES.filter((w) => w.platform === "google").map((w) => w.id).join(" sau ")}.`,
    });
  } else if (workspace && context.currentWorkspace && context.currentWorkspace !== workspace.id) {
    const current = findWorkspace(context.currentWorkspace);
    errors.push({
      path: "workspace",
      message: `Planul e pentru ${workspaceName(workspace)}, dar lucrezi în ${current ? workspaceName(current) : context.currentWorkspace}. Portalul creează doar în spațiul afișat sus: schimbă spațiul din selector sau corectează planul.`,
    });
  }

  const account = asString(raw.ad_account);
  if (account && !/^\d{3}-?\d{3}-?\d{4}$/.test(account)) {
    errors.push({
      path: "ad_account",
      message: `Contul Google Ads are 10 cifre (123-456-7890, cu sau fără cratime), dreapta sus în Google Ads. „${account}” nu are forma asta.`,
    });
  }

  // Bugetul: plafonul spațiului se aplică pe SUMA bugetelor zilnice din tot planul.
  const campaigns = asArray(raw.campaigns);
  const currency = raw.currency;
  if (workspace && isCurrency(currency)) {
    const cap = workspace.dailyBudgetCap[currency];
    const total = campaigns.reduce<number>((sum, campaign) => sum + (asNumber(asRecord(campaign)?.daily_budget) ?? 0), 0);
    if (cap === undefined) {
      errors.push({
        path: "currency",
        message: `Spațiul ${workspaceName(workspace)} nu acceptă ${currency}: nu are plafon de buget pentru moneda asta. Dacă un cont chiar e în ${currency}, adaugă plafonul în lib/ads/workspaces.ts.`,
      });
    } else if (Math.round(total * 100) > Math.round(cap * 100)) {
      errors.push({
        path: "campaigns",
        message: `Bugetele zilnice adunate fac ${formatMoney(Math.round(total * 100) / 100, currency)} pe zi, peste plafonul spațiului ${workspaceName(workspace)}: ${formatMoney(cap, currency)} pe zi pentru tot planul. Verifică să nu fie un zero în plus; dacă suma e intenționată, plafonul se schimbă în lib/ads/workspaces.ts.`,
      });
    }
  }

  // Listele comune ---------------------------------------------------------------------------
  const lists = asArray(raw.shared_negative_lists);
  const listKeys = new Map<string, number>();
  const listNames = new Map<string, number>();
  lists.forEach((list, index) => {
    const record = asRecord(list);
    const key = asString(record?.key);
    const name = asString(record?.name);
    if (key) {
      if (listKeys.has(key)) errors.push({ path: `shared_negative_lists.${index}.key`, message: `Cheia „${key}” e folosită de două liste comune. Fiecare listă are cheia ei.` });
      else listKeys.set(key, index);
    }
    if (name) {
      const folded = name.toLocaleLowerCase("ro-RO");
      if (listNames.has(folded)) errors.push({ path: `shared_negative_lists.${index}.name`, message: `Două liste comune se numesc „${name}”. Google cere nume unice în cont.` });
      else listNames.set(folded, index);
    }
    const keywords = rawKeywords(raw, `shared_negative_lists.${index}.keywords`);
    keywords.forEach((keyword) => errors.push(...keywordTextProblems(raw, keyword, true)));
    errors.push(...duplicateProblems(raw, keywords));
  });

  // Campaniile ------------------------------------------------------------------------------
  const campaignKeys = new Set<string>();
  const campaignNames = new Map<string, number>();
  campaigns.forEach((campaign, campaignIndex) => {
    const at = `campaigns.${campaignIndex}`;
    const record = asRecord(campaign);
    if (!record) return;
    const named = campaignLabel(raw, campaignIndex);
    const capitalized = named.charAt(0).toUpperCase() + named.slice(1);

    const key = asString(record.key);
    if (key) {
      if (campaignKeys.has(key)) errors.push({ path: `${at}.key`, message: `${capitalized}: cheia „${key}” e folosită de altă campanie din plan.` });
      campaignKeys.add(key);
    }
    const name = asString(record.name);
    if (name) {
      const folded = name.toLocaleLowerCase("ro-RO");
      const first = campaignNames.get(folded);
      if (first !== undefined) {
        errors.push({ path: `${at}.name`, message: `Două campanii din plan se numesc „${name}” (${first + 1} și ${campaignIndex + 1}). Google cere nume unice în cont.` });
      } else {
        campaignNames.set(folded, campaignIndex);
      }
    }

    // Listele legate.
    const linked = asArray(record.negative_lists);
    const seenLinks = new Set<string>();
    linked.forEach((value, index) => {
      const linkKey = asString(value);
      if (!linkKey) return;
      if (!listKeys.has(linkKey)) {
        const guess = closest(linkKey, [...listKeys.keys()]);
        errors.push({
          path: `${at}.negative_lists.${index}`,
          message: `${capitalized}: lista „${linkKey}” nu există în "shared_negative_lists".${guess ? ` Ai vrut „${guess}”?` : listKeys.size > 0 ? ` Liste: ${[...listKeys.keys()].join(", ")}.` : ""}`,
        });
      }
      if (seenLinks.has(linkKey)) errors.push({ path: `${at}.negative_lists.${index}`, message: `${capitalized}: lista „${linkKey}” e legată de două ori.` });
      seenLinks.add(linkKey);
    });

    // Licitarea.
    const strategy = getIn(record, "bidding.strategy");
    const campaignCpc = asNumber(getIn(record, "bidding.max_cpc"));
    const groups = asArray(record.ad_groups);
    groups.forEach((group, groupIndex) => {
      const groupCpc = asNumber(asRecord(group)?.max_cpc);
      if (strategy === "maximize_clicks" && asRecord(group)?.max_cpc !== undefined) {
        errors.push({
          path: `${at}.ad_groups.${groupIndex}.max_cpc`,
          message: `${searchLabel(raw, `${at}.ad_groups.${groupIndex}`)}: cu „Maximizează clicurile”, Google nu folosește licitarea pe grup. Pune plafonul pe campanie (bidding.max_cpc) sau treci campania pe manual_cpc.`,
        });
      }
      if (strategy === "manual_cpc" && groupCpc === null && campaignCpc === null) {
        errors.push({
          path: `${at}.ad_groups.${groupIndex}.max_cpc`,
          message: `${searchLabel(raw, `${at}.ad_groups.${groupIndex}`)}: la CPC manual, grupul are nevoie de o licitare. Pune "max_cpc" pe grup sau pe campanie (bidding.max_cpc, folosit de toate grupurile fără licitare).`,
        });
      }
    });

    // Locațiile.
    const locationKeys = new Map<string, number>();
    asArray(record.locations).forEach((location, index) => {
      const locationRecord = asRecord(location);
      if (locationRecord?.radius_km !== undefined) {
        errors.push({
          path: `${at}.locations.${index}.radius_km`,
          message: `${searchLabel(raw, `${at}.locations.${index}`)}: pe căutare, portalul țintește orașul sau regiunea întreagă, fără rază. Scoate "radius_km".`,
        });
      }
      const locKey = locationKey(location);
      if (!locKey) return;
      if (locationKeys.has(locKey)) errors.push({ path: `${at}.locations.${index}`, message: `${capitalized}: aceeași locație apare de două ori. Scoate dublura.` });
      else locationKeys.set(locKey, index);
    });
    asArray(record.excluded_locations).forEach((location, index) => {
      if (asRecord(location)?.radius_km !== undefined) {
        errors.push({ path: `${at}.excluded_locations.${index}.radius_km`, message: `${searchLabel(raw, `${at}.excluded_locations.${index}`)}: excluderile se fac fără rază.` });
      }
      const locKey = locationKey(location);
      if (locKey && locationKeys.has(locKey)) {
        errors.push({ path: `${at}.excluded_locations.${index}`, message: `${capitalized}: aceeași locație e și țintită, și exclusă. Păstreaz-o într-o singură listă.` });
      }
    });
    const languages = asArray(record.languages).map(asString).filter((code): code is string => Boolean(code));
    if (new Set(languages).size !== languages.length) errors.push({ path: `${at}.languages`, message: `${capitalized}: aceeași limbă apare de două ori.` });

    // Programul.
    const perDay = new Map<string, Array<{ from: number; to: number; index: number }>>();
    asArray(record.schedule).forEach((item, index) => {
      const itemRecord = asRecord(item);
      if (!itemRecord) return;
      const label = searchLabel(raw, `${at}.schedule.${index}`);
      const from = minutesOf(itemRecord.from);
      const to = minutesOf(itemRecord.to);
      for (const [field, value, minutes] of [["from", itemRecord.from, from], ["to", itemRecord.to, to]] as const) {
        if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value.trim()) && minutes === null) {
          errors.push({
            path: `${at}.schedule.${index}.${field}`,
            message: `${label}: „${value}” nu merge. Google programează din 15 în 15 minute (:00, :15, :30, :45), între 00:00 și 24:00.`,
          });
        }
      }
      if (from !== null && to !== null && from >= to) {
        errors.push({ path: `${at}.schedule.${index}`, message: `${label}: ora de sfârșit (${String(itemRecord.to)}) trebuie să fie după cea de început (${String(itemRecord.from)}). Pentru program peste miezul nopții, fă două intervale.` });
      }
      const days = asArray(itemRecord.days).map(asString).filter((day): day is string => Boolean(day));
      if (new Set(days).size !== days.length) errors.push({ path: `${at}.schedule.${index}.days`, message: `${label}: aceeași zi apare de două ori.` });
      if (from === null || to === null || from >= to) return;
      for (const day of new Set(days)) perDay.set(day, [...(perDay.get(day) ?? []), { from, to, index }]);
    });
    for (const [day, slots] of perDay) {
      const dayName = DAY_LABEL[day as keyof typeof DAY_LABEL] ?? day;
      if (slots.length > SCHEDULE_PER_DAY_MAX) {
        errors.push({ path: `${at}.schedule`, message: `${capitalized}: ${countOf(slots.length, "intervale")} ${dayName}; Google acceptă cel mult ${SCHEDULE_PER_DAY_MAX} pe zi.` });
      }
      const sorted = [...slots].sort((a, b) => a.from - b.from);
      for (let index = 1; index < sorted.length; index += 1) {
        if (sorted[index].from < sorted[index - 1].to) {
          errors.push({
            path: `${at}.schedule.${sorted[index].index}`,
            message: `${capitalized}: intervalele ${sorted[index - 1].index + 1} și ${sorted[index].index + 1} din program se suprapun ${dayName}. Google nu acceptă intervale suprapuse.`,
          });
        }
      }
    }

    // Negativele campaniei.
    const campaignNegatives = rawKeywords(raw, `${at}.negatives`);
    campaignNegatives.forEach((keyword) => errors.push(...keywordTextProblems(raw, keyword, true)));
    errors.push(...duplicateProblems(raw, campaignNegatives));

    // Materialele.
    errors.push(...assetRules(raw, record, at, capitalized));

    // Grupurile.
    const groupNames = new Map<string, number>();
    groups.forEach((group, groupIndex) => {
      const groupAt = `${at}.ad_groups.${groupIndex}`;
      const groupRecord = asRecord(group);
      if (!groupRecord) return;
      const groupName = asString(groupRecord.name);
      if (groupName) {
        const folded = groupName.toLocaleLowerCase("ro-RO");
        if (groupNames.has(folded)) {
          errors.push({ path: `${groupAt}.name`, message: `${capitalized}: două grupuri se numesc „${groupName}”. Google cere nume unice în campanie.` });
        } else {
          groupNames.set(folded, groupIndex);
        }
      }
      const keywords = rawKeywords(raw, `${groupAt}.keywords`);
      keywords.forEach((keyword) => errors.push(...keywordTextProblems(raw, keyword)));
      errors.push(...duplicateProblems(raw, keywords));
      const negatives = rawKeywords(raw, `${groupAt}.negatives`);
      negatives.forEach((keyword) => errors.push(...keywordTextProblems(raw, keyword, true)));
      errors.push(...duplicateProblems(raw, negatives));
      asArray(groupRecord.ads).forEach((_, adIndex) => errors.push(...adRules(raw, `${groupAt}.ads.${adIndex}`)));
    });

    // Conflictele: negativele (grupului, campaniei, listelor legate) peste cuvintele pozitive.
    errors.push(...conflictProblems(raw, record, at).errors);
  });

  return errors;
}

function assetRules(raw: unknown, campaign: Record<string, unknown>, at: string, campaignName: string): PlanProblem[] {
  const errors: PlanProblem[] = [];
  const assets = asRecord(campaign.assets);
  if (!assets) return errors;

  const sitelinks = asArray(assets.sitelinks);
  if (sitelinks.length > SITELINKS_MAX) {
    errors.push({ path: `${at}.assets.sitelinks`, message: `${campaignName}: ${countOf(sitelinks.length, "linkuri suplimentare")}, Google acceptă cel mult ${SITELINKS_MAX} pe campanie.` });
  }
  const sitelinkTexts = new Set<string>();
  sitelinks.forEach((sitelink, index) => {
    const path = `${at}.assets.sitelinks.${index}`;
    const record = asRecord(sitelink);
    const label = searchLabel(raw, path);
    const text = asString(record?.text);
    if (text) {
      const length = googleLength(cleanText(text));
      if (length > SITELINK_TEXT_MAX) errors.push({ path: `${path}.text`, message: `${label}: textul are ${countOf(length, "caractere")}, maximum ${SITELINK_TEXT_MAX}.` });
      const folded = cleanText(text).toLocaleLowerCase("ro-RO");
      if (sitelinkTexts.has(folded)) errors.push({ path: `${path}.text`, message: `${label}: alt link suplimentar are același text. Google refuză dublurile.` });
      sitelinkTexts.add(folded);
    }
    const first = asString(record?.description1);
    const second = asString(record?.description2);
    for (const [field, value] of [["description1", first], ["description2", second]] as const) {
      if (!value) continue;
      const length = googleLength(cleanText(value));
      if (length > SITELINK_DESCRIPTION_MAX) {
        errors.push({ path: `${path}.${field}`, message: `${label}: ${field === "description1" ? "descrierea 1" : "descrierea 2"} are ${countOf(length, "caractere")}, maximum ${SITELINK_DESCRIPTION_MAX}.` });
      }
    }
    if (Boolean(first) !== Boolean(second)) {
      errors.push({
        path: `${path}.${first ? "description2" : "description1"}`,
        message: `${label}: Google cere ambele rânduri de descriere sau niciunul. Completează și ${first ? "description2" : "description1"} sau scoate-o pe cealaltă.`,
      });
    }
  });

  const callouts = asArray(assets.callouts);
  if (callouts.length > CALLOUTS_MAX) {
    errors.push({ path: `${at}.assets.callouts`, message: `${campaignName}: ${countOf(callouts.length, "mesaje scurte")}, Google acceptă cel mult ${CALLOUTS_MAX} pe campanie.` });
  }
  const calloutTexts = new Set<string>();
  callouts.forEach((callout, index) => {
    const text = asString(callout);
    if (!text) return;
    const path = `${at}.assets.callouts.${index}`;
    const length = googleLength(cleanText(text));
    if (length > CALLOUT_MAX) errors.push({ path, message: `${searchLabel(raw, path)}: ${countOf(length, "caractere")}, maximum ${CALLOUT_MAX}.` });
    const folded = cleanText(text).toLocaleLowerCase("ro-RO");
    if (calloutTexts.has(folded)) errors.push({ path, message: `${searchLabel(raw, path)}: apare de două ori.` });
    calloutTexts.add(folded);
  });

  const snippets = asArray(assets.snippets);
  if (snippets.length > SNIPPETS_MAX) {
    errors.push({ path: `${at}.assets.snippets`, message: `${campaignName}: ${countOf(snippets.length, "fragmente structurate")}, Google acceptă cel mult ${SNIPPETS_MAX} pe campanie.` });
  }
  snippets.forEach((snippet, index) => {
    const path = `${at}.assets.snippets.${index}`;
    const label = searchLabel(raw, path);
    const values = asArray(asRecord(snippet)?.values);
    if (values.length > 0 && (values.length < SNIPPET_VALUES_MIN || values.length > SNIPPET_VALUES_MAX)) {
      errors.push({
        path: `${path}.values`,
        message: `${label}: ${countOf(values.length, "valori")}; Google cere între ${SNIPPET_VALUES_MIN} și ${SNIPPET_VALUES_MAX}.`,
      });
    }
    const seen = new Set<string>();
    values.forEach((value, valueIndex) => {
      const text = asString(value);
      if (!text) return;
      const length = googleLength(cleanText(text));
      if (length > SNIPPET_VALUE_MAX) {
        errors.push({ path: `${path}.values.${valueIndex}`, message: `${label}: „${text}” are ${countOf(length, "caractere")}, maximum ${SNIPPET_VALUE_MAX}.` });
      }
      const folded = cleanText(text).toLocaleLowerCase("ro-RO");
      if (seen.has(folded)) errors.push({ path: `${path}.values.${valueIndex}`, message: `${label}: „${text}” apare de două ori.` });
      seen.add(folded);
    });
  });

  const call = asRecord(assets.call);
  const phone = asString(call?.phone);
  const country = asString(call?.country);
  if (call && phone && country) {
    const result = checkPhone(country, phone);
    if (!result.ok) errors.push({ path: `${at}.assets.call.phone`, message: `${searchLabel(raw, `${at}.assets.call`)}: telefonul ${result.message}` });
  }
  return errors;
}

function adRules(raw: unknown, path: string): PlanProblem[] {
  const errors: PlanProblem[] = [];
  const ad = asRecord(getIn(raw, path));
  if (!ad) return errors;
  const label = searchLabel(raw, path);

  const headlines = asArray(ad.headlines).map((item, index) => ({ record: asRecord(item), index }));
  if (headlines.length > 0 && headlines.length < RSA_HEADLINES_MIN) {
    errors.push({ path: `${path}.headlines`, message: `${label}: ${countOf(headlines.length, "titluri")}; Google cere cel puțin ${RSA_HEADLINES_MIN}.` });
  }
  if (headlines.length > RSA_HEADLINES_MAX) {
    errors.push({ path: `${path}.headlines`, message: `${label}: ${countOf(headlines.length, "titluri")}; Google acceptă cel mult ${RSA_HEADLINES_MAX}.` });
  }
  const headlineTexts = new Map<string, number>();
  headlines.forEach(({ record, index }) => {
    const text = asString(record?.text);
    if (!text) return;
    const clean = cleanText(text);
    const length = googleLength(clean);
    if (length > RSA_HEADLINE_MAX) {
      errors.push({ path: `${path}.headlines.${index}.text`, message: `${label} › titlul ${index + 1} („${clean}”): ${countOf(length, "caractere")}, maximum ${RSA_HEADLINE_MAX}.` });
    }
    const folded = clean.toLocaleLowerCase("ro-RO");
    const first = headlineTexts.get(folded);
    if (first !== undefined) {
      errors.push({ path: `${path}.headlines.${index}.text`, message: `${label}: titlurile ${first + 1} și ${index + 1} sunt la fel („${clean}”). Google refuză titlurile duplicate.` });
    } else {
      headlineTexts.set(folded, index);
    }
  });

  const descriptions = asArray(ad.descriptions).map((item, index) => ({
    text: asString(item) ?? asString(asRecord(item)?.text),
    pin: asNumber(asRecord(item)?.pin),
    index,
  }));
  if (descriptions.length > 0 && descriptions.length < RSA_DESCRIPTIONS_MIN) {
    errors.push({ path: `${path}.descriptions`, message: `${label}: ${countOf(descriptions.length, "descrieri")}; Google cere cel puțin ${RSA_DESCRIPTIONS_MIN}.` });
  }
  if (descriptions.length > RSA_DESCRIPTIONS_MAX) {
    errors.push({ path: `${path}.descriptions`, message: `${label}: ${countOf(descriptions.length, "descrieri")}; Google acceptă cel mult ${RSA_DESCRIPTIONS_MAX}.` });
  }
  const descriptionTexts = new Map<string, number>();
  descriptions.forEach(({ text, index }) => {
    if (!text) return;
    const clean = cleanText(text);
    const length = googleLength(clean);
    const fieldPath = typeof asArray(ad.descriptions)[index] === "string" ? `${path}.descriptions.${index}` : `${path}.descriptions.${index}.text`;
    if (length > RSA_DESCRIPTION_MAX) {
      errors.push({ path: fieldPath, message: `${label} › descrierea ${index + 1}: ${countOf(length, "caractere")}, maximum ${RSA_DESCRIPTION_MAX}.` });
    }
    const folded = clean.toLocaleLowerCase("ro-RO");
    const first = descriptionTexts.get(folded);
    if (first !== undefined) {
      errors.push({ path: fieldPath, message: `${label}: descrierile ${first + 1} și ${index + 1} sunt la fel. Google refuză descrierile duplicate.` });
    } else {
      descriptionTexts.set(folded, index);
    }
  });

  // Fixările: pozițiile 1 și 2 trebuie să poată fi ocupate (titlurile), poziția 1 la descrieri.
  const headlinePins = headlines.map(({ record }) => asNumber(record?.pin));
  const freeHeadlines = headlinePins.filter((pin) => pin === null).length;
  if (headlines.length >= RSA_HEADLINES_MIN && freeHeadlines === 0) {
    for (const position of [1, 2]) {
      if (!headlinePins.includes(position)) {
        errors.push({
          path: `${path}.headlines`,
          message: `${label}: toate titlurile sunt fixate, dar niciunul pe poziția ${position}. Google trebuie să aibă mereu un titlu pentru pozițiile 1 și 2: fixează unul acolo sau lasă câteva titluri nefixate.`,
        });
      }
    }
  }
  const freeDescriptions = descriptions.filter(({ pin }) => pin === null).length;
  if (descriptions.length >= RSA_DESCRIPTIONS_MIN && freeDescriptions === 0 && !descriptions.some(({ pin }) => pin === 1)) {
    errors.push({ path: `${path}.descriptions`, message: `${label}: toate descrierile sunt fixate, dar niciuna pe poziția 1.` });
  }

  for (const field of ["path1", "path2"] as const) {
    const value = asString(ad[field]);
    if (!value) continue;
    const length = googleLength(cleanText(value));
    if (length > RSA_PATH_MAX) errors.push({ path: `${path}.${field}`, message: `${label}: ${field === "path1" ? "calea 1" : "calea 2"} („${value}”) are ${countOf(length, "caractere")}, maximum ${RSA_PATH_MAX}.` });
  }
  if (asString(ad.path2) && !asString(ad.path1)) {
    errors.push({ path: `${path}.path2`, message: `${label}: calea 2 se afișează după calea 1, deci are nevoie de ea. Pune "path1" sau mută textul acolo.` });
  }
  return errors;
}

/**
 * Cuvintele pozitive ale unei campanii blocate de negativele ei (ale
 * grupului, ale campaniei, ale listelor legate). Erorile = blocaj sigur;
 * avertismentele = doar cu ș/ț scrise altfel (cu sedilă).
 */
function conflictProblems(raw: unknown, campaign: Record<string, unknown>, at: string): { errors: PlanProblem[]; warnings: PlanProblem[] } {
  const errors: PlanProblem[] = [];
  const warnings: PlanProblem[] = [];
  const listsByKey = new Map<string, { name: string; index: number }>();
  asArray(getIn(raw, "shared_negative_lists")).forEach((list, index) => {
    const key = asString(asRecord(list)?.key);
    if (key) listsByKey.set(key, { name: asString(asRecord(list)?.name) ?? key, index });
  });

  type Origin = { where: string; path: string };
  const campaignWide: Array<NegativeSource<Origin>> = rawKeywords(raw, `${at}.negatives`).map((keyword) => ({
    text: keyword.text,
    match: keyword.match,
    meta: { where: "negativele campaniei", path: keyword.path },
  }));
  for (const value of asArray(campaign.negative_lists)) {
    const key = asString(value);
    const list = key ? listsByKey.get(key) : undefined;
    if (!list) continue;
    rawKeywords(raw, `shared_negative_lists.${list.index}.keywords`).forEach((keyword) =>
      campaignWide.push({ text: keyword.text, match: keyword.match, meta: { where: `lista „${list.name}”`, path: keyword.path } })
    );
  }

  let reported = 0;
  const LIMIT = 40;
  asArray(campaign.ad_groups).forEach((_, groupIndex) => {
    const groupAt = `${at}.ad_groups.${groupIndex}`;
    const own: Array<NegativeSource<Origin>> = rawKeywords(raw, `${groupAt}.negatives`).map((keyword) => ({
      text: keyword.text,
      match: keyword.match,
      meta: { where: "negativele grupului", path: keyword.path },
    }));
    const positives: Array<PositiveKeyword<string>> = rawKeywords(raw, `${groupAt}.keywords`).map((keyword) => ({
      text: keyword.text,
      match: keyword.match,
      meta: keyword.path,
    }));
    for (const conflict of findConflicts(positives, [...own, ...campaignWide])) {
      const message = `${searchLabel(raw, conflict.positive.meta)} e blocat de ${conflict.negative.meta.where}: negativul ${keywordNotation(conflict.negative)}${
        conflict.certain ? "" : " (scris cu ș/ț cu sedilă — Google le poate vedea ca litere diferite)"
      }. Campania ar plăti pentru un cuvânt pe care tot ea îl oprește: scoate negativul sau cuvântul.`;
      if (conflict.certain) {
        reported += 1;
        if (reported <= LIMIT) errors.push({ path: conflict.positive.meta, message });
      } else {
        warnings.push({ path: conflict.positive.meta, message });
      }
    }
  });
  if (reported > LIMIT) {
    errors.push({ path: at, message: `${campaignLabel(raw, Number(at.split(".")[1]))}: încă ${countOf(reported - LIMIT, "cuvinte cheie")} blocate de negative, pe lângă cele de mai sus.` });
  }
  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Avertismentele
// ---------------------------------------------------------------------------

function collectWarnings(raw: Record<string, unknown>): PlanProblem[] {
  const warnings: PlanProblem[] = [];
  const currency = isCurrency(raw.currency) ? raw.currency : null;
  const sane = currency ? MAX_CPC_SANE[currency] : undefined;

  asArray(raw.campaigns).forEach((campaign, campaignIndex) => {
    const at = `campaigns.${campaignIndex}`;
    const record = asRecord(campaign);
    if (!record) return;
    const named = campaignLabel(raw, campaignIndex);
    const capitalized = named.charAt(0).toUpperCase() + named.slice(1);

    if (getIn(record, "networks.search_partners") === true) {
      warnings.push({ path: `${at}.networks.search_partners`, message: `${capitalized}: anunțurile apar și pe site-urile partenere de căutare ale Google. Traficul de acolo e de obicei mai slab; oprit e varianta sigură.` });
    }
    if (getIn(record, "networks.display") === true) {
      warnings.push({ path: `${at}.networks.display`, message: `${capitalized}: rețeaua de display e pornită — anunțurile text apar și pe site-uri, ca bannere. O campanie de căutare de obicei o ține oprită.` });
    }
    if (record.location_mode === "presence_or_interest") {
      warnings.push({ path: `${at}.location_mode`, message: `${capitalized}: anunțurile apar și oamenilor din afara zonei care doar caută despre ea. Pentru un serviciu local, „presence” (doar oamenii din zonă) e de obicei ce vrei.` });
    }
    if (asArray(record.languages).length === 0) {
      warnings.push({ path: `${at}.languages`, message: `${capitalized}: fără limbă, campania țintește toate limbile. Pentru anunțuri în română, pune ["ro"].` });
    }

    const strategy = getIn(record, "bidding.strategy");
    const cap = asNumber(getIn(record, "bidding.max_cpc"));
    const budget = asNumber(record.daily_budget);
    if (strategy === "maximize_clicks" && cap === null) {
      warnings.push({ path: `${at}.bidding.max_cpc`, message: `${capitalized}: „Maximizează clicurile” fără plafon — Google poate plăti oricât pe un clic, cât timp intră în buget. Un plafon (bidding.max_cpc) ține costul pe clic sub control.` });
    }
    if (cap !== null && sane !== undefined && cap > sane) {
      warnings.push({ path: `${at}.bidding.max_cpc`, message: `${capitalized}: ${formatMoney(cap, currency)} pe clic e mult pentru o campanie locală. Verifică să nu fie un zero în plus.` });
    }
    if (cap !== null && budget !== null && cap > budget) {
      warnings.push({ path: `${at}.bidding.max_cpc`, message: `${capitalized}: un singur clic (până la ${formatMoney(cap, currency)}) poate consuma tot bugetul zilei (${formatMoney(budget, currency)}).` });
    }

    // Domeniile din campanie.
    const hosts = new Map<string, string>();
    const noteHost = (url: unknown, path: string) => {
      const host = typeof url === "string" ? hostOf(url) : null;
      if (host && !hosts.has(host)) hosts.set(host, path);
    };
    asArray(record.ad_groups).forEach((group, groupIndex) => {
      const groupRecord = asRecord(group);
      const groupAt = `${at}.ad_groups.${groupIndex}`;
      noteHost(groupRecord?.final_url, `${groupAt}.final_url`);
      asArray(groupRecord?.ads).forEach((ad, adIndex) => noteHost(asRecord(ad)?.final_url, `${groupAt}.ads.${adIndex}.final_url`));
      const groupCpc = asNumber(groupRecord?.max_cpc);
      if (groupCpc !== null && sane !== undefined && groupCpc > sane) {
        warnings.push({ path: `${groupAt}.max_cpc`, message: `${searchLabel(raw, groupAt)}: ${formatMoney(groupCpc, currency)} pe clic e mult. Verifică să nu fie un zero în plus.` });
      }
      asArray(groupRecord?.ads).forEach((ad, adIndex) => {
        const adAt = `${groupAt}.ads.${adIndex}`;
        const headlines = asArray(asRecord(ad)?.headlines);
        if (headlines.length >= RSA_HEADLINES_MIN && headlines.length < RSA_HEADLINES_RECOMMENDED) {
          warnings.push({ path: `${adAt}.headlines`, message: `${searchLabel(raw, adAt)}: doar ${countOf(headlines.length, "titluri")}. Cu sub ${RSA_HEADLINES_RECOMMENDED}, Google are puține combinații de încercat; 12–15 e ce recomandă.` });
        }
        const pinned = headlines.filter((item) => asRecord(item)?.pin !== undefined).length;
        if (pinned > 3 || (headlines.length > 0 && pinned > 0 && pinned >= headlines.length - 1)) {
          warnings.push({ path: `${adAt}.headlines`, message: `${searchLabel(raw, adAt)}: ${countOf(pinned, "titluri")} fixate din ${headlines.length}. Fiecare fixare scade combinațiile pe care le poate încerca Google; fixează doar ce trebuie să apară mereu (de obicei titlul 1).` });
        }
      });
    });
    asArray(getIn(record, "assets.sitelinks")).forEach((sitelink, index) => noteHost(asRecord(sitelink)?.url, `${at}.assets.sitelinks.${index}.url`));
    if (hosts.size > 1) {
      const [first, ...others] = [...hosts.entries()];
      warnings.push({
        path: others[0][1],
        message: `${capitalized}: adresele duc pe domenii diferite (${[first, ...others].map(([host]) => host).join(", ")}). Google cere ca anunțurile dintr-o campanie să ducă, de regulă, pe același site — verifică să nu fie o greșeală.`,
      });
    }

    // Materialele.
    const sitelinks = asArray(getIn(record, "assets.sitelinks")).length;
    if (sitelinks < SITELINKS_RECOMMENDED) {
      warnings.push({
        path: `${at}.assets.sitelinks`,
        message: `${capitalized}: ${sitelinks === 0 ? "niciun link suplimentar" : `doar ${countOf(sitelinks, "linkuri suplimentare")}`}. Google le arată mai des de la ${SITELINKS_RECOMMENDED} în sus, iar anunțul ocupă mai mult loc.`,
      });
    }
    const call = asRecord(getIn(record, "assets.call"));
    if (call && call.conversion_action_id === undefined) {
      warnings.push({ path: `${at}.assets.call`, message: `${capitalized}: butonul de apel fără acțiune de conversie — apelurile se numără după setarea contului. Pune "conversion_action_id" (acțiunea „apeluri din anunțuri”) ca să le vezi ca lead-uri în campania asta.` });
    }

    // Același cuvânt cheie în mai multe grupuri ale campaniei.
    const seen = new Map<string, string>();
    asArray(record.ad_groups).forEach((_, groupIndex) => {
      for (const keyword of rawKeywords(raw, `${at}.ad_groups.${groupIndex}.keywords`)) {
        const key = `${keywordKey(keyword.text)}|${keyword.match}`;
        const first = seen.get(key);
        if (first && first.split(".keywords.")[0] !== keyword.path.split(".keywords.")[0]) {
          warnings.push({
            path: keyword.path,
            message: `${searchLabel(raw, keyword.path)} e și în ${searchLabel(raw, first.split(".keywords.")[0]).split(" › ").pop()}. Grupurile ar concura între ele pe aceeași căutare — păstrează-l într-unul singur.`,
          });
        } else if (!first) {
          seen.set(key, keyword.path);
        }
      }
    });

    warnings.push(...conflictProblems(raw, record, at).warnings);
  });

  return warnings;
}

// ---------------------------------------------------------------------------
// Validarea
// ---------------------------------------------------------------------------

const FIELD_ORDER = ["format", "workspace", "ad_account", "currency", "shared_negative_lists", "campaigns"];

/** Ordinea din plan: secțiunile de la rădăcină, apoi indexurile, numeric. */
function comparePaths(a: PlanProblem, b: PlanProblem): number {
  const left = a.path.split(".");
  const right = b.path.split(".");
  const rank = (part: string) => {
    const index = FIELD_ORDER.indexOf(part);
    return index === -1 ? FIELD_ORDER.length : index;
  };
  const first = rank(left[0] ?? "") - rank(right[0] ?? "");
  if (first !== 0) return first;
  for (let index = 1; index < Math.min(left.length, right.length); index += 1) {
    const x = left[index];
    const y = right[index];
    if (x === y) continue;
    if (/^\d+$/.test(x) && /^\d+$/.test(y)) return Number(x) - Number(y);
    return 0;
  }
  return 0;
}

/** Cu `format` = `meridian-google-search/1` — așa îl recunoaște `plan-json.ts`. */
export function isSearchPlanValue(value: unknown): boolean {
  return asRecord(value)?.format === SEARCH_PLAN_FORMAT;
}

export function validateSearchPlan(raw: unknown, context: ValidationContext = {}): SearchValidation {
  const cleaned = dropNulls(raw);
  const record = asRecord(cleaned);
  if (!record) {
    return { ok: false, plan: null, errors: [{ path: "", message: "Planul trebuie să fie un obiect JSON { … }." }], warnings: [], operations: null };
  }

  const parsed = searchPlanSchema.safeParse(record, { error: () => DEFAULT_MESSAGE, reportInput: true });
  const schemaErrors = parsed.success ? [] : parsed.error.issues.flatMap((issue) => formatIssue(issue, record));
  const crossErrors = crossRules(record, context).filter(
    (problem) => !schemaErrors.some((existing) => existing.path === problem.path)
  );
  const errors = [...schemaErrors, ...crossErrors];

  let operations: number | null = null;
  if (parsed.success) {
    operations = countSearchOperations(parsed.data);
    if (operations > MUTATE_OPERATIONS_MAX) {
      errors.push({
        path: "campaigns",
        message: `Planul produce ${countOf(operations, "operații")}, iar Google primește cel mult ${MUTATE_OPERATIONS_MAX.toLocaleString("ro-RO")} într-o cerere. Portalul creează tot planul dintr-o singură cerere (totul sau nimic), deci nu-l împarte: fă din el două planuri, de exemplu câte o campanie pe plan.`,
      });
    }
  }

  const sortedErrors = errors.sort(comparePaths);
  const warnings = collectWarnings(record).sort(comparePaths);
  if (parsed.success && sortedErrors.length === 0) {
    return { ok: true, plan: parsed.data, errors: [], warnings, operations: operations ?? 0 };
  }
  return { ok: false, plan: null, errors: sortedErrors, warnings, operations };
}
