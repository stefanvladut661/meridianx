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

export type StoreFailure =
  | "unconfigured"
  | "missing_migration"
  | "missing_admin_migration"
  | "missing_search_migration"
  | "not_found"
  | "error";

export const STORE_FAILURE_MESSAGE: Record<StoreFailure, string> = {
  unconfigured: "Supabase nu e configurat pe server (NEXT_PUBLIC_SUPABASE_URL, cheile).",
  missing_migration:
    "Tabelele portalului lipsesc: aplică migrarea 6 (supabase/migrations/00000000000006_ads_portal.sql) în SQL editor.",
  missing_admin_migration:
    "Lipsește funcția is_lead_admin(): aplică întâi migrarea 5, apoi migrarea 6.",
  missing_search_migration:
    "Lipsesc coloanele sau tabelele noi ale portalului: aplică migrările de la 9 în sus (supabase/migrations/00000000000009_… și următoarele) în SQL editor.",
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
  // Coloană necunoscută (Postgres 42703, PostgREST PGRST204): o migrare nouă neaplicată.
  if (code === "42703" || code === "PGRST204" || /column .* does not exist|Could not find the '.*' column/i.test(message)) {
    return { ok: false, reason: "missing_search_migration", detail: message };
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
  /** Căutare: grupurile campaniei. */
  adGroups?: string[];
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
  /** `search` = campanie dintr-un plan de căutare (`plan` are altă formă); null = plan video. */
  channel: "search" | null;
  /** Rândurile create din același plan de căutare. */
  planGroupId: string | null;
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
  channel?: "search" | null;
  plan_group_id?: string | null;
}

const BASE_COLUMNS =
  "id, workspace, platform, ad_account, platform_campaign_id, name, objective, daily_budget, currency, " +
  "status, creation, creation_error, platform_objects, plan_json, created_at, created_by_email";
/** Din migrarea 9. Fără ea, citirile cad pe coloanele vechi — lista nu se strică. */
const COLUMNS = `${BASE_COLUMNS}, channel, plan_group_id`;

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
    channel: row.channel === "search" ? "search" : null,
    planGroupId: row.plan_group_id ?? null,
  };
}

type Query<T> = PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null }>;

/** O citire cu coloanele migrării 9; dacă ea nu e aplicată, aceeași citire fără ele. */
async function withOptionalColumns<T>(run: (columns: string) => Query<T>): Promise<{ data: T | null; error: { code?: string; message?: string } | null }> {
  const first = await run(COLUMNS);
  if (first.error && failure(first.error).reason === "missing_search_migration") return run(BASE_COLUMNS);
  return first;
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

  const { data, error } = await withOptionalColumns((columns) =>
    supabase.from("ads_campaigns").select(columns).order("created_at", { ascending: false }).limit(limit)
  );

  if (error) return failure(error);
  return { ok: true, data: ((data ?? []) as unknown as AdsCampaignRow[]).map(toCampaign) };
}

export async function getCampaign(id: string): Promise<StoreResult<AdsCampaign>> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, reason: "not_found" };
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const { data, error } = await withOptionalColumns((columns) => supabase.from("ads_campaigns").select(columns).eq("id", id).maybeSingle());
  if (error) return failure(error);
  if (!data) return { ok: false, reason: "not_found" };
  return { ok: true, data: toCampaign(data as unknown as AdsCampaignRow) };
}

/**
 * Conturile de reclame folosite deja într-un spațiu — pe TikTok, unde
 * tokenul nu poate lista singur conturile, de aici pornește contextul dat
 * conversației cu Claude.
 */
