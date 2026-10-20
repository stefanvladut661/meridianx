import "server-only";

import type { AdsWorkspace } from "../workspaces";
import type { Level } from "../model/types";
import { metaRunning } from "../model/status";
import type { PauseItem, PlatformPauseOutcome } from "../google/pause";
import { describeMetaError, metaRateLimit } from "./errors";
import { metaGet, metaPause } from "./graph";

/**
 * „Pune pe pauză” din ecranul v2, pe Meta: campanii, seturi sau reclame.
 *
 * Starea se citește din nou chiar înainte (`GET /?ids=…`): se trimite doar ce e
 * acum pornit și e în contul de pe ecran; ce e deja oprit, șters sau din alt cont
 * se sare, cu motivul. Câte o cerere pe obiect, prin `metaPause` (garda ei
 * permite doar `status: PAUSED`). Dacă Meta limitează cererile la jumătate,
 * restul rămân neatinse și mesajul spune când se poate relua.
 */

const FIELDS: Record<Level, string> = {
  campaign: "id,name,status,account_id",
  group: "id,name,status,account_id",
  ad: "id,name,status,account_id",
};

export async function pauseOnMeta(workspace: AdsWorkspace, adAccount: string, items: PauseItem[]): Promise<PlatformPauseOutcome> {
  const accountDigits = adAccount.replace(/^act_/, "");
  const states = new Map<string, { name: string; status: string; account: string }>();
  for (const level of ["campaign", "group", "ad"] as const) {
    const ids = items.filter((item) => item.level === level && /^\d+$/.test(item.platformId)).map((item) => item.platformId);
    for (let index = 0; index < ids.length; index += 50) {
      const rows = await metaGet<Record<string, { id?: string; name?: string; status?: string; account_id?: string }>>(workspace, "/", {
        ids: ids.slice(index, index + 50).join(","),
        fields: FIELDS[level],
      });
      for (const row of Object.values(rows)) {
        if (row?.id) states.set(`${level}|${row.id}`, { name: row.name ?? row.id, status: row.status ?? "", account: String(row.account_id ?? "") });
      }
    }
  }

  const outcome: PlatformPauseOutcome = { paused: [], skipped: [] };
  const queue: Array<PauseItem & { name: string }> = [];
  for (const item of items) {
    const state = states.get(`${item.level}|${item.platformId}`);
    if (!state) outcome.skipped.push({ ...item, name: item.platformId, why: "nu mai e în cont" });
    else if (state.account && state.account !== accountDigits) outcome.skipped.push({ ...item, name: state.name, why: "e în alt cont de reclame" });
    else if (!metaRunning(state.status)) outcome.skipped.push({ ...item, name: state.name, why: state.status === "PAUSED" ? "era deja pe pauză" : `are starea ${state.status}` });
    else queue.push({ ...item, name: state.name });
  }

  for (const [index, item] of queue.entries()) {
    try {
      await metaPause(workspace, item.platformId);
      outcome.paused.push(item);
    } catch (error) {
      const why = describeMetaError(error, "pauza", workspace.tokenEnv);
      outcome.skipped.push({ ...item, why: `nepus pe pauză — ${why}` });
      // La o limită de cereri, nu mai încercăm restul acum: rămân neatinse, cu motivul.
      const limit = metaRateLimit(error);
      if (limit) {
        for (const rest of queue.slice(index + 1)) {
          outcome.skipped.push({ ...rest, why: `nepus pe pauză — Meta limitează cererile; reîncearcă peste ${limit.minutes} minute` });
        }
        break;
      }
    }
  }
  return outcome;
}
