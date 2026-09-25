import type { z } from "zod";
import { PIXEL_ID as SITE_META_PIXEL_ID } from "@/lib/meta-pixel";
import { SITE_URL } from "@/lib/site-url";
import {
  CONVERSION_EVENTS,
  CONVERSION_EVENT_LABEL,
  CONVERSION_EVENT_NAME,
  CTA_LABEL,
  CURRENCIES,
  GENDER_LABEL,
  META_ENHANCEMENT_LABEL,
  META_HEADLINE_VISIBLE,
  META_PLACEMENT_LABEL,
  META_PRIMARY_TEXT_VISIBLE,
  META_SPECIAL_CATEGORY_LABEL,
  OBJECTIVES_WITH_CONVERSION,
  OBJECTIVE_LABEL,
  PLATFORM_LABEL,
  SITE_SENDS,
  SITE_STORED_UTM,
  TIKTOK_AD_TEXT_MAX,
  TIKTOK_ENHANCEMENT_LABEL,
  TIKTOK_IDENTITY_LABEL,
  TIKTOK_PLACEMENT_LABEL,
  VARIANT_MODE_LABEL,
  type ConversionEvent,
  type Currency,
  type Objective,
  type Platform,
} from "./constants";
import { KNOWN_KEYS, PLAN_FORMAT, planSchema, type Plan } from "./plan-schema";
import { asArray, asNumber, asRecord, asString, getIn, pathString } from "./plan-path";
import {
  UTM_KEYS,
  ageLabel,
  countOf,
  foreignMacro,
  formatMoney,
  tiktokAgeGroups,
  utmAlreadyInUrl,
} from "./plan-derive";
import { WORKSPACES, findWorkspace, workspaceName } from "./workspaces";

/**
 * Validarea planului, cu mesaje în română.
 *
 * Trei straturi:
 *   1. schema Zod (`plan-schema.ts`) — forma: ce câmp lipsește, ce tip are;
 *   2. regulile încrucișate de aici — ce nu se vede dintr-un singur câmp
 *      (obiectiv ↔ pixel, platformă ↔ secțiune, buget ↔ plafonul spațiului);
 *   3. avertismentele — planul e valid, dar probabil nu face ce crezi
 *      (evenimentul nu e trimis de site, textul se taie, o îmbunătățire
 *      automată e pornită).
 *
 * Erorile blochează crearea; avertismentele nu. Toate apar odată: omul
 * corectează un plan întreg, nu joacă „încă o eroare" de zece ori.
 *
 * Fișierul e izomorf. În browser dă răspunsul pe loc; pe server (faza 2)
 * rulează din nou, identic, înainte de orice apel către platformă — ce
 * vine din browser nu e de încredere.
 */

export interface PlanProblem {
  /** Calea câmpului (`creative.primary_texts.1`), `""` pentru plan în ansamblu. */
  path: string;
  message: string;
}

export interface ValidationContext {
  /** Spațiul afișat în selector. Un plan pentru alt spațiu se respinge. */
  currentWorkspace?: string | null;
}

export type PlanValidation =
  | { ok: true; plan: Plan; errors: []; warnings: PlanProblem[] }
  | { ok: false; plan: null; errors: PlanProblem[]; warnings: PlanProblem[] };

// ---------------------------------------------------------------------------
// Etichete
// ---------------------------------------------------------------------------

