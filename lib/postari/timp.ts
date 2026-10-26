/**
 * Ore și zile într-un fus orar dat (implicit „Europe/Bucharest”), fără
 * pachete: doar `Intl`. Fișier izomorf — îl folosesc și ecranele, și serverul.
 * În bază orele stau ca `timestamptz` (UTC); omul le scrie și le citește în fusul
 * planului.
 */

export const RO_TZ = "Europe/Bucharest";

export const ZILE_SCURT = ["dum.", "lun.", "mar.", "mie.", "joi", "vin.", "sâm."] as const;
export const LUNI = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"] as const;

const DAY_RE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isDay(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isTime(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

/** Fusul există? (`Intl` aruncă `RangeError` pe unul necunoscut.) */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function addDays(day: string, count: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsIn(date: Date, timeZone: string): Parts {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    partsFormatters.set(timeZone, formatter);
  }
  const out: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) if (part.type !== "literal") out[part.type] = Number(part.value);
  return { year: out.year, month: out.month, day: out.day, hour: out.hour === 24 ? 0 : out.hour, minute: out.minute, second: out.second };
}

/** Diferența fusului față de UTC, în milisecunde, la momentul dat. */
function offsetAt(date: Date, timeZone: string): number {
  const p = partsIn(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * „2026-11-02” + „12:30” în „Europe/Bucharest” → momentul UTC. Două treceri
 * prind schimbarea orei (DST). O oră care nu există (ex. 03:30 în noaptea în
 * care ceasul sare înainte) cade pe ora de după salt.
 */
export function zonedToUtc(day: string, time: string, timeZone: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, date, hour, minute);
  let utc = guess - offsetAt(new Date(guess), timeZone);
  utc = guess - offsetAt(new Date(utc), timeZone);
  return new Date(utc);
}

/** Ziua („AAAA-LL-ZZ”) și ora („HH:MM”) unui moment, în fusul dat. */
export function zonedParts(date: Date, timeZone: string): { day: string; time: string; weekday: number } {
  const p = partsIn(date, timeZone);
  const day = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  return { day, time: `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`, weekday: new Date(`${day}T00:00:00Z`).getUTCDay() };
}

export function todayIn(timeZone: string, now: Date = new Date()): string {
  return zonedParts(now, timeZone).day;
}

/** „lun. 2 noiembrie” */
export function dayLabel(day: string, withYear = false): string {
  const [year, month, date] = day.split("-").map(Number);
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return `${ZILE_SCURT[weekday]} ${date} ${LUNI[month - 1]}${withYear ? ` ${year}` : ""}`;
}

/** „lun. 2 noiembrie, 12:30” în fusul dat. */
export function momentLabel(iso: string | Date, timeZone: string = RO_TZ, withYear = false): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const { day, time } = zonedParts(date, timeZone);
  return `${dayLabel(day, withYear)}, ${time}`;
}

/** „acum 3 min”, „acum 2 ore”, „ieri”, sau data, pentru momente trecute. */
export function agoLabel(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "acum câteva secunde";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `acum ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "acum o oră" : `acum ${hours} ore`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ieri";
  if (days < 30) return `acum ${days} zile`;
  return momentLabel(iso);
}

/** „peste 12 min”, „peste 3 ore”, „mâine”, pentru momente viitoare. */
export function untilLabel(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  if (seconds <= 0) return "acum";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `peste ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "peste o oră" : `peste ${hours} ore`;
  const days = Math.round(hours / 24);
  return days === 1 ? "mâine" : `peste ${days} zile`;
}
