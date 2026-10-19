import { CURRENCIES, LANGUAGE_LABEL, type Currency } from "../../constants";
import { asArray, asNumber, asRecord, asString, asStringList, getIn } from "../../plan-path";
import { buildFinalUrl, formatMoney, monthlyBudget, UTM_KEYS, type UtmKey } from "../../plan-derive";
import { joinRo, locationLabel } from "../../plan-summary";
import { findWorkspace } from "../../workspaces";
import {
  BIDDING_LABEL,
  DAYS,
  DAY_LABEL,
  LOCATION_MODE_LABEL,
  SNIPPET_HEADER_LABEL,
  type BiddingStrategy,
  type Day,
  type LocationMode,
  type MatchType,
  type SnippetHeader,
} from "./limits";
import { checkPhone } from "./phone";
import { hostOf } from "./text";

/**
 * Planul de căutare spus în română, din datele BRUTE — și dintr-un plan cu
 * greșeli: ce lipsește apare ca lipsă, nu completat din burtă. Previzualizarea
 * îl folosește pe tot; numărul de operații îl dă validarea (`build.ts`).
 */

export interface SummaryKeyword {
  text: string;
  match: MatchType;
}

export interface SummaryAd {
  headlines: Array<{ text: string; pin: number | null }>;
  descriptions: Array<{ text: string; pin: number | null }>;
  path1: string | null;
  path2: string | null;
  finalUrl: string | null;
  /** „example.com › montaj › oras” — cum apare adresa în rezultatul de căutare. */
  displayUrl: string | null;
  /** Originea paginii („https://www.example.com”), rândul mic de sub numele site-ului. */
  origin: string | null;
}

export interface SummaryAdGroup {
  path: string;
  name: string;
  finalUrl: string | null;
  maxCpc: string | null;
  keywords: SummaryKeyword[];
  negatives: SummaryKeyword[];
  ads: SummaryAd[];
}

export interface SummaryCampaign {
  path: string;
  key: string | null;
  name: string;
  budget: string | null;
  monthly: string | null;
  bidding: string | null;
  networks: string[];
  places: string[];
  excluded: string[];
  locationMode: string | null;
  languages: string | null;
  schedule: string[];
  lists: Array<{ key: string; name: string | null; count: number }>;
  negatives: SummaryKeyword[];
  sitelinks: Array<{ text: string; description: string | null; url: string | null }>;
  callouts: string[];
  snippets: Array<{ header: string; values: string[] }>;
  call: { phone: string; tracked: boolean } | null;
  adGroups: SummaryAdGroup[];
}

export interface SearchSummary {
  workspaceId: string | null;
  account: string | null;
  currency: Currency | null;
  totals: {
    campaigns: number;
    adGroups: number;
    keywords: number;
    negatives: number;
    ads: number;
    dailyBudget: number;
  };
  dailyBudget: string | null;
  monthly: string | null;
  cap: string | null;
  /** Plafonul spațiului, ca număr, în moneda planului. */
  capAmount: number | null;
  overCap: boolean;
  lists: Array<{ key: string; name: string; count: number; usedBy: string[] }>;
  campaigns: SummaryCampaign[];
}

function keywordsOf(value: unknown): SummaryKeyword[] {
  return asArray(value).flatMap((item) => {
    const record = asRecord(item);
    const text = asString(record?.text);
    const match = record?.match;
    return text && (match === "broad" || match === "phrase" || match === "exact") ? [{ text, match }] : [];
  });
}

function utmOf(value: unknown): Partial<Record<UtmKey, string>> {
  const record = asRecord(value) ?? {};
  const utm: Partial<Record<UtmKey, string>> = {};
  for (const key of UTM_KEYS) {
    const text = asString(record[key]);
    if (text) utm[key] = text;
  }
  return utm;
}

