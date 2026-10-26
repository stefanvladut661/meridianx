/**
 * Bani, zile și luni, pe ora României. Fișier izomorf: îl folosesc și
 * ecranele, și serverul. O lună e „AAAA-LL”; o zi e „AAAA-LL-ZZ”.
 */

export const RO_TZ = "Europe/Bucharest";

export const LUNI = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"] as const;

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_RE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Ziua de azi în România, „AAAA-LL-ZZ”. */
export function todayIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: RO_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function currentMonth(now: Date = new Date()): string {
  return todayIso(now).slice(0, 7);
}

export function isMonth(value: string | null | undefined): value is string {
  return typeof value === "string" && MONTH_RE.test(value);
}

export function isDay(value: string | null | undefined): value is string {
  if (typeof value !== "string" || !DAY_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function monthStart(month: string): string {
  return `${month}-01`;
}

export function daysInMonth(month: string): number {
  const [year, mm] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mm, 0)).getUTCDate();
}

export function monthEnd(month: string): string {
  return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

export function addMonths(month: string, count: number): string {
  const [year, mm] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, mm - 1 + count, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function addDays(day: string, count: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

/** Zile de la `from` la `to` (negativ dacă `to` e înainte). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** „octombrie 2026”. */
export function monthLabel(month: string): string {
  const [year, mm] = month.split("-").map(Number);
  return `${LUNI[mm - 1]} ${year}`;
}

/** „21 oct. 2026”. */
export function dayLabel(day: string | null | undefined): string {
  if (!day || !isDay(day.slice(0, 10))) return "—";
  return new Intl.DateTimeFormat("ro-RO", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${day.slice(0, 10)}T00:00:00Z`));
}

/** „21 oct. 2026, 14:05”, pe ora României. */
export function dateTimeLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ro-RO", { timeZone: RO_TZ, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

/** „1.234,50 lei” / „1.234,50 €”. `null` → „—” (o sumă necunoscută nu e 0). */
export function money(amount: number | null | undefined, currency: string = "RON"): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "—";
  const value = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return currency === "EUR" ? `${value} €` : currency === "RON" ? `${value} lei` : `${value} ${currency}`;
}

/**
 * O sumă scrisă de om → număr cu 2 zecimale, sau `null`. Ca în română: punctul
 * separă miile, virgula zecimalele („1.500” = 1500, „1.234,50” = 1234,5). Un
 * punct singur care nu desparte grupe de câte trei cifre e zecimal („1500.50”).
 */
export function parseAmount(raw: string): number | null {
  const text = raw.replace(/\s|lei|ron|eur|€/gi, "").trim();
  if (!text) return null;
  let normalized = text;
  if (text.includes(",") && text.includes(".")) {
    // Separatorul de zecimale e ultimul dintre cele două.
    normalized = text.lastIndexOf(",") > text.lastIndexOf(".") ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (text.includes(",")) {
    normalized = text.replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    normalized = text.replace(/\./g, "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100) / 100;
}
