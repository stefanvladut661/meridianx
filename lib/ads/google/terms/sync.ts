import "server-only";

import { createAdminClient } from "@/lib/supabase/clients";
import { addDays, todayInBucharest } from "../../metrics";
import { latestTermDate, noteTermSync, termAccounts, writeTerms } from "../../terms-store";
import { findWorkspace } from "../../workspaces";
import { workspaceToken } from "../../workspaces.server";
import { describeGoogleError } from "../errors";
import { findGoogleAccount } from "../lookup";
import { fetchSearchTerms } from "./fetch";

/**
 * Sincronizarea termenilor de căutare: `search_term_view` → `ads_search_terms`.
 *
 * Pornită de același cron ca cifrele (`/admin/ads/sincronizare`) și, la
 * cerere, de „Sincronizează termenii” de pe /admin/ads/termeni. Prima dată
 * aduce ultimele 30 de zile; apoi ultimele 7 (Google mai corectează cifrele
 * câteva zile) plus golul de la ultima zi sincronizată.
 */

const FIRST_DAYS = 30;
const MUTABLE_DAYS = 7;

export interface TermsSyncOutcome {
  accounts: number;
  rows: number;
  problems: string[];
}

export async function runSearchTermsSync(options: { adAccounts?: string[] } = {}): Promise<TermsSyncOutcome> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase nu e configurat pe server.");
  const outcome: TermsSyncOutcome = { accounts: 0, rows: 0, problems: [] };
  const today = todayInBucharest();

  let targets = await termAccounts(admin);
  if (options.adAccounts) targets = targets.filter((target) => options.adAccounts?.includes(target.adAccount));

  for (const target of targets) {
    const workspace = findWorkspace(target.workspace);
    if (!workspace || workspace.platform !== "google" || !workspaceToken(workspace)) {
      outcome.problems.push(`${target.adAccount}: spațiul ${target.workspace} nu are cheie Google.`);
      continue;
    }
    try {
      const account = await findGoogleAccount(workspace, target.adAccount);
      if (!account) throw new Error(`cheia spațiului nu vede contul ${target.adAccount}`);
      const last = await latestTermDate(admin, target.adAccount);
      const since = last ? [addDays(today, -MUTABLE_DAYS), addDays(last, -1)].sort()[0] : addDays(today, -FIRST_DAYS);
      const from = [since, addDays(today, -FIRST_DAYS)].sort()[1];
      const terms = await fetchSearchTerms(workspace, account, from, today);
      const written = await writeTerms(admin, target.workspace, target.adAccount, terms);
      if (!written.ok) throw new Error(`ads_search_terms: ${written.detail ?? written.reason}`);
      outcome.rows += written.data.rows;
      outcome.accounts += 1;
      await noteTermSync(admin, target.workspace, target.adAccount, null);
    } catch (error) {
      const message = error instanceof Error && !/ApiError$|Credentials/.test(error.name) ? error.message : describeGoogleError(error, "citirea termenilor", workspace.tokenEnv);
      outcome.problems.push(`${target.adAccount}: ${message}`);
      await noteTermSync(admin, target.workspace, target.adAccount, message.slice(0, 1000));
    }
  }
  return outcome;
}
