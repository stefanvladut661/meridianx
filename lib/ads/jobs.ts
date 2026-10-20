import "server-only";

import { createAdminClient, createReadOnlySessionClient } from "@/lib/supabase/clients";
import type { Platform } from "./constants";
import type { CreatedObject } from "./types";

/**
 * Lucrările de creare pe pași (migrarea 13) — singurul loc care atinge `ads_jobs`.
 *
 * O lucrare ține pașii unei creări și ce s-a creat deja, ca să poată fi reluată
 * de unde a rămas după o limită de cereri a platformei. Scriere prin service
 * role, după ce acțiunea a verificat sesiunea; citirea pentru ecran, prin RLS.
 */

export type StepStatus = "pending" | "sent" | "done";

export interface JobStep {
  /** `thumb:0`, `campaign`, `adset`, `creative:1`, `ad:1`. */
  key: string;
  kind: CreatedObject["kind"];
  /** Numele obiectului pe platformă (după el se caută un pas „trimis” fără răspuns). */
  name: string;
  /** Ce vede omul („reclama 2 din 3”). */
  label: string;
  status: StepStatus;
  id?: string;
}

export interface JobRow<State> {
  id: string;
  platform: Platform;
  workspace: string;
  adAccount: string;
  fingerprint: string;
  planName: string;
  status: "running" | "waiting" | "done" | "failed";
  state: State;
  stepsTotal: number;
  stepsDone: number;
  waitUntil: string | null;
  message: string | null;
  recordId: string | null;
  createdAt: string;
  createdBy: string | null;
  createdByEmail: string | null;
}

export const JOBS_MIGRATION_MISSING =
  "Tabelul lucrărilor de creare lipsește: aplică migrarea 13 (supabase/migrations/00000000000013_ads_jobs.sql) în Supabase → SQL Editor.";

const COLUMNS =
  "id, platform, workspace, ad_account, fingerprint, plan_name, status, state, steps_total, steps_done, wait_until, message, record_id, created_at, created_by, created_by_email";

function toJob<State>(row: Record<string, unknown>): JobRow<State> {
  return {
    id: String(row.id),
    platform: row.platform as Platform,
    workspace: String(row.workspace),
    adAccount: String(row.ad_account),
    fingerprint: String(row.fingerprint),
    planName: String(row.plan_name),
    status: row.status as JobRow<State>["status"],
    state: (row.state ?? {}) as State,
    stepsTotal: Number(row.steps_total) || 0,
    stepsDone: Number(row.steps_done) || 0,
    waitUntil: (row.wait_until as string | null) ?? null,
    message: (row.message as string | null) ?? null,
    recordId: (row.record_id as string | null) ?? null,
    createdAt: String(row.created_at),
    createdBy: (row.created_by as string | null) ?? null,
    createdByEmail: (row.created_by_email as string | null) ?? null,
  };
}

function missing(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || /ads_jobs/.test(error.message ?? "")));
}

export type JobResult<T> = { ok: true; data: T } | { ok: false; message: string };

/** Lucrarea deschisă (în lucru sau în așteptare) a aceluiași plan, dacă există. */
export async function openJobFor<State>(fingerprint: string): Promise<JobResult<JobRow<State> | null>> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Supabase nu e configurat pe server." };
  const { data, error } = await admin.from("ads_jobs").select(COLUMNS).eq("fingerprint", fingerprint).in("status", ["running", "waiting"]).limit(1).maybeSingle();
  if (error) return { ok: false, message: missing(error) ? JOBS_MIGRATION_MISSING : error.message };
  return { ok: true, data: data ? toJob<State>(data as Record<string, unknown>) : null };
}

export async function createJob<State>(input: {
  platform: Platform;
  workspace: string;
  adAccount: string;
  fingerprint: string;
  planName: string;
  state: State;
  stepsTotal: number;
  user: { id: string; email: string | null };
}): Promise<JobResult<JobRow<State>>> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Supabase nu e configurat pe server." };
  const { data, error } = await admin
    .from("ads_jobs")
    .insert({
      platform: input.platform,
      workspace: input.workspace,
      ad_account: input.adAccount,
      fingerprint: input.fingerprint,
      plan_name: input.planName,
      state: input.state,
      steps_total: input.stepsTotal,
      created_by: input.user.id,
      created_by_email: input.user.email,
    })
    .select(COLUMNS)
    .single();
  if (error?.code === "23505") return { ok: false, message: "Planul ăsta are deja o creare în lucru. Reia-o din Planuri, nu o porni a doua oară." };
  if (error || !data) return { ok: false, message: missing(error) ? JOBS_MIGRATION_MISSING : (error?.message ?? "lucrarea nu s-a putut nota") };
  return { ok: true, data: toJob<State>(data as Record<string, unknown>) };
}

export async function readJob<State>(id: string): Promise<JobResult<JobRow<State> | null>> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Supabase nu e configurat pe server." };
  const { data, error } = await admin.from("ads_jobs").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) return { ok: false, message: missing(error) ? JOBS_MIGRATION_MISSING : error.message };
  return { ok: true, data: data ? toJob<State>(data as Record<string, unknown>) : null };
}

/**
 * Lucrarea e a celui care o rulează acum, pentru cel mult `seconds` secunde:
 * două ferestre deschise pe aceeași lucrare nu trimit aceiași pași în paralel.
 * false = altcineva o rulează chiar acum.
 */
export async function claimJob(id: string, seconds: number): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const now = new Date();
  const { data, error } = await admin
    .from("ads_jobs")
    .update({ lease_until: new Date(now.getTime() + seconds * 1000).toISOString() })
    .eq("id", id)
    .or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`)
    .select("id");
  return !error && Array.isArray(data) && data.length === 1;
}

/** Starea după fiecare pas: pasul „trimis” se scrie ÎNAINTE de cerere, „gata” după. */
export async function saveJob<State>(
  id: string,
  patch: Partial<{ status: JobRow<State>["status"]; state: State; stepsDone: number; waitUntil: string | null; message: string | null; recordId: string | null; release: boolean }>
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase nu e configurat pe server.");
  const update: Record<string, unknown> = {};
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.state !== undefined) update.state = patch.state;
  if (patch.stepsDone !== undefined) update.steps_done = patch.stepsDone;
  if (patch.waitUntil !== undefined) update.wait_until = patch.waitUntil;
  if (patch.message !== undefined) update.message = patch.message;
  if (patch.recordId !== undefined) update.record_id = patch.recordId;
  if (patch.release) update.lease_until = null;
  const { error } = await admin.from("ads_jobs").update(update).eq("id", id);
  if (error) throw new Error(`ads_jobs: ${error.message}`);
}

/** Lucrările neterminate (în lucru, în așteptare, oprite) — pentru „Planuri”. Prin sesiune. */
export async function listUnfinishedJobs(limit = 50): Promise<JobResult<Array<JobRow<unknown>>>> {
  const supabase = await createReadOnlySessionClient();
  if (!supabase) return { ok: false, message: "Supabase nu e configurat pe server." };
  const { data, error } = await supabase.from("ads_jobs").select(COLUMNS).neq("status", "done").order("created_at", { ascending: false }).limit(limit);
  if (error) return { ok: false, message: missing(error) ? JOBS_MIGRATION_MISSING : error.message };
  return { ok: true, data: ((data ?? []) as Array<Record<string, unknown>>).map((row) => toJob<unknown>(row)) };
}
