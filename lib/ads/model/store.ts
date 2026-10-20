import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, createReadOnlySessionClient } from "@/lib/supabase/clients";
import type { Platform } from "../constants";
import type {
  AccountSnapshot,
  AccountSummary,
  ClientSummary,
  ConversionType,
  DailySnapshot,
  EntitySnapshot,
  Level,
} from "./types";

/**
 * Tabelele modelului comun (migrarea 12) — singurul loc care le atinge.
 *
 * Ca în `../store.ts`: citirile pentru ecran merg prin sesiune (RLS,
 * `is_lead_admin()`), scrierile prin service role, DUPĂ ce acțiunea a verificat
 * sesiunea sau cron-ul a verificat `CRON_SECRET`. Tabelele n-au politici de scriere.
 */

export type ModelResult<T> = { ok: true; data: T } | { ok: false; message: string };

export const MODEL_MIGRATION_MISSING =
  "Tabelele noi ale portalului lipsesc: aplică migrarea 12 (supabase/migrations/00000000000012_ads_model.sql) în Supabase → SQL Editor.";

const UNCONFIGURED = "Supabase nu e configurat pe server (NEXT_PUBLIC_SUPABASE_URL, cheile).";

export function modelFailure(error: { code?: string; message?: string } | null | undefined): { ok: false; message: string } {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (code === "42P01" || code === "PGRST205" || code === "PGRST202" || /ads_(clients|accounts|entit|result|changes|sync_runs)/.test(message) && /does not exist|schema cache|Could not find/i.test(message)) {
    return { ok: false, message: MODEL_MIGRATION_MISSING };
  }
  if (code === "42883" && /is_lead_admin/.test(message)) {
    return { ok: false, message: "Lipsește funcția is_lead_admin(): aplică întâi migrarea 5." };
  }
  return { ok: false, message: `Baza de date n-a răspuns cum trebuie. ${message}`.trim() };
}

type Db = SupabaseClient;

/** Toate rândurile unei citiri, câte 1.000 (limita API-ului Supabase). */
export async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { code?: string; message?: string } | null }>
): Promise<{ data: T[]; error: { code?: string; message?: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; from < 200_000; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return { data: rows, error: null };
}

// ---------------------------------------------------------------------------
// Clienții și conturile
// ---------------------------------------------------------------------------

interface ClientRow {
  id: string;
  name: string;
  owner: "agentie" | "clienti";
}

interface AccountRow {
  id: string;
  client_id: string;
  platform: Platform;
  workspace: string;
  ad_account: string;
  name: string | null;
  currency: string | null;
  timezone: string | null;
  conversions: ConversionType[] | null;
  measured: boolean | null;
  sync_enabled: boolean;
  last_synced_at: string | null;
  last_sync_status: "ok" | "partial" | "failed" | null;
  last_sync_error: string | null;
  synced_through: string | null;
}

const ACCOUNT_COLUMNS =
  "id, client_id, platform, workspace, ad_account, name, currency, timezone, conversions, measured, sync_enabled, last_synced_at, last_sync_status, last_sync_error, synced_through";

function toAccount(row: AccountRow): AccountSummary {
  return {
    id: row.id,
    clientId: row.client_id,
    platform: row.platform,
    workspace: row.workspace,
    adAccount: row.ad_account,
    name: row.name,
    currency: row.currency,
    measured: row.measured,
    conversions: Array.isArray(row.conversions) ? row.conversions : [],
    syncEnabled: row.sync_enabled,
    lastSyncedAt: row.last_synced_at,
    lastSyncStatus: row.last_sync_status,
    lastSyncError: row.last_sync_error,
  };
}

/** Clienții (fără cei arhivați), cu conturile lor. Prin sesiune. */
export async function listClients(): Promise<ModelResult<ClientSummary[]>> {
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return { ok: false, message: UNCONFIGURED };
  const [clients, accounts] = await Promise.all([
    supabase.from("ads_clients").select("id, name, owner").is("archived_at", null).order("name", { ascending: true }).limit(500),
    supabase.from("ads_accounts").select(ACCOUNT_COLUMNS).order("platform", { ascending: true }).limit(1000),
  ]);
  if (clients.error) return modelFailure(clients.error);
  if (accounts.error) return modelFailure(accounts.error);
  const byClient = new Map<string, AccountSummary[]>();
  for (const row of (accounts.data ?? []) as AccountRow[]) {
    const list = byClient.get(row.client_id) ?? [];
    list.push(toAccount(row));
    byClient.set(row.client_id, list);
  }
  return {
    ok: true,
    data: ((clients.data ?? []) as ClientRow[]).map((client) => ({
      id: client.id,
      name: client.name,
      owner: client.owner,
      accounts: byClient.get(client.id) ?? [],
    })),
  };
}

type User = { id: string; email: string | null };

export async function createClientRecord(input: { name: string; owner: "agentie" | "clienti" }, user: User): Promise<ModelResult<{ id: string }>> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: UNCONFIGURED };
  const { data, error } = await admin
    .from("ads_clients")
    .insert({ name: input.name.trim(), owner: input.owner, created_by: user.id, created_by_email: user.email })
    .select("id")
    .single();
  if (error?.code === "23505") return { ok: false, message: `Există deja un client „${input.name.trim()}”.` };
  if (error || !data) return modelFailure(error);
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function renameClientRecord(id: string, name: string): Promise<ModelResult<null>> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: UNCONFIGURED };
  const { error } = await admin.from("ads_clients").update({ name: name.trim() }).eq("id", id);
  if (error?.code === "23505") return { ok: false, message: `Există deja un client „${name.trim()}”.` };
  if (error) return modelFailure(error);
  return { ok: true, data: null };
}