/** „luni–vineri 07:30–19:00”, „sâmbătă 09:00–14:00”. */
export function scheduleLabel(item: unknown): string | null {
  const record = asRecord(item);
  const days = asArray(record?.days).filter((day): day is Day => (DAYS as readonly unknown[]).includes(day));
  const from = asString(record?.from);
  const to = asString(record?.to);
  if (days.length === 0 || !from || !to) return null;
  const sorted = [...new Set(days)].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));
  const runs: Day[][] = [];
  for (const day of sorted) {
    const last = runs[runs.length - 1];
    if (last && DAYS.indexOf(day) === DAYS.indexOf(last[last.length - 1]) + 1) last.push(day);
    else runs.push([day]);
  }
  const text = runs
    .map((run) => (run.length >= 3 ? `${DAY_LABEL[run[0]]}–${DAY_LABEL[run[run.length - 1]]}` : run.map((day) => DAY_LABEL[day]).join(", ")))
    .join(", ");
  return `${text} ${from}–${to}`;
}

function displayUrl(url: string | null, path1: string | null, path2: string | null): string | null {
  const host = url ? hostOf(url) : null;
  if (!host) return null;
  return [host, path1, path1 ? path2 : null].filter(Boolean).join(" › ");
}

function originOf(url: string | null): string | null {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

export function summarizeSearchPlan(raw: Record<string, unknown>): SearchSummary {
  const currency = CURRENCIES.includes(raw.currency as Currency) ? (raw.currency as Currency) : null;
  const workspace = findWorkspace(raw.workspace);
  const lists = asArray(raw.shared_negative_lists).flatMap((list) => {
    const record = asRecord(list);
    const key = asString(record?.key);
    return key ? [{ key, name: asString(record?.name) ?? key, count: keywordsOf(record?.keywords).length, usedBy: [] as string[] }] : [];
  });

  const campaigns: SummaryCampaign[] = asArray(raw.campaigns).map((campaign, campaignIndex) => {
    const record = asRecord(campaign) ?? {};
    const path = `campaigns.${campaignIndex}`;
    const name = asString(record.name) ?? `Campania ${campaignIndex + 1}`;
    const daily = asNumber(record.daily_budget);
    const strategy = getIn(record, "bidding.strategy");
    const cap = asNumber(getIn(record, "bidding.max_cpc"));
    const campaignUtm = utmOf(record.utm);
    const mode = record.location_mode ?? "presence";
    const languages = asStringList(record.languages);

    const linked = asStringList(record.negative_lists);
    for (const key of linked) lists.find((list) => list.key === key)?.usedBy.push(name);

    const adGroups: SummaryAdGroup[] = asArray(record.ad_groups).map((group, groupIndex) => {
      const groupRecord = asRecord(group) ?? {};
      const groupUrl = asString(groupRecord.final_url);
      const utm = { ...campaignUtm, ...utmOf(groupRecord.utm) };
      const groupCpc = asNumber(groupRecord.max_cpc);
      return {
        path: `${path}.ad_groups.${groupIndex}`,
        name: asString(groupRecord.name) ?? `Grupul ${groupIndex + 1}`,
        finalUrl: groupUrl ? buildFinalUrl(groupUrl, utm) : null,
        maxCpc: groupCpc !== null ? `${formatMoney(groupCpc, currency)} pe clic` : null,
        keywords: keywordsOf(groupRecord.keywords),
        negatives: keywordsOf(groupRecord.negatives),
        ads: asArray(groupRecord.ads).map((ad) => {
          const adRecord = asRecord(ad) ?? {};
          const url = asString(adRecord.final_url) ?? groupUrl;
          const path1 = asString(adRecord.path1);
          const path2 = asString(adRecord.path2);
          return {
            headlines: asArray(adRecord.headlines).flatMap((item) => {
              const text = asString(asRecord(item)?.text);
              return text ? [{ text, pin: asNumber(asRecord(item)?.pin) }] : [];
            }),
            descriptions: asArray(adRecord.descriptions).flatMap((item) => {
              const text = asString(item) ?? asString(asRecord(item)?.text);
              return text ? [{ text, pin: asNumber(asRecord(item)?.pin) }] : [];
            }),
            path1,
            path2,
            finalUrl: url ? buildFinalUrl(url, utm) : null,
            displayUrl: displayUrl(url, path1, path2),
            origin: originOf(url),
          };
        }),
      };
    });

    const call = asRecord(getIn(record, "assets.call"));
    const phone = asString(call?.phone);
    const phoneCheck = phone ? checkPhone(asString(call?.country) ?? "RO", phone) : null;

    return {
      path,
      key: asString(record.key),
      name,
      budget: daily !== null ? `${formatMoney(daily, currency)} pe zi` : null,
      monthly: daily !== null ? `≈ ${formatMoney(monthlyBudget(daily), currency)} pe lună` : null,
      bidding:
        typeof strategy === "string" && strategy in BIDDING_LABEL
          ? `${BIDDING_LABEL[strategy as BiddingStrategy]}${
              cap !== null ? (strategy === "maximize_clicks" ? `, cel mult ${formatMoney(cap, currency)} pe clic` : `, ${formatMoney(cap, currency)} pe clic`) : ""
            }`
          : null,
      networks: [
        "Căutarea Google",
        ...(getIn(record, "networks.search_partners") === true ? ["partenerii de căutare"] : []),
        ...(getIn(record, "networks.display") === true ? ["rețeaua de display"] : []),
      ],
      places: asArray(record.locations).map(locationLabel).filter((label): label is string => Boolean(label)),
      excluded: asArray(record.excluded_locations).map(locationLabel).filter((label): label is string => Boolean(label)),
      locationMode: typeof mode === "string" && mode in LOCATION_MODE_LABEL ? LOCATION_MODE_LABEL[mode as LocationMode] : null,
      languages: languages.length > 0 ? joinRo(languages.map((code) => LANGUAGE_LABEL[code] ?? code)) : null,
      schedule: asArray(record.schedule).map(scheduleLabel).filter((label): label is string => Boolean(label)),
      lists: linked.map((key) => {
        const list = lists.find((item) => item.key === key);
        return { key, name: list?.name ?? null, count: list?.count ?? 0 };
      }),
      negatives: keywordsOf(record.negatives),
      sitelinks: asArray(getIn(record, "assets.sitelinks")).flatMap((item) => {
        const sitelink = asRecord(item);
        const text = asString(sitelink?.text);
        if (!text) return [];
        const description = [asString(sitelink?.description1), asString(sitelink?.description2)].filter(Boolean).join(" · ");
        return [{ text, description: description || null, url: asString(sitelink?.url) }];
      }),
      callouts: asStringList(getIn(record, "assets.callouts")),
      snippets: asArray(getIn(record, "assets.snippets")).flatMap((item) => {
        const snippet = asRecord(item);
        const header = snippet?.header;
        const values = asStringList(snippet?.values);
        return typeof header === "string" && values.length > 0
          ? [{ header: SNIPPET_HEADER_LABEL[header as SnippetHeader] ?? header, values }]
          : [];
      }),
      call: phone ? { phone: phoneCheck?.ok ? phoneCheck.display : phone, tracked: call?.conversion_action_id !== undefined } : null,
      adGroups,
    };
  });

  const total = asArray(raw.campaigns).reduce<number>((sum, campaign) => sum + (asNumber(asRecord(campaign)?.daily_budget) ?? 0), 0);
  const capValue = workspace && currency ? workspace.dailyBudgetCap[currency] : undefined;
  const dailyBudget = Math.round(total * 100) / 100;

  return {
    workspaceId: workspace?.id ?? null,
    account: asString(raw.ad_account),
    currency,
    totals: {
      campaigns: campaigns.length,
      adGroups: campaigns.reduce((sum, campaign) => sum + campaign.adGroups.length, 0),
      keywords: campaigns.reduce((sum, campaign) => sum + campaign.adGroups.reduce((inner, group) => inner + group.keywords.length, 0), 0),
      negatives:
        lists.reduce((sum, list) => sum + list.count, 0) +
        campaigns.reduce(
          (sum, campaign) => sum + campaign.negatives.length + campaign.adGroups.reduce((inner, group) => inner + group.negatives.length, 0),
          0
        ),
      ads: campaigns.reduce((sum, campaign) => sum + campaign.adGroups.reduce((inner, group) => inner + group.ads.length, 0), 0),
      dailyBudget,
    },
    dailyBudget: total > 0 ? `${formatMoney(dailyBudget, currency)} pe zi` : null,
    monthly: total > 0 ? `≈ ${formatMoney(monthlyBudget(dailyBudget), currency)} pe lună` : null,
    cap: capValue !== undefined ? `${formatMoney(capValue, currency)} pe zi` : null,
    capAmount: capValue ?? null,
    overCap: capValue !== undefined && Math.round(dailyBudget * 100) > Math.round(capValue * 100),
    lists,
    campaigns,
  };
}
