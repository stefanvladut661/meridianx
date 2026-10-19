import type { MatchType } from "../search/limits";
import { negativeBlocks } from "../search/negatives";
import { keywordWords } from "../search/text";
import type { Proposal, ProposalReason, TermRow } from "./types";

/**
 * Propunerile de negative din termenii de căutare — trei motive, toate ale
 * contului (nu din cod):
 *
 *   - un cuvânt din regulile contului („de exclus”) apare în termen → negativ
 *     amplu (sau de frază, dacă regula are mai multe cuvinte) pe campania lui;
 *   - termenul a costat peste pragul contului și n-a adus nicio conversie →
 *     negativ exact pe campania lui;
 *   - termenul se potrivește cu un cuvânt cheie al ALTEI campanii și cu niciunul
 *     al campaniei lui (o căutare de „aer condiționat” în campania de centrale)
 *     → negativ exact pe campania lui, ca să ajungă la cealaltă.
 *
 * Termenii deja excluși nu se propun. Un cuvânt de regulă care ar bloca chiar
 * cuvintele cheie ale campaniei nu se propune acolo. Nimic nu se adaugă fără
 * bifă: asta e doar lista. Pur, izomorf.
 */

/** Fără diacritice și cu litere mici — regulile se potrivesc și pe „angajări” scris „angajari”. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[şș]/g, "s")
    .replace(/[ţț]/g, "t")
    .toLowerCase();
}

function containsSequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0) return false;
  for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    if (needle.every((word, index) => haystack[start + index] === word)) return true;
  }
  return false;
}

export function buildProposals(input: {
  terms: TermRow[];
  excludeWords: string[];
  costThreshold: number;
  /** Cuvintele cheie pozitive active, pe campanie (toate campaniile de căutare ale contului). */
  positives: Record<string, Array<{ text: string; match: MatchType }>>;
  campaignNames: Record<string, string>;
}): Proposal[] {
  const proposals = new Map<string, Proposal>();
  const rules = input.excludeWords
    .map((word) => word.trim())
    .filter(Boolean)
    .map((word) => ({ word, words: keywordWords(fold(word)) }));

  const add = (campaignId: string, text: string, match: MatchType, term: TermRow, reason: ProposalReason) => {
    const id = `${campaignId}|${match}|${fold(text)}`;
    const entry =
      proposals.get(id) ??
      ({ id, campaignId, campaignName: input.campaignNames[campaignId] ?? term.campaignName, text, match, terms: [], cost: 0, clicks: 0, reasons: [] } satisfies Proposal);
    if (!entry.terms.includes(term.term)) {
      entry.terms.push(term.term);
      entry.cost = Math.round((entry.cost + term.cost) * 100) / 100;
      entry.clicks += term.clicks;
    }
    if (!entry.reasons.some((item) => JSON.stringify(item) === JSON.stringify(reason))) entry.reasons.push(reason);
    proposals.set(id, entry);
  };

  for (const term of input.terms) {
    if (term.status === "EXCLUDED" || term.status === "ADDED_EXCLUDED") continue;
    const words = keywordWords(fold(term.term));
    const own = input.positives[term.campaignId] ?? [];

    for (const rule of rules) {
      if (!containsSequence(words, rule.words)) continue;
      const match: MatchType = rule.words.length > 1 ? "phrase" : "broad";
      // Nu propunem un negativ care ar opri chiar cuvintele cheie ale campaniei.
      if (own.some((positive) => negativeBlocks({ text: rule.word, match }, positive.text))) continue;
      add(term.campaignId, rule.word, match, term, { kind: "rule", word: rule.word });
    }

    if (input.costThreshold > 0 && term.cost >= input.costThreshold && term.conversions === 0) {
      add(term.campaignId, term.term, "exact", term, { kind: "cost", cost: term.cost, threshold: input.costThreshold });
    }

    const fits = (positive: { text: string }) => {
      const needed = keywordWords(fold(positive.text));
      return needed.length > 0 && needed.every((word) => words.includes(word));
    };
    if (!own.some(fits)) {
      for (const [campaignId, list] of Object.entries(input.positives)) {
        if (campaignId === term.campaignId) continue;
        const match = list.find(fits);
        if (match) {
          add(term.campaignId, term.term, "exact", term, { kind: "other_campaign", campaign: input.campaignNames[campaignId] ?? campaignId, keyword: match.text });
          break;
        }
      }
    }
  }

  return [...proposals.values()].sort((a, b) => b.cost - a.cost || b.clicks - a.clicks);
}

export function reasonLabel(reason: ProposalReason, money: (amount: number) => string): string {
  switch (reason.kind) {
    case "rule":
      return `regula „${reason.word}”`;
    case "cost":
      return `${money(reason.cost)} fără conversii (pragul: ${money(reason.threshold)})`;
    case "other_campaign":
      return `ține de „${reason.campaign}” (cuvântul „${reason.keyword}”)`;
  }
}
