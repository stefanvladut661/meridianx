import "server-only";

import type { AdsWorkspace } from "../../workspaces";
import { GoogleAdsApiError, googleReadPost } from "../api";
import type { GoogleAccount } from "../lookup";
import type { SearchPlan } from "./schema";
import { keywordKey } from "./text";
import type { KeywordVolume, SearchVolumes } from "./types";

/**
 * Volumele de căutare din Keyword Planner (faza 14), lângă cuvintele cheie din
 * previzualizare: `KeywordPlanIdeaService.GenerateKeywordHistoricalMetrics`,
 * v26, o citire (`googleReadPost`) — nu creează nimic.
 *
 * Serviciul e blocat la nivelul de acces Explorer al proiectului Google Cloud:
 * cere Basic (README → „De făcut de om”). Fără acces, întoarce `null` și
 * ecranul nu arată nimic — nici măcar o coloană goală.
 *
 * Google răspunde la cel mult o cerere pe secundă pe cont: campaniile cu
 * aceleași locații, aceeași limbă și aceeași rețea merg într-o singură cerere,
 * iar cererile pleacă pe rând, la peste o secundă una de alta.
 */

const GEO_MAX = 10;
const KEYWORDS_MAX = 10_000;
const SPACING_MS = 1_100;

interface RawMetrics {
  avgMonthlySearches?: string;
  competition?: string;
  lowTopOfPageBidMicros?: string;
  highTopOfPageBidMicros?: string;
}

interface RawResult {
  text?: string;
  closeVariants?: string[];
  keywordMetrics?: RawMetrics;
}

const money = (micros: string | undefined) => (micros === undefined ? null : Math.round(Number(micros) / 10_000) / 100);

function volumeOf(metrics: RawMetrics | undefined): KeywordVolume {
  const competition = metrics?.competition;
  return {
    searches: metrics?.avgMonthlySearches !== undefined ? Number(metrics.avgMonthlySearches) : null,
    competition: competition === "LOW" || competition === "MEDIUM" || competition === "HIGH" ? competition : null,
    lowBid: money(metrics?.lowTopOfPageBidMicros),
    highBid: money(metrics?.highTopOfPageBidMicros),
  };
}

/** Lipsa accesului (nivelul Explorer) sau a permisiunii: ascuns, nu eroare. */
function noAccess(error: unknown): boolean {
  if (!(error instanceof GoogleAdsApiError)) return false;
  return (
    error.info.status === 403 ||
    error.has("SERVICE_ACCESS_DENIED") ||
    error.has("DEVELOPER_TOKEN_NOT_APPROVED") ||
    error.has("PROJECT_NOT_ALLOWED") ||
    error.info.reason === "PERMISSION_DENIED"
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function readKeywordVolumes(
  workspace: AdsWorkspace,
  account: GoogleAccount,
  plan: SearchPlan,
  targeting: ReadonlyArray<{ geoTargets: readonly string[]; languageConstants: readonly string[] }>
): Promise<SearchVolumes | null> {
  const notes = new Set<string>();
  // Câte o cerere pe fiecare combinație locații + limbă + rețea.
  const requests = new Map<string, { body: Record<string, unknown>; campaigns: number[]; keywords: Set<string> }>();
  plan.campaigns.forEach((campaign, index) => {
    const geo = [...new Set(targeting[index]?.geoTargets ?? [])].sort();
    if (geo.length > GEO_MAX) notes.add(`O campanie are ${geo.length} locații; volumele sunt pe primele ${GEO_MAX}.`);
    const languages = targeting[index]?.languageConstants ?? [];
    if (languages.length > 1) notes.add("Volumele sunt pe prima limbă a fiecărei campanii.");
    const network = campaign.networks.search_partners ? "GOOGLE_SEARCH_AND_PARTNERS" : "GOOGLE_SEARCH";
    const body = {
      geoTargetConstants: geo.slice(0, GEO_MAX),
      ...(languages[0] ? { language: languages[0] } : {}),
      keywordPlanNetwork: network,
      includeAdultKeywords: false,
    };
    const signature = JSON.stringify(body);
    const request = requests.get(signature) ?? { body, campaigns: [] as number[], keywords: new Set<string>() };
    request.campaigns.push(index);
    for (const group of campaign.ad_groups) for (const keyword of group.keywords) request.keywords.add(keyword.text.trim());
    requests.set(signature, request);
  });

  const byCampaign: Array<Record<string, KeywordVolume>> = plan.campaigns.map(() => ({}));
  let first = true;
  for (const request of requests.values()) {
    const keywords = [...request.keywords].slice(0, KEYWORDS_MAX);
    if (keywords.length === 0) continue;
    if (!first) await sleep(SPACING_MS);
    first = false;
    let results: RawResult[];
    try {
      const data = await googleReadPost<{ results?: RawResult[] }>(
        workspace,
        `/customers/${account.info.id}:generateKeywordHistoricalMetrics`,
        { ...request.body, keywords },
        { loginCustomerId: account.loginCustomerId }
      );
      results = data.results ?? [];
    } catch (error) {
      if (noAccess(error)) return null;
      return { error: error instanceof GoogleAdsApiError ? `Keyword Planner n-a răspuns: ${error.info.message}` : "Keyword Planner n-a răspuns." };
    }
    // Google întoarce o singură formă pentru variantele apropiate („centrala”/„centrale”).
    const found = new Map<string, KeywordVolume>();
    for (const result of results) {
      const volume = volumeOf(result.keywordMetrics);
      for (const text of [result.text ?? "", ...(result.closeVariants ?? [])]) if (text) found.set(keywordKey(text), volume);
    }
    for (const index of request.campaigns) {
      for (const group of plan.campaigns[index].ad_groups) {
        for (const keyword of group.keywords) {
          const key = keywordKey(keyword.text);
          const volume = found.get(key);
          if (volume) byCampaign[index][key] = volume;
        }
      }
    }
  }
  return { note: notes.size > 0 ? [...notes].join(" ") : null, campaigns: byCampaign };
}
