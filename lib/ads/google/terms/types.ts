import type { MatchType } from "../search/limits";

/** Termenii de căutare și propunerile — ce ajunge în browser. Izomorf, doar tipuri. */

export interface TermRow {
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  term: string;
  /** Cum s-a potrivit: EXACT, PHRASE, BROAD, NEAR_EXACT, NEAR_PHRASE… */
  matchType: string;
  keyword: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  /** ADDED, EXCLUDED, ADDED_EXCLUDED, NONE. */
  status: string;
  firstSeen: string | null;
  lastSeen: string | null;
}

export interface TermRules {
  adAccount: string;
  excludeWords: string[];
  costThreshold: number;
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  updatedAt: string | null;
  updatedByEmail: string | null;
}

export type ProposalReason =
  | { kind: "rule"; word: string }
  | { kind: "cost"; cost: number; threshold: number }
  | { kind: "other_campaign"; campaign: string; keyword: string };

export interface Proposal {
  /** Cheia stabilă a propunerii (campanie + negativ), pentru bife. */
  id: string;
  campaignId: string;
  campaignName: string;
  /** Negativul propus. */
  text: string;
  match: MatchType;
  /** Termenii din care vine (unul sau mai mulți — un cuvânt de regulă poate prinde mai mulți termeni). */
  terms: string[];
  cost: number;
  clicks: number;
  reasons: ProposalReason[];
}
