import type { FirmaRand } from "./types";

/**
 * Telefon, WhatsApp, șabloane, .vcf și CSV, ca în prototip (lib/prospect.js).
 * Funcții pure, fără importuri de server: merg și în componentele client.
 */

const cifre = (valoare: string | null | undefined): string => String(valoare ?? "").replace(/\D/g, "");

/** 0722 432 689 → 722432689 (fără 0 în față), pentru tastat sau lipit în telefon. */
export const numarScurt = (telefon: string | null | undefined): string => cifre(telefon).replace(/^(00)?40/, "").replace(/^0/, "");

/** 0722 432 689 → 722 432 689 */
export const numarAfisat = (telefon: string | null | undefined): string =>
  numarScurt(telefon).replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");

/** 0722 432 689 → 40722432689 */
export const numarInternational = (telefon: string | null | undefined): string => {
  const c = cifre(telefon).replace(/^00/, "");
  if (c.startsWith("40")) return c;
  return c.startsWith("0") ? `4${c}` : `40${c}`;
};

export const linkTelefon = (telefon: string | null | undefined): string => `tel:+${numarInternational(telefon)}`;

export const linkWhatsApp = (telefon: string | null | undefined, mesaj = ""): string =>
  `https://wa.me/${numarInternational(telefon)}${mesaj ? `?text=${encodeURIComponent(mesaj)}` : ""}`;

/** Problema site-ului vechi, din `date_extra.problema` (o trimite robotul la /termina), fără punctul de la final. */
export function problemaDin(dateExtra: Record<string, unknown> | null | undefined): string {
  const v = dateExtra?.problema;
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().replace(/[.;:,!]+$/, "").trim() : "";
}

/** Cele 3 schimbări, din `date_extra.puncte` (listă sau text pe rânduri), fără marcajele lor („* ”, „- ”). */
export function puncteDin(dateExtra: Record<string, unknown> | null | undefined): string[] {
  const v = dateExtra?.puncte;
  const brute = Array.isArray(v) ? v : typeof v === "string" ? v.split(/\r?\n/) : [];
  return brute
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.replace(/^\s*[*•\-–]\s*/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 6);
}

/** Firma, cum o folosesc șabloanele: datele de bază și, pentru WhatsApp, `date_extra` (problema, punctele). */
export type FirmaSablon = Pick<FirmaRand, "nume" | "persoana_contact" | "link_demo" | "oras"> & { date_extra?: Record<string, unknown> | null };

/**
 * Șabloanele de mesaj: {nume_firma}, {persoana_contact}, {link_demo}, {oras}, {utilizator}, {nume_titular} (titularul
 * contului WhatsApp), {problema} și {puncte} (din `date_extra`; punctele pe rânduri, cu „* ”).
 *
 * Rândurile și paragrafele se păstrează. Un rând cu {problema} sau {puncte} fără date dispare (varianta scurtă), iar
 * odată cu {puncte} dispare și rândul de dinainte care se termină în „:” („Pe scurt, ce am schimbat:”).
 */
export function umpleSablon(sablon: string, firma: FirmaSablon, utilizator = "", titular = ""): string {
  const problema = problemaDin(firma.date_extra);
  const puncte = puncteDin(firma.date_extra);
  const randuri: string[] = [];
  for (const rand of sablon.replace(/\r\n?/g, "\n").split("\n")) {
    if (rand.includes("{problema}") && !problema) continue;
    if (rand.includes("{puncte}") && !puncte.length) {
      let i = randuri.length - 1;
      while (i >= 0 && !randuri[i].trim()) i--;
      if (i >= 0 && randuri[i].trim().endsWith(":")) randuri.splice(i);
      continue;
    }
    randuri.push(rand);
  }
  return randuri
    .join("\n")
    .replaceAll("{nume_firma}", firma.nume || "")
    .replaceAll("{persoana_contact}", firma.persoana_contact || "")
    .replaceAll("{link_demo}", firma.link_demo || "")
    .replaceAll("{oras}", firma.oras || "")
    .replaceAll("{utilizator}", utilizator)
    .replaceAll("{nume_titular}", titular)
    .replaceAll("{problema}", problema)
    .replaceAll("{puncte}", puncte.map((p) => `* ${p}`).join("\n"))
    // „Bună ziua, !” când lipsește persoana de contact.
    .replace(/,[ \t]*([!?])/g, "$1")
    .split("\n")
    .map((r) => r.replace(/[ \t]{2,}/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const vcfText = (v: string): string => v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** Contactele zilei, ca fișier .vcf (vCard 3.0), pentru importul în telefon. */
export function continutVcf(firme: Pick<FirmaRand, "nr" | "nume" | "telefon" | "email" | "nisa" | "oras" | "link_demo">[]): string {
  return firme
    .filter((f) => f.telefon)
    .map((f) =>
      [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN:${vcfText(f.nume)}`,
        `ORG:${vcfText(f.nume)}`,
        `TEL;TYPE=CELL,VOICE:+${numarInternational(f.telefon)}`,
        f.email ? `EMAIL;TYPE=WORK:${f.email}` : null,
        `NOTE:${vcfText([`#${f.nr}`, f.nisa, f.oras, f.link_demo].filter(Boolean).join(" · "))}`,
        "END:VCARD",
      ]
        .filter(Boolean)
        .join("\r\n")
    )
    .join("\r\n");
}

/** O celulă CSV: ghilimele dacă e nevoie; formulele (=, +, -, @) neutralizate pentru Excel. */
export function celulaCsv(valoare: unknown): string {
  let text = valoare === null || valoare === undefined ? "" : String(valoare);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * CSV pentru Excel în română: BOM UTF-8 (diacriticele se văd corect) și
 * punct și virgulă ca separator (Excel cu setări românești îl desparte în coloane).
 */
export function continutCsv(antet: string[], randuri: unknown[][]): string {
  const linii = [antet, ...randuri].map((rand) => rand.map(celulaCsv).join(";"));
  return "\uFEFF" + linii.join("\r\n") + "\r\n";
}
