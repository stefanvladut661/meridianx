import "server-only";

import { createAdminClient, createReadOnlySessionClient } from "@/lib/supabase/clients";
import type { StoreFailure, StoreResult } from "./store";

/**
 * Jurnalul modificărilor portalului pe conturile Google existente (migrarea
 * 10): pauze, negative, liste legate, acțiuni de conversie. Scrierea prin
 * service role, DUPĂ ce acțiunea a verificat sesiunea; citirea prin sesiune
 * (RLS, `is_lead_admin()`).
 */

export type ChangeKind = "pause" | "negatives" | "negative_list_link" | "conversion_actions";

export interface AccountChange {
  id: string;
  workspace: string;
  adAccount: string;
  kind: ChangeKind;
  summary: string;
  detail: Record<string, unknown>;
  operations: number;
  createdAt: string;
  createdByEmail: string | null;
}

function reasonOf(error: { code?: string; message?: string }): StoreFailure {
  const message = error.message ?? "";
  if (error.code === "42P01" || error.code === "PGRST205" || /ads_google_changes/.test(message)) return "missing_search_migration";
  return "error";
}

export async function recordChange(input: {
  workspace: string;
  adAccount: string;
  kind: ChangeKind;
  summary: string;
  detail: Record<string, unknown>;
  operations: number;
  user: { id: string; email: string | null };
}): Promise<StoreResult<{ id: string }>> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, reason: "unconfigured" };
  const { data, error } = await supabase
    .from("ads_google_changes")
    .insert({
      workspace: input.workspace,
      ad_account: input.adAccount,
      kind: input.kind,
      summary: input.summary,
      detail: input.detail,
      operations: input.operations,
      created_by: input.user.id,
      created_by_email: input.user.email,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, reason: error ? reasonOf(error) : "error", detail: error?.message };
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function listChanges(adAccount: string, limit = 30): Promise<StoreResult<AccountChange[]>> {
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return { ok: false, reason: "unconfigured" };
  const { data, error } = await supabase
    .from("ads_google_changes")
    .select("id, workspace, ad_account, kind, summary, detail, operations, created_at, created_by_email")
    .eq("ad_account", adAccount)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { ok: false, reason: reasonOf(error), detail: error.message };
  return {
    ok: true,
    data: ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      workspace: String(row.workspace),
      adAccount: String(row.ad_account),
      kind: row.kind as ChangeKind,
      summary: String(row.summary),
      detail: (row.detail as Record<string, unknown>) ?? {},
      operations: Number(row.operations ?? 0),
      createdAt: String(row.created_at),
      createdByEmail: (row.created_by_email as string | null) ?? null,
    })),
  };
}
