import "server-only";

import { createAdminClient } from "@/lib/supabase/clients";
import type { ConversionEvent, Objective } from "./constants";
import { adapterFor } from "./platform";
import { addDays, todayInBucharest } from "./metrics";
import type { Plan } from "./plan-schema";
import { WORKSPACES, workspaceName, type AdsWorkspace } from "./workspaces";
import { workspaceToken } from "./workspaces.server";

/**
 * Sincronizarea cifrelor: Meta Insights și TikTok Reporting → `ads_metrics_daily`.
 *
 * Rulează zilnic din cron și, la cerere, din „Sincronizează acum". Scrie cu
 * service role; cine o pornește a trecut deja de `CRON_SECRET` sau de
 * sesiunea de admin.
 *
 * INTERVALUL: ultimele 7 zile la fiecare rulare (Meta își mai corectează
 * cifrele câteva zile după — documentația spune „o pereche de zile”, cu
 * limita absolută la 28; conversiile de pe site se raportează în ziua în care
 * se întâmplă, nu în ziua clicului) PLUS golul de la ultima rulare reușită,
 * dacă cron-ul a lipsit câteva zile. Prima rulare aduce tot, de la crearea
 * celei mai vechi campanii.
 *
 * ISTORICUL: o zi mai veche de 7 zile se scrie o singură dată și nu se mai
 * atinge — baza refuză oricum (trigger-ul din migrarea 6). Zilele recente
 * se suprascriu cu cifrele noi.
 *
 * O zi fără livrare nu are rând (Meta nu întoarce nimic pentru ea): pe
 * ecran contează ca zero.
 */

/** Cât de departe în urmă păstrează Meta cifrele (37 de luni); nu cerem mai mult. */
const MAX_LOOKBACK_DAYS = 37 * 30;
/** Zilele care se mai pot schimba (atribuirea întârziată). */
const MUTABLE_DAYS = 7;
/** Între două sincronizări manuale. */
const MANUAL_COOLDOWN_MS = 2 * 60 * 1000;

export type SyncTrigger = "cron" | "manual";

export interface SyncOutcome {
  status: "ok" | "partial" | "failed";
  campaignsSynced: number;
  rowsWritten: number;
  /** Mesajele pentru om, câte unul pe problemă. */
  problems: string[];
  /** Spațiile cu campanii, dar fără token — sărite, nu eșuate. */
  skipped: string[];
}

interface CampaignRow {
  id: string;
  workspace: string;
  ad_account: string;
  platform_campaign_id: string;
  objective: Objective;
  status: string;
  created_at: string;
  plan_json: Plan;
}

const earliestOf = (...dates: string[]) => [...dates].sort()[0];
const latest = (...dates: string[]) => [...dates].sort()[dates.length - 1];

function dateOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date(iso));
}

export class SyncBusyError extends Error {
  constructor() {
    super("O sincronizare tocmai a rulat. Mai încearcă peste două minute.");
    this.name = "SyncBusyError";
  }
}