/** Cum numim fiecare câmp în mesaje. `#` = index de listă, `{n}` = numărul lui (de la 1). */
const LABELS: Record<string, string> = {
  "": "Planul",
  format: "Câmpul format",
  workspace: "Spațiul de lucru (workspace)",
  ad_account: "Contul de reclame (ad_account)",
  campaign: "Secțiunea campaign",
  "campaign.name": "Numele campaniei",
  "campaign.objective": "Obiectivul campaniei",
  "campaign.daily_budget": "Bugetul zilnic",
  "campaign.currency": "Moneda",
  audience: "Secțiunea audience (publicul)",
  "audience.locations": "Lista de locații",
  "audience.locations.#": "Locația {n}",
  "audience.locations.#.type": "Tipul locației {n}",
  "audience.locations.#.code": "Codul de țară al locației {n}",
  "audience.locations.#.name": "Numele locației {n}",
  "audience.locations.#.country": "Țara locației {n}",
  "audience.locations.#.radius_km": "Raza locației {n}",
  "audience.locations.#.key": "Cheia locației {n}",
  "audience.age_min": "Vârsta minimă",
  "audience.age_max": "Vârsta maximă",
  "audience.gender": "Genul",
  "audience.languages": "Lista de limbi",
  "audience.languages.#": "Limba {n}",
  "audience.interests": "Lista de interese",
  "audience.interests.#": "Interesul {n}",
  "audience.interests.#.name": "Numele interesului {n}",
  "audience.interests.#.id": "Id-ul interesului {n}",
  "audience.behaviors": "Lista de comportamente",
  "audience.behaviors.#": "Comportamentul {n}",
  "audience.behaviors.#.name": "Numele comportamentului {n}",
  "audience.behaviors.#.id": "Id-ul comportamentului {n}",
  conversion: "Secțiunea conversion",
  "conversion.pixel_id": "Id-ul pixelului",
  "conversion.event": "Evenimentul de conversie",
  destination: "Destinația",
  "destination.type": "Tipul destinației",
  "destination.url": "URL-ul destinației",
  "destination.utm": "Parametrii UTM",
  "destination.utm.source": "utm_source",
  "destination.utm.medium": "utm_medium",
  "destination.utm.campaign": "utm_campaign",
  "destination.utm.content": "utm_content",
  "destination.utm.term": "utm_term",
  creative: "Secțiunea creative (materialul)",
  "creative.video": "Video-ul",
  "creative.video.source": "Sursa video-ului",
  "creative.video.video_id": "Id-ul video-ului",
  "creative.video.file_name": "Numele fișierului video",
  "creative.thumbnail": "Coperta video-ului",
  "creative.thumbnail.url": "URL-ul copertei",
  "creative.primary_texts": "Lista de texte principale",
  "creative.primary_texts.#": "Textul principal {n}",
  "creative.headlines": "Lista de titluri",
  "creative.headlines.#": "Titlul {n}",
  "creative.descriptions": "Lista de descrieri",
  "creative.descriptions.#": "Descrierea {n}",
  "creative.cta": "Butonul (cta)",
  "creative.variants": "Modul variantelor (variants)",
  meta: "Secțiunea meta",
  "meta.page_id": "Pagina de Facebook (page_id)",
  "meta.instagram_account_id": "Contul de Instagram (instagram_account_id)",
  "meta.special_ad_categories": "Lista de categorii speciale",
  "meta.special_ad_categories.#": "Categoria specială {n}",
  "meta.advantage_audience": "Advantage+ audience",
  "meta.placements": "Plasările Meta",
  "meta.placements.#": "Plasarea {n}",
  "meta.enhancements": "Îmbunătățirile automate Meta",
  "meta.dsa_beneficiary": "Beneficiarul reclamei (dsa_beneficiary)",
  "meta.dsa_payor": "Plătitorul reclamei (dsa_payor)",
  tiktok: "Secțiunea tiktok",
  "tiktok.identity_type": "Tipul identității TikTok",
  "tiktok.identity_id": "Id-ul identității TikTok",
  "tiktok.placements": "Plasările TikTok",
  "tiktok.enhancements": "Îmbunătățirile automate TikTok",
};

/** Ce să scrii când lipsește un câmp obligatoriu. */
const MISSING_HINT: Record<string, string> = {
  workspace: `Scrie unul dintre: ${WORKSPACES.map((w) => w.id).join(", ")}.`,
  ad_account: "E id-ul contului în care se creează campania — pe Meta „act_” urmat de cifre, pe TikTok advertiser_id.",
  campaign: "Conține name, objective, daily_budget și currency.",
  "campaign.name": "E numele care apare în Ads Manager.",
  "campaign.objective": "Variante: leads, traffic, sales, video_views, awareness.",
  "campaign.daily_budget": "Scrie suma pe zi ca număr, în moneda contului: \"daily_budget\": 50.",
  "campaign.currency": "Moneda contului de reclame: RON, EUR sau USD.",
  audience: "Conține cel puțin locations — fără locație, reclama ar merge oriunde.",
  "audience.locations":
    "Fără locație, reclama ar merge oriunde în lume. Exemplu: [{ \"type\": \"country\", \"code\": \"RO\" }].",
  "conversion.pixel_id": "Id-ul pixelului din Events Manager, între ghilimele.",
  "conversion.event": "Variante: lead, contact, schedule, complete_registration, purchase, view_content.",
  destination: "Exemplu: { \"type\": \"website\", \"url\": \"https://…\" }.",
  "destination.url": "Adresa completă a paginii, cu https://.",
  creative: "Conține video, primary_texts și cta.",
  "creative.video":
    "{ \"source\": \"library\", \"video_id\": \"…\" } pentru un video deja urcat, sau { \"source\": \"upload\" } ca să-l alegi în portal.",
  "creative.video.video_id": "Id-ul din biblioteca de media a contului de reclame.",
  "creative.primary_texts": "Cel puțin un text: \"primary_texts\": [\"…\"].",
  "creative.cta": `Variante: ${Object.keys(CTA_LABEL).join(", ")}.`,
  "meta.page_id": "Id-ul paginii de Facebook în numele căreia apare reclama.",
  "tiktok.identity_type": "Variante: CUSTOMIZED_USER, TT_USER, BC_AUTH_TT.",
  "tiktok.identity_id": "Id-ul identității din TikTok Ads Manager → Assets → Identities.",
};

