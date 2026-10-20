import "server-only";

import type { AdsWorkspace } from "../../workspaces";
import { googleSearch } from "../api";
import type { GoogleAccount } from "../lookup";

/**
 * Termenii de căutare din Google (`search_term_view`), pe zi, cu cuvântul cheie
 * pe care s-au potrivit — doar citire. O interogare pe cont. Google omite
 * termenii cu prea puține căutări (confidențialitate); ce lipsește de aici
 * lipsește și din Google Ads.
 */

export interface FetchedTerm {
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  term: string;
  status: string;
  matchType: string;
  keyword: string;
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
}

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function fetchSearchTerms(
  workspace: AdsWorkspace,
  account: GoogleAccount,
  since: string,
  until: string
): Promise<FetchedTerm[]> {
  const rows = await googleSearch<{
    campaign?: { id?: string; name?: string };
    adGroup?: { id?: string; name?: string };
    searchTermView?: { searchTerm?: string; status?: string };
    segments?: { date?: string; searchTermMatchType?: string; keyword?: { info?: { text?: string } } };
    metrics?: { impressions?: string; clicks?: string; costMicros?: string; conversions?: number | string };
  }>(
    workspace,
    account.info.id,
    `SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, search_term_view.search_term, search_term_view.status, segments.search_term_match_type, segments.keyword.info.text, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM search_term_view WHERE segments.date BETWEEN '${since}' AND '${until}'`,
    { loginCustomerId: account.loginCustomerId }
  );
  return rows.flatMap((row) => {
    const term = row.searchTermView?.searchTerm?.trim();
    if (!term || !row.campaign?.id || !row.adGroup?.id || !row.segments?.date) return [];
    return [
      {
        campaignId: row.campaign.id,
        campaignName: row.campaign.name ?? row.campaign.id,
        adGroupId: row.adGroup.id,
        adGroupName: row.adGroup.name ?? row.adGroup.id,
        term,
        status: row.searchTermView?.status ?? "NONE",
        matchType: row.segments.searchTermMatchType ?? "",
        keyword: row.segments.keyword?.info?.text ?? "",
        date: row.segments.date,
        impressions: num(row.metrics?.impressions),
        clicks: num(row.metrics?.clicks),
        cost: Math.round((num(row.metrics?.costMicros) / 1_000_000) * 100) / 100,
        conversions: Math.round(num(row.metrics?.conversions) * 100) / 100,
      },
    ];
  });
}