export async function runAdsSync(options: { trigger: SyncTrigger; workspaceIds?: string[] }): Promise<SyncOutcome> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Supabase nu e configurat pe server.");

  const today = todayInBucharest();
  const mutableFrom = addDays(today, -MUTABLE_DAYS);

  // Ultimele rulări: pentru golul de acoperit și pentru pauza dintre manuale.
  const { data: runs } = await supabase
    .from("ads_runs")
    .select("started_at, status")
    .order("started_at", { ascending: false })
    .limit(20);
  const recent = (runs ?? []) as Array<{ started_at: string; status: string }>;
  if (options.trigger === "manual" && recent[0] && Date.now() - Date.parse(recent[0].started_at) < MANUAL_COOLDOWN_MS) {
    throw new SyncBusyError();
  }
  const lastOk = recent.find((run) => run.status === "ok");

  const { data: runRow, error: runError } = await supabase
    .from("ads_runs")
    .insert({ status: "running" })
    .select("id")
    .single();
  if (runError || !runRow) throw new Error(runError?.message ?? "ads_runs: rândul rulării n-a putut fi scris.");
  const runId = (runRow as { id: number }).id;

  const outcome: SyncOutcome = { status: "ok", campaignsSynced: 0, rowsWritten: 0, problems: [], skipped: [] };

  try {
    let query = supabase
      .from("ads_campaigns")
      .select("id, workspace, ad_account, platform_campaign_id, objective, status, created_at, plan_json");
    if (options.workspaceIds?.length) query = query.in("workspace", options.workspaceIds);
    const { data: campaignRows, error: campaignError } = await query;
    if (campaignError) throw new Error(campaignError.message);
    const campaigns = (campaignRows ?? []) as CampaignRow[];

    // Pe spațiu, apoi pe cont: o cerere de cifre pe cont, nu una pe campanie.
    for (const workspace of WORKSPACES as readonly AdsWorkspace[]) {
      const own = campaigns.filter((campaign) => campaign.workspace === workspace.id);
      if (own.length === 0) continue;
      const adapter = adapterFor(workspace.platform);
      if (!workspaceToken(workspace)) {
        outcome.skipped.push(`${workspaceName(workspace)}: ${own.length} campanii, dar ${workspace.tokenEnv} nu e setat.`);
        continue;
      }

      const accounts = new Map<string, CampaignRow[]>();
      for (const campaign of own) accounts.set(campaign.ad_account, [...(accounts.get(campaign.ad_account) ?? []), campaign]);

      for (const [adAccount, list] of accounts) {
        // De unde: cel mai devreme dintre „ultimele 7 zile” și „golul de la
        // ultima rulare reușită”, dar nu înainte de prima campanie a contului
        // și nu mai vechi de cât păstrează Meta.
        const earliest = list.map((campaign) => dateOf(campaign.created_at)).sort()[0] ?? today;
        const gapFrom = lastOk ? addDays(dateOf(lastOk.started_at), -1) : earliest;
        const from = latest(earliest, addDays(today, -MAX_LOOKBACK_DAYS), earliestOf(mutableFrom, gapFrom));

        try {
          const byPlatformId = new Map(list.map((campaign) => [campaign.platform_campaign_id, campaign]));
          const rows = await adapter.fetchDaily(workspace, adAccount, {
            campaigns: list.map((campaign) => ({
              platformId: campaign.platform_campaign_id,
              objective: campaign.objective,
              event: (campaign.plan_json?.conversion?.event ?? null) as ConversionEvent | null,
            })),
            since: from,
            until: today,
          });

          const toRecord = (row: (typeof rows)[number]) => ({
            campaign_id: byPlatformId.get(row.platformId)?.id,
            date: row.date,
            spend: row.spend,
            impressions: row.impressions,
            clicks: row.clicks,
            results: row.results,
            cost_per_result: row.results > 0 ? Math.round((row.spend / row.results) * 10000) / 10000 : null,
            raw: row.raw,
            synced_at: new Date().toISOString(),
          });
          const records = rows.filter((row) => byPlatformId.has(row.platformId)).map(toRecord);
          const recentRecords = records.filter((record) => record.date >= mutableFrom);
          const frozenRecords = records.filter((record) => record.date < mutableFrom);

          if (recentRecords.length > 0) {
            const { error } = await supabase.from("ads_metrics_daily").upsert(recentRecords, { onConflict: "campaign_id,date" });
            if (error) throw new Error(`ads_metrics_daily: ${error.message}`);
          }
          if (frozenRecords.length > 0) {
            // Zilele vechi: doar cele care lipsesc. Cele existente rămân cum au fost scrise.
            const { error } = await supabase
              .from("ads_metrics_daily")
              .upsert(frozenRecords, { onConflict: "campaign_id,date", ignoreDuplicates: true });
            if (error) throw new Error(`ads_metrics_daily: ${error.message}`);
          }
          outcome.rowsWritten += records.length;

          // Statusul de livrare, cum îl vede platforma acum (după ce omul a pornit-o).
          const statuses = await adapter.fetchStatuses(workspace, adAccount, [...byPlatformId.keys()]);
          for (const [platformId, status] of statuses) {
            const campaign = byPlatformId.get(platformId);
            if (campaign && status && status !== campaign.status) {
              const { error } = await supabase.from("ads_campaigns").update({ status }).eq("id", campaign.id);
              if (error) throw new Error(`ads_campaigns: ${error.message}`);
            }
          }
          outcome.campaignsSynced += list.length;
        } catch (error) {
          outcome.problems.push(
            `${workspaceName(workspace)} · ${adAccount}: ${
              error instanceof Error && !/ApiError$|TokenMissingError$/.test(error.name)
                ? error.message
                : adapter.describeError(error, "citirea cifrelor", workspace.tokenEnv)
            }`
          );
        }
      }
    }

    outcome.status = outcome.problems.length === 0 ? "ok" : outcome.campaignsSynced > 0 ? "partial" : "failed";
  } catch (error) {
    outcome.status = "failed";
    outcome.problems.push(error instanceof Error ? error.message : String(error));
  }

  const note = [...outcome.problems, ...outcome.skipped].join("\n") || null;
  await supabase
    .from("ads_runs")
    .update({
      finished_at: new Date().toISOString(),
      status: outcome.status,
      campaigns_synced: outcome.campaignsSynced,
      error: note ? `[${options.trigger}] ${note}`.slice(0, 4000) : null,
    })
    .eq("id", runId);

  return outcome;
}
