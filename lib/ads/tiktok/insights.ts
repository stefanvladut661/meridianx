import "server-only";

import type { Objective } from "../constants";
import type { DailyRow, SyncCampaign } from "../platform";
import type { AdsWorkspace } from "../workspaces";
import { TikTokApiError, tiktokGet, tiktokGetAll } from "./api";

/**
 * Cifrele zilnice din raportul TikTok (`/report/integrated/get/`), pe
 * campanie — doar citire.
 *
 * O cerere pe cont și pe fereastră, nu una pe campanie: cu dimensiunea
 * „zi", TikTok acceptă cel mult 30 de zile pe cerere și 100 de campanii în
 * filtru, deci perioada și lista se taie în bucăți. Datele sunt în fusul
 * orar al contului.
 *
 * „Clicuri" = clicurile spre destinație (`clicks`). „Rezultate" = ce
 * urmărește campania: evenimentul pixelului pe care optimizează grupul
 * (`conversion`) la Lead-uri/Vânzări, clicurile la Trafic, vizionările de
 * 6 secunde (`engaged_view`) la video, acoperirea la Notorietate. Rândul
 * brut (cu `result`, coloana „Results" din Ads Manager) rămâne în `raw`.
 */

const METRICS = ["spend", "impressions", "clicks", "reach", "conversion", "result", "engaged_view"];
const MAX_DAYS = 30;
const MAX_CAMPAIGNS = 100;

interface RawReportRow {
  dimensions?: { campaign_id?: string | number; stat_time_day?: string };
  metrics?: Record<string, string | number | undefined>;
}

function num(value: string | number | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function tiktokResults(metrics: Record<string, string | number | undefined>, objective: Objective): number {
  switch (objective) {
    case "leads":
    case "sales":
      return num(metrics.conversion);
    case "traffic":
      return num(metrics.clicks);
    case "video_views":
      return num(metrics.engaged_view);
    case "awareness":
      return num(metrics.reach);
  }
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** [since, until] în ferestre de cel mult 30 de zile, capetele incluse. */
export function reportWindows(since: string, until: string): Array<{ since: string; until: string }> {
  const windows: Array<{ since: string; until: string }> = [];
  for (let start = since; start <= until; start = addDays(start, MAX_DAYS)) {
    const end = addDays(start, MAX_DAYS - 1);
    windows.push({ since: start, until: end < until ? end : until });
  }
  return windows;
}

export async function fetchTikTokDaily(
  workspace: AdsWorkspace,
  advertiserId: string,
  input: { campaigns: SyncCampaign[]; since: string; until: string }
): Promise<DailyRow[]> {
  if (input.campaigns.length === 0) return [];
  const byId = new Map(input.campaigns.map((campaign) => [campaign.platformId, campaign]));
  const ids = [...byId.keys()];
  const rows: DailyRow[] = [];

  for (let index = 0; index < ids.length; index += MAX_CAMPAIGNS) {
    const chunk = ids.slice(index, index + MAX_CAMPAIGNS);
    for (const window of reportWindows(input.since, input.until)) {
      const raw = await tiktokGetAll<RawReportRow>(
        workspace,
        "/report/integrated/get/",
        {
          advertiser_id: advertiserId,
          report_type: "BASIC",
          data_level: "AUCTION_CAMPAIGN",
          dimensions: ["campaign_id", "stat_time_day"],
          metrics: METRICS,
          start_date: window.since,
          end_date: window.until,
          filtering: [{ field_name: "campaign_ids", filter_type: "IN", filter_value: JSON.stringify(chunk) }],
        },
        "list",
        50_000,
        1000
      );
      for (const row of raw) {
        const platformId = row.dimensions?.campaign_id !== undefined ? String(row.dimensions.campaign_id) : null;
        const campaign = platformId ? byId.get(platformId) : undefined;
        const date = row.dimensions?.stat_time_day?.slice(0, 10);
        if (!campaign || !date) continue;
        const metrics = row.metrics ?? {};
        rows.push({
          platformId: campaign.platformId,
          date,
          spend: Math.round(num(metrics.spend) * 100) / 100,
          impressions: Math.round(num(metrics.impressions)),
          clicks: Math.round(num(metrics.clicks)),
          results: tiktokResults(metrics, campaign.objective),
          raw: row,
        });
      }
    }
  }
  return rows;
}

interface RawCampaign {
  campaign_id?: string | number;
  operation_status?: string;
  secondary_status?: string;
}

async function readStatuses(
  workspace: AdsWorkspace,
  advertiserId: string,
  ids: string[],
  extra: Record<string, unknown> = {}
): Promise<RawCampaign[]> {
  const data = await tiktokGet<{ list?: RawCampaign[] }>(workspace, "/campaign/get/", {
    advertiser_id: advertiserId,
    filtering: { campaign_ids: ids, ...extra },
    fields: ["campaign_id", "operation_status", "secondary_status"],
    page_size: MAX_CAMPAIGNS,
  });
  return data.list ?? [];
}

/**
 * Statusul curent, pe id de campanie: `secondary_status` (spune și de ce nu
 * livrează — buget epuizat, respinsă), altfel `operation_status`.
 *
 * Lista implicită nu întoarce campaniile șterse; cele care lipsesc se caută
 * o dată și printre cele șterse. Dacă TikTok refuză filtrul ăsta, rămân cu
 * statusul vechi — o citire de status nu oprește sincronizarea.
 */
export async function fetchTikTokStatuses(
  workspace: AdsWorkspace,
  advertiserId: string,
  platformIds: string[]
): Promise<Map<string, string>> {
  const statuses = new Map<string, string>();
  const note = (list: RawCampaign[]) => {
    for (const item of list) {
      const status = item.secondary_status || item.operation_status;
      if (item.campaign_id !== undefined && status) statuses.set(String(item.campaign_id), status);
    }
  };

  for (let index = 0; index < platformIds.length; index += MAX_CAMPAIGNS) {
    const chunk = platformIds.slice(index, index + MAX_CAMPAIGNS);
    note(await readStatuses(workspace, advertiserId, chunk));
    const missing = chunk.filter((id) => !statuses.has(id));
    if (missing.length > 0) {
      try {
        note(await readStatuses(workspace, advertiserId, missing, { secondary_status: "CAMPAIGN_STATUS_DELETE" }));
      } catch (error) {
        if (!(error instanceof TikTokApiError)) throw error;
      }
    }
  }
  return statuses;
}
