/**
 * Generatorul de parole (feat/vault, faza 4). Pur, fără DOM.
 *
 * Pe WebCrypto (`crypto.getRandomValues`), nu pe libsodium: regula
 * proiectului e că libsodium se importă DOAR din `lib/vault/crypto.ts`,
 * iar acel fișier nu se atinge fără revizuire umană. `getRandomValues`
 * e același CSPRNG al sistemului — pentru „alege un caracter la
 * întâmplare" e exact ce trebuie.
 *
 * Alegerea e UNIFORMĂ: `byte % alfabet` ar favoriza primele caractere
 * din alfabet (256 nu se împarte la 70), așa că bytes-ii din afara
 * celui mai mare multiplu al lungimii alfabetului se aruncă
 * (eșantionare prin respingere).
 */

export interface GeneratorOptions {
  length: number;
  digits: boolean;
  symbols: boolean;
}

export const GENERATOR_DEFAULTS: GeneratorOptions = { length: 24, digits: true, symbols: true };
export const GENERATOR_MIN = 8;
export const GENERATOR_MAX = 64;

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
/** Fără ghilimele, backslash sau spațiu: se lipesc în shell-uri și în
    fișiere de configurare fără să rupă nimic. */
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?";

export function alphabetFor(options: GeneratorOptions): string {
  return LOWER + UPPER + (options.digits ? DIGITS : "") + (options.symbols ? SYMBOLS : "");
}

export function generatePassword(options: GeneratorOptions): string {
  const alphabet = alphabetFor(options);
  const length = Math.min(GENERATOR_MAX, Math.max(GENERATOR_MIN, Math.floor(options.length)));
  const limit = 256 - (256 % alphabet.length);
  const out: string[] = [];
  const buffer = new Uint8Array(length * 2);
  while (out.length < length) {
    crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (byte >= limit) continue;
      out.push(alphabet[byte % alphabet.length]);
      if (out.length === length) break;
    }
  }
  return out.join("");
}

/** Entropia în biți a unei parole generate cu aceste opțiuni:
    `length · log2(alfabet)`. Cifră reală, afișată ca atare. */
export function entropyBits(options: GeneratorOptions): number {
  const length = Math.min(GENERATOR_MAX, Math.max(GENERATOR_MIN, Math.floor(options.length)));
  return Math.round(length * Math.log2(alphabetFor(options).length));
}
