import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, createReadOnlySessionClient } from "@/lib/supabase/clients";
import type { FetchedTerm } from "./google/terms/fetch";
import type { TermRow, TermRules } from "./google/terms/types";
import type { StoreFailure, StoreResult } from "./store";

/**
 * Tabelele termenilor de căutare (migrarea 11): termenii pe zi și regulile de
 * propuneri pe cont. Citirea pentru ecran prin sesiune (RLS); scrierea prin
 * service role, după CRON_SECRET sau sesiunea de admin.
 */

const PAGE = 1000;

function reasonOf(error: { code?: string; message?: string }): StoreFailure {
  if (error.code === "42P01" || error.code === "PGRST205" || /ads_search_term/.test(error.message ?? "")) return "missing_search_migration";
  return "error";
}

/** Toate rândurile unei citiri, pe pagini (PostgREST dă cel mult 1.000 pe cerere). */
async function allRows<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { code?: string; message?: string } | null }>, cap = 50_000) {
  const rows: T[] = [];
  for (let start = 0; start < cap; start += PAGE) {
    const { data, error } = await read(start, start + PAGE - 1);
    if (error) return { rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return { rows, error: null };
}

const keyOf = (row: { campaign_id: string; ad_group_id: string; search_term: string }) => `${row.campaign_id}|${row.ad_group_id}|${row.search_term}`;

// ---------------------------------------------------------------------------
// Conturile de sincronizat
// ---------------------------------------------------------------------------

/**
 * Conturile ai căror termeni se sincronizează: cele cu campanii de căutare
 * create din portal și cele cu reguli (conturi preluate), dacă sincronizarea
 * nu e oprită.
 */
export async function termAccounts(admin: SupabaseClient): Promise<Array<{ workspace: string; adAccount: string }>> {
  const found = new Map<string, string>();
  const { data: campaigns } = await admin.from("ads_campaigns").select("workspace, ad_account").eq("platform", "google").eq("channel", "search").limit(5000);
  for (const row of (campaigns ?? []) as Array<{ workspace: string; ad_account: string }>) found.set(row.ad_account, row.workspace);
  const { data: rules } = await admin.from("ads_search_term_rules").select("workspace, ad_account, sync_enabled").limit(5000);
  for (const row of (rules ?? []) as Array<{ workspace: string; ad_account: string; sync_enabled: boolean }>) {
    if (row.sync_enabled) found.set(row.ad_account, row.workspace);
    else found.delete(row.ad_account);
  }
  return [...found.entries()].map(([adAccount, workspace]) => ({ workspace, adAccount }));
}

/** Ultima zi sincronizată pentru un cont — `null` = niciodată. */
export async function latestTermDate(admin: SupabaseClient, adAccount: string): Promise<string | null> {
  const { data } = await admin.from("ads_search_terms").select("date").eq("ad_account", adAccount).order("date", { ascending: false }).limit(1).maybeSingle();
  return (data as { date?: string } | null)?.date ?? null;
}

// ---------------------------------------------------------------------------
// Scrierea
// ---------------------------------------------------------------------------

export async function writeTerms(admin: SupabaseClient, workspace: string, adAccount: string, terms: FetchedTerm[]): Promise<StoreResult<{ rows: number }>> {
  if (terms.length === 0) return { ok: true, data: { rows: 0 } };

  // Prima și ultima apariție: din ce e deja în bază pentru aceiași termeni, plus lotul nou.
  const seen = new Map<string, { first: string; last: string }>();
  const note = (key: string, first: string | null, last: string | null) => {
    const entry = seen.get(key);
    const nextFirst = [entry?.first, first].filter((value): value is string => Boolean(value)).sort()[0];
    const nextLast = [entry?.last, last].filter((value): value is string => Boolean(value)).sort().pop();
    if (nextFirst && nextLast) seen.set(key, { first: nextFirst, last: nextLast });
  };
  const uniqueTerms = [...new Set(terms.map((term) => term.term))];
  for (let index = 0; index < uniqueTerms.length; index += 100) {
    const chunk = uniqueTerms.slice(index, index + 100);
    const { rows, error } = await allRows<{ campaign_id: string; ad_group_id: string; search_term: string; first_seen: string | null; last_seen: string | null }>((from, to) =>
      admin
        .from("ads_search_terms")
        .select("campaign_id, ad_group_id, search_term, first_seen, last_seen")
        .eq("ad_account", adAccount)
        .in("search_term", chunk)
        .range(from, to)
    );
    if (error) return { ok: false, reason: reasonOf(error), detail: error.message };
    for (const row of rows) note(keyOf(row), row.first_seen, row.last_seen);
  }
  for (const term of terms) note(keyOf({ campaign_id: term.campaignId, ad_group_id: term.adGroupId, search_term: term.term }), term.date, term.date);

  const records = terms.map((term) => {
    const span = seen.get(keyOf({ campaign_id: term.campaignId, ad_group_id: term.adGroupId, search_term: term.term }));
    return {
      workspace,
      ad_account: adAccount,
      campaign_id: term.campaignId,
      campaign_name: term.campaignName,
      ad_group_id: term.adGroupId,
      ad_group_name: term.adGroupName,
      search_term: term.term,
      match_type: term.matchType,
      keyword_text: term.keyword,
      date: term.date,
      impressions: term.impressions,
      clicks: term.clicks,
      cost: term.cost,
      conversions: term.conversions,
      status: term.status,
      first_seen: span?.first ?? term.date,
      last_seen: span?.last ?? term.date,
      synced_at: new Date().toISOString(),
    };
  });
  for (let index = 0; index < records.length; index += 500) {
    const { error } = await admin
      .from("ads_search_terms")
      .upsert(records.slice(index, index + 500), { onConflict: "ad_account,campaign_id,ad_group_id,search_term,match_type,keyword_text,date" });
    if (error) return { ok: false, reason: reasonOf(error), detail: error.message };
  }
  return { ok: true, data: { rows: records.length } };
}

/** Starea ultimei sincronizări, pe rândul de reguli al contului (creat cu valorile implicite dacă lipsește). */
export async function noteTermSync(admin: SupabaseClient, workspace: string, adAccount: string, error: string | null): Promise<void> {
  await admin
    .from("ads_search_term_rules")
    .upsert(
      { workspace, ad_account: adAccount, last_synced_at: new Date().toISOString(), last_sync_error: error },
      { onConflict: "ad_account" }
    );
}

// ---------------------------------------------------------------------------
// Citirea pentru ecran
// ---------------------------------------------------------------------------

export async function readTerms(adAccount: string, from: string, to: string): Promise<StoreResult<TermRow[]>> {
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return { ok: false, reason: "unconfigured" };
  const { rows, error } = await allRows<{
    campaign_id: string;
    campaign_name: string | null;
    ad_group_id: string;
    ad_group_name: string | null;
    search_term: string;
    match_type: string;
    keyword_text: string;
    date: string;
    impressions: number | string;
    clicks: number | string;
    cost: number | string;
    conversions: number | string;
    status: string;
    first_seen: string | null;
    last_seen: string | null;
  }>((start, end) =>
    supabase
      .from("ads_search_terms")
      .select("campaign_id, campaign_name, ad_group_id, ad_group_name, search_term, match_type, keyword_text, date, impressions, clicks, cost, conversions, status, first_seen, last_seen")
      .eq("ad_account", adAccount)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false })
      .range(start, end)
  );
  if (error) return { ok: false, reason: reasonOf(error), detail: error.message };

  const grouped = new Map<string, TermRow>();
  for (const row of rows) {
    const key = keyOf(row);
    const entry =
      grouped.get(key) ??
      ({
        campaignId: row.campaign_id,
        campaignName: row.campaign_name ?? row.campaign_id,
        adGroupId: row.ad_group_id,
        adGroupName: row.ad_group_name ?? row.ad_group_id,
        term: row.search_term,
        matchType: row.match_type,
        keyword: row.keyword_text,
        impressions: 0,
        clicks: 0,
        cost: 0,
        conversions: 0,
        // Rândurile vin cele mai noi primele: statusul și potrivirea sunt cele de azi.
        status: row.status,
        firstSeen: row.first_seen,
        lastSeen: row.last_seen,
      } satisfies TermRow);
    entry.impressions += Number(row.impressions);
    entry.clicks += Number(row.clicks);
    entry.cost = Math.round((entry.cost + Number(row.cost)) * 100) / 100;
    entry.conversions = Math.round((entry.conversions + Number(row.conversions)) * 100) / 100;
    if (row.first_seen && (!entry.firstSeen || row.first_seen < entry.firstSeen)) entry.firstSeen = row.first_seen;
    if (row.last_seen && (!entry.lastSeen || row.last_seen > entry.lastSeen)) entry.lastSeen = row.last_seen;
    grouped.set(key, entry);
  }
  return { ok: true, data: [...grouped.values()].sort((a, b) => b.cost - a.cost || b.clicks - a.clicks) };
}