/** Arhivarea scoate clientul din listă; conturile rămân în bază, fără sincronizare. */
export async function archiveClientRecord(id: string): Promise<ModelResult<null>> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: UNCONFIGURED };
  const { error } = await admin.from("ads_clients").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) return modelFailure(error);
  await admin.from("ads_accounts").update({ sync_enabled: false }).eq("client_id", id);
  return { ok: true, data: null };
}

export async function clientById(admin: Db, id: string): Promise<ClientRow | null> {
  const { data } = await admin.from("ads_clients").select("id, name, owner").eq("id", id).is("archived_at", null).maybeSingle();
  return (data as ClientRow | null) ?? null;
}

export async function addAccountRecord(
  input: { clientId: string; platform: Platform; workspace: string; adAccount: string; name: string | null; currency: string | null },
  user: User
): Promise<ModelResult<{ id: string }>> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: UNCONFIGURED };
  const { data: existing } = await admin
    .from("ads_accounts")
    .select("id, client_id")
    .eq("platform", input.platform)
    .eq("ad_account", input.adAccount)
    .maybeSingle();
  if (existing) {
    const owner = await clientById(admin, (existing as { client_id: string }).client_id);
    return { ok: false, message: owner ? `Contul e deja la clientul „${owner.name}”.` : "Contul e deja urmărit, la un client arhivat." };
  }
  const { data, error } = await admin
    .from("ads_accounts")
    .insert({
      client_id: input.clientId,
      platform: input.platform,
      workspace: input.workspace,
      ad_account: input.adAccount,
      name: input.name,
      currency: input.currency,
      created_by: user.id,
      created_by_email: user.email,
    })
    .select("id")
    .single();
  if (error || !data) return modelFailure(error);
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function setAccountSyncRecord(accountId: string, enabled: boolean): Promise<ModelResult<null>> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: UNCONFIGURED };
  const { error } = await admin.from("ads_accounts").update({ sync_enabled: enabled }).eq("id", accountId);
  if (error) return modelFailure(error);
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Sincronizarea (service role)
// ---------------------------------------------------------------------------

export interface SyncAccount {
  id: string;
  clientId: string;
  platform: Platform;
  workspace: string;
  adAccount: string;
  lastSyncedAt: string | null;
  syncedThrough: string | null;
}