/** Etichetele valorilor, pentru „variante: leads (Lead-uri), …". */
const VALUE_LABELS: Record<string, Record<string, string>> = {
  workspace: Object.fromEntries(WORKSPACES.map((w) => [w.id, workspaceName(w)])),
  "campaign.objective": OBJECTIVE_LABEL,
  "campaign.currency": Object.fromEntries(CURRENCIES.map((c) => [c, c])),
  "audience.gender": GENDER_LABEL,
  "conversion.event": CONVERSION_EVENT_LABEL,
  "creative.cta": CTA_LABEL,
  "creative.variants": VARIANT_MODE_LABEL,
  "meta.special_ad_categories.#": META_SPECIAL_CATEGORY_LABEL,
  "meta.placements.#": META_PLACEMENT_LABEL,
  "tiktok.identity_type": TIKTOK_IDENTITY_LABEL,
  "tiktok.placements": TIKTOK_PLACEMENT_LABEL,
};

/** Uniunile care nu au discriminator: ce formă e acceptată. */
const UNION_HINT: Record<string, string> = {
  "creative.thumbnail": "Coperta video-ului poate fi \"auto\" sau { \"url\": \"https://…\" }.",
  "meta.placements": `Plasările Meta pot fi "automatic" sau o listă: ${Object.keys(META_PLACEMENT_LABEL).join(", ")}.`,
};

const ID_FIELDS = /(^|\.)(ad_account|pixel_id|page_id|instagram_account_id|video_id|identity_id|id|key)$/;

/** Ordinea secțiunilor în plan — erorile se afișează în aceeași ordine. */
const SECTION_ORDER = [
  "format",
  "workspace",
  "ad_account",
  "campaign",
  "audience",
  "conversion",
  "destination",
  "creative",
  "meta",
  "tiktok",
];

function patternOf(path: ReadonlyArray<PropertyKey>): { pattern: string; n: number | null } {
  let n: number | null = null;
  const parts = path.map((part) => {
    if (typeof part === "number") {
      n = part + 1;
      return "#";
    }
    return String(part);
  });
  return { pattern: parts.join("."), n };
}

export function labelFor(path: ReadonlyArray<PropertyKey> | string): string {
  const parts =
    typeof path === "string"
      ? path === ""
        ? []
        : path.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part))
      : path;
  const { pattern, n } = patternOf(parts);

  const direct = LABELS[pattern];
  if (direct) return direct.replace("{n}", String(n ?? ""));

  // Cheile de îmbunătățiri au titlul lor, din constante.
  const last = String(parts[parts.length - 1] ?? "");
  if (pattern.startsWith("meta.enhancements.") && last in META_ENHANCEMENT_LABEL) {
    return META_ENHANCEMENT_LABEL[last as keyof typeof META_ENHANCEMENT_LABEL].title;
  }
  if (pattern.startsWith("tiktok.enhancements.") && last in TIKTOK_ENHANCEMENT_LABEL) {
    return TIKTOK_ENHANCEMENT_LABEL[last as keyof typeof TIKTOK_ENHANCEMENT_LABEL].title;
  }

  return `Câmpul „${pathString(parts)}”`;
}

// ---------------------------------------------------------------------------
// Mesajele pentru erorile de schemă
// ---------------------------------------------------------------------------

/** Semn pus de harta de erori: mesajul n-a fost personalizat în schemă. */
const DEFAULT_MESSAGE = "\u0000implicit";

function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "o listă";
  switch (typeof value) {
    case "string":
      return `textul „${value.length > 40 ? `${value.slice(0, 40)}…` : value}”`;
    case "number":
      return `numărul ${value}`;
    case "boolean":
      return String(value);
    case "object":
      return "un obiect";
    default:
      return typeof value;
  }
}

function expectedLabel(expected: string): string {
  switch (expected) {
    case "string":
      return "text, între ghilimele";
    case "number":
      return "număr, fără ghilimele";
    case "int":
      return "număr întreg";
    case "boolean":
      return "true sau false, fără ghilimele";
    case "array":
      return "o listă [ … ]";
    case "object":
      return "un obiect { … }";
    default:
      return expected;
  }
}

