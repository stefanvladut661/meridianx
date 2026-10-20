import "server-only";

import { createAdminClient } from "@/lib/supabase/clients";
import { addDays, todayInBucharest } from "../metrics";
import { adapterFor } from "../platform";
import { findWorkspace, workspaceName, type AdsWorkspace } from "../workspaces";
import { workspaceToken } from "../workspaces.server";
import { googleStructureReader } from "../google/structure";
import type { EntitySnapshot, Level, StructureReader } from "./types";
import { inheritStatus } from "./inherit";
import {
  accountsToSync,
  finishSyncRun,
  knownEntities,
  markGone,
  noteAccountSync,
  saveDaily,
  saveStructure,
  startSyncRun,
  type SyncAccount,
} from "./store";

/**
 * Sincronizarea modelului comun: structura (campanii, grupuri, reclame) și
 * cifrele pe zi ale conturilor urmărite → `ads_entities`, `ads_entity_daily`.
 *
 * Pornită de cron (`/admin/ads/sincronizare`, același din `vercel.json`) și de
 * „Actualizează” din bara de sus (doar conturile clientului ales). Scrie cu
 * service role; cine o pornește a trecut deja de `CRON_SECRET` sau de sesiune.
 *
 * INTERVALUL: prima dată ultimele 90 de zile; apoi ultimele 7 (platformele își
 * mai corectează cifrele câteva zile) plus golul de la ultima zi adusă fără
 * eroare. Zilele mai vechi de 7 se scriu o singură dată.
 *
 * TIMPUL: o rulare are o limită (Vercel oprește funcția la 60 de secunde).
 * Conturile merg întâi cele mai vechi; ce nu încape rămâne pentru rularea
 * următoare și e spus în jurnal, nu pierdut.
 */

const FIRST_DAYS = 90;
const MUTABLE_DAYS = 7;
const MANUAL_COOLDOWN_MS = 2 * 60 * 1000;

export interface ModelSyncOutcome {
  status: "ok" | "partial" | "failed";
  accounts: number;
  rows: number;
  problems: string[];
  /** Conturi rămase pentru rularea următoare (limita de timp). */
  leftover: number;
  /** Conturi sărite pentru că tocmai au fost actualizate. */
  fresh: number;
}

/** Cititorul platformei pentru un spațiu; null = platforma nu e încă în modelul comun. */
export function readerFor(workspace: AdsWorkspace): StructureReader | null {
  switch (workspace.platform) {
    case "google":
      return googleStructureReader(workspace);
    default:
      return null;
  }
}

function errorText(workspace: AdsWorkspace, error: unknown): string {
  if (error instanceof Error && !/ApiError$|TokenMissingError$|Credentials(Missing|Invalid)Error$|AccountHiddenError$/.test(error.name)) {
    return error.message;
  }
  return adapterFor(workspace.platform).describeError(error, "citirea contului", workspace.tokenEnv);
}