/** Conturile de sincronizat, întâi cele mai vechi (sau niciodată sincronizate). */
export async function accountsToSync(admin: Db, filter: { clientId?: string; accountIds?: string[] } = {}): Promise<SyncAccount[]> {
  let query = admin.from("ads_accounts").select(ACCOUNT_COLUMNS).eq("sync_enabled", true);
  if (filter.clientId) query = query.eq("client_id", filter.clientId);
  if (filter.accountIds?.length) query = query.in("id", filter.accountIds);
  const { data, error } = await query.limit(1000);
  if (error) throw new Error(modelFailure(error).message);
  return ((data ?? []) as AccountRow[])
    .map((row) => ({
      id: row.id,
      clientId: row.client_id,
      platform: row.platform,
      workspace: row.workspace,
      adAccount: row.ad_account,
      lastSyncedAt: row.last_synced_at,
      syncedThrough: row.synced_through,
    }))
    .sort((a, b) => (a.lastSyncedAt ?? "").localeCompare(b.lastSyncedAt ?? ""));
}

export interface KnownEntity {
  id: string;
  level: Level;
  platformId: string;
  status: string;
}

export async function knownEntities(admin: Db, accountId: string): Promise<KnownEntity[]> {
  const { data, error } = await readAll<{ id: string; level: Level; platform_id: string; status: string }>((from, to) =>
    admin.from("ads_entities").select("id, level, platform_id, status").eq("account_id", accountId).order("id").range(from, to)
  );
  if (error) throw new Error(modelFailure(error).message);
  return data.map((row) => ({ id: row.id, level: row.level, platformId: row.platform_id, status: row.status }));
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < list.length; index += size) out.push(list.slice(index, index + size));
  return out;
}

/**
 * Structura citită acum: contul (nume, monedă, conversii) și rândurile lui.
 * Întoarce id-ul din bază al fiecărui rând (`nivel|id platformă` → uuid).
 * Rândurile pe care platforma nu le-a mai întors rămân, cu ultima stare știută.
 */
export async function saveStructure(
  admin: Db,
  account: SyncAccount,
  snapshot: { account: AccountSnapshot; entities: EntitySnapshot[] }
): Promise<Map<string, string>> {
  const now = new Date().toISOString();
  const { error: accountError } = await admin
    .from("ads_accounts")
    .update({
      name: snapshot.account.name,
      currency: snapshot.account.currency,
      timezone: snapshot.account.timezone,
      conversions: snapshot.account.conversions,
      measured: snapshot.account.measured,
    })
    .eq("id", account.id);
  if (accountError) throw new Error(`ads_accounts: ${accountError.message}`);

  // Campaniile create din portal: legătura spre planul lor.
  const { data: portal } = await admin
    .from("ads_campaigns")
    .select("id, platform_campaign_id")
    .eq("platform", account.platform)
    .eq("ad_account", account.adAccount)
    .limit(5000);
  const portalIds = new Map(((portal ?? []) as Array<{ id: string; platform_campaign_id: string }>).map((row) => [row.platform_campaign_id, row.id]));

  const ids = new Map<string, string>();
  const rows = snapshot.entities.map((entity) => ({
    account_id: account.id,
    platform: account.platform,
    level: entity.level,
    platform_id: entity.platformId,
    campaign_platform_id: entity.campaignId,
    group_platform_id: entity.groupId,
    name: entity.name,
    status: entity.status,
    status_detail: entity.statusDetail,
    daily_budget: entity.dailyBudget,
    lifetime_budget: entity.lifetimeBudget,
    kind: entity.kind,
    default_result: entity.defaultResult,
    settings: entity.settings,
    portal_campaign_id: entity.level === "campaign" ? (portalIds.get(entity.platformId) ?? null) : null,
    platform_created_at: entity.createdAt,
    last_seen_at: now,
  }));
  for (const part of chunk(rows, 500)) {
    const { data, error } = await admin
      .from("ads_entities")
      .upsert(part, { onConflict: "account_id,level,platform_id" })
      .select("id, level, platform_id");
    if (error) throw new Error(`ads_entities: ${error.message}`);
    for (const row of (data ?? []) as Array<{ id: string; level: Level; platform_id: string }>) ids.set(`${row.level}|${row.platform_id}`, row.id);
  }
  return ids;
}

/** Rândurile care nu mai există pe platformă: rămân, cu starea „ștearsă”. */
export async function markGone(admin: Db, entityIds: string[]): Promise<void> {
  for (const part of chunk(entityIds, 200)) {
    await admin.from("ads_entities").update({ status: "removed", status_detail: "nu mai apare în cont" }).in("id", part);
  }
}