/** Distanța Levenshtein — pentru „ai vrut …?". Șirurile sunt scurte. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

function closest(value: string, options: string[]): string | null {
  const lower = value.toLowerCase();
  let best: { option: string; score: number } | null = null;
  for (const option of options) {
    const score =
      option.includes(lower) || lower.includes(option)
        ? 1
        : distance(lower, option.toLowerCase());
    if (!best || score < best.score) best = { option, score };
  }
  return best && best.score <= Math.max(2, Math.floor(value.length / 3)) ? best.option : null;
}

function listValues(pattern: string, values: string[]): string {
  const labels = VALUE_LABELS[pattern];
  return values
    .map((value) => (labels?.[value] && labels[value] !== value ? `${value} (${labels[value]})` : value))
    .join(", ");
}

function formatIssue(issue: z.core.$ZodIssue, prefix: ReadonlyArray<PropertyKey> = []): PlanProblem[] {
  const fullPath = [...prefix, ...issue.path];
  const path = pathString(fullPath);
  const { pattern } = patternOf(fullPath);
  const label = labelFor(fullPath);
  const input = (issue as { input?: unknown }).input;

  if (issue.code === "unrecognized_keys") {
    const known = KNOWN_KEYS[pattern] ?? [];
    const where = path === "" ? "la rădăcina planului" : `în ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
    return issue.keys.map((key) => {
      const guess = closest(key, known);
      return {
        path: path ? `${path}.${key}` : key,
        message: `Câmpul „${key}” nu există ${where}.${guess ? ` Ai vrut „${guess}”?` : ` Câmpuri acceptate: ${known.join(", ")}.`}`,
      };
    });
  }

  // Mesaj scris în schemă (regex, refine): e deja o propoziție fără subiect.
  if (issue.message !== DEFAULT_MESSAGE) {
    return [{ path, message: `${label} ${issue.message}` }];
  }

  /* Mesajele de mai jos evită acordul în gen („gol"/„goală"): eticheta e
     când „Numele campaniei", când „Pagina de Facebook". Formele cu verb
     („lipsește", „poate fi") sau cu două puncte merg cu oricare. */
  switch (issue.code) {
    case "invalid_type": {
      if (input === undefined) {
        const hint = MISSING_HINT[pattern];
        return [{ path, message: `${label} lipsește.${hint ? ` ${hint}` : ""}` }];
      }
      if (issue.expected === "string" && typeof input === "number" && ID_FIELDS.test(pattern)) {
        return [
          {
            path,
            message: `${label}: id-urile se scriu ca text, între ghilimele. Ca număr, id-urile lungi se rotunjesc și ajung să arate spre alt cont, altă pagină sau alt video.`,
          },
        ];
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
      return [
        {
          path,
          message: `${label} trebuie să fie ${expectedLabel(issue.expected)}, nu ${describeValue(input)}.`,
        },
      ];
    }

    case "too_small": {
      const minimum = Number(issue.minimum);
      if (issue.origin === "string") {
        return [
          {
            path,
            message:
              minimum <= 1
                ? `${label}: nu e scris nimic.`
                : `${label}: prea scurt, minimum ${countOf(minimum, "caractere")}.`,
          },
        ];
      }
      if (issue.origin === "array") {
        return [
          {
            path,
            message:
              minimum <= 1
                ? `${label}: lista e goală.${MISSING_HINT[pattern] ? ` ${MISSING_HINT[pattern]}` : " Pune cel puțin un element."}`
                : `${label}: prea puține elemente, minimum ${minimum}.`,
          },
        ];
      }
      return [
        {
          path,
          message: `${label} trebuie să fie ${issue.inclusive ? "cel puțin" : "mai mare decât"} ${minimum}.`,
        },
      ];
    }

    case "too_big": {
      const maximum = Number(issue.maximum);
      if (issue.origin === "string") {
        const length = typeof input === "string" ? input.trim().length : null;
        return [
          {
            path,
            message: `${label}: ${length === null ? "prea lung" : countOf(length, "caractere")}, maximum ${maximum}.`,
          },
        ];
      }
      if (issue.origin === "array") {
        const length = Array.isArray(input) ? input.length : null;
        return [
          {
            path,
            message: `${label}: ${length === null ? "prea multe elemente" : countOf(length, "elemente")}, maximum ${maximum}.`,
          },
        ];
      }
      const note = pattern === "audience.age_max" ? " (65 înseamnă „65 și peste”)" : "";
      return [{ path, message: `${label} poate fi cel mult ${maximum}${note}.` }];
    }

    case "invalid_value": {
      const values = issue.values.map((value) => String(value));
      if (pattern === "format") {
        return [{ path, message: `Câmpul format trebuie să fie „${PLAN_FORMAT}” — sau poate lipsi.` }];
      }
      if (input === undefined) {
        return [{ path, message: `${label} lipsește. Variante: ${listValues(pattern, values)}.` }];
      }
      const guess = typeof input === "string" ? closest(input, values) : null;
      return [
        {
          path,
          message: `${label}: ${describeValue(input)} nu e o valoare acceptată.${guess ? ` Ai vrut „${guess}”?` : ""} Variante: ${listValues(pattern, values)}.`,
        },
      ];
    }

    case "invalid_union": {
      // Uniune cu discriminator (`type`, `source`): Zod pune calea pe cheia
      // discriminatorului și dă variantele în `options`.
      const union = issue as typeof issue & { discriminator?: string; options?: unknown[] };
      if (union.discriminator) {
        const value = asRecord(input)?.[union.discriminator];
        const options = (union.options ?? []).map(String).join(", ");
        return [
          {
            path,
            message:
              value === undefined
                ? `${label} lipsește. Variante: ${options}.`
                : `${label}: ${describeValue(value)} nu e o valoare acceptată. Variante: ${options}.`,
          },
        ];
      }

      // Uniune fără discriminator: dacă una dintre forme a ajuns mai adânc
      // (un element greșit dintr-o listă), eroarea ei e cea utilă.
      const deeper = issue.errors
        .flat()
        .filter((inner) => inner.path.length > 0);
      if (deeper.length > 0) {
        return deeper.flatMap((inner) => formatIssue(inner, fullPath));
      }
      const hint = UNION_HINT[pattern];
      return [{ path, message: hint ?? `${label} nu are o formă acceptată.` }];
    }

    default:
      return [{ path, message: `${label} nu e valid.` }];
  }
}

