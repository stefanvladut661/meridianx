import { sendToText, type SendTo } from "./standard";

/**
 * Generatorul fișierului de import GTM (faza 13) — izomorf și pur: primește
 * id-ul de conversie și etichetele acțiunilor, întoarce JSON-ul pe care omul
 * îl importă în Google Tag Manager (Admin → Import container → Combinare).
 * Portalul nu vorbește cu GTM și nu publică nimic.
 *
 * Formatul e cel al exportului din GTM (`exportFormatVersion: 2`), cu tipurile
 * scrise ca în export (LINK_CLICK, FORM_SUBMISSION, PAGEVIEW, CUSTOM_EVENT;
 * condițiile STARTS_WITH, EQUALS, MATCH_REGEX). Ce conține, după alegeri:
 *   - Conversion Linker (`gclidw`) pe toate paginile — fără el, conversiile
 *     din browserele care taie cookie-urile terțe se pierd;
 *   - tag-ul Google (`googtag`, AW-…) pe toate paginile, dacă site-ul nu-l are;
 *   - conversia „clic pe telefon” (`awct`) pe un declanșator „doar linkuri”,
 *     Click URL începe cu `tel:`;
 *   - conversia „formular” (`awct`) pe declanșatorul ales: trimiterea
 *     formularului (opțional cu Form ID), pagina de mulțumire (Page Path) sau
 *     un eveniment dataLayer;
 *   - variabilele încorporate de care au nevoie declanșatoarele.
 *
 * Id-urile din fișier încep de la 900, iar numele încep cu „Google Ads ·”:
 * la „Combinare → Redenumește” nu se calcă nimic din containerul clientului.
 */

export const GTM_ALL_PAGES_TRIGGER = "2147479553";
export const GTM_FILE_NAME = "gtm-conversii-google-ads.json";

export type FormTrigger =
  | { kind: "form_submit"; formId: string }
  | { kind: "thank_you"; path: string }
  | { kind: "event"; event: string };

export const FORM_TRIGGER_LABEL: Record<FormTrigger["kind"], string> = {
  form_submit: "Trimiterea formularului",
  thank_you: "Pagina de mulțumire",
  event: "Eveniment dataLayer",
};

export interface GtmInput {
  /** Cifrele din AW-… ale contului (din eticheta acțiunilor). */
  conversionId: string;
  /** Site-ul NU are deja tag-ul Google cu AW-… — îl pune importul. */
  includeGoogleTag: boolean;
  phone: SendTo | null;
  form: (SendTo & { trigger: FormTrigger }) | null;
}

export type GtmField = "conversionId" | "phone" | "form" | "formId" | "path" | "event";

export interface GtmProblem {
  field: GtmField;
  message: string;
}

const LABEL = /^[A-Za-z0-9_-]{1,64}$/;

