import { addMonths, daysBetween } from "./format";

/** Conturile firmei (migrarea 22), cum le văd ecranele. Fișier izomorf. */

export const CATEGORIE_CONT = {
  platforma: "Platformă",
  banca: "Bancă",
  facturare: "Facturare",
  google: "Google",
  meta: "Meta",
  tiktok: "TikTok",
  vercel: "Vercel",
  supabase: "Supabase",
  github: "GitHub",
  domeniu: "Domeniu",
  altele: "Altele",
} as const;
export type CategorieCont = keyof typeof CATEGORIE_CONT;

export interface ContFirma {
  id: string;
  nume: string;
  categoria: CategorieCont;
  adresa: string | null;
  cont: string | null;
  cineAreAcces: string | null;
  doiFa: "da" | "nu" | "necunoscut";
  undeEParola: string | null;
  abonament: number | null;
  moneda: "RON" | "EUR" | "USD";
  ciclu: "lunar" | "anual" | null;
  reinnoire: string | null;
  note: string | null;
  updatedAt: string;
}

/** Lista de bază (din prompt): conturile pe care le are orice firmă ca a ta. Fără date, doar numele. */
export const STARTER_ACCOUNTS: { nume: string; categoria: CategorieCont; adresa: string }[] = [
  { nume: "Banca Transilvania — BT Go", categoria: "banca", adresa: "https://btgo.ro" },
  { nume: "Oblio", categoria: "facturare", adresa: "https://www.oblio.eu" },
  { nume: "Google (Gmail, Drive)", categoria: "google", adresa: "https://myaccount.google.com" },
  { nume: "Meta Business", categoria: "meta", adresa: "https://business.facebook.com" },
  { nume: "TikTok Business", categoria: "tiktok", adresa: "https://business.tiktok.com" },
  { nume: "Vercel", categoria: "vercel", adresa: "https://vercel.com" },
  { nume: "Supabase", categoria: "supabase", adresa: "https://supabase.com/dashboard" },
  { nume: "GitHub", categoria: "github", adresa: "https://github.com" },
  { nume: "Domeniul meridianx.ro", categoria: "domeniu", adresa: "" },
  { nume: "Resend (emailuri)", categoria: "platforma", adresa: "https://resend.com" },
  { nume: "Anthropic (citirea bonurilor)", categoria: "platforma", adresa: "https://console.anthropic.com" },
];

/**
 * Pare o parolă sau o cheie: un șir lung fără spații, cu litere și cifre (ori
 * prefixele cunoscute de chei). Aici se scrie doar UNDE e parola.
 */
export function looksLikeSecret(value: string): boolean {
  const text = value.trim();
  if (/^(sk|pk|re|ghp|gho|github_pat|xox[bpa]|eyJ)[-_A-Za-z0-9]{10,}/.test(text)) return true;
  return text.split(/\s+/).some((word) => word.length >= 12 && /[A-Za-z]/.test(word) && /\d/.test(word) && !/^https?:\/\//.test(word) && !word.includes("@"));
}

/** Următoarea reînnoire, de azi încolo (un abonament lunar reînnoit ieri trece la luna următoare). */
export function nextRenewal(account: Pick<ContFirma, "reinnoire" | "ciclu">, today: string): string | null {
  if (!account.reinnoire) return null;
  let date = account.reinnoire;
  if (!account.ciclu) return date;
  for (let i = 0; i < 240 && date < today; i++) {
    const month = addMonths(date.slice(0, 7), account.ciclu === "lunar" ? 1 : 12);
    const day = Math.min(Number(account.reinnoire.slice(8, 10)), new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate());
    date = `${month}-${String(day).padStart(2, "0")}`;
  }
  return date;
}

/** Reînnoirea cade în următoarele `days` zile (alerta e la 7). */
export function renewsWithin(account: Pick<ContFirma, "reinnoire" | "ciclu">, today: string, days = 7): boolean {
  const next = nextRenewal(account, today);
  if (!next) return false;
  const left = daysBetween(today, next);
  return left >= 0 && left <= days;
}