export async function readRules(adAccount: string): Promise<StoreResult<TermRules | null>> {
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return { ok: false, reason: "unconfigured" };
  const { data, error } = await supabase
    .from("ads_search_term_rules")
    .select("ad_account, exclude_words, cost_threshold, sync_enabled, last_synced_at, last_sync_error, updated_at, updated_by_email")
    .eq("ad_account", adAccount)
    .maybeSingle();
  if (error) return { ok: false, reason: reasonOf(error), detail: error.message };
  if (!data) return { ok: true, data: null };
  const row = data as Record<string, unknown>;
  return {
    ok: true,
    data: {
      adAccount,
      excludeWords: (row.exclude_words as string[] | null) ?? [],
      costThreshold: Number(row.cost_threshold ?? 20),
      syncEnabled: row.sync_enabled !== false,
      lastSyncedAt: (row.last_synced_at as string | null) ?? null,
      lastSyncError: (row.last_sync_error as string | null) ?? null,
      updatedAt: (row.updated_at as string | null) ?? null,
      updatedByEmail: (row.updated_by_email as string | null) ?? null,
    },
  };
}

export async function saveRules(input: {
  workspace: string;
  adAccount: string;
  excludeWords: string[];
  costThreshold: number;
  syncEnabled: boolean;
  user: { id: string; email: string | null };
}): Promise<StoreResult<null>> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, reason: "unconfigured" };
  const { error } = await admin.from("ads_search_term_rules").upsert(
    {
      workspace: input.workspace,
      ad_account: input.adAccount,
      exclude_words: input.excludeWords,
      cost_threshold: input.costThreshold,
      sync_enabled: input.syncEnabled,
      updated_at: new Date().toISOString(),
      updated_by: input.user.id,
      updated_by_email: input.user.email,
    },
    { onConflict: "ad_account" }
  );
  if (error) return { ok: false, reason: reasonOf(error), detail: error.message };
  return { ok: true, data: null };
}
