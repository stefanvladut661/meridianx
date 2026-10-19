import { z } from "zod";

/**
 * Acțiunile de conversie standard pentru lead-uri (faza 13) — izomorf: același
 * cod validează în browser, pe server și construiește operațiile.
 *
 * Trei feluri, fiecare pe tipul lui din Google Ads API v26
 * (`ConversionActionTypeEnum`):
 *   - apelul din anunț — `AD_CALL`: butonul de apel al anunțului / materialul
 *     de apel; contează după o durată minimă (`phone_call_duration_seconds`);
 *   - clicul pe telefon de pe site — `CLICK_TO_CALL`: o atingere pe un link
 *     `tel:` (nu apelul în sine); se declanșează din GTM;
 *   - formularul trimis — `WEBPAGE`: o pagină sau un eveniment de pe site;
 *     se declanșează din GTM.
 *
 * Regulile Google (ghidul „Create conversion actions”, v26), verificate aici
 * înainte de `validateOnly`:
 *   - fereastra după clic: 1–90 de zile; la apeluri (`AD_CALL`) 1–60;
 *   - fereastra după afișare: 1–30 de zile; la apeluri NU se trimite;
 *   - durata minimă a apelului: 0–10.000 de secunde, doar la apeluri;
 *   - la apeluri, `value_settings.always_use_default_value` = true;
 *   - `include_in_conversions_metric` nu se trimite (se folosește
 *     `primary_for_goal`); modelul de atribuire nu se trimite — Google pune
 *     implicit „bazat pe date”, iar cele pe reguli sunt refuzate.
 */

export const LEAD_KINDS = ["call", "phone_click", "form"] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];

export const LEAD_CATEGORIES = ["SUBMIT_LEAD_FORM", "PHONE_CALL_LEAD", "REQUEST_QUOTE", "BOOK_APPOINTMENT", "CONTACT"] as const;
export type LeadCategory = (typeof LEAD_CATEGORIES)[number];

export const COUNTING_TYPES = ["ONE_PER_CLICK", "MANY_PER_CLICK"] as const;
export type CountingType = (typeof COUNTING_TYPES)[number];

export interface LeadActionSpec {
  type: "AD_CALL" | "CLICK_TO_CALL" | "WEBPAGE";
  /** Cum îi spunem pe ecran. */
  title: string;
  /** Ce numără, într-o propoziție. */
  what: string;
  /** Numele propus în Google Ads — fără nimic despre client. */
  defaultName: string;
  defaultCategory: LeadCategory;
  /** Tip de apel: durată minimă, fereastră 1–60, fără fereastră după afișare, valoare fixă. */
  call: boolean;
  /** Se declanșează de pe site (are etichetă AW-…/…, intră în importul GTM). */
  site: boolean;
}

export const LEAD_ACTIONS: Record<LeadKind, LeadActionSpec> = {
  call: {
    type: "AD_CALL",
    title: "Apel din anunț",
    what: "Omul sună direct din anunț (butonul de apel). Contează doar apelurile mai lungi decât durata minimă.",
    defaultName: "Lead - apel din anunț",
    defaultCategory: "PHONE_CALL_LEAD",
    call: true,
    site: false,
  },
  phone_click: {
    type: "CLICK_TO_CALL",
    title: "Clic pe telefon, pe site",
    what: "Omul atinge numărul de telefon de pe site (un link tel:). Numără clicul, nu apelul.",
    defaultName: "Lead - clic pe telefon (site)",
    defaultCategory: "PHONE_CALL_LEAD",
    call: false,
    site: true,
  },
  form: {
    type: "WEBPAGE",
    title: "Formular trimis",
    what: "Omul trimite formularul de contact sau de ofertă de pe site.",
    defaultName: "Lead - formular trimis (site)",
    defaultCategory: "SUBMIT_LEAD_FORM",
    call: false,
    site: true,
  },
};

export const CONVERSION_LIMITS = {
  /** Limita portalului (Google cere doar un nume unic în cont; `validateOnly` prinde restul). */
  nameMax: 100,
  clickWindow: { min: 1, max: 90, callMax: 60, default: 30 },
  viewWindow: { min: 1, max: 30, default: 1 },
  callSeconds: { min: 0, max: 10_000, default: 60 },
  valueMax: 1_000_000,
} as const;

