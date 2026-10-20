import { CURRENCY_LABEL, type Currency } from "./constants";

/**
 * Cifrele portalului — calcule pure, aceleași pe server și în browser.
 *
 * Rapoartele (CTR, CPC, CPM, cost pe rezultat) se calculează MEREU din
 * sume, niciodată ca medie a rapoartelor zilnice: media CTR-urilor a zece
 * zile nu e CTR-ul celor zece zile. O zi fără livrare lipsește din bază și
 * contează ca zero.
 */

export interface DayFigures {
  /** `YYYY-MM-DD`, în fusul contului de reclame. */
  date: string;
  spend: number;
  impressions: number;
  /** Clicuri pe link (ce numește Ads Manager „Link clicks”). */
  clicks: number;
  results: number;
}

export interface Totals {
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  /** Procent: 1,84 = 1,84%. `null` fără afișări. */
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  costPerResult: number | null;
  /** Zile cu livrare. */
  days: number;
}

export function totalsOf(rows: ReadonlyArray<DayFigures>): Totals {
  const sum = rows.reduce(
    (acc, row) => ({
      spend: acc.spend + row.spend,
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      results: acc.results + row.results,
    }),
    { spend: 0, impressions: 0, clicks: 0, results: 0 }
  );
  return {
    ...sum,
    spend: Math.round(sum.spend * 100) / 100,
    ctr: sum.impressions > 0 ? (sum.clicks / sum.impressions) * 100 : null,
    cpc: sum.clicks > 0 ? sum.spend / sum.clicks : null,
    cpm: sum.impressions > 0 ? (sum.spend / sum.impressions) * 1000 : null,
    costPerResult: sum.results > 0 ? sum.spend / sum.results : null,
    // Zile calendaristice cu livrare — nu rânduri: două campanii în aceeași zi sunt o zi.
    days: new Set(rows.filter((row) => row.spend > 0 || row.impressions > 0).map((row) => row.date)).size,
  };
}

// ---------------------------------------------------------------------------
// Perioade
// ---------------------------------------------------------------------------

export const PERIODS = [7, 30, 90] as const;
export type PeriodDays = (typeof PERIODS)[number];

export function isPeriod(value: unknown): value is PeriodDays {
  return PERIODS.includes(Number(value) as PeriodDays);
}

/** Ziua de azi pe ora României, `YYYY-MM-DD`. */
export function todayInBucharest(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(now);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

/** Toate zilele dintre `from` și `to`, inclusiv. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) out.push(date);
  return out;
}

export interface PeriodRange {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
}

/** Ultimele `days` zile, până azi inclusiv, și cele `days` de dinainte. */
export function periodRange(days: number, today: string = todayInBucharest()): PeriodRange {
  const from = addDays(today, -(days - 1));
  return { from, to: today, previousFrom: addDays(from, -days), previousTo: addDays(from, -1) };
}

/** Rândurile completate cu zero pentru zilele fără livrare, în ordine. */
export function fillDays(rows: ReadonlyArray<DayFigures>, from: string, to: string): DayFigures[] {
  const byDate = new Map<string, DayFigures>();
  for (const row of rows) {
    const existing = byDate.get(row.date);
    byDate.set(
      row.date,
      existing
        ? {
            date: row.date,
            spend: existing.spend + row.spend,
            impressions: existing.impressions + row.impressions,
            clicks: existing.clicks + row.clicks,
            results: existing.results + row.results,
          }
        : { ...row }
    );
  }
  return daysBetween(from, to).map(
    (date) => byDate.get(date) ?? { date, spend: 0, impressions: 0, clicks: 0, results: 0 }
  );
}

// ---------------------------------------------------------------------------
// Comparația
// ---------------------------------------------------------------------------

/** Cum se citește o creștere: bine, rău sau doar informativ. */
export type Direction = "up_good" | "up_bad" | "neutral";

export interface Delta {
  /** Procent față de perioada anterioară; `null` fără bază de comparat. */
  percent: number | null;
  tone: "good" | "bad" | "flat" | "none";
}

export function deltaOf(current: number | null, previous: number | null, direction: Direction): Delta {
  if (current === null || previous === null || previous === 0) return { percent: null, tone: "none" };
  const percent = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(percent) < 0.5 || direction === "neutral") return { percent, tone: "flat" };
  const up = percent > 0;
  return { percent, tone: (direction === "up_good") === up ? "good" : "bad" };
}

// ---------------------------------------------------------------------------
// Cum se scriu
// ---------------------------------------------------------------------------

const integer = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("ro-RO", { notation: "compact", maximumFractionDigits: 1 });

export function formatCount(value: number): string {
  return value >= 100_000 ? compact.format(value) : integer.format(value);
}

export function formatAmount(value: number | null, currency: Currency | string): string {
  if (value === null) return "—";
  const label = CURRENCY_LABEL[currency as Currency] ?? currency;
  const number = value >= 10_000 ? integer.format(value) : decimal.format(value);
  return `${number} ${label}`;
}

export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${decimal.format(value)}%`;
}

export function formatDelta(delta: Delta): string {
  if (delta.percent === null) return "fără perioadă de comparat";
  const rounded = Math.round(delta.percent);
  if (rounded === 0) return "la fel";
  return `${rounded > 0 ? "+" : "−"}${integer.format(Math.abs(rounded))}%`;
}

const dayMonth = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", timeZone: "UTC" });
const weekdayDayMonth = new Intl.DateTimeFormat("ro-RO", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** „3 oct.” — ziua ca etichetă de axă. */
export function formatDay(date: string, withWeekday = false): string {
  const [y, m, d] = date.split("-").map(Number);
  const value = new Date(Date.UTC(y, m - 1, d));
  return (withWeekday ? weekdayDayMonth : dayMonth).format(value);
}
