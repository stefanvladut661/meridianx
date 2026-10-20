import "server-only";

import { cache } from "react";
import { createReadOnlySessionClient } from "@/lib/supabase/clients";
import type { Platform } from "../constants";
import type { Channel, DateRange } from "./selection";
import { listClients, modelFailure, readAll, type ModelResult } from "./store";
import type { AccountSummary, ClientSummary, EntityRow, EntitySettings, Figures, Level, NormalizedStatus } from "./types";

/**
 * Ce citește ecranul v2 — DOAR din bază, niciodată direct din platforme:
 * paginile rămân rapide, nu consumă din limitele conturilor și istoricul
 * rămâne după ce platforma îl uită. Prin sesiune (RLS, `is_lead_admin()`).
 */

/** Clienții, o singură citire pe cerere (layout-ul și pagina îi cer amândouă). */
export const clientsForRequest = cache(listClients);

export interface ClientView {
  client: ClientSummary;
  /** Conturile clientului pe canalul ales. */
  accounts: AccountSummary[];
  /** Toate nivelurile: campanii, grupuri, reclame. */
  entities: EntityRow[];
  /** Sumele perioadei, pe id de rând. Un rând fără livrare lipsește. */
  totals: Record<string, Figures>;
  /** Sumele perioadei de dinainte, pe id de rând. */
  previous: Record<string, Figures>;
}

interface EntityDbRow {
  id: string;
  account_id: string;
  platform: Platform;
  level: Level;
  platform_id: string;
  campaign_platform_id: string;
  group_platform_id: string | null;
  name: string;
  status: NormalizedStatus;
  status_detail: string | null;
  daily_budget: number | string | null;
  lifetime_budget: number | string | null;
  kind: string | null;
  default_result: string | null;
  settings: EntitySettings | null;
  portal_campaign_id: string | null;
  platform_created_at: string | null;
  last_seen_at: string;
}

interface TotalsRow {
  entity_id: string;
  spend: number | string;
  impressions: number | string;
  clicks: number | string;
  conversions: Record<string, number | string> | null;
  extra: Record<string, number | string> | null;
}

const ENTITY_COLUMNS =
  "id, account_id, platform, level, platform_id, campaign_platform_id, group_platform_id, name, status, status_detail, daily_budget, lifetime_budget, kind, default_result, settings, portal_campaign_id, platform_created_at, last_seen_at";

const numberOrNull = (value: number | string | null): number | null => (value === null || value === undefined ? null : Number(value));

function numbers(map: Record<string, number | string> | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(map ?? {})) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) out[key] = Math.round(parsed * 100) / 100;
  }
  return out;
}

function toFigures(row: TotalsRow): Figures {
  return {
    spend: Math.round(Number(row.spend) * 100) / 100,
    impressions: Number(row.impressions) || 0,
    clicks: Number(row.clicks) || 0,
    conversions: numbers(row.conversions),
    extra: numbers(row.extra),
  };
}

async function totalsOf(
  supabase: NonNullable<Awaited<ReturnType<typeof createReadOnlySessionClient>>>,
  accountIds: string[],
  from: string,
  to: string
): Promise<ModelResult<Record<string, Figures>>> {
  const { data, error } = await readAll<TotalsRow>((start, end) =>
    supabase.rpc("ads_entity_totals", { p_accounts: accountIds, p_from: from, p_to: to }).range(start, end)
  );
  if (error) return modelFailure(error);
  return { ok: true, data: Object.fromEntries(data.map((row) => [row.entity_id, toFigures(row)])) };
}

export async function readClientView(input: { client: ClientSummary; channel: Channel; range: DateRange }): Promise<ModelResult<ClientView>> {
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return { ok: false, message: "Supabase nu e configurat pe server (NEXT_PUBLIC_SUPABASE_URL, cheile)." };

  const accounts = input.client.accounts.filter((account) => input.channel === "toate" || account.platform === input.channel);
  const empty: ClientView = { client: input.client, accounts, entities: [], totals: {}, previous: {} };
  if (accounts.length === 0) return { ok: true, data: empty };
  const accountIds = accounts.map((account) => account.id);
  const currency = new Map(accounts.map((account) => [account.id, account.currency]));

  const [entityRows, choices, current, previous] = await Promise.all([
    readAll<EntityDbRow>((start, end) =>
      supabase.from("ads_entities").select(ENTITY_COLUMNS).in("account_id", accountIds).order("id").range(start, end)
    ),
    readAll<{ entity_id: string; result_key: string }>((start, end) =>
      supabase.from("ads_result_choices").select("entity_id, result_key").order("entity_id").range(start, end)
    ),
    totalsOf(supabase, accountIds, input.range.from, input.range.to),
    totalsOf(supabase, accountIds, input.range.previousFrom, input.range.previousTo),
  ]);
  if (entityRows.error) return modelFailure(entityRows.error);
  if (choices.error) return modelFailure(choices.error);
  if (!current.ok) return current;
  if (!previous.ok) return previous;

  const chosen = new Map(choices.data.map((row) => [row.entity_id, row.result_key]));
  // Cheia rezultatului e a campaniei; grupurile și reclamele o moștenesc.
  const campaignKey = new Map<string, { key: string | null; chosen: boolean }>();
  for (const row of entityRows.data) {
    if (row.level !== "campaign") continue;
    const choice = chosen.get(row.id);
    campaignKey.set(`${row.account_id}|${row.platform_id}`, { key: choice ?? row.default_result, chosen: choice !== undefined });
  }

  const entities: EntityRow[] = entityRows.data.map((row) => {
    const result = campaignKey.get(`${row.account_id}|${row.campaign_platform_id}`) ?? { key: null, chosen: false };
    return {
      id: row.id,
      accountId: row.account_id,
      platform: row.platform,
      level: row.level,
      platformId: row.platform_id,
      campaignId: row.campaign_platform_id,
      groupId: row.group_platform_id,
      name: row.name,
      status: row.status,
      statusDetail: row.status_detail,
      dailyBudget: numberOrNull(row.daily_budget),
      lifetimeBudget: numberOrNull(row.lifetime_budget),
      kind: row.kind,
      currency: currency.get(row.account_id) ?? null,
      resultKey: result.key,
      resultChosen: result.chosen,
      settings: row.settings ?? { facts: [] },
      portalCampaignId: row.portal_campaign_id,
      createdAt: row.platform_created_at,
      lastSeenAt: row.last_seen_at,
    };
  });

  return { ok: true, data: { client: input.client, accounts, entities, totals: current.data, previous: previous.data } };
}

export interface EntityDay {
  entityId: string;
  date: string;
  figures: Figures;
}

/** Zilele unor rânduri anume (graficul din panou, statisticile). */
export async function readEntityDays(entityIds: string[], from: string, to: string): Promise<ModelResult<EntityDay[]>> {
  if (entityIds.length === 0) return { ok: true, data: [] };
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return { ok: false, message: "Supabase nu e configurat pe server." };
  const { data, error } = await readAll<TotalsRow & { date: string }>((start, end) =>
    supabase.rpc("ads_entity_days", { p_entities: entityIds, p_from: from, p_to: to }).range(start, end)
  );
  if (error) return modelFailure(error);
  return { ok: true, data: data.map((row) => ({ entityId: row.entity_id, date: row.date, figures: toFigures(row) })) };
}