export async function knownAccounts(workspaceId: string): Promise<string[]> {
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("ads_campaigns")
    .select("ad_account, created_at")
    .eq("workspace", workspaceId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return [...new Set((data as Array<{ ad_account: string }>).map((row) => row.ad_account))].slice(0, 10);
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
  const { data, error } = await withOptionalColumns((columns) =>
    supabase
      .from("ads_campaigns")
      .select(columns)
      .eq("fingerprint", fingerprint)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  );

  if (error) return failure(error);
  return { ok: true, data: data ? toCampaign(data as unknown as AdsCampaignRow) : null };
}

// ---------------------------------------------------------------------------
// Căutare (faza 10): mai multe campanii dintr-un singur plan
// ---------------------------------------------------------------------------

export interface NewSearchCampaignRecord {
  platformCampaignId: string;
  name: string;
  dailyBudget: number;
  /** Planul campaniei: cel de căutare, cu doar campania asta și listele ei. */
  plan: Record<string, unknown>;
  platformObjects: PlatformObjects;
}

/**
 * Rândurile campaniilor create dintr-un plan de căutare, legate prin
 * `plan_group_id` (migrarea 9). Toate sau niciunul (un singur insert).
 * Obiectivul e `leads`: rezultatele numărate sunt conversiile contului
 * (apeluri, formulare), ca la Demand Gen pe Lead-uri. Statusul scris e cel de
 * la creare: PAUSED.
 */
export async function recordSearchCampaigns(input: {
  workspace: string;
  adAccount: string;
  currency: string;
  fingerprint: string;
  groupId: string;
  campaigns: NewSearchCampaignRecord[];
  createdBy: { id: string; email: string | null };
}): Promise<StoreResult<Array<{ id: string; platformCampaignId: string }>>> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const { data, error } = await supabase
    .from("ads_campaigns")
    .insert(
      input.campaigns.map((campaign) => ({
        workspace: input.workspace,
        platform: "google",
        ad_account: input.adAccount,
        platform_campaign_id: campaign.platformCampaignId,
        name: campaign.name,
        objective: "leads",
        daily_budget: campaign.dailyBudget,
        currency: input.currency,
        status: PAUSED,
        creation: "complete",
        creation_error: null,
        platform_objects: campaign.platformObjects,
        plan_json: campaign.plan,
        fingerprint: input.fingerprint,
        created_by: input.createdBy.id,
        created_by_email: input.createdBy.email,
        channel: "search",
        plan_group_id: input.groupId,
      }))
    )
    .select("id, platform_campaign_id");

  if (error || !data) return failure(error ?? { message: "fără rânduri întoarse" });
  return {
    ok: true,
    data: (data as Array<{ id: string; platform_campaign_id: string }>).map((row) => ({ id: row.id, platformCampaignId: row.platform_campaign_id })),
  };
}

/**
 * Campaniile create din portal într-un cont, după nume — ca verificarea unui
 * plan de căutare să spună „creată din portal acum 3 minute”, nu doar „numele
 * e ocupat”. Citire prin service role (verificarea rulează după sesiune).
 */
export async function portalCampaignsByName(adAccount: string, names: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const supabase = createAdminClient();
  if (!supabase || names.length === 0) return found;
  const { data, error } = await supabase
    .from("ads_campaigns")
    .select("name, created_at")
    .eq("platform", "google")
    .eq("ad_account", adAccount)
    .in("name", names)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !data) return found;
  for (const row of data as Array<{ name: string; created_at: string }>) if (!found.has(row.name)) found.set(row.name, row.created_at);
  return found;
}

/** Campaniile create din portal într-un cont Google: id-ul Google → rândul din portal. */
export async function portalCampaignIds(adAccount: string): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return found;
  const { data, error } = await supabase
    .from("ads_campaigns")
    .select("id, platform_campaign_id")
    .eq("platform", "google")
    .eq("ad_account", adAccount)
    .limit(2000);
  if (error || !data) return found;
  for (const row of data as Array<{ id: string; platform_campaign_id: string }>) found.set(row.platform_campaign_id, row.id);
  return found;
}

/**
 * După o pauză din portal: rândurile campaniilor create din portal trec pe
 * PAUSED imediat (altfel ar aștepta sincronizarea de a doua zi).
 */
export async function markPortalPaused(adAccount: string, platformIds: string[]): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase || platformIds.length === 0) return;
  await supabase
    .from("ads_campaigns")
    .update({ status: PAUSED })
    .eq("platform", "google")
    .eq("ad_account", adAccount)
    .in("platform_campaign_id", platformIds);
}
