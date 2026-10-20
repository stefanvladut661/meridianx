import type { Platform } from "../constants";
import { formatAmount } from "../metrics";
import { EMPTY_FIGURES, addFigures, conversionOf, costPerResultOf, ctrOf, resultUnit, resultsOf } from "./results";
import type { ConversionType, EntityRow, Figures, ResultKind } from "./types";

/**
 * Cifrele unui rând de tabel și totalurile de sus, calculate din sume (niciodată
 * medii de rapoarte). Funcții pure, aceleași pe server și în browser.
 */

export interface RowFigures {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  /** null = nemăsurat (fără conversie aleasă sau fără conversii în cont). */
  results: number | null;
  resultKind: ResultKind;
  resultLabel: string | null;
  costPerResult: number | null;
  extra: Record<string, number>;
}

export function rowFigures(entity: EntityRow, figures: Figures | undefined, catalog: ReadonlyArray<ConversionType>): RowFigures {
  const sum = figures ?? EMPTY_FIGURES;
  const conversion = conversionOf(catalog, entity.resultKey);
  const results = conversion ? resultsOf(sum, entity.resultKey) : null;
  return {
    spend: sum.spend,
    impressions: sum.impressions,
    clicks: sum.clicks,
    ctr: ctrOf(sum),
    results,
    resultKind: conversion?.kind ?? "other",
    resultLabel: conversion?.label ?? null,
    costPerResult: costPerResultOf(sum.spend, results),
    extra: sum.extra,
  };
}

export interface CurrencyTotals {
  currency: string;
  spend: number;
  impressions: number;
  clicks: number;
  /** Rezultatele campaniilor măsurate. */
  results: number;
  /** Cheltuiala campaniilor măsurate — din ea se calculează costul per rezultat. */
  measuredSpend: number;
  byKind: Partial<Record<ResultKind, number>>;
  measured: number;
  unmeasured: number;
}

/** Totalurile de sus, pe monedă (lei și euro nu se adună). Doar din rânduri de același nivel. */
export function totalsByCurrency(rows: ReadonlyArray<{ entity: EntityRow; figures: RowFigures }>): CurrencyTotals[] {
  const map = new Map<string, CurrencyTotals>();
  for (const { entity, figures } of rows) {
    const currency = entity.currency ?? "—";
    const total =
      map.get(currency) ??
      { currency, spend: 0, impressions: 0, clicks: 0, results: 0, measuredSpend: 0, byKind: {}, measured: 0, unmeasured: 0 };
    total.spend = Math.round((total.spend + figures.spend) * 100) / 100;
    total.impressions += figures.impressions;
    total.clicks += figures.clicks;
    if (figures.results === null) {
      if (figures.spend > 0) total.unmeasured += 1;
    } else {
      total.measured += 1;
      total.results = Math.round((total.results + figures.results) * 100) / 100;
      total.measuredSpend = Math.round((total.measuredSpend + figures.spend) * 100) / 100;
      total.byKind[figures.resultKind] = Math.round(((total.byKind[figures.resultKind] ?? 0) + figures.results) * 100) / 100;
    }
    map.set(currency, total);
  }
  return [...map.values()].sort((a, b) => b.spend - a.spend);
}

/** Suma cifrelor mai multor rânduri (un grup = reclamele lui etc.). */
export function sumFigures(list: ReadonlyArray<Figures | undefined>): Figures {
  return list.reduce<Figures>((acc, item) => (item ? addFigures(acc, item) : acc), EMPTY_FIGURES);
}

// ---------------------------------------------------------------------------
// Coloanele care apar doar cu filtrul pe un canal
// ---------------------------------------------------------------------------

export interface ChannelColumn {
  key: string;
  label: string;
  /** Explicația din antet (title + cititor de ecran). */
  hint: string;
  kind: "count" | "money" | "percent";
  value: (figures: RowFigures) => number | null;
}

const perClick = (figures: RowFigures) => (figures.clicks > 0 ? figures.spend / figures.clicks : null);
const perThousand = (figures: RowFigures) => (figures.impressions > 0 ? (figures.spend / figures.impressions) * 1000 : null);
const extra = (key: string) => (figures: RowFigures) => (key in figures.extra ? figures.extra[key] : 0);

export const CHANNEL_COLUMNS: Record<Platform, ChannelColumn[]> = {
  google: [
    { key: "cpc", label: "CPC mediu", hint: "Cheltuit împărțit la clicuri", kind: "money", value: perClick },
    { key: "all_conversions", label: "Toate conversiile", hint: "Și conversiile secundare, nu doar cele principale", kind: "count", value: extra("all_conversions") },
    { key: "phone_calls", label: "Apeluri din anunț", hint: "Apelurile din butonul de apel, cum le numără Google", kind: "count", value: extra("phone_calls") },
    { key: "video_views", label: "Vizionări", hint: "Vizionările video numărate de Google (TrueView)", kind: "count", value: extra("video_views") },
  ],
  meta: [
    { key: "cpm", label: "CPM", hint: "Cheltuit la 1.000 de afișări", kind: "money", value: perThousand },
    { key: "cpc", label: "CPC (link)", hint: "Cheltuit împărțit la clicurile pe link", kind: "money", value: perClick },
    { key: "all_clicks", label: "Toate clicurile", hint: "Și clicurile care nu duc pe site (profil, like, extindere)", kind: "count", value: extra("all_clicks") },
    { key: "thruplay", label: "ThruPlay", hint: "Vizionări până la capăt sau de cel puțin 15 secunde", kind: "count", value: extra("thruplay") },
  ],
  tiktok: [
    { key: "cpm", label: "CPM", hint: "Cheltuit la 1.000 de afișări", kind: "money", value: perThousand },
    { key: "cpc", label: "CPC", hint: "Cheltuit împărțit la clicuri", kind: "money", value: perClick },
    { key: "video_2s", label: "Vizionări 2 s", hint: "Vizionări de cel puțin 2 secunde", kind: "count", value: extra("video_2s") },
    { key: "video_6s", label: "Vizionări 6 s", hint: "Vizionări de cel puțin 6 secunde", kind: "count", value: extra("video_6s") },
  ],
};

/** „4 apeluri”, „1 lead”, „nemăsurat”. */
export function resultText(figures: Pick<RowFigures, "results" | "resultKind">): string {
  return figures.results === null ? "nemăsurat" : resultUnit(figures.results, figures.resultKind);
}

/** Bugetul de pe rând: pe zi, total, „la campanie” (bugetul e pe campanie) sau „la grupuri”. */
export function budgetText(entity: EntityRow, parentHasBudget: boolean): string {
  const currency = entity.currency ?? "";
  if (entity.dailyBudget) return `${formatAmount(entity.dailyBudget, currency)}/zi`;
  if (entity.lifetimeBudget) return `${formatAmount(entity.lifetimeBudget, currency)} total`;
  if (entity.level === "group" && parentHasBudget) return "la campanie";
  if (entity.level === "campaign" && entity.platform !== "google") return "la grupuri";
  return "—";
}

/** Caută fără diacritice și fără majuscule: „campanie” găsește „Campanie” și „câmpanie”. */
export function searchable(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}