// ---------------------------------------------------------------------------
// Reguli încrucișate
// ---------------------------------------------------------------------------

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

const isObjective = (value: unknown): value is Objective =>
  isOneOf(Object.keys(OBJECTIVE_LABEL) as Objective[], value);
const isEvent = (value: unknown): value is ConversionEvent => isOneOf(CONVERSION_EVENTS, value);
const isCurrency = (value: unknown): value is Currency => isOneOf(CURRENCIES, value);

/** `act_123` pe Meta, oricum ar fi scris în plan. */
export function normalizeAdAccount(platform: Platform, value: string): string {
  const trimmed = value.trim();
  return platform === "meta" && /^\d+$/.test(trimmed) ? `act_${trimmed}` : trimmed;
}

/** Raza minimă a unui oraș pe Meta (10 mile). */
const META_CITY_RADIUS_MIN = 17;

/**
 * Ce refuză Meta la creare, prins înainte: altfel campania s-ar crea, iar
 * setul de reclame ar pica — o campanie goală, pe jumătate.
 */
function metaRules(raw: Record<string, unknown>): PlanProblem[] {
  const errors: PlanProblem[] = [];

  asArray(getIn(raw, "audience.locations")).forEach((location, index) => {
    const record = asRecord(location);
    const radius = asNumber(record?.radius_km);
    if (record?.type === "city" && radius !== null && radius < META_CITY_RADIUS_MIN) {
      errors.push({
        path: `audience.locations.${index}.radius_km`,
        message: `Raza locației ${index + 1} e ${radius} km. Pe Meta, raza unui oraș e între ${META_CITY_RADIUS_MIN} și 80 km; fără rază se ia doar orașul.`,
      });
    }
  });

  const placements = getIn(raw, "meta.placements");
  if (Array.isArray(placements) && placements.includes("facebook_stories")) {
    if (!placements.includes("facebook_feed") && !placements.includes("instagram_stories")) {
      errors.push({
        path: "meta.placements",
        message:
          "Facebook Stories nu poate sta singur: Meta îl acceptă doar împreună cu Facebook — flux sau Instagram — Stories. Adaugă una dintre ele.",
      });
    }
  }

  if (getIn(raw, "meta.advantage_audience") === true) {
    const ageMin = asNumber(getIn(raw, "audience.age_min")) ?? 18;
    const ageMax = asNumber(getIn(raw, "audience.age_max")) ?? 65;
    if (ageMax !== 65 || ageMin > 25) {
      errors.push({
        path: "meta.advantage_audience",
        message: `Cu Advantage+ audience pornit, Meta cere vârsta maximă 65 și vârsta minimă cel mult 25 (planul: ${ageLabel(ageMin, ageMax)}). Oprește-l sau lărgește vârsta.`,
      });
    }
  }

  const objective = getIn(raw, "campaign.objective");
  if (getIn(raw, "creative.variants") === "platform_rotates" && isObjective(objective) && !OBJECTIVES_WITH_CONVERSION.includes(objective)) {
    errors.push({
      path: "creative.variants",
      message: `Pe Meta, alternarea textelor (dynamic creative) merge doar la obiectivele cu pixel — Lead-uri și Vânzări. Pentru ${OBJECTIVE_LABEL[objective]}, folosește "one_ad_per_text".`,
    });
  }

  return errors;
}

