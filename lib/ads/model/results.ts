import type { ConversionType, Figures, ResultKind } from "./types";

/**
 * „Rezultate” — un singur cuvânt pentru ce contează la o campanie: apel, lead
 * sau formular. Fiecare platformă îi spune altfel; portalul le aduce la
 * același nume. Funcții pure, aceleași pe server și în browser.
 *
 * Regula care nu se negociază: o cifră pe care n-o măsoară nimic nu e 0. Fără
 * nicio conversie în cont sau fără o conversie aleasă pe campanie, rezultatul
 * e `null` și se scrie „nemăsurat”.
 */

/** Cheia „nemăsurat”, aleasă intenționat de om pe o campanie. */
export const NO_RESULT = "none";

export const EMPTY_FIGURES: Figures = { spend: 0, impressions: 0, clicks: 0, conversions: {}, extra: {} };

const UNITS: Record<ResultKind, [string, string]> = {
  call: ["apel", "apeluri"],
  lead: ["lead", "lead-uri"],
  form: ["formular", "formulare"],
  purchase: ["vânzare", "vânzări"],
  other: ["conversie", "conversii"],
};

export const RESULT_KIND_LABEL: Record<ResultKind, string> = {
  call: "Apeluri",
  lead: "Lead-uri",
  form: "Formulare",
  purchase: "Vânzări",
  other: "Conversii",
};

const decimalOrInteger = (value: number) =>
  new Intl.NumberFormat("ro-RO", { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 }).format(value);

/**
 * „1 apel”, „4 apeluri”, „20 de apeluri”, „2,5 conversii”. Regula din română:
 * de la 20 în sus (și la orice număr care se termină în 00–19 peste 100, cu
 * excepția lor), între număr și substantiv intră „de”.
 */
export function resultUnit(value: number, kind: ResultKind): string {
  const [one, many] = UNITS[kind];
  const text = decimalOrInteger(value);
  if (value === 1) return `${text} ${one}`;
  if (!Number.isInteger(value)) return `${text} ${many}`;
  const rest = Math.abs(value) % 100;
  const needsDe = Math.abs(value) >= 20 && (rest === 0 || rest >= 20);
  return `${text} ${needsDe ? "de " : ""}${many}`;
}

export function conversionOf(catalog: ReadonlyArray<ConversionType>, key: string | null): ConversionType | null {
  if (!key || key === NO_RESULT) return null;
  return catalog.find((entry) => entry.key === key) ?? null;
}

/** Rezultatele unui rând, după cheia campaniei lui. `null` = nemăsurat. */
export function resultsOf(figures: Figures, key: string | null): number | null {
  if (!key || key === NO_RESULT) return null;
  return Math.round((figures.conversions[key] ?? 0) * 100) / 100;
}

export function addFigures(target: Figures, add: Figures): Figures {
  const conversions = { ...target.conversions };
  for (const [key, value] of Object.entries(add.conversions)) conversions[key] = (conversions[key] ?? 0) + value;
  const extra = { ...target.extra };
  for (const [key, value] of Object.entries(add.extra)) extra[key] = (extra[key] ?? 0) + value;
  return {
    spend: Math.round((target.spend + add.spend) * 100) / 100,
    impressions: target.impressions + add.impressions,
    clicks: target.clicks + add.clicks,
    conversions,
    extra,
  };
}

/** Procent: 1,84 = 1,84%. `null` fără afișări. */
export function ctrOf(figures: Pick<Figures, "clicks" | "impressions">): number | null {
  return figures.impressions > 0 ? (figures.clicks / figures.impressions) * 100 : null;
}

export function costPerResultOf(spend: number, results: number | null): number | null {
  return results !== null && results > 0 ? spend / results : null;
}