export const CATEGORY_LABEL: Record<string, string> = {
  SUBMIT_LEAD_FORM: "Formular de lead trimis",
  PHONE_CALL_LEAD: "Apel telefonic",
  REQUEST_QUOTE: "Cerere de ofertă",
  BOOK_APPOINTMENT: "Programare",
  CONTACT: "Contact",
  DEFAULT: "Implicită",
  PAGE_VIEW: "Vizualizare de pagină",
  PURCHASE: "Achiziție",
  SIGNUP: "Înscriere",
  DOWNLOAD: "Descărcare",
  ADD_TO_CART: "Adăugare în coș",
  BEGIN_CHECKOUT: "Început de comandă",
  SUBSCRIBE_PAID: "Abonament plătit",
  IMPORTED_LEAD: "Lead importat",
  QUALIFIED_LEAD: "Lead calificat",
  CONVERTED_LEAD: "Lead convertit",
  GET_DIRECTIONS: "Indicații de orientare",
  OUTBOUND_CLICK: "Clic spre alt site",
  ENGAGEMENT: "Implicare",
  STORE_VISIT: "Vizită în magazin",
  STORE_SALE: "Vânzare în magazin",
  MESSAGE_LEAD: "Mesaj",
};

export const CONVERSION_TYPE_LABEL: Record<string, string> = {
  AD_CALL: "Apel din anunț",
  CLICK_TO_CALL: "Clic pe telefon (site)",
  WEBPAGE: "Pagină web",
  WEBPAGE_CODELESS: "Pagină web, fără cod",
  WEBSITE_CALL: "Apel spre numărul Google de pe site",
  UPLOAD_CLICKS: "Import de clicuri",
  UPLOAD_CALLS: "Import de apeluri",
  LEAD_FORM_SUBMIT: "Formular din anunț",
  GOOGLE_HOSTED: "Acțiune locală Google",
  STORE_VISITS: "Vizite în magazin",
  GOOGLE_ANALYTICS_4_CUSTOM: "Eveniment Google Analytics 4",
  GOOGLE_ANALYTICS_4_GENERATE_LEAD: "Lead din Google Analytics 4",
  GOOGLE_ANALYTICS_4_PURCHASE: "Achiziție din Google Analytics 4",
  SMART_CAMPAIGN_AD_CLICKS_TO_CALL: "Smart: clic pe apel",
  SMART_CAMPAIGN_MAP_CLICKS_TO_CALL: "Smart: apel din Maps",
  SMART_CAMPAIGN_MAP_DIRECTIONS: "Smart: indicații în Maps",
  SMART_CAMPAIGN_TRACKED_CALLS: "Smart: apeluri urmărite",
  LOCAL_SERVICES_ADS: "Local Services",
};

export const COUNTING_LABEL: Record<string, string> = {
  ONE_PER_CLICK: "o conversie pe clic",
  MANY_PER_CLICK: "fiecare conversie",
};

// ---------------------------------------------------------------------------
// Cererea din formular
// ---------------------------------------------------------------------------

const whole = (what: string, min: number, max: number) =>
  z
    .number({ error: `${what}: scrie un număr.` })
    .int({ error: `${what}: un număr întreg.` })
    .min(min, { error: `${what}: cel puțin ${min}.` })
    .max(max, { error: `${what}: cel mult ${max.toLocaleString("ro-RO")}.` });

export const leadActionInputSchema = z.strictObject({
  kind: z.enum(LEAD_KINDS),
  name: z
    .string()
    .trim()
    .min(1, { error: "Numele lipsește." })
    .max(CONVERSION_LIMITS.nameMax, { error: `Numele are cel mult ${CONVERSION_LIMITS.nameMax} de caractere.` }),
  category: z.enum(LEAD_CATEGORIES, { error: "Alege categoria." }),
  counting: z.enum(COUNTING_TYPES),
  clickWindowDays: whole("Fereastra după clic", CONVERSION_LIMITS.clickWindow.min, CONVERSION_LIMITS.clickWindow.max),
  viewWindowDays: whole("Fereastra după afișare", CONVERSION_LIMITS.viewWindow.min, CONVERSION_LIMITS.viewWindow.max).nullable(),
  callSeconds: whole("Durata minimă", CONVERSION_LIMITS.callSeconds.min, CONVERSION_LIMITS.callSeconds.max).nullable(),
  value: z
    .number({ error: "Valoarea: scrie un număr." })
    .min(0, { error: "Valoarea nu poate fi negativă." })
    .max(CONVERSION_LIMITS.valueMax, { error: "Valoarea e prea mare." })
    .nullable(),
  primary: z.boolean(),
});
export type LeadActionInput = z.infer<typeof leadActionInputSchema>;

export const conversionsRequestSchema = z.strictObject({
  actions: z.array(leadActionInputSchema).min(1, { error: "Bifează cel puțin o acțiune." }).max(LEAD_KINDS.length),
});
export type ConversionsRequest = z.infer<typeof conversionsRequestSchema>;

/** Valorile propuse pentru un fel — ce vede omul în formular înainte să schimbe ceva. */
export function defaultLeadAction(kind: LeadKind): LeadActionInput {
  const spec = LEAD_ACTIONS[kind];
  return {
    kind,
    name: spec.defaultName,
    category: spec.defaultCategory,
    counting: "ONE_PER_CLICK",
    clickWindowDays: CONVERSION_LIMITS.clickWindow.default,
    viewWindowDays: spec.call ? null : CONVERSION_LIMITS.viewWindow.default,
    callSeconds: spec.call ? CONVERSION_LIMITS.callSeconds.default : null,
    value: null,
    primary: true,
  };
}

