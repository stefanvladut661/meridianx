import { countOf } from "../../plan-derive";
import { GOOGLE_MATCH_TYPE, KEYWORD_MAX_CHARS, KEYWORD_MAX_WORDS, MATCH_TYPE_LABEL, type MatchType } from "../search/limits";
import { findConflicts, keywordNotation, parseKeywordLines } from "../search/negatives";
import { cleanText, forbiddenKeywordChars, googleLength, keywordKey, keywordWords } from "../search/text";
import type { ParsedKeyword } from "./types";

/**
 * Negative pe un cont existent: lista lipită (un cuvânt pe rând, în notația
 * Google Ads Editor: `[exactă]`, `"frază"`, `amplă`), citită și verificată;
 * operațiile care le adaugă — DOAR negative pe campanii, cuvinte într-o listă
 * de negative, legarea unei liste de negative de campanii. Garda
 * (`assertGooglePaused`) le verifică oricum, una câte una. Pur, izomorf.
 */

export type NegativesMode = "campaigns" | "list" | "link";

export const NEGATIVES_MODE_LABEL: Record<NegativesMode, string> = {
  campaigns: "Pe campaniile alese",
  list: "Într-o listă comună existentă",
  link: "Leagă o listă comună de campanii",
};

/** Câte cuvinte primește o singură trimitere (limita listei comune). */
export const NEGATIVES_PER_REQUEST_MAX = 5_000;

export function parseNegativeInput(text: string): ParsedKeyword[] {
  return parseKeywordLines(text).map(({ line, raw, keyword }) => {
    if (!keyword) {
      return { line, raw, text: null, match: null, problem: "Parantezele sau ghilimelele nu se închid: [exactă], \"frază\" sau doar cuvintele (amplă)." };
    }
    const clean = cleanText(keyword.text);
    const forbidden = forbiddenKeywordChars(clean, true);
    const length = googleLength(clean);
    const words = keywordWords(clean).length;
    const problem =
      forbidden.length > 0
        ? `Google nu acceptă ${forbidden.map((char) => `„${char}”`).join(", ")} într-un cuvânt cheie.`
        : length > KEYWORD_MAX_CHARS
          ? `${countOf(length, "caractere")}, maximum ${KEYWORD_MAX_CHARS}.`
          : words > KEYWORD_MAX_WORDS
            ? `${countOf(words, "cuvinte")}, maximum ${KEYWORD_MAX_WORDS}.`
            : null;
    return { line, raw, text: clean, match: keyword.match, problem };
  });
}

