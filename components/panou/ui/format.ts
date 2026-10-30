/** Formatările din redesign (ro-RO), cu tipuri. Datele vin ca ISO sau ca `Date`. */

type DateLike = string | number | Date;

export const num = (n: number | null | undefined): string => new Intl.NumberFormat("ro-RO").format(Math.round(n || 0));

export const ron = (n: number | null | undefined, fraction = 0): string =>
  new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: fraction,
    minimumFractionDigits: fraction,
  }).format(Math.round((n || 0) * 100) / 100);

export const eur = (n: number | null | undefined): string =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);

export const pct = (n: number | null | undefined, fraction = 1): string =>
  `${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: fraction }).format(n || 0)}%`;

const RO_TZ = "Europe/Bucharest";

export const dateRo = (v: DateLike): string => new Date(v).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric", timeZone: RO_TZ });

export const dayMonthRo = (v: DateLike): string => new Date(v).toLocaleDateString("ro-RO", { day: "numeric", month: "short", timeZone: RO_TZ });

export const weekdayRo = (v: DateLike): string => new Date(v).toLocaleDateString("ro-RO", { weekday: "short", timeZone: RO_TZ });

export const timeRo = (v: DateLike): string => new Date(v).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: RO_TZ });

export const dateTimeRo = (v: DateLike): string => `${dateRo(v)}, ${timeRo(v)}`;

/** Ziua calendaristică în ora României (AAAA-LL-ZZ), nu în UTC: un lead de la 00:30 e din ziua lui. */
export const isoDay = (v: DateLike): string => new Intl.DateTimeFormat("sv-SE", { timeZone: RO_TZ }).format(new Date(v));

export function relativeRo(v: DateLike, now: number = Date.now()): string {
  const min = Math.round((now - new Date(v).getTime()) / 60000);
  if (min < 1) return "chiar acum";
  if (min < 60) return `acum ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `acum ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `acum ${d} z`;
  return dateRo(v);
}

export function untilRo(v: DateLike, now: number = Date.now()): string {
  const diff = new Date(v).getTime() - now;
  const h = Math.floor(diff / 3600000);
  const m = Math.round((diff % 3600000) / 60000);
  if (diff <= 0) return "acum";
  if (h < 1) return `în ${m} min`;
  if (h < 24) return `în ${h} h ${m} min`;
  return `în ${Math.round(h / 24)} z`;
}

export const initials = (name = ""): string =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

/** Variația procentuală față de perioada anterioară; `null` când nu există bază de comparație. */
export function delta(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