function crossRules(raw: Record<string, unknown>, context: ValidationContext): PlanProblem[] {
  const workspace = findWorkspace(raw.workspace);
  if (!workspace) return []; // schema spune deja de ce
  const platform = workspace.platform;
  const errors: PlanProblem[] = [];
  const name = workspaceName(workspace);

  if (context.currentWorkspace && context.currentWorkspace !== workspace.id) {
    const current = findWorkspace(context.currentWorkspace);
    errors.push({
      path: "workspace",
      message: `Planul e pentru ${name}, dar lucrezi în ${current ? workspaceName(current) : context.currentWorkspace}. Portalul creează campanii doar în spațiul afișat sus: schimbă spațiul din selector sau corectează planul.`,
    });
  }

  if (platform === "meta" && raw.meta === undefined) {
    errors.push({
      path: "meta",
      message:
        "Secțiunea meta lipsește. Pe Meta, reclama are nevoie de pagina de Facebook în numele căreia apare: \"meta\": { \"page_id\": \"…\" }.",
    });
  }
  if (platform === "tiktok" && raw.tiktok === undefined) {
    errors.push({
      path: "tiktok",
      message:
        "Secțiunea tiktok lipsește. Pe TikTok, reclama are nevoie de identitatea care apare pe ea: \"tiktok\": { \"identity_type\": \"CUSTOMIZED_USER\", \"identity_id\": \"…\" }.",
    });
  }

  const account = asString(raw.ad_account);
  if (account) {
    if (platform === "meta" && !/^(act_)?\d{5,25}$/.test(account)) {
      errors.push({
        path: "ad_account",
        message: `Contul de reclame Meta arată așa: act_ urmat de cifre (act_1234567890). „${account}” nu are forma asta.`,
      });
    }
    if (platform === "tiktok" && !/^\d{5,25}$/.test(account)) {
      errors.push({
        path: "ad_account",
        message: `Contul TikTok (advertiser_id) conține doar cifre. „${account}” nu are forma asta.`,
      });
    }
  }

  const objective = getIn(raw, "campaign.objective");
  if (isObjective(objective) && OBJECTIVES_WITH_CONVERSION.includes(objective) && raw.conversion === undefined) {
    errors.push({
      path: "conversion",
      message: `Obiectivul ${OBJECTIVE_LABEL[objective]} optimizează pe un eveniment de pe site, deci are nevoie de pixel: "conversion": { "pixel_id": "…", "event": "lead" }.`,
    });
  }

  const event = getIn(raw, "conversion.event");
  if (isEvent(event) && CONVERSION_EVENT_NAME[event][platform] === null) {
    errors.push({
      path: "conversion.event",
      message: `${PLATFORM_LABEL[platform]} nu are eveniment standard pentru „${CONVERSION_EVENT_LABEL[event]}”. Folosește lead sau contact.`,
    });
  }

  if (getIn(raw, "creative.video.source") === "library") {
    const videoId = asString(getIn(raw, "creative.video.video_id"));
    if (videoId && platform === "meta" && !/^\d{5,25}$/.test(videoId)) {
      errors.push({
        path: "creative.video.video_id",
        message:
          "Id-ul unui video Meta conține doar cifre. Îl găsești în biblioteca de media a contului de reclame.",
      });
    }
  }

  if (platform === "tiktok") {
    asArray(getIn(raw, "creative.primary_texts")).forEach((text, index) => {
      if (typeof text === "string" && text.trim().length > TIKTOK_AD_TEXT_MAX) {
        errors.push({
          path: `creative.primary_texts.${index}`,
          message: `Textul principal ${index + 1} are ${countOf(text.trim().length, "caractere")}. TikTok acceptă cel mult ${TIKTOK_AD_TEXT_MAX}.`,
        });
      }
    });
    if (getIn(raw, "creative.variants") === "platform_rotates") {
      errors.push({
        path: "creative.variants",
        message:
          "Pe TikTok, portalul face câte o reclamă pentru fiecare text: alternarea automată ține de optimizările creative ale TikTok, pe care portalul nu le pornește. Folosește \"one_ad_per_text\".",
      });
    }
  }

  if (platform === "meta") errors.push(...metaRules(raw));

  const currency = getIn(raw, "campaign.currency");
  const budget = asNumber(getIn(raw, "campaign.daily_budget"));
  if (isCurrency(currency)) {
    const cap = workspace.dailyBudgetCap[currency];
    if (cap === undefined) {
      errors.push({
        path: "campaign.currency",
        message: `Spațiul ${name} nu acceptă ${currency}: nu are plafon de buget pentru moneda asta. Dacă un cont din portofoliu chiar e în ${currency}, adaugă plafonul în lib/ads/workspaces.ts.`,
      });
    } else if (budget !== null && budget > cap) {
      errors.push({
        path: "campaign.daily_budget",
        message: `${formatMoney(budget, currency)} pe zi depășește plafonul spațiului ${name}: ${formatMoney(cap, currency)} pe zi. Verifică să nu fie un zero în plus. Dacă suma e intenționată, plafonul se schimbă în lib/ads/workspaces.ts.`,
      });
    }
  }

  const ageMin = asNumber(getIn(raw, "audience.age_min")) ?? 18;
  const ageMax = asNumber(getIn(raw, "audience.age_max")) ?? 65;
  if (ageMin > ageMax) {
    errors.push({
      path: "audience.age_max",
      message: `Vârsta maximă (${ageMax}) e mai mică decât cea minimă (${ageMin}).`,
    });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Avertismente
// ---------------------------------------------------------------------------

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const OWN_HOST = hostOf(SITE_URL);

function collectWarnings(raw: Record<string, unknown>): PlanProblem[] {
  const workspace = findWorkspace(raw.workspace);
  if (!workspace) return [];
  const platform = workspace.platform;
  const other: Platform = platform === "meta" ? "tiktok" : "meta";
  const warnings: PlanProblem[] = [];

  if (raw[other] !== undefined) {
    warnings.push({
      path: other,
      message: `Secțiunea ${other} se ignoră: spațiul ${workspaceName(workspace)} e pe ${PLATFORM_LABEL[platform]}. Dacă planul era pentru ${PLATFORM_LABEL[other]}, schimbă workspace.`,
    });
  }

  // Îmbunătățirile automate — singurele avertismente cu majuscule, intenționat.
  const enhancements = asRecord(getIn(raw, `${platform}.enhancements`)) ?? {};
  const labels: Record<string, { title: string; body: string }> =
    platform === "meta" ? META_ENHANCEMENT_LABEL : TIKTOK_ENHANCEMENT_LABEL;
  for (const [key, value] of Object.entries(enhancements)) {
    const label = labels[key];
    if (value === true && label) {
      warnings.push({
        path: `${platform}.enhancements.${key}`,
        message: `PORNIT: ${label.title}. ${label.body} Pentru un testimonial filmat, lasă-l oprit.`,
      });
    }
  }

  if (platform === "meta" && getIn(raw, "meta.advantage_audience") === true) {
    warnings.push({
      path: "meta.advantage_audience",
      message:
        "Advantage+ audience e pornit: Meta tratează vârsta și interesele din plan ca sugestii și poate livra în afara lor.",
    });
  }

  // Meta extinde interesele singur pe obiectivele de conversie și trafic,
  // iar extinderea nu se poate opri din API. Vârsta, genul și locația rămân limite.
  const objectiveForExpansion = getIn(raw, "campaign.objective");
  if (
    platform === "meta" &&
    getIn(raw, "meta.advantage_audience") !== true &&
    (objectiveForExpansion === "leads" || objectiveForExpansion === "sales" || objectiveForExpansion === "traffic") &&
    (asArray(getIn(raw, "audience.interests")).length > 0 || asArray(getIn(raw, "audience.behaviors")).length > 0)
  ) {
    warnings.push({
      path: "audience.interests",
      message:
        "La Lead-uri, Vânzări și Trafic, Meta poate livra și în afara intereselor din plan (extinderea targetării detaliate nu se poate opri din API). Vârsta, genul și locațiile rămân limite stricte.",
    });
  }

  const categories = asArray(getIn(raw, "meta.special_ad_categories"));
  if (platform === "meta" && categories.length > 0) {
    warnings.push({
      path: "meta.special_ad_categories",
      message:
        "Cu o categorie specială, Meta restrânge targetarea (vârstă, gen, rază, unele interese). Dacă planul cere ceva interzis, Meta refuză la creare și portalul îți arată mesajul lor.",
    });
  }

  const objective = getIn(raw, "campaign.objective");
  if (isObjective(objective) && !OBJECTIVES_WITH_CONVERSION.includes(objective) && raw.conversion !== undefined) {
    warnings.push({
      path: "conversion",
      message: `Obiectivul ${OBJECTIVE_LABEL[objective]} nu optimizează pe un eveniment de pe site: secțiunea conversion se ignoră.`,
    });
  }

  const url = asString(getIn(raw, "destination.url"));
  const onOwnSite = url !== null && OWN_HOST !== null && hostOf(url) === OWN_HOST;
  const event = getIn(raw, "conversion.event");

  if (
    onOwnSite &&
    isEvent(event) &&
    CONVERSION_EVENT_NAME[event][platform] !== null &&
    !SITE_SENDS[platform].includes(event)
  ) {
    const sent = SITE_SENDS[platform]
      .map((item) => CONVERSION_EVENT_NAME[item][platform])
      .filter(Boolean)
      .join(", ");
    warnings.push({
      path: "conversion.event",
      message: `Site-ul nostru nu trimite evenimentul ${CONVERSION_EVENT_NAME[event][platform]} către ${PLATFORM_LABEL[platform]} (trimite: ${sent}). Campania ar optimiza pe ceva ce nu se întâmplă.`,
    });
  }

  const pixel = asString(getIn(raw, "conversion.pixel_id"));
  if (onOwnSite && platform === "meta" && pixel && pixel !== SITE_META_PIXEL_ID) {
    warnings.push({
      path: "conversion.pixel_id",
      message: `Site-ul nostru trimite evenimentele către pixelul ${SITE_META_PIXEL_ID}, nu către ${pixel}. Cu alt pixel, campania nu vede niciun lead.`,
    });
  }

  const utm = asRecord(getIn(raw, "destination.utm")) ?? {};
  if (url) {
    const duplicated = utmAlreadyInUrl(url).filter((key) => utm[key] !== undefined);
    if (duplicated.length > 0) {
      warnings.push({
        path: "destination.url",
        message: `URL-ul are deja ${duplicated.map((key) => `utm_${key}`).join(", ")}, iar planul le mai adaugă o dată. Scoate-le dintr-o parte.`,
      });
    }
  }
  if (onOwnSite) {
    const ignored = UTM_KEYS.filter(
      (key) => utm[key] !== undefined && !(SITE_STORED_UTM as readonly string[]).includes(key)
    );
    if (ignored.length > 0) {
      warnings.push({
        path: `destination.utm.${ignored[0]}`,
        message: `Site-ul salvează pe lead doar utm_source, utm_medium și utm_campaign. ${ignored.map((key) => `utm_${key}`).join(" și ")} ajung în statisticile platformei, nu în panoul de lead-uri.`,
      });
    }
  }
  for (const key of UTM_KEYS) {
    const value = asString(utm[key]);
    const macro = value ? foreignMacro(value, platform) : null;
    if (macro) {
      warnings.push({
        path: `destination.utm.${key}`,
        message: `${macro} e un macro de ${PLATFORM_LABEL[other]}. Pe ${PLATFORM_LABEL[platform]} nu se înlocuiește și ajunge ca atare în URL.`,
      });
    }
  }

  if (platform === "tiktok") {
    asArray(getIn(raw, "audience.locations")).forEach((location, index) => {
      if (asRecord(location)?.radius_km !== undefined) {
        warnings.push({
          path: `audience.locations.${index}.radius_km`,
          message: `TikTok nu targetează pe rază: locația ${index + 1} se ia întreagă, fără cei ${String(asRecord(location)?.radius_km)} km.`,
        });
      }
    });
    const ageMin = asNumber(getIn(raw, "audience.age_min")) ?? 18;
    const ageMax = asNumber(getIn(raw, "audience.age_max")) ?? 65;
    const groups = ageMin <= ageMax ? tiktokAgeGroups(ageMin, ageMax) : null;
    if (groups?.widened) {
      warnings.push({
        path: "audience.age_min",
        message: `TikTok targetează pe grupe de vârstă, deci ${ageLabel(ageMin, ageMax)} devine ${ageLabel(groups.min, groups.max)} (${groups.groups.map((group) => group.label).join(", ")}).`,
      });
    }
    if (asArray(getIn(raw, "creative.headlines")).length > 0 || asArray(getIn(raw, "creative.descriptions")).length > 0) {
      warnings.push({
        path: "creative.headlines",
        message: "Reclamele TikTok nu au titlu și descriere: headlines și descriptions se ignoră.",
      });
    }
  }

  if (platform === "meta") {
    const headlines = asArray(getIn(raw, "creative.headlines"));
    if (Array.isArray(getIn(raw, "creative.primary_texts")) && headlines.length === 0) {
      warnings.push({
        path: "creative.headlines",
        message: "Nu ai niciun titlu. Pe Meta e opțional, dar în flux e rândul îngroșat de lângă buton.",
      });
    }
    asArray(getIn(raw, "creative.primary_texts")).forEach((text, index) => {
      if (typeof text === "string" && text.trim().length > META_PRIMARY_TEXT_VISIBLE) {
        warnings.push({
          path: `creative.primary_texts.${index}`,
          message: `Textul principal ${index + 1} are ${countOf(text.trim().length, "caractere")}: în flux se vede cam primul rând și jumătate (~${META_PRIMARY_TEXT_VISIBLE}), restul după „Vezi mai mult”. Pune ce contează la început.`,
        });
      }
    });
    headlines.forEach((text, index) => {
      if (typeof text === "string" && text.trim().length > META_HEADLINE_VISIBLE) {
        warnings.push({
          path: `creative.headlines.${index}`,
          message: `Titlul ${index + 1} are ${countOf(text.trim().length, "caractere")}; pe telefon se taie după ~${META_HEADLINE_VISIBLE}.`,
        });
      }
    });
  }

  if (
    getIn(raw, "creative.variants") === "platform_rotates" &&
    asArray(getIn(raw, "creative.primary_texts")).length === 1
  ) {
    warnings.push({
      path: "creative.variants",
      message: "Ai un singur text principal, deci alternarea nu are ce alterna.",
    });
  }

  if (getIn(raw, "creative.video.source") === "upload") {
    warnings.push({
      path: "creative.video",
      message: "Video-ul e nou: îl alegi din calculator după verificarea planului, iar campania se poate crea abia după ce platforma termină de procesat fișierul.",
    });
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Validarea
// ---------------------------------------------------------------------------

/**
 * `null` = câmp lipsă. Planurile scrise de un model de limbaj pun des
 * `"instagram_account_id": null` pentru „nu am"; tratat altfel, fiecare ar
 * da o eroare de tip fără sens pentru om.
 */
function dropNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dropNulls);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== null)
        .map(([key, item]) => [key, dropNulls(item)])
    );
  }
  return value;
}