export function checkGtmInput(input: GtmInput): { errors: GtmProblem[]; warnings: string[] } {
  const errors: GtmProblem[] = [];
  const warnings: string[] = [];
  if (!/^\d{5,15}$/.test(input.conversionId)) errors.push({ field: "conversionId", message: "Id-ul de conversie (cifrele din AW-…) lipsește sau nu e bun." });
  if (!input.phone && !input.form) errors.push({ field: "form", message: "Alege cel puțin o conversie: clicul pe telefon sau formularul." });
  for (const [field, sendTo] of [["phone", input.phone], ["form", input.form]] as const) {
    if (!sendTo) continue;
    if (sendTo.conversionId !== input.conversionId) {
      errors.push({ field, message: `Eticheta e din alt cont (AW-${sendTo.conversionId}, nu AW-${input.conversionId}).` });
    }
    if (!LABEL.test(sendTo.label)) errors.push({ field, message: "Eticheta conversiei nu are forma dată de Google." });
  }
  const trigger = input.form?.trigger;
  if (trigger?.kind === "form_submit" && trigger.formId && !/^[^\s"'{}<>]{1,100}$/.test(trigger.formId)) {
    errors.push({ field: "formId", message: "Form ID: atributul id al formularului, fără spații sau ghilimele." });
  }
  if (trigger?.kind === "thank_you" && !/^\/[^\s?#"'{}<>]{0,200}$/.test(trigger.path)) {
    errors.push({ field: "path", message: "Calea paginii începe cu / și n-are spații, ? sau # (de exemplu /multumim)." });
  }
  if (trigger?.kind === "thank_you" && trigger.path === "/") {
    errors.push({ field: "path", message: "Prima pagină nu e o pagină de mulțumire: conversia s-ar număra la fiecare vizită." });
  }
  if (trigger?.kind === "event" && !/^[A-Za-z0-9_.:-]{1,100}$/.test(trigger.event)) {
    errors.push({ field: "event", message: "Numele evenimentului: litere, cifre, _ . : - (de exemplu generate_lead)." });
  }
  if (input.phone && input.form && input.phone.label === input.form.label) {
    warnings.push("Clicul pe telefon și formularul trimit aceeași acțiune: Google le numără împreună, fără să le poți despărți.");
  }
  if (trigger?.kind === "form_submit") {
    warnings.push(
      "Declanșatorul „trimiterea formularului” prinde doar formularele care se trimit clasic (pagina se reîncarcă). Formularele trimise prin JavaScript — cele mai multe azi — au nevoie de pagina de mulțumire sau de un eveniment dataLayer."
    );
  }
  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Fișierul
// ---------------------------------------------------------------------------

type Parameter = { type: "TEMPLATE" | "BOOLEAN"; key?: string; value: string };
type Condition = { type: "STARTS_WITH" | "EQUALS" | "MATCH_REGEX"; parameter: Parameter[] };

const ACCOUNT = { accountId: "0", containerId: "0" };
const template = (key: string, value: string): Parameter => ({ type: "TEMPLATE", key, value });
const boolean = (key: string, value: boolean): Parameter => ({ type: "BOOLEAN", key, value: String(value) });
const condition = (type: Condition["type"], variable: string, value: string): Condition => ({
  type,
  parameter: [template("arg0", variable), template("arg1", value)],
});

const BUILT_IN: Record<string, string> = {
  PAGE_URL: "Page URL",
  PAGE_HOSTNAME: "Page Hostname",
  PAGE_PATH: "Page Path",
  REFERRER: "Referrer",
  EVENT: "Event",
  CLICK_URL: "Click URL",
  FORM_ID: "Form ID",
};

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface GtmItem {
  kind: "tag" | "trigger" | "variable";
  name: string;
  what: string;
}

/** „2026-10-20 09:41:07”, cum scrie GTM `exportTime`. */
function exportTimeOf(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function buildGtmImport(input: GtmInput, now: Date): { file: Record<string, unknown>; items: GtmItem[] } {
  const tags: Array<Record<string, unknown>> = [];
  const triggers: Array<Record<string, unknown>> = [];
  const builtIns = new Set(["PAGE_URL", "PAGE_HOSTNAME", "PAGE_PATH", "REFERRER", "EVENT"]);
  const items: GtmItem[] = [];
  let nextTag = 901;
  let nextTrigger = 911;

  const conversionTag = (name: string, sendTo: SendTo, triggerId: string) => ({
    ...ACCOUNT,
    tagId: String(nextTag++),
    name,
    type: "awct",
    parameter: [
      boolean("enableConversionLinker", true),
      template("conversionCookiePrefix", "_gcl"),
      template("conversionId", sendTo.conversionId),
      template("conversionLabel", sendTo.label),
    ],
    firingTriggerId: [triggerId],
    tagFiringOption: "ONCE_PER_EVENT",
  });

  tags.push({
    ...ACCOUNT,
    tagId: String(nextTag++),
    name: "Google Ads · Conversion Linker",
    type: "gclidw",
    parameter: [boolean("enableCrossDomain", false), boolean("enableCookieOverrides", false)],
    firingTriggerId: [GTM_ALL_PAGES_TRIGGER],
    tagFiringOption: "ONCE_PER_EVENT",
  });
  items.push({ kind: "tag", name: "Google Ads · Conversion Linker", what: "pe toate paginile — păstrează clicul din anunț (gclid) în cookie-ul site-ului" });

  if (input.includeGoogleTag) {
    const name = `Google Ads · tag Google AW-${input.conversionId}`;
    tags.push({
      ...ACCOUNT,
      tagId: String(nextTag++),
      name,
      type: "googtag",
      parameter: [template("tagId", `AW-${input.conversionId}`)],
      firingTriggerId: [GTM_ALL_PAGES_TRIGGER],
      tagFiringOption: "ONCE_PER_EVENT",
    });
    items.push({ kind: "tag", name, what: "pe toate paginile — site-ul nu are încă tag-ul Google" });
  }

  if (input.phone) {
    const triggerId = String(nextTrigger++);
    const triggerName = "Google Ads · clic pe un link tel:";
    triggers.push({
      ...ACCOUNT,
      triggerId,
      name: triggerName,
      type: "LINK_CLICK",
      filter: [condition("STARTS_WITH", "{{Click URL}}", "tel:")],
      waitForTags: { type: "BOOLEAN", value: "false" },
      checkValidation: { type: "BOOLEAN", value: "false" },
      waitForTagsTimeout: { type: "TEMPLATE", value: "2000" },
    });
    builtIns.add("CLICK_URL");
    const name = "Google Ads · conversie · clic pe telefon";
    tags.push(conversionTag(name, input.phone, triggerId));
    items.push({ kind: "trigger", name: triggerName, what: "doar linkuri; Click URL începe cu tel:" });
    items.push({ kind: "tag", name, what: `trimite ${sendToText(input.phone)}` });
  }

  if (input.form) {
    const triggerId = String(nextTrigger++);
    const trigger = input.form.trigger;
    let triggerName: string;
    let what: string;
    if (trigger.kind === "form_submit") {
      triggerName = trigger.formId ? `Google Ads · formular trimis (#${trigger.formId})` : "Google Ads · formular trimis";
      what = trigger.formId ? `trimiterea formularului cu Form ID = ${trigger.formId}, doar dacă trece validarea` : "trimiterea oricărui formular, doar dacă trece validarea";
      triggers.push({
        ...ACCOUNT,
        triggerId,
        name: triggerName,
        type: "FORM_SUBMISSION",
        ...(trigger.formId ? { filter: [condition("EQUALS", "{{Form ID}}", trigger.formId)] } : {}),
        autoEventFilter: [condition("MATCH_REGEX", "{{Page URL}}", ".*")],
        waitForTags: { type: "BOOLEAN", value: "false" },
        checkValidation: { type: "BOOLEAN", value: "true" },
        waitForTagsTimeout: { type: "TEMPLATE", value: "2000" },
      });
      if (trigger.formId) builtIns.add("FORM_ID");
    } else if (trigger.kind === "thank_you") {
      const path = trigger.path.replace(/\/+$/, "") || "/";
      triggerName = `Google Ads · pagina de mulțumire ${path}`;
      what = `afișarea paginii ${path} (cu sau fără / la final)`;
      triggers.push({
        ...ACCOUNT,
        triggerId,
        name: triggerName,
        type: "PAGEVIEW",
        filter: [condition("MATCH_REGEX", "{{Page Path}}", `^${escapeRegex(path)}/?$`)],
      });
    } else {
      triggerName = `Google Ads · eveniment ${trigger.event}`;
      what = `dataLayer.push({ event: "${trigger.event}" })`;
      triggers.push({
        ...ACCOUNT,
        triggerId,
        name: triggerName,
        type: "CUSTOM_EVENT",
        customEventFilter: [condition("EQUALS", "{{_event}}", trigger.event)],
      });
    }
    const name = "Google Ads · conversie · formular";
    tags.push(conversionTag(name, input.form, triggerId));
    items.push({ kind: "trigger", name: triggerName, what });
    items.push({ kind: "tag", name, what: `trimite ${sendToText(input.form)}` });
  }

  const builtInVariable = [...builtIns].map((type) => ({ ...ACCOUNT, type, name: BUILT_IN[type] }));
  items.push({ kind: "variable", name: builtInVariable.map((item) => item.name).join(", "), what: "variabile încorporate, pornite la import" });

  const file = {
    exportFormatVersion: 2,
    exportTime: exportTimeOf(now),
    containerVersion: {
      ...ACCOUNT,
      containerVersionId: "0",
      container: { ...ACCOUNT, name: "Conversii Google Ads", publicId: "GTM-XXXXXXX", usageContext: ["WEB"] },
      tag: tags,
      trigger: triggers,
      builtInVariable,
    },
  };
  return { file, items };
}
