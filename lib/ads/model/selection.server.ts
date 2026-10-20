import "server-only";

import { cookies } from "next/headers";
import { todayInBucharest } from "../metrics";
import {
  DEFAULT_PERIOD,
  SELECTION_COOKIE,
  parseChannel,
  parseClientId,
  parsePeriod,
  rangeOf,
  type DateRange,
  type Selection,
} from "./selection";

/** Alegerea din cookie (ultima făcută în bara de sus), fără adresă. */
export async function selectionFromCookie(): Promise<Selection> {
  const store = await cookies();
  let saved: Record<string, unknown> = {};
  try {
    saved = JSON.parse(store.get(SELECTION_COOKIE)?.value ?? "{}") as Record<string, unknown>;
  } catch {
    saved = {};
  }
  return {
    clientId: parseClientId(saved.client),
    channel: parseChannel(saved.canal) ?? "toate",
    period: parsePeriod(saved.perioada) ?? DEFAULT_PERIOD,
  };
}

/** Adresa câștigă; ce lipsește din ea vine din cookie. */
export async function readSelection(
  params: Record<string, string | string[] | undefined>
): Promise<Selection & { range: DateRange; today: string }> {
  const saved = await selectionFromCookie();
  const selection: Selection = {
    clientId: parseClientId(params.client) ?? saved.clientId,
    channel: parseChannel(params.canal) ?? saved.channel,
    period: parsePeriod(params.perioada) ?? saved.period,
  };
  const today = todayInBucharest();
  return { ...selection, range: rangeOf(selection.period, today), today };
}
