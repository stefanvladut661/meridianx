import type { MatchType } from "./limits";
import { keywordWords, withCommaBelow } from "./text";

/**
 * Conflictele dintre negative și cuvintele cheie pozitive — simularea
 * potrivirii negativelor, cum o descrie Google:
 *
 *   - amplă (`broad`): negativul blochează căutarea dacă TOATE cuvintele lui
 *     apar în ea, în orice ordine;
 *   - frază (`phrase`): dacă apar toate, unul după altul, în aceeași ordine;
 *   - exactă (`exact`): dacă căutarea e exact negativul.
 *
 * Negativele NU se extind la variante apropiate (plural, greșeli, diacritice):
 * „pret” nu blochează „preț”. Majusculele nu contează.
 *
 * Un cuvânt cheie pozitiv e „blocat” când căutarea identică cu el ar fi
 * blocată de un negativ din aceeași campanie (al campaniei, al grupului
 * sau dintr-o listă comună legată) — campania ar plăti pentru un cuvânt pe
 * care singură îl oprește. Folosită la validarea planului (faza 8) și la
 * negativele adăugate pe campanii existente (fazele 11 și 12). Pură, izomorfă.
 */

export interface MatchableKeyword {
  text: string;
  match: MatchType;
}

/** Negativul ar bloca o căutare care are exact cuvintele astea. */
export function negativeBlocksWords(negative: MatchableKeyword, query: string[]): boolean {
  const words = keywordWords(negative.text);
  if (words.length === 0 || query.length === 0) return false;
  if (negative.match === "exact") {
    return words.length === query.length && words.every((word, index) => word === query[index]);
  }
  if (negative.match === "phrase") {
    for (let start = 0; start + words.length <= query.length; start += 1) {
      if (words.every((word, index) => query[start + index] === word)) return true;
    }
    return false;
  }
  return words.every((word) => query.includes(word));
}

export function negativeBlocks(negative: MatchableKeyword, query: string): boolean {
  return negativeBlocksWords(negative, keywordWords(query));
}

/**
 * La fel, dar cu „ş/ţ” (sedilă) și „ș/ț” (virgulă) socotite egale. Google
 * le vede ca litere diferite, deci un rezultat aici, fără unul în
 * `negativeBlocks`, e doar un semn de verificat, nu un blocaj sigur.
 */
export function negativeBlocksLoosely(negative: MatchableKeyword, query: string): boolean {
  return negativeBlocks({ ...negative, text: withCommaBelow(negative.text) }, withCommaBelow(query));
}

export interface NegativeSource<Meta> extends MatchableKeyword {
  /** De unde vine negativul — pentru mesaj („lista „NEG - Irelevante””). */
  meta: Meta;
}

export interface PositiveKeyword<Meta> extends MatchableKeyword {
  meta: Meta;
}

export interface Conflict<P, N> {
  positive: PositiveKeyword<P>;
  negative: NegativeSource<N>;
  /** Blocaj sigur (aceleași litere) sau doar cu ș/ț scrise diferit. */
  certain: boolean;
}

/**
 * Fiecare cuvânt pozitiv blocat, cu PRIMUL negativ care îl blochează (cel
 * mai apropiat: al grupului, apoi al campaniei, apoi listele — ordinea în
 * care vin `negatives`). Un cuvânt apare o singură dată în rezultat.
 */
export function findConflicts<P, N>(
  positives: ReadonlyArray<PositiveKeyword<P>>,
  negatives: ReadonlyArray<NegativeSource<N>>
): Array<Conflict<P, N>> {
  const conflicts: Array<Conflict<P, N>> = [];
  for (const positive of positives) {
    const words = keywordWords(positive.text);
    const certain = negatives.find((negative) => negativeBlocksWords(negative, words));
    if (certain) {
      conflicts.push({ positive, negative: certain, certain: true });
      continue;
    }
    const loose = negatives.find((negative) => negativeBlocksLoosely(negative, positive.text));
    if (loose) conflicts.push({ positive, negative: loose, certain: false });
  }
  return conflicts;
}

/** `[montaj]`, `"montaj"`, `montaj` — cum scrie Google Ads tipul de potrivire. */
export function keywordNotation(keyword: MatchableKeyword): string {
  return keyword.match === "exact" ? `[${keyword.text}]` : keyword.match === "phrase" ? `"${keyword.text}"` : keyword.text;
}

/**
 * O listă lipită (un cuvânt pe rând), în notația din Google Ads Editor:
 * `[exact]`, `"frază"`, `amplă`. Rândurile goale se sar; `-` din față (cum
 * apar negativele în unele exporturi) se ignoră.
 */
export function parseKeywordLines(text: string): Array<{ line: number; keyword: MatchableKeyword | null; raw: string }> {
  return text
    .split(/\r?\n/)
    .map((raw, index) => ({ raw: raw.trim(), line: index + 1 }))
    .filter(({ raw }) => raw !== "")
    .map(({ raw, line }) => {
      const value = raw.replace(/^-\s*/, "").trim();
      const exact = /^\[(.+)\]$/.exec(value);
      if (exact) return { line, raw, keyword: { text: exact[1].trim(), match: "exact" as const } };
      const phrase = /^"(.+)"$/.exec(value) ?? /^„(.+)”$/.exec(value);
      if (phrase) return { line, raw, keyword: { text: phrase[1].trim(), match: "phrase" as const } };
      if (/^[[\]"„”]|[[\]"„”]$/.test(value)) return { line, raw, keyword: null };
      return { line, raw, keyword: { text: value, match: "broad" as const } };
    });
}