function sectionRank(path: string): number {
  const index = SECTION_ORDER.indexOf(path.split(".")[0] ?? "");
  return index === -1 ? SECTION_ORDER.length : index;
}

function byPlanOrder(a: PlanProblem, b: PlanProblem): number {
  return sectionRank(a.path) - sectionRank(b.path);
}

export function validatePlan(raw: unknown, context: ValidationContext = {}): PlanValidation {
  const cleaned = dropNulls(raw);
  const record = asRecord(cleaned);
  if (!record) {
    return {
      ok: false,
      plan: null,
      errors: [{ path: "", message: "Planul trebuie să fie un obiect JSON { … }." }],
      warnings: [],
    };
  }

  const parsed = planSchema.safeParse(record, {
    error: () => DEFAULT_MESSAGE,
    reportInput: true,
  });

  const schemaErrors = parsed.success ? [] : parsed.error.issues.flatMap((issue) => formatIssue(issue));
  const crossErrors = crossRules(record, context).filter(
    (problem) => !schemaErrors.some((existing) => existing.path === problem.path)
  );
  const errors = [...schemaErrors, ...crossErrors].sort(byPlanOrder);
  const warnings = collectWarnings(record).sort(byPlanOrder);

  if (parsed.success && errors.length === 0) {
    return { ok: true, plan: parsed.data, errors: [], warnings };
  }
  return { ok: false, plan: null, errors, warnings };
}
