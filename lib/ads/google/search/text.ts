import { KEYWORD_FORBIDDEN_CHARS, KEYWORD_POSITIVE_ONLY_FORBIDDEN } from "./limits";

/**
 * Textele planului de căutare, cum le citește Google: lungimea (un caracter
 * cu diacritice e unul singur, un caracter „lat” — chinezesc, japonez,
 * coreean — contează dublu), cuvintele unui cuvânt cheie și comparația lor.
 * Funcții pure, izomorfe.
 */

/** Caracterele „late” (East Asian Wide / Fullwidth), pe care Google le numără de două ori. */
function isWide(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe4f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    codePoint >= 0x20000
  );
}

/**
 * Lungimea unui text de anunț cum o numără Google. Textul se aduce întâi la
 * forma compusă (NFC): „ă” scris ca „a” + semnul de deasupra devine un
 * singur caracter, cum îl vede omul — altfel un titlu copiat dintr-un
 * document ar părea mai lung decât e.
 */
export function googleLength(text: string): number {
  let length = 0;
  for (const char of text.normalize("NFC")) {
    length += isWide(char.codePointAt(0) ?? 0) ? 2 : 1;
  }
  return length;
}

/** Textul, curățat cum îl păstrează Google: NFC, spații simple, fără margini. */
export function cleanText(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Cuvintele unui cuvânt cheie, cu litere mici — Google nu ține cont de majuscule. */
export function keywordWords(text: string): string[] {
  const clean = cleanText(text).toLocaleLowerCase("ro-RO");
  return clean === "" ? [] : clean.split(" ");
}

/** Forma de comparat a unui cuvânt cheie: aceleași cuvinte = același cuvânt cheie. */
export function keywordKey(text: string): string {
  return keywordWords(text).join(" ");
}

/**
 * „ş” și „ţ” cu sedilă (din tastaturile vechi) sunt alte caractere decât
 * „ș” și „ț” cu virgulă. Pentru comparații aproximative le aducem la aceeași formă.
 */
export function withCommaBelow(text: string): string {
  return text.replace(/ş/g, "ș").replace(/Ş/g, "Ș").replace(/ţ/g, "ț").replace(/Ţ/g, "Ț");
}

/** Caracterele nepermise dintr-un cuvânt cheie, fiecare o singură dată. Steluța merge doar în negative. */
export function forbiddenKeywordChars(text: string, negative = false): string[] {
  const forbidden = negative ? KEYWORD_FORBIDDEN_CHARS : [...KEYWORD_FORBIDDEN_CHARS, ...KEYWORD_POSITIVE_ONLY_FORBIDDEN];
  return forbidden.filter((char) => text.includes(char));
}

/** Domeniul unei adrese, fără „www.” — sau null. */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
