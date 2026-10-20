import { PLATFORMS, type Platform } from "../constants";
import { addDays } from "../metrics";

/**
 * Ce e ales în bara de sus: clientul, perioada și canalul. Tot ce e dedesubt
 * se schimbă după ele. Stau în adresă (`?client=…&perioada=30&canal=google`),
 * ca un link trimis cuiva să arate același lucru, și într-un cookie, ca trecerea
 * de la o pagină la alta să nu le piardă. Fișier izomorf.
 */

export type Channel = "toate" | Platform;

/** Ordinea din prompt: Toate / Meta / Google / TikTok. */
export const CHANNELS: readonly Channel[] = ["toate", "meta", "google", "tiktok"];

const KNOWN: readonly string[] = ["toate", ...PLATFORMS];

export const CHANNEL_LABEL: Record<Channel, string> = {
  toate: "Toate",
  meta: "Meta",
  google: "Google",
  tiktok: "TikTok",
};

export const PERIODS = ["7", "30", "90", "luna", "luna-trecuta"] as const;
export type PeriodKey = (typeof PERIODS)[number];

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  "7": "Ultimele 7 zile",
  "30": "Ultimele 30 de zile",
  "90": "Ultimele 90 de zile",
  luna: "Luna aceasta",
  "luna-trecuta": "Luna trecută",
};

export const DEFAULT_PERIOD: PeriodKey = "7";

export const SELECTION_COOKIE = "meridian_ads_alegere";

export interface Selection {
  clientId: string | null;
  channel: Channel;
  period: PeriodKey;
}

export interface DateRange {
  from: string;
  to: string;
  /** Aceeași durată, chiar înainte — pentru comparație. */
  previousFrom: string;
  previousTo: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseChannel(value: unknown): Channel | null {
  return typeof value === "string" && KNOWN.includes(value) ? (value as Channel) : null;
}

export function parsePeriod(value: unknown): PeriodKey | null {
  return typeof value === "string" && (PERIODS as readonly string[]).includes(value) ? (value as PeriodKey) : null;
}

export function parseClientId(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value) ? value : null;
}

function daysInclusive(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Intervalul perioadei, cu tot cu ziua de azi, și perioada de aceeași durată de dinainte. */
export function rangeOf(period: PeriodKey, today: string): DateRange {
  let from: string;
  let to = today;
  if (period === "luna") {
    from = `${today.slice(0, 7)}-01`;
  } else if (period === "luna-trecuta") {
    to = addDays(`${today.slice(0, 7)}-01`, -1);
    from = `${to.slice(0, 7)}-01`;
  } else {
    from = addDays(today, -(Number(period) - 1));
  }
  const length = daysInclusive(from, to);
  return { from, to, previousFrom: addDays(from, -length), previousTo: addDays(from, -1) };
}

/** Parametrii de adresă ai alegerii, păstrând ce mai era în adresă. */
export function selectionQuery(selection: Selection, keep?: URLSearchParams): string {
  const params = new URLSearchParams(keep);
  if (selection.clientId) params.set("client", selection.clientId);
  params.set("perioada", selection.period);
  params.set("canal", selection.channel);
  return params.toString();
}