/**
 * Cifrele pe zi. Zilele din ultimele 7 se suprascriu (platformele își mai
 * corectează cifrele); cele mai vechi se scriu o singură dată — baza refuză
 * oricum să le schimbe (trigger-ul din migrarea 12).
 */
export async function saveDaily(admin: Db, days: DailySnapshot[], ids: Map<string, string>, mutableFrom: string): Promise<number> {
  const now = new Date().toISOString();
  const rows = days.flatMap((day) => {
    const entityId = ids.get(`${day.level}|${day.platformId}`);
    if (!entityId) return [];
    return [
      {
        entity_id: entityId,
        date: day.date,
        spend: day.spend,
        impressions: day.impressions,
        clicks: day.clicks,
        conversions: day.conversions,
        extra: day.extra,
        synced_at: now,
      },
    ];
  });
  const recent = rows.filter((row) => row.date >= mutableFrom);
  const frozen = rows.filter((row) => row.date < mutableFrom);
  for (const part of chunk(recent, 500)) {
    const { error } = await admin.from("ads_entity_daily").upsert(part, { onConflict: "entity_id,date" });
    if (error) throw new Error(`ads_entity_daily: ${error.message}`);
  }
  for (const part of chunk(frozen, 500)) {
    const { error } = await admin.from("ads_entity_daily").upsert(part, { onConflict: "entity_id,date", ignoreDuplicates: true });
    if (error) throw new Error(`ads_entity_daily: ${error.message}`);
  }
  return rows.length;
}

export async function noteAccountSync(
  admin: Db,
  accountId: string,
  outcome: { status: "ok" | "partial" | "failed"; error: string | null; syncedThrough?: string }
): Promise<void> {
  await admin
    .from("ads_accounts")
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: outcome.status,
      last_sync_error: outcome.error ? outcome.error.slice(0, 2000) : null,
      ...(outcome.syncedThrough ? { synced_through: outcome.syncedThrough } : {}),
    })
    .eq("id", accountId);
}

export async function startSyncRun(admin: Db, trigger: "cron" | "manual"): Promise<number | null> {
  const { data, error } = await admin.from("ads_sync_runs").insert({ trigger }).select("id").single();
  if (error || !data) return null;
  return (data as { id: number }).id;
}

export async function finishSyncRun(
  admin: Db,
  runId: number | null,
  outcome: { status: "ok" | "partial" | "failed"; accounts: number; rows: number; problems: string[] }
): Promise<void> {
  if (runId === null) return;
  await admin
    .from("ads_sync_runs")
    .update({
      finished_at: new Date().toISOString(),
      status: outcome.status,
      accounts_synced: outcome.accounts,
      rows_written: outcome.rows,
      problems: outcome.problems.length ? outcome.problems.join("\n").slice(0, 4000) : null,
    })
    .eq("id", runId);
}

// ---------------------------------------------------------------------------
// Rezultatul ales pe campanie și jurnalul acțiunilor
// ---------------------------------------------------------------------------

/** `key` null = înapoi la implicit. */
export async function setResultChoiceRecord(entityId: string, key: string | null, user: User): Promise<ModelResult<null>> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: UNCONFIGURED };
  if (key === null) {
    const { error } = await admin.from("ads_result_choices").delete().eq("entity_id", entityId);
    if (error) return modelFailure(error);
    return { ok: true, data: null };
  }
  const { error } = await admin
    .from("ads_result_choices")
    .upsert(
      { entity_id: entityId, result_key: key, updated_at: new Date().toISOString(), updated_by: user.id, updated_by_email: user.email },
      { onConflict: "entity_id" }
    );
  if (error) return modelFailure(error);
  return { ok: true, data: null };
}

export async function recordModelChange(input: {
  platform: Platform;
  workspace: string;
  adAccount: string;
  kind: "pause";
  summary: string;
  detail: Record<string, unknown>;
  user: User;
}): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { error } = await admin.from("ads_changes").insert({
    platform: input.platform,
    workspace: input.workspace,
    ad_account: input.adAccount,
    kind: input.kind,
    summary: input.summary,
    detail: input.detail,
    created_by: input.user.id,
    created_by_email: input.user.email,
  });
  return !error;
}
