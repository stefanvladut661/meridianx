import "server-only";

import type { Objective } from "../constants";
import type { DailyRow, SyncCampaign } from "../platform";
import type { AdsWorkspace } from "../workspaces";
import { googleSearch } from "./api";
import { findGoogleAccount } from "./lookup";
import { GoogleAccountHiddenError } from "./video";

/**
 * Cifrele zilnice din Google Ads (GAQL pe `campaign`, segmentat pe zi) —
 * doar citire. O interogare pe cont, filtrată pe campaniile portalului.
 *
 * „Cheltuială" = `metrics.cost_micros` / 1.000.000, în moneda contului.
 * „Clicuri" = `metrics.clicks`. „Rezultate" = conversiile (`metrics.conversions`,
 * după obiectivele contului) la Lead-uri și Vânzări, clicurile la Trafic.
 * Zilele sunt în fusul orar al contului. Rândul brut rămâne în `raw`.
 */

interface RawRow {
  campaign?: { id?: string; status?: string; primaryStatus?: string };
  segments?: { date?: string };
  metrics?: { costMicros?: string; impressions?: string; clicks?: string; conversions?: number | string };
}

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function googleResults(metrics: RawRow["metrics"] = {}, objective: Objective): number {
  switch (objective) {
    case "leads":
    case "sales":
      return Math.round(num(metrics.conversions) * 100) / 100;
    default:
      return num(metrics.clicks);
  }
}

const MAX_IDS = 500;

export async function fetchGoogleDaily(
  workspace: AdsWorkspace,
  customerId: string,
  input: { campaigns: SyncCampaign[]; since: string; until: string }
): Promise<DailyRow[]> {
  if (input.campaigns.length === 0) return [];
  const account = await findGoogleAccount(workspace, customerId);
  if (!account) throw new GoogleAccountHiddenError(customerId);
  const byId = new Map(input.campaigns.map((campaign) => [campaign.platformId, campaign]));
  const ids = [...byId.keys()].filter((id) => /^\d+$/.test(id));
  const rows: DailyRow[] = [];

  for (let index = 0; index < ids.length; index += MAX_IDS) {
    const chunk = ids.slice(index, index + MAX_IDS);
    const raw = await googleSearch<RawRow>(
      workspace,
      account.info.id,
      `SELECT campaign.id, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM campaign WHERE campaign.id IN (${chunk.join(", ")}) AND segments.date BETWEEN '${input.since}' AND '${input.until}'`,
      { loginCustomerId: account.loginCustomerId }
    );
    for (const row of raw) {
      const campaign = row.campaign?.id ? byId.get(row.campaign.id) : undefined;
      const date = row.segments?.date;
      if (!campaign || !date) continue;
      rows.push({
        platformId: campaign.platformId,
        date,
        spend: Math.round((num(row.metrics?.costMicros) / 1_000_000) * 100) / 100,
        impressions: Math.round(num(row.metrics?.impressions)),
        clicks: Math.round(num(row.metrics?.clicks)),
        results: googleResults(row.metrics, campaign.objective),
        raw: row,
      });
    }
  }
  return rows;
}

/** Statusul curent pe id de campanie: ENABLED, PAUSED sau REMOVED (Google întoarce și campaniile șterse). */
export async function fetchGoogleStatuses(
  workspace: AdsWorkspace,
  customerId: string,
  platformIds: string[]
): Promise<Map<string, string>> {
  const statuses = new Map<string, string>();
  const ids = platformIds.filter((id) => /^\d+$/.test(id));
  if (ids.length === 0) return statuses;
  const account = await findGoogleAccount(workspace, customerId);
  if (!account) throw new GoogleAccountHiddenError(customerId);
  for (let index = 0; index < ids.length; index += MAX_IDS) {
    const chunk = ids.slice(index, index + MAX_IDS);
    const raw = await googleSearch<RawRow>(
      workspace,
      account.info.id,
      `SELECT campaign.id, campaign.status, campaign.primary_status FROM campaign WHERE campaign.id IN (${chunk.join(", ")})`,
      { loginCustomerId: account.loginCustomerId }
    );
    for (const row of raw) {
      if (row.campaign?.id && row.campaign.status) statuses.set(row.campaign.id, row.campaign.status);
    }
  }
  return statuses;
}
