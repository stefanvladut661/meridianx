import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createReadOnlySessionClient } from "@/lib/supabase/clients";
import type { Platform } from "../constants";
import { countCalls, type CallCount, type CallResult, type CallRow } from "./calls-shared";
import { modelFailure, readAll, type ModelResult } from "./store";

/**
 * Apelurile notate de mână (migrarea 14) — singurul loc care atinge `ads_calls`.
 * Citirile prin sesiune (RLS, `is_lead_admin()`), scrierile prin service role,
 * după ce acțiunea a verificat sesiunea. Nimic de aici nu ajunge la o platformă.
 */

export const CALLS_MIGRATION_MISSING =
  "Tabelul apelurilor lipsește: aplică migrarea 14 (supabase/migrations/00000000000014_ads_calls.sql) în Supabase → SQL Editor.";

function callsFailure(error: { code?: string; message?: string } | null | undefined): { ok: false; message: string } {
  const code = error?.code ?? "";
  if (code === "42P01" || code === "PGRST205" || /ads_calls/.test(error?.message ?? "")) return { ok: false, message: CALLS_MIGRATION_MISSING };
  return modelFailure(error);
}

interface CallDbRow {
  id: string;
  client_id: string;
  platform: Platform | null;
  entity_id: string | null;
  called_on: string;
  result: CallResult;
  note: string | null;
  created_at: string;
  created_by_email: string | null;
}

const COLUMNS = "id, client_id, platform, entity_id, called_on, result, note, created_at, created_by_email";

/** Apelurile unui client în perioadă, cele mai noi întâi, cu numele campaniei. */
export async function readCalls(input: { clientId: string; from: string; to: string; platform?: Platform | null }): Promise<ModelResult<CallRow[]>> {
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return { ok: false, message: "Supabase nu e configurat pe server (NEXT_PUBLIC_SUPABASE_URL, cheile)." };
  const { data, error } = await readAll<CallDbRow>((start, end) => {
    let query = supabase.from("ads_calls").select(COLUMNS).eq("client_id", input.clientId).gte("called_on", input.from).lte("called_on", input.to);
    if (input.platform) query = query.eq("platform", input.platform);
    return query.order("called_on", { ascending: false }).order("created_at", { ascending: false }).range(start, end);
  });
  if (error) return callsFailure(error);

  const entityIds = [...new Set(data.map((row) => row.entity_id).filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  for (let index = 0; index < entityIds.length; index += 200) {
    const { data: entities, error: entityError } = await supabase.from("ads_entities").select("id, name").in("id", entityIds.slice(index, index + 200));
    if (entityError) return modelFailure(entityError);
    for (const entity of (entities ?? []) as Array<{ id: string; name: string }>) names.set(entity.id, entity.name);
  }

  return {
    ok: true,
    data: data.map((row) => ({
      id: row.id,
      clientId: row.client_id,
      platform: row.platform,
      entityId: row.entity_id,
      campaignName: row.entity_id ? (names.get(row.entity_id) ?? null) : null,
      calledOn: row.called_on,
      result: row.result,
      note: row.note,
      createdAt: row.created_at,
      createdByEmail: row.created_by_email,
    })),
  };
}

export interface CampaignChoice {
  id: string;
  name: string;
  platform: Platform;
  accountId: string;
  removed: boolean;
}

/** Campaniile conturilor date, pentru lista din formular (doar nivelul campanie). */
export async function campaignChoices(accountIds: string[]): Promise<ModelResult<CampaignChoice[]>> {
  if (accountIds.length === 0) return { ok: true, data: [] };
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return { ok: false, message: "Supabase nu e configurat pe server." };
  const { data, error } = await readAll<{ id: string; name: string; platform: Platform; account_id: string; status: string }>((start, end) =>
    supabase.from("ads_entities").select("id, name, platform, account_id, status").in("account_id", accountIds).eq("level", "campaign").order("id").range(start, end)
  );
  if (error) return modelFailure(error);
  return {
    ok: true,
    data: data
      .map((row) => ({ id: row.id, name: row.name, platform: row.platform, accountId: row.account_id, removed: row.status === "removed" }))
      .sort((a, b) => Number(a.removed) - Number(b.removed) || a.name.localeCompare(b.name, "ro")),
  };
}

/**
 * „Apeluri notate” pe campanie, în perioadă. Lipsa tabelului nu oprește ecranul
 * Campanii: întoarce `missing`, iar coloana spune ce lipsește.
 */
export async function callCountsByCampaign(input: { clientId: string; from: string; to: string }): Promise<{ counts: Record<string, CallCount>; missing: string | null }> {
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return { counts: {}, missing: null };
  const { data, error } = await readAll<{ entity_id: string | null; result: CallResult }>((start, end) =>
    supabase
      .from("ads_calls")
      .select("entity_id, result")
      .eq("client_id", input.clientId)
      .gte("called_on", input.from)
      .lte("called_on", input.to)
      .not("entity_id", "is", null)
      .order("id")
      .range(start, end)
  );
  if (error) {
    const failure = callsFailure(error);
    return { counts: {}, missing: failure.message === CALLS_MIGRATION_MISSING ? failure.message : null };
  }
  const grouped = new Map<string, Array<{ result: CallResult }>>();
  for (const row of data) {
    if (!row.entity_id) continue;
    grouped.set(row.entity_id, [...(grouped.get(row.entity_id) ?? []), row]);
  }
  return { counts: Object.fromEntries([...grouped].map(([id, rows]) => [id, countCalls(rows)])), missing: null };
}

export interface NewCall {
  clientId: string;
  platform: Platform | null;
  entityId: string | null;
  calledOn: string;
  result: CallResult;
  note: string | null;
  createdBy: { id: string; email: string | null };
}

export async function insertCallRecord(admin: SupabaseClient, call: NewCall): Promise<ModelResult<{ id: string }>> {
  const { data, error } = await admin
    .from("ads_calls")
    .insert({
      client_id: call.clientId,
      platform: call.platform,
      entity_id: call.entityId,
      called_on: call.calledOn,
      result: call.result,
      note: call.note,
      created_by: call.createdBy.id,
      created_by_email: call.createdBy.email,
    })
    .select("id")
    .single();
  if (error || !data) return callsFailure(error);
  return { ok: true, data: { id: (data as { id: string }).id } };
}

/** Șterge o notă de apel scrisă greșit. Atinge doar nota din portal, nimic din platforme. */
export async function deleteCallRecord(admin: SupabaseClient, id: string): Promise<ModelResult<null>> {
  const { error } = await admin.from("ads_calls").delete().eq("id", id);
  if (error) return callsFailure(error);
  return { ok: true, data: null };
}

/** Campania aleasă în formular e a clientului și a canalului ales? */
export async function campaignOfClient(admin: SupabaseClient, entityId: string, clientId: string): Promise<ModelResult<{ platform: Platform } | null>> {
  const { data, error } = await admin.from("ads_entities").select("id, level, platform, account_id").eq("id", entityId).maybeSingle();
  if (error) return modelFailure(error);
  const entity = data as { level: string; platform: Platform; account_id: string } | null;
  if (!entity || entity.level !== "campaign") return { ok: true, data: null };
  const { data: account, error: accountError } = await admin.from("ads_accounts").select("client_id").eq("id", entity.account_id).maybeSingle();
  if (accountError) return modelFailure(accountError);
  if ((account as { client_id: string } | null)?.client_id !== clientId) return { ok: true, data: null };
  return { ok: true, data: { platform: entity.platform } };
}
