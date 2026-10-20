import "server-only";

import { createAdminClient } from "@/lib/supabase/clients";
import { PLATFORM_LABEL, type Platform } from "../constants";
import { adapterFor } from "../platform";
import { findWorkspace, type AdsWorkspace } from "../workspaces";
import { workspaceToken } from "../workspaces.server";
import { pauseOnGoogle, type PauseItem, type PlatformPauseOutcome } from "../google/pause";
import { pauseOnMeta } from "../meta/pause";
import { canPause } from "./status";
import { recordModelChange } from "./store";
import type { Level, NormalizedStatus } from "./types";

/**
 * „Pune pe pauză” din ecranul v2 — singura acțiune a portalului pe campaniile
 * existente. Fiecare platformă are funcția ei separată de pauză, cu garda ei
 * (Google: `googlePause`), care poate trimite doar starea de pauză. Nimic nu
 * pornește, nu schimbă bugete și nu șterge.
 *
 * Rândurile vin din bază (id-uri din `ads_entities`), ca browserul să nu poată
 * cere pauza pe un obiect pe care portalul nu-l urmărește.
 */

export interface PauseRequestResult {
  paused: Array<{ id: string; name: string; level: Level }>;
  skipped: Array<{ id: string; name: string; level: Level; why: string }>;
  problems: string[];
}

interface Row {
  id: string;
  account_id: string;
  platform: Platform;
  level: Level;
  platform_id: string;
  name: string;
  status: NormalizedStatus;
}

interface AccountRow {
  id: string;
  platform: Platform;
  workspace: string;
  ad_account: string;
}

type Pauser = (workspace: AdsWorkspace, adAccount: string, items: PauseItem[]) => Promise<PlatformPauseOutcome>;

const PAUSERS: Partial<Record<Platform, Pauser>> = {
  google: pauseOnGoogle,
  meta: pauseOnMeta,
};

const LEVEL_WORD: Record<Level, [string, string]> = {
  campaign: ["campanie pusă", "campanii puse"],
  group: ["grup pus", "grupuri puse"],
  ad: ["reclamă pusă", "reclame puse"],
};

function summaryOf(paused: Array<{ level: Level }>): string {
  const parts = (["campaign", "group", "ad"] as const)
    .map((level) => {
      const count = paused.filter((item) => item.level === level).length;
      if (count === 0) return null;
      const [one, many] = LEVEL_WORD[level];
      return count === 1 ? `o ${one}` : `${count} ${many}`;
    })
    .filter(Boolean);
  const text = `${parts.join(", ")} pe pauză`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export async function pauseEntities(entityIds: string[], user: { id: string; email: string | null }): Promise<PauseRequestResult> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase nu e configurat pe server.");
  const result: PauseRequestResult = { paused: [], skipped: [], problems: [] };

  const { data: rows, error } = await admin
    .from("ads_entities")
    .select("id, account_id, platform, level, platform_id, name, status")
    .in("id", entityIds.slice(0, 200));
  if (error) throw new Error(error.message);
  const entities = (rows ?? []) as Row[];
  const accountIds = [...new Set(entities.map((row) => row.account_id))];
  const { data: accountRows, error: accountError } = accountIds.length
    ? await admin.from("ads_accounts").select("id, platform, workspace, ad_account").in("id", accountIds)
    : { data: [], error: null };
  if (accountError) throw new Error(accountError.message);
  const accounts = new Map(((accountRows ?? []) as AccountRow[]).map((row) => [row.id, row]));

  for (const accountId of accountIds) {
    const account = accounts.get(accountId);
    const own = entities.filter((row) => row.account_id === accountId);
    if (!account) continue;
    const workspace = findWorkspace(account.workspace);
    const pauser = PAUSERS[account.platform];
    const label = PLATFORM_LABEL[account.platform];

    const wanted = own.filter((row) => canPause(row.status));
    for (const row of own.filter((item) => !canPause(item.status))) {
      result.skipped.push({ id: row.id, name: row.name, level: row.level, why: "nu cheltuie acum (după ultima actualizare)" });
    }
    if (wanted.length === 0) continue;
    if (!workspace || !workspaceToken(workspace)) {
      result.problems.push(`${label} · ${account.ad_account}: ${workspace ? `${workspace.tokenEnv} nu e setat` : "spațiul nu mai există"} — nimic trimis.`);
      continue;
    }
    if (!pauser) {
      result.problems.push(`${label}: pauza din portal vine într-o fază următoare a portalului v2. Pune-le pe pauză din ${label}.`);
      continue;
    }

    try {
      const outcome = await pauser(workspace, account.ad_account, wanted.map((row) => ({ level: row.level, platformId: row.platform_id })));
      const byKey = new Map(wanted.map((row) => [`${row.level}|${row.platform_id}`, row]));
      const paused = outcome.paused.map((item) => ({ row: byKey.get(`${item.level}|${item.platformId}`)!, name: item.name })).filter((item) => item.row);
      for (const item of paused) result.paused.push({ id: item.row.id, name: item.name, level: item.row.level });
      for (const item of outcome.skipped) {
        const row = byKey.get(`${item.level}|${item.platformId}`);
        if (row) result.skipped.push({ id: row.id, name: item.name, level: row.level, why: item.why });
      }
      if (paused.length > 0) {
        // Rândurile trec pe „Pe pauză” imediat, fără să aștepte sincronizarea de mâine.
        await admin.from("ads_entities").update({ status: "paused" }).in("id", paused.map((item) => item.row.id));
        const campaigns = paused.filter((item) => item.row.level === "campaign").map((item) => item.row.platform_id);
        if (campaigns.length) {
          await admin.from("ads_campaigns").update({ status: "PAUSED" }).eq("platform", account.platform).eq("ad_account", account.ad_account).in("platform_campaign_id", campaigns);
        }
        await recordModelChange({
          platform: account.platform,
          workspace: account.workspace,
          adAccount: account.ad_account,
          kind: "pause",
          summary: summaryOf(paused.map((item) => item.row)),
          detail: {
            paused: paused.map((item) => ({ level: item.row.level, id: item.row.platform_id, name: item.name })),
            skipped: outcome.skipped,
          },
          user,
        });
      }
    } catch (failure) {
      result.problems.push(`${label} · ${account.ad_account}: ${adapterFor(account.platform).describeError(failure, "pauza", workspace.tokenEnv)}`);
    }
  }
  return result;
}