export type ConversionsValidation =
  | { ok: true; request: ConversionsRequest }
  | { ok: false; errors: Array<{ path: string; message: string }> };

/**
 * Schema + regulile pe tip. Căile erorilor sunt ale formularului
 * (`actions.1.clickWindowDays`), ca browserul să le pună lângă câmp.
 */
export function validateConversionsRequest(raw: unknown): ConversionsValidation {
  const parsed = conversionsRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) };
  }
  const errors: Array<{ path: string; message: string }> = [];
  const kinds = new Set<string>();
  const names = new Set<string>();
  parsed.data.actions.forEach((action, index) => {
    const spec = LEAD_ACTIONS[action.kind];
    const at = (field: string) => `actions.${index}.${field}`;
    if (kinds.has(action.kind)) errors.push({ path: at("kind"), message: `„${spec.title}” apare de două ori.` });
    kinds.add(action.kind);
    const key = action.name.toLocaleLowerCase("ro-RO");
    if (names.has(key)) errors.push({ path: at("name"), message: "Două acțiuni cu același nume — Google cere nume unice în cont." });
    names.add(key);
    if (spec.call) {
      if (action.clickWindowDays > CONVERSION_LIMITS.clickWindow.callMax) {
        errors.push({ path: at("clickWindowDays"), message: `La apeluri, fereastra după clic e de cel mult ${CONVERSION_LIMITS.clickWindow.callMax} de zile.` });
      }
      if (action.viewWindowDays !== null) errors.push({ path: at("viewWindowDays"), message: "La apeluri nu există fereastră după afișare." });
      if (action.callSeconds === null) errors.push({ path: at("callSeconds"), message: "Durata minimă a apelului lipsește." });
    } else if (action.callSeconds !== null) {
      errors.push({ path: at("callSeconds"), message: "Durata minimă e doar pentru apelurile din anunț." });
    }
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, request: parsed.data };
}

// ---------------------------------------------------------------------------
// Operațiile spre Google
// ---------------------------------------------------------------------------

/**
 * O operație `conversionActionOperation.create` pe acțiune, fără status
 * (Google o pornește; o conversie nu cheltuie bani). Numerele int64 pleacă
 * ca text, ca în restul portalului (JSON-ul proto3).
 */
export function buildConversionOperations(request: ConversionsRequest, currency: string): Array<Record<string, unknown>> {
  return request.actions.map((action) => {
    const spec = LEAD_ACTIONS[action.kind];
    const create: Record<string, unknown> = {
      name: action.name,
      type: spec.type,
      category: action.category,
      countingType: action.counting,
      primaryForGoal: action.primary,
      clickThroughLookbackWindowDays: String(action.clickWindowDays),
    };
    if (spec.call) {
      create.phoneCallDurationSeconds = String(action.callSeconds ?? CONVERSION_LIMITS.callSeconds.default);
      // Google cere valoarea fixă la apeluri; fără valoare aleasă, doar regula.
      create.valueSettings =
        action.value === null
          ? { alwaysUseDefaultValue: true }
          : { defaultValue: action.value, defaultCurrencyCode: currency, alwaysUseDefaultValue: true };
    } else {
      if (action.viewWindowDays !== null) create.viewThroughLookbackWindowDays = String(action.viewWindowDays);
      // Site-ul nu trimite o valoare: dacă omul a ales una, e aceeași la fiecare conversie.
      if (action.value !== null) create.valueSettings = { defaultValue: action.value, defaultCurrencyCode: currency, alwaysUseDefaultValue: true };
    }
    return { conversionActionOperation: { create } };
  });
}

// ---------------------------------------------------------------------------
// Eticheta (AW-…/…) din fragmentele de cod ale acțiunii
// ---------------------------------------------------------------------------

export interface SendTo {
  /** Cifrele din AW-…, fără prefix — așa le cere eticheta de conversie din GTM. */
  conversionId: string;
  label: string;
}

const SEND_TO = /['"]send_to['"]\s*:\s*['"]AW-(\d+)\/([A-Za-z0-9_-]+)['"]/;

/** `gtag('event', 'conversion', {'send_to': 'AW-123/AbC'})` → { conversionId: "123", label: "AbC" }. */
export function sendToOf(snippets: ReadonlyArray<{ eventSnippet?: string | null }>): SendTo | null {
  for (const snippet of snippets) {
    const match = SEND_TO.exec(snippet.eventSnippet ?? "");
    if (match) return { conversionId: match[1], label: match[2] };
  }
  return null;
}

export function sendToText(sendTo: SendTo): string {
  return `AW-${sendTo.conversionId}/${sendTo.label}`;
}
