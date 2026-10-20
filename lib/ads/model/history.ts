import "server-only";

import { createReadOnlySessionClient } from "@/lib/supabase/clients";
import type { Platform } from "../constants";
import { modelFailure, type ModelResult } from "./store";

/**
 * „Istoric”: tot ce a făcut portalul, în ordinea în care s-a întâmplat —
 * campaniile create, pauzele și celelalte modificări pe conturi (negative,
 * conversii) și actualizările cifrelor. Doar citiri, prin sesiune (RLS).
 */

export type HistoryKind = "create" | "change" | "sync";

export interface HistoryEvent {
  id: string;
  kind: HistoryKind;
  at: string;
  platform: Platform | null;
  title: string;
  detail: string | null;
  by: string | null;
  tone: "ok" | "warn" | "error" | "neutral";
  href: string | null;
  account: string | null;
}

const LIMIT = 150;

export async function readHistory(): Promise<ModelResult<{ events: HistoryEvent[]; missing: string[] }>> {
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return { ok: false, message: "Supabase nu e configurat pe server." };

  const [created, changes, googleChanges, runs] = await Promise.all([
    supabase
      .from("ads_campaigns")
      .select("id, platform, ad_account, name, created_at, created_by_email, creation, creation_error, channel")
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase.from("ads_changes").select("id, platform, ad_account, kind, summary, detail, created_at, created_by_email").order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("ads_google_changes").select("id, ad_account, kind, summary, operations, created_at, created_by_email").order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("ads_sync_runs").select("id, trigger, started_at, finished_at, status, accounts_synced, rows_written, problems").order("started_at", { ascending: false }).limit(LIMIT),
  ]);

  // Un tabel lipsă (o migrare neaplicată) nu golește tot istoricul: se spune ce lipsește.
  const missing: string[] = [];
  const events: HistoryEvent[] = [];
  const note = (error: { code?: string; message?: string } | null, label: string) => {
    if (!error) return false;
    const failure = modelFailure(error);
    missing.push(`${label}: ${failure.message}`);
    return true;
  };

  if (!note(created.error, "campaniile create")) {
    for (const row of (created.data ?? []) as Array<Record<string, string | null>>) {
      const partial = row.creation === "partial";
      events.push({
        id: `c-${row.id}`,
        kind: "create",
        at: String(row.created_at),
        platform: row.platform as Platform,
        title: `${row.channel === "search" ? "Campanie de căutare creată" : "Campanie creată"} pe pauză: ${row.name}`,
        detail: partial ? `Creată parțial — ${row.creation_error ?? "o parte din reclame lipsește"}` : null,
        by: row.created_by_email ?? null,
        tone: partial ? "warn" : "ok",
        href: `/admin/ads/${row.id}`,
        account: row.ad_account ?? null,
      });
    }
  }
  if (!note(changes.error, "pauzele")) {
    for (const row of (changes.data ?? []) as Array<Record<string, unknown>>) {
      const detail = row.detail as { skipped?: Array<{ name?: string; why?: string }> } | null;
      const skipped = detail?.skipped?.length ? `Sărite: ${detail.skipped.map((item) => `${item.name ?? "?"} (${item.why ?? "?"})`).join(", ")}.` : null;
      events.push({
        id: `m-${String(row.id)}`,
        kind: "change",
        at: String(row.created_at),
        platform: row.platform as Platform,
        title: String(row.summary),
        detail: skipped,
        by: (row.created_by_email as string | null) ?? null,
        tone: "neutral",
        href: null,
        account: String(row.ad_account),
      });
    }
  }
  if (!note(googleChanges.error, "modificările pe Google")) {
    for (const row of (googleChanges.data ?? []) as Array<Record<string, unknown>>) {
      events.push({
        id: `g-${String(row.id)}`,
        kind: "change",
        at: String(row.created_at),
        platform: "google",
        title: String(row.summary),
        detail: Number(row.operations) ? `${row.operations} operații trimise spre Google.` : null,
        by: (row.created_by_email as string | null) ?? null,
        tone: "neutral",
        href: `/admin/ads/cont?cont=${String(row.ad_account)}`,
        account: String(row.ad_account),
      });
    }
  }
  if (!note(runs.error, "actualizările")) {
    for (const row of (runs.data ?? []) as Array<Record<string, unknown>>) {
      const status = String(row.status);
      const accounts = Number(row.accounts_synced) || 0;
      events.push({
        id: `s-${String(row.id)}`,
        kind: "sync",
        at: String(row.started_at),
        platform: null,
        title: `${row.trigger === "cron" ? "Actualizarea de dimineață" : "Actualizare cerută"}: ${accounts === 1 ? "un cont citit" : `${accounts} conturi citite`}, ${Number(row.rows_written) || 0} zile scrise`,
        detail: row.problems ? String(row.problems) : status === "running" ? "Încă rulează (sau s-a oprit la limita de timp a serverului)." : null,
        by: row.trigger === "cron" ? "cron" : null,
        tone: status === "ok" ? "ok" : status === "partial" ? "warn" : status === "failed" ? "error" : "neutral",
        href: null,
        account: null,
      });
    }
  }

  events.sort((a, b) => b.at.localeCompare(a.at));
  return { ok: true, data: { events: events.slice(0, 300), missing } };
}