async function syncOne(admin: NonNullable<ReturnType<typeof createAdminClient>>, account: SyncAccount, today: string): Promise<number> {
  const workspace = findWorkspace(account.workspace);
  if (!workspace) throw new Error(`spațiul ${account.workspace} nu mai există în lib/ads/workspaces.ts`);
  if (workspace.platform !== account.platform) throw new Error(`spațiul ${account.workspace} nu e de ${account.platform}`);
  if (!workspaceToken(workspace)) throw new Error(`${workspace.tokenEnv} nu e setat pe server — contul nu se poate citi.`);
  const reader = readerFor(workspace);
  if (!reader) throw new Error(`${workspaceName(workspace)}: citirea contului vine într-o fază următoare a portalului v2.`);

  const since = account.syncedThrough
    ? [addDays(today, -MUTABLE_DAYS), addDays(account.syncedThrough, -1)].sort()[0]
    : addDays(today, -(FIRST_DAYS - 1));
  const from = [since, addDays(today, -(FIRST_DAYS - 1))].sort()[1];

  const structure = await reader.readStructure(account.adAccount);
  const days = await reader.readDaily(account.adAccount, from, today);

  // Rândurile pomenite de cifre sau știute din bază, pe care structura de acum
  // nu le mai are: șterse între timp. Le citim după id, ca să le știm starea.
  const seen = new Set(structure.entities.map((entity) => `${entity.level}|${entity.platformId}`));
  const known = await knownEntities(admin, account.id);
  const wanted = new Map<string, { level: Level; platformId: string }>();
  for (const day of days) {
    const key = `${day.level}|${day.platformId}`;
    if (!seen.has(key)) wanted.set(key, { level: day.level, platformId: day.platformId });
  }
  for (const entity of known) {
    const key = `${entity.level}|${entity.platformId}`;
    if (!seen.has(key) && entity.status !== "removed") wanted.set(key, { level: entity.level, platformId: entity.platformId });
  }
  let missing: EntitySnapshot[] = [];
  if (wanted.size > 0 && reader.readMissing) missing = await reader.readMissing(account.adAccount, [...wanted.values()]);
  const found = new Set(missing.map((entity) => `${entity.level}|${entity.platformId}`));

  const ids = await saveStructure(admin, account, { account: structure.account, entities: inheritStatus([...structure.entities, ...missing]) });
  const gone = known.filter((entity) => {
    const key = `${entity.level}|${entity.platformId}`;
    return !seen.has(key) && !found.has(key) && entity.status !== "removed";
  });
  if (gone.length > 0) await markGone(admin, gone.map((entity) => entity.id));
  for (const entity of known) {
    const key = `${entity.level}|${entity.platformId}`;
    if (!ids.has(key)) ids.set(key, entity.id);
  }

  const written = await saveDaily(admin, days, ids, addDays(today, -MUTABLE_DAYS));
  await noteAccountSync(admin, account.id, { status: "ok", error: null, syncedThrough: today });
  return written;
}

export async function runModelSync(options: {
  trigger: "cron" | "manual";
  clientId?: string;
  accountIds?: string[];
  /** Cât are voie să dureze rularea, în milisecunde. */
  budgetMs?: number;
}): Promise<ModelSyncOutcome> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase nu e configurat pe server.");
  const started = Date.now();
  const budget = options.budgetMs ?? 40_000;
  const today = todayInBucharest();
  const outcome: ModelSyncOutcome = { status: "ok", accounts: 0, rows: 0, problems: [], leftover: 0, fresh: 0 };

  let accounts = await accountsToSync(admin, { clientId: options.clientId, accountIds: options.accountIds });
  if (options.trigger === "manual") {
    const fresh = accounts.filter((account) => account.lastSyncedAt && Date.now() - Date.parse(account.lastSyncedAt) < MANUAL_COOLDOWN_MS);
    outcome.fresh = fresh.length;
    accounts = accounts.filter((account) => !fresh.includes(account));
  }
  if (accounts.length === 0) return outcome;

  const runId = await startSyncRun(admin, options.trigger);
  for (const [index, account] of accounts.entries()) {
    if (Date.now() - started > budget) {
      outcome.leftover = accounts.length - index;
      outcome.problems.push(`${outcome.leftover} ${outcome.leftover === 1 ? "cont a rămas" : "conturi au rămas"} pentru rularea următoare (limita de timp a unei rulări).`);
      break;
    }
    const workspace = findWorkspace(account.workspace);
    try {
      outcome.rows += await syncOne(admin, account, today);
      outcome.accounts += 1;
    } catch (error) {
      const text = workspace ? errorText(workspace, error) : error instanceof Error ? error.message : String(error);
      outcome.problems.push(`${workspace ? workspaceName(workspace) : account.workspace} · ${account.adAccount}: ${text}`);
      await noteAccountSync(admin, account.id, { status: "failed", error: text });
    }
  }

  const failed = outcome.problems.length - (outcome.leftover > 0 ? 1 : 0);
  outcome.status = failed === 0 && outcome.leftover === 0 ? "ok" : outcome.accounts > 0 ? "partial" : "failed";
  await finishSyncRun(admin, runId, { status: outcome.status, accounts: outcome.accounts, rows: outcome.rows, problems: outcome.problems });
  return outcome;
}
