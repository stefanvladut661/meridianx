import "server-only";

import type { AdsWorkspace } from "../workspaces";
import type { Level } from "../model/types";
import { tiktokRunning } from "../model/status";
import type { PauseItem, PlatformPauseOutcome } from "../google/pause";
import { TIKTOK_PAUSE_PATH_BY_LEVEL, type TikTokPausePath } from "../meta/paused";
import { describeTikTokError, tiktokRateLimit } from "./errors";
import { tiktokGetAll, tiktokPause } from "./api";

/**
 * „Pune pe pauză” din ecranul v2, pe TikTok: campanii, grupuri sau reclame.
 *
 * Starea se citește din nou chiar înainte: se trimite doar ce e acum pornit;
 * ce e deja oprit sau șters se sare, cu motivul. Câte o cerere la cel mult 20 de
 * id-uri, prin `tiktokPause` (garda ei permite doar `operation_status: DISABLE`).
 */

const READ: Record<Level, { path: string; key: string; field: string; name: string }> = {
  campaign: { path: "/campaign/get/", key: "campaign_ids", field: "campaign_id", name: "campaign_name" },
  group: { path: "/adgroup/get/", key: "adgroup_ids", field: "adgroup_id", name: "adgroup_name" },
  ad: { path: "/ad/get/", key: "ad_ids", field: "ad_id", name: "ad_name" },
};

const PAUSE: Record<Level, TikTokPausePath> = TIKTOK_PAUSE_PATH_BY_LEVEL;

export async function pauseOnTikTok(workspace: AdsWorkspace, advertiserId: string, items: PauseItem[]): Promise<PlatformPauseOutcome> {
  const outcome: PlatformPauseOutcome = { paused: [], skipped: [] };
  for (const level of ["campaign", "group", "ad"] as const) {
    const wanted = items.filter((item) => item.level === level && /^\d+$/.test(item.platformId));
    if (wanted.length === 0) continue;
    const read = READ[level];
    const states = new Map<string, { name: string; operation: string; secondary: string }>();
    for (let index = 0; index < wanted.length; index += 100) {
      const rows = await tiktokGetAll<Record<string, unknown>>(
        workspace,
        read.path,
        {
          advertiser_id: advertiserId,
          fields: [read.field, read.name, "operation_status", "secondary_status"],
          filtering: { [read.key]: wanted.slice(index, index + 100).map((item) => item.platformId) },
        },
        "list",
        100,
        100
      );
      for (const row of rows) {
        states.set(String(row[read.field]), { name: String(row[read.name] ?? row[read.field]), operation: String(row.operation_status ?? ""), secondary: String(row.secondary_status ?? "") });
      }
    }
    const queue: Array<PauseItem & { name: string }> = [];
    for (const item of wanted) {
      const state = states.get(item.platformId);
      if (!state) outcome.skipped.push({ ...item, name: item.platformId, why: "nu mai e în cont (sau e ștearsă)" });
      else if (!tiktokRunning(state.operation)) outcome.skipped.push({ ...item, name: state.name, why: "era deja pe pauză" });
      else queue.push({ ...item, name: state.name });
    }
    for (let index = 0; index < queue.length; index += 20) {
      const batch = queue.slice(index, index + 20);
      try {
        const result = await tiktokPause(workspace, PAUSE[level], advertiserId, batch.map((item) => item.platformId));
        const done = new Set(result.ids.length ? result.ids : batch.map((item) => item.platformId));
        for (const item of batch) {
          if (done.has(item.platformId)) outcome.paused.push(item);
          else outcome.skipped.push({ ...item, why: "TikTok n-a confirmat pauza" });
        }
      } catch (error) {
        const limit = tiktokRateLimit(error);
        const why = limit
          ? `nepus pe pauză — TikTok limitează cererile; reîncearcă peste ${limit.minutes} minute`
          : `nepus pe pauză — ${describeTikTokError(error, "pauza", workspace.tokenEnv)}`;
        for (const item of queue.slice(index)) outcome.skipped.push({ ...item, why });
        break;
      }
    }
  }
  return outcome;
}
