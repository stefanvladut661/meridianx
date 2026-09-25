import "server-only";

import { createAdminClient, createReadOnlySessionClient } from "@/lib/supabase/clients";
import type { Currency, Objective, Platform } from "./constants";
import type { Plan } from "./plan-schema";
import { PAUSED } from "./meta/paused";

/**
 * Tabelele portalului (migrarea 6) — singurul loc care le atinge.
 *
 * Citirile merg pe clientul legat de sesiune, deci prin RLS
 * (`is_lead_admin()`): dacă o rută scapă neprotejată, baza tot refuză.
 * Scrierile merg prin service role, DUPĂ ce acțiunea a verificat sesiunea —
 * exact ca la lead-uri. Tabelele nu au politici de scriere.
 */

export type StoreResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: StoreFailure; detail?: string };

export type StoreFailure = "unconfigured" | "missing_migration" | "missing_admin_migration" | "not_found" | "error";

export const STORE_FAILURE_MESSAGE: Record<StoreFailure, string> = {
  unconfigured: "Supabase nu e configurat pe server (NEXT_PUBLIC_SUPABASE_URL, cheile).",
  missing_migration:
    "Tabelele portalului lipsesc: aplică migrarea 6 (supabase/migrations/00000000000006_ads_portal.sql) în SQL editor.",
  missing_admin_migration:
    "Lipsește funcția is_lead_admin(): aplică întâi migrarea 5, apoi migrarea 6.",
  not_found: "Campania nu există în baza portalului.",
  error: "Baza de date n-a răspuns cum trebuie.",
};

function failure(error: { code?: string; message?: string }): { ok: false; reason: StoreFailure; detail?: string } {
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (code === "42P01" || code === "PGRST205" || /relation .*ads_.* does not exist/i.test(message)) {
    return { ok: false, reason: "missing_migration", detail: message };
  }
  if (code === "42883" && /is_lead_admin/.test(message)) {
    return { ok: false, reason: "missing_admin_migration", detail: message };
  }
  return { ok: false, reason: "error", detail: message };
}

// ---------------------------------------------------------------------------
// Forma rândului
// ---------------------------------------------------------------------------

/** Id-urile obiectelor de sub campanie, cum le-a întors platforma. */
export interface PlatformObjects {
  adset?: string;
  creatives?: string[];
  ads?: string[];
}

export interface AdsCampaign {
  id: string;
  workspace: string;
  platform: Platform;
  adAccount: string;
  platformCampaignId: string;
  name: string;
  objective: Objective;
  dailyBudget: number;
  currency: Currency;
  status: string;
  creation: "complete" | "partial";
  creationError: string | null;
  platformObjects: PlatformObjects;
  plan: Plan;
  createdAt: string;
  createdByEmail: string | null;
}

interface AdsCampaignRow {
  id: string;
  workspace: string;
  platform: Platform;
  ad_account: string;
  platform_campaign_id: string;
  name: string;
  objective: Objective;
  daily_budget: number | string;
  currency: Currency;
  status: string;
  creation: "complete" | "partial";
  creation_error: string | null;
  platform_objects: PlatformObjects | null;
  plan_json: Plan;
  created_at: string;
  created_by_email: string | null;
}

const COLUMNS =
  "id, workspace, platform, ad_account, platform_campaign_id, name, objective, daily_budget, currency, " +
  "status, creation, creation_error, platform_objects, plan_json, created_at, created_by_email";

function toCampaign(row: AdsCampaignRow): AdsCampaign {
  return {
    id: row.id,
    workspace: row.workspace,
    platform: row.platform,
    adAccount: row.ad_account,
    platformCampaignId: row.platform_campaign_id,
    name: row.name,
    objective: row.objective,
    dailyBudget: Number(row.daily_budget),
    currency: row.currency,
    status: row.status,
    creation: row.creation,
    creationError: row.creation_error,
    platformObjects: row.platform_objects ?? {},
    plan: row.plan_json,
    createdAt: row.created_at,
    createdByEmail: row.created_by_email,
  };
}

// ---------------------------------------------------------------------------
// Scriere
// ---------------------------------------------------------------------------

export interface NewCampaignRecord {
  workspace: string;
  platform: Platform;
  adAccount: string;
  platformCampaignId: string;
  plan: Plan;
  fingerprint: string;
  creation: "complete" | "partial";
  creationError: string | null;
  platformObjects: PlatformObjects;
  createdBy: { id: string; email: string | null };
}

/**
 * Rândul campaniei tocmai create. Se cheamă DOAR din acțiunea de creare,
 * după `getAdminUser()`. Statusul scris e cel trimis la creare: PAUSED.
 */
export async function recordCampaign(input: NewCampaignRecord): Promise<StoreResult<{ id: string }>> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const { data, error } = await supabase
    .from("ads_campaigns")
    .insert({
      workspace: input.workspace,
      platform: input.platform,
      ad_account: input.adAccount,
      platform_campaign_id: input.platformCampaignId,
      name: input.plan.campaign.name,
      objective: input.plan.campaign.objective,
      daily_budget: input.plan.campaign.daily_budget,
      currency: input.plan.campaign.currency,
      status: PAUSED,
      creation: input.creation,
      creation_error: input.creationError,
      platform_objects: input.platformObjects,
      plan_json: input.plan,
      fingerprint: input.fingerprint,
      created_by: input.createdBy.id,
      created_by_email: input.createdBy.email,
    })
    .select("id")
    .single();

  if (error || !data) return failure(error ?? { message: "fără rând întors" });
  return { ok: true, data: { id: (data as { id: string }).id } };
}

// ---------------------------------------------------------------------------
// Citire
// ---------------------------------------------------------------------------

export async function listCampaigns(limit = 200): Promise<StoreResult<AdsCampaign[]>> {
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const { data, error } = await supabase
    .from("ads_campaigns")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return failure(error);
  return { ok: true, data: ((data ?? []) as unknown as AdsCampaignRow[]).map(toCampaign) };
}

export async function getCampaign(id: string): Promise<StoreResult<AdsCampaign>> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, reason: "not_found" };
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const { data, error } = await supabase.from("ads_campaigns").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) return failure(error);
  if (!data) return { ok: false, reason: "not_found" };
  return { ok: true, data: toCampaign(data as unknown as AdsCampaignRow) };
}

/**
 * Ultima campanie creată din EXACT același plan verificat, în ultimele
 * `minutes` minute — sau null. Prinde dublul clic și al doilea tab.
 */
export async function findRecentDuplicate(
  fingerprint: string,
  minutes = 30
): Promise<StoreResult<AdsCampaign | null>> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const { data, error } = await supabase
    .from("ads_campaigns")
    .select(COLUMNS)
    .eq("fingerprint", fingerprint)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return failure(error);
  return { ok: true, data: data ? toCampaign(data as unknown as AdsCampaignRow) : null };
}
