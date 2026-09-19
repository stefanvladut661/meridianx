/**
 * Datele din panou, mereu pe ora României.
 *
 * Serverul Vercel rulează pe UTC, iar browserul pe fusul omului — fără un
 * fus explicit, aceeași oră se randează diferit pe server și pe client
 * (avertisment de hidratare) și, mai rău, lead-ul de la 14:30 apărea la
 * 11:30. Fusul e fixat aici, o singură dată, pentru tabel, fișă și
 * istoric.
 */

export const TIME_ZONE = "Europe/Bucharest";

const dayKey = new Intl.DateTimeFormat("ro-RO", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const time = new Intl.DateTimeFormat("ro-RO", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const shortDate = new Intl.DateTimeFormat("ro-RO", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

const dateTime = new Intl.DateTimeFormat("ro-RO", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** „azi 14:30” pentru ziua curentă (pe ora României), altfel „19.09.26”. */
export function formatLeadDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  return dayKey.format(date) === dayKey.format(now)
    ? `azi ${time.format(date)}`
    : shortDate.format(date);
}

/** „19.09.2026, 14:30”. */
export function formatLeadDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}
