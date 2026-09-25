import "server-only";

import { createReadOnlySessionClient } from "@/lib/supabase/clients";
import type { Currency, Objective } from "./constants";
import type { DayFigures } from "./metrics";
import { STORE_FAILURE_MESSAGE, type StoreFailure } from "./store";

/**
 * Cifrele pentru ecrane — DOAR din bază, niciodată direct din API-ul Meta:
 * paginile rămân rapide, nu consumă din limita de cereri a contului și
 * istoricul rămâne după ce platforma îl uită.
 *
 * Citire prin sesiune (RLS, `is_lead_admin()`), ca restul portalului.
 */

export type StatsResult<T> = { ok: true; data: T } | { ok: false; message: string };

function fail(error: { code?: string; message?: string }): { ok: false; message: string } {
  const code = error.code ?? "";
  const message = error.message ?? "";
  const reason: StoreFailure =
    code === "42P01" || code === "PGRST205" || /does not exist|schema cache/i.test(message)
      ? "missing_migration"
      : code === "42883" && /is_lead_admin/.test(message)
        ? "missing_admin_migration"
        : "error";
  return { ok: false, message: reason === "error" ? `${STORE_FAILURE_MESSAGE.error} ${message}` : STORE_FAILURE_MESSAGE[reason] };
}

export interface StatsCampaign {
  id: string;
  name: string;
  workspace: string;
  objective: Objective;
  currency: Currency;
  status: string;
  adAccount: string;
  platformCampaignId: string;
  createdAt: string;
  creation: "complete" | "partial";
  dailyBudget: number;
}

export interface CampaignDay extends DayFigures {
  campaignId: string;
}

export interface SyncRun {
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "ok" | "partial" | "failed";
  campaignsSynced: number;
  error: string | null;
}

interface MetricRow {
  campaign_id: string;
  date: string;
  spend: number | string;
  impressions: number | string;
  clicks: number | string;
  results: number | string;
}

function toDay(row: MetricRow): CampaignDay {
  return {
    campaignId: row.campaign_id,
    date: row.date,
    spend: Number(row.spend) || 0,
    impressions: Number(row.impressions) || 0,
    clicks: Number(row.clicks) || 0,
    results: Number(row.results) || 0,
  };
}

const CAMPAIGN_COLUMNS =
  "id, name, workspace, objective, currency, status, ad_account, platform_campaign_id, created_at, creation, daily_budget";

function toCampaign(row: Record<string, unknown>): StatsCampaign {
  return {
    id: String(row.id),
    name: String(row.name),
    workspace: String(row.workspace),
    objective: row.objective as Objective,
    currency: row.currency as Currency,
    status: String(row.status),
    adAccount: String(row.ad_account),
    platformCampaignId: String(row.platform_campaign_id),
    createdAt: String(row.created_at),
    creation: row.creation === "partial" ? "partial" : "complete",
    dailyBudget: Number(row.daily_budget) || 0,
  };
}

/** Campaniile spațiului și cifrele lor între `from` și `to` (inclusiv). */
export async function readWorkspaceStats(
  workspaceId: string,
  from: string,
  to: string
): Promise<StatsResult<{ campaigns: StatsCampaign[]; days: CampaignDay[] }>> {
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return { ok: false, message: STORE_FAILURE_MESSAGE.unconfigured };

  const { data: campaignRows, error } = await supabase
    .from("ads_campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("workspace", workspaceId)
    .order("created_at", { ascending: false });
  if (error) return fail(error);

  const campaigns = ((campaignRows ?? []) as unknown as Record<string, unknown>[]).map(toCampaign);
  if (campaigns.length === 0) return { ok: true, data: { campaigns, days: [] } };

  const { data: dayRows, error: dayError } = await supabase
    .from("ads_metrics_daily")
    .select("campaign_id, date, spend, impressions, clicks, results")
    .in(
      "campaign_id",
      campaigns.map((campaign) => campaign.id)
    )
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true })
    .limit(20_000);
  if (dayError) return fail(dayError);

  return { ok: true, data: { campaigns, days: ((dayRows ?? []) as MetricRow[]).map(toDay) } };
}

/** Toate zilele unei campanii, de la prima la ultima. */
export async function readCampaignDays(campaignId: string): Promise<StatsResult<CampaignDay[]>> {
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return { ok: false, message: STORE_FAILURE_MESSAGE.unconfigured };

  const { data, error } = await supabase
    .from("ads_metrics_daily")
    .select("campaign_id, date, spend, impressions, clicks, results")
    .eq("campaign_id", campaignId)
    .order("date", { ascending: true })
    .limit(5_000);
  if (error) return fail(error);
  return { ok: true, data: ((data ?? []) as MetricRow[]).map(toDay) };
}

/** Cifrele pe toată durata, pentru lista de campanii (o singură cerere). */
export async function readLifetimeTotals(
  campaignIds: string[]
): Promise<StatsResult<Map<string, CampaignDay[]>>> {
  const byCampaign = new Map<string, CampaignDay[]>();
  if (campaignIds.length === 0) return { ok: true, data: byCampaign };
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return { ok: false, message: STORE_FAILURE_MESSAGE.unconfigured };

  const { data, error } = await supabase
    .from("ads_metrics_daily")
    .select("campaign_id, date, spend, impressions, clicks, results")
    .in("campaign_id", campaignIds)
    .limit(50_000);
  if (error) return fail(error);
  for (const row of ((data ?? []) as MetricRow[]).map(toDay)) {
    const list = byCampaign.get(row.campaignId) ?? [];
    list.push(row);
    byCampaign.set(row.campaignId, list);
  }
  return { ok: true, data: byCampaign };
}

/** Ultima sincronizare (cron sau manuală). */
export async function readLastRun(): Promise<SyncRun | null> {
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("ads_runs")
    .select("started_at, finished_at, status, campaigns_synced, error")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    startedAt: String(row.started_at),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    status: row.status as SyncRun["status"],
    campaignsSynced: Number(row.campaigns_synced) || 0,
    error: row.error ? String(row.error) : null,
  };
}
