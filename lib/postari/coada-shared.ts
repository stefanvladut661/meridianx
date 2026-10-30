import type { Platforma } from "./limite";

/**
 * Stările unei postări din coadă și ce înseamnă pentru om. Fișier izomorf —
 * îl folosesc ecranele și serverul. Aceleași stări ca în migrarea 25.
 *
 *   planificată → în lucru → publicată (Instagram)
 *                          → trimisă în ciorne (TikTok) → publicată (când o publici din aplicație)
 *               → eșuată (cu motivul; „Reîncearcă”)
 *   planificată / eșuată → scoasă din coadă
 */

/** Tonul unei stări (culoarea etichetei din ecrane). */
export type Tone = "ok" | "warn" | "error" | "accent" | "neutral" | "muted";

export const STARI = ["planificata", "in_lucru", "publicata", "in_ciorne", "esuata", "scoasa"] as const;
export type Stare = (typeof STARI)[number];

export const STARE_LABEL: Record<Stare, string> = {
  planificata: "Planificată",
  in_lucru: "În lucru",
  publicata: "Publicată",
  in_ciorne: "Trimisă în ciorne",
  esuata: "Eșuată",
  scoasa: "Scoasă din coadă",
};

export const STARE_TONE: Record<Stare, Tone> = {
  planificata: "neutral",
  in_lucru: "accent",
  publicata: "ok",
  in_ciorne: "accent",
  esuata: "error",
  scoasa: "muted",
};

/** De câte ori se încearcă o postare înainte să rămână „eșuată”. */
export const MAX_INCERCARI = 4;
/** Pauza dinaintea reîncercării 2, 3 și 4. */
export const PAUZE_REINCERCARE_MS = [2 * 60_000, 10 * 60_000, 30 * 60_000] as const;
/** O postare care n-a pornit la peste 6 ore după ora ei nu mai pleacă singură: decizi tu („Reîncearcă”). */
export const INTARZIERE_MAXIMA_MS = 6 * 60 * 60_000;

/** Pașii din „în lucru”, cum îi citește omul. */
export const PAS_LABEL: Record<string, string> = {
  copiere: "copiază clipul de pe Drive",
  container: "pregătește postarea la Instagram",
  procesare: "Instagram procesează clipul",
  publicare: "publică",
  init: "pregătește trimiterea la TikTok",
  urcare: "urcă clipul la TikTok",
  verificare: "TikTok procesează clipul",
};

/** Postarea cum o arată ecranele (fără tokenuri, fără adrese de urcare). */
export interface PostView {
  id: string;
  planId: string;
  planNume: string | null;
  element: number;
  platforma: Platforma;
  fisier: string;
  driveFileId: string;
  descriere: string;
  hashtaguri: string[];
  caption: string;
  optiuni: { tip?: "reel" | "trial_reel"; absolvire?: "manual" | "automat" | null; in_feed?: boolean; coperta_ms?: number | null };
  /** Durata clipului, dacă a fost citită din fișier (la verificarea planului). */
  durataMs: number | null;
  programataLa: string;
  sursaOra: "fixa" | "slot";
  stare: Stare;
  pas: string | null;
  incercari: number;
  urmatoareaIncercare: string | null;
  /** O rulare lucrează acum la ea. */
  ocupata: boolean;
  eroare: string | null;
  eroareCod: string | null;
  link: string | null;
  avertisment: string | null;
  trimisaLa: string | null;
  publicataLa: string | null;
  publicataDe: string | null;
  scoasaLa: string | null;
  reluataLa: string | null;
  /** Se mai poate scoate din coadă (n-a ajuns la pasul de după care nu mai e cale înapoi). */
  sePoateScoate: boolean;
}

/** Ce scrie pe rând, pe scurt: „în lucru — urcă clipul la TikTok”, „reîncearcă la 14:05 (2 din 4)”. */
export function stateDetail(post: Pick<PostView, "stare" | "pas" | "incercari" | "urmatoareaIncercare" | "eroare" | "ocupata">, timeLabel: (iso: string) => string): string | null {
  if (post.stare === "in_lucru") {
    const step = post.pas ? PAS_LABEL[post.pas] ?? post.pas : "pornește";
    if (post.ocupata) return step;
    if (post.urmatoareaIncercare && post.eroare && post.incercari > 0) return `${step}; reîncearcă la ${timeLabel(post.urmatoareaIncercare)} (încercarea ${post.incercari + 1} din ${MAX_INCERCARI})`;
    if (post.urmatoareaIncercare && post.eroare) return `așteaptă: ${post.eroare}`;
    if (post.urmatoareaIncercare) return `${step}; continuă la ${timeLabel(post.urmatoareaIncercare)}`;
    return step;
  }
  if (post.stare === "planificata" && post.eroare && post.urmatoareaIncercare) return `așteaptă: ${post.eroare}`;
  return null;
}