/** Cuvintele bune, fiecare o singură dată (același text, același tip). */
export function usableNegatives(parsed: ParsedKeyword[]): Array<{ text: string; match: MatchType }> {
  const seen = new Set<string>();
  const result: Array<{ text: string; match: MatchType }> = [];
  for (const item of parsed) {
    if (item.problem || !item.text || !item.match) continue;
    const key = `${keywordKey(item.text)}|${item.match}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ text: item.text, match: item.match });
  }
  return result;
}

const keyOf = (keyword: { text: string; match: MatchType }) => `${keywordKey(keyword.text)}|${keyword.match}`;

export interface NegativeTarget {
  id: string;
  name: string;
  /** Negativele pe care campania le are deja (nu se adaugă a doua oară). */
  existing: Array<{ text: string; match: MatchType }>;
  /** Cuvintele pozitive active ale campaniei, pentru conflicte. */
  positives: Array<{ text: string; match: MatchType; group: string | null }>;
}

export interface NegativesPlan {
  operations: Array<Record<string, unknown>>;
  additions: Array<{ where: string; keywords: string[]; skipped: string[] }>;
  conflicts: Array<{ campaign: string; keyword: string; negative: string; group: string | null }>;
}

/**
 * Operațiile și conflictele, după mod:
 *   - `campaigns`: fiecare cuvânt ca negativ pe fiecare campanie aleasă;
 *   - `list`: cuvintele intră în listă (o dată); campaniile alese, nelegate
 *     încă, se leagă de ea; conflictele — pe toate campaniile listei;
 *   - `link`: lista existentă se leagă de campaniile alese; conflictele — între
 *     cuvintele listei și cuvintele pozitive ale campaniilor noi.
 */
export function planNegatives(input: {
  customerId: string;
  mode: NegativesMode;
  keywords: Array<{ text: string; match: MatchType }>;
  targets: NegativeTarget[];
  list: { resourceName: string; name: string; keywords: Array<{ text: string; match: MatchType }>; linked: NegativeTarget[] } | null;
}): NegativesPlan {
  const operations: Array<Record<string, unknown>> = [];
  const additions: NegativesPlan["additions"] = [];
  const conflicts: NegativesPlan["conflicts"] = [];
  const keyword = (item: { text: string; match: MatchType }) => ({ text: item.text, matchType: GOOGLE_MATCH_TYPE[item.match] });
  const campaignName = (id: string) => `customers/${input.customerId}/campaigns/${id}`;
  const conflictsOn = (targets: NegativeTarget[], negatives: Array<{ text: string; match: MatchType }>) => {
    for (const target of targets) {
      const found = findConflicts(
        target.positives.map((positive) => ({ ...positive, meta: positive.group })),
        negatives.map((negative) => ({ ...negative, meta: null }))
      ).filter((conflict) => conflict.certain);
      for (const conflict of found) {
        conflicts.push({ campaign: target.name, keyword: keywordNotation(conflict.positive), negative: keywordNotation(conflict.negative), group: conflict.positive.meta });
      }
    }
  };

  if (input.mode === "campaigns") {
    for (const target of input.targets) {
      const existing = new Set(target.existing.map(keyOf));
      const added: string[] = [];
      const skipped: string[] = [];
      for (const item of input.keywords) {
        if (existing.has(keyOf(item))) {
          skipped.push(keywordNotation(item));
          continue;
        }
        operations.push({ campaignCriterionOperation: { create: { campaign: campaignName(target.id), negative: true, keyword: keyword(item) } } });
        added.push(keywordNotation(item));
      }
      additions.push({ where: `campania „${target.name}”`, keywords: added, skipped });
    }
    conflictsOn(input.targets, input.keywords);
    return { operations, additions, conflicts };
  }

  if (!input.list) return { operations, additions, conflicts };
  const list = input.list;
  const linkedIds = new Set(list.linked.map((target) => target.id));
  const newTargets = input.targets.filter((target) => !linkedIds.has(target.id));

  if (input.mode === "list") {
    const existing = new Set(list.keywords.map(keyOf));
    const added: string[] = [];
    const skipped: string[] = [];
    for (const item of input.keywords) {
      if (existing.has(keyOf(item))) {
        skipped.push(keywordNotation(item));
        continue;
      }
      operations.push({ sharedCriterionOperation: { create: { sharedSet: list.resourceName, keyword: keyword(item) } } });
      added.push(keywordNotation(item));
    }
    additions.push({ where: `lista „${list.name}”`, keywords: added, skipped });
    conflictsOn([...list.linked, ...newTargets], input.keywords);
    conflictsOn(newTargets, list.keywords);
  } else {
    conflictsOn(newTargets, list.keywords);
  }

  for (const target of newTargets) {
    operations.push({ campaignSharedSetOperation: { create: { campaign: campaignName(target.id), sharedSet: list.resourceName } } });
  }
  if (newTargets.length > 0 || input.mode === "link") {
    additions.push({
      where: `legarea listei „${list.name}”`,
      keywords: newTargets.map((target) => `campania „${target.name}”`),
      skipped: input.targets.filter((target) => linkedIds.has(target.id)).map((target) => `campania „${target.name}” (deja legată)`),
    });
  }
  return { operations, additions, conflicts };
}

export function matchLabel(match: MatchType): string {
  return MATCH_TYPE_LABEL[match];
}

/** Un negativ ales din termenii de căutare: pe campania termenului. */
export interface TermNegative {
  campaignId: string;
  text: string;
  match: MatchType;
}

/** Problema textului unui negativ, sau null — aceleași reguli ca la lista lipită. */
export function negativeTextProblem(text: string): string | null {
  const clean = cleanText(text);
  const forbidden = forbiddenKeywordChars(clean, true);
  if (forbidden.length > 0) return `Google nu acceptă ${forbidden.map((char) => `„${char}”`).join(", ")} într-un cuvânt cheie.`;
  if (googleLength(clean) > KEYWORD_MAX_CHARS) return `${countOf(googleLength(clean), "caractere")}, maximum ${KEYWORD_MAX_CHARS}.`;
  if (keywordWords(clean).length > KEYWORD_MAX_WORDS) return `${countOf(keywordWords(clean).length, "cuvinte")}, maximum ${KEYWORD_MAX_WORDS}.`;
  return clean === "" ? "Gol." : null;
}

/**
 * Negativele bifate din termenii de căutare: fiecare pe campania lui (sau,
 * toate, într-o listă comună — care se leagă și de campaniile termenilor, dacă
 * nu era deja). Conflictele: pe fiecare campanie afectată, negativele care
 * ajung la ea peste cuvintele ei active.
 */
export function planTermNegatives(input: {
  customerId: string;
  items: TermNegative[];
  targets: NegativeTarget[];
  list: { resourceName: string; name: string; keywords: Array<{ text: string; match: MatchType }>; linked: NegativeTarget[] } | null;
}): NegativesPlan {
  const operations: Array<Record<string, unknown>> = [];
  const additions: NegativesPlan["additions"] = [];
  const conflicts: NegativesPlan["conflicts"] = [];
  const keyword = (item: { text: string; match: MatchType }) => ({ text: cleanText(item.text), matchType: GOOGLE_MATCH_TYPE[item.match] });
  const byId = new Map(input.targets.map((target) => [target.id, target]));
  const check = (target: NegativeTarget, negatives: Array<{ text: string; match: MatchType }>) => {
    const found = findConflicts(
      target.positives.map((positive) => ({ ...positive, meta: positive.group })),
      negatives.map((negative) => ({ ...negative, meta: null }))
    ).filter((item) => item.certain);
    for (const conflict of found) {
      conflicts.push({ campaign: target.name, keyword: keywordNotation(conflict.positive), negative: keywordNotation(conflict.negative), group: conflict.positive.meta });
    }
  };

  if (!input.list) {
    for (const target of input.targets) {
      const mine = input.items.filter((item) => item.campaignId === target.id);
      const existing = new Set(target.existing.map(keyOf));
      const seen = new Set<string>();
      const added: string[] = [];
      const skipped: string[] = [];
      for (const item of mine) {
        const key = keyOf(item);
        if (seen.has(key)) continue;
        seen.add(key);
        if (existing.has(key)) {
          skipped.push(keywordNotation(item));
          continue;
        }
        operations.push({ campaignCriterionOperation: { create: { campaign: `customers/${input.customerId}/campaigns/${target.id}`, negative: true, keyword: keyword(item) } } });
        added.push(keywordNotation(item));
      }
      additions.push({ where: `campania „${target.name}”`, keywords: added, skipped });
      check(target, mine);
    }
    return { operations, additions, conflicts };
  }

  const list = input.list;
  const existing = new Set(list.keywords.map(keyOf));
  const seen = new Set<string>();
  const added: string[] = [];
  const skipped: string[] = [];
  const fresh: Array<{ text: string; match: MatchType }> = [];
  for (const item of input.items) {
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    if (existing.has(key)) {
      skipped.push(keywordNotation(item));
      continue;
    }
    operations.push({ sharedCriterionOperation: { create: { sharedSet: list.resourceName, keyword: keyword(item) } } });
    added.push(keywordNotation(item));
    fresh.push(item);
  }
  additions.push({ where: `lista „${list.name}”`, keywords: added, skipped });
  const linkedIds = new Set(list.linked.map((target) => target.id));
  const toLink = [...new Set(input.items.map((item) => item.campaignId))]
    .filter((id) => !linkedIds.has(id))
    .map((id) => byId.get(id))
    .filter((target): target is NegativeTarget => Boolean(target));
  for (const target of toLink) {
    operations.push({ campaignSharedSetOperation: { create: { campaign: `customers/${input.customerId}/campaigns/${target.id}`, sharedSet: list.resourceName } } });
  }
  if (toLink.length > 0) {
    additions.push({ where: `legarea listei „${list.name}” (campaniile termenilor nu erau legate)`, keywords: toLink.map((target) => `campania „${target.name}”`), skipped: [] });
  }
  for (const target of [...list.linked, ...toLink]) check(target, fresh);
  for (const target of toLink) check(target, list.keywords);
  return { operations, additions, conflicts };
}
