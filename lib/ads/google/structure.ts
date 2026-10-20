import "server-only";

import type { AdsWorkspace } from "../workspaces";
import type {
  ConversionType,
  DailySnapshot,
  EntitySnapshot,
  Level,
  ResultKind,
  StructureReader,
  StructureSnapshot,
} from "../model/types";
import { googleStatus, googleStatusDetail } from "../model/status";
import { googleSearch } from "./api";
import { findGoogleAccount, listConversionActions, type GoogleAccount } from "./lookup";
import { GoogleAccountHiddenError } from "./video";
import { BIDDING_STRATEGY_LABEL, CHANNEL_LABEL } from "./account/labels";

/**
 * Contul Google Ads în modelul comun (v2): campaniile, grupurile și reclamele,
 * cu starea și bugetul lor, plus cifrele pe zi la fiecare nivel. Doar citiri
 * (GAQL, v26), prin `api.ts`.
 *
 * Nivelurile se citesc separat, nu adunate din reclame: Performance Max nu are
 * grupuri și reclame, deci cheltuiala ei există doar pe campanie.
 *
 * Conversiile: `metrics.conversions` (cele principale ale contului — ce numără
 * Google în coloana „Conversii”) intră sub cheia `g:conversions`; pe fiecare
 * acțiune, `metrics.all_conversions` (și cele secundare), sub `g:ca:<id>`. Așa
 * omul poate alege pe campanie „doar apelurile din anunț”.
 *
 * Reclama are id-ul `grup~reclamă`, ca în numele resursei (`adGroupAds/1~2`) —
 * aceeași formă cere și pauza.
 */

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (micros: unknown): number => Math.round((num(micros) / 1_000_000) * 100) / 100;

async function accountOf(workspace: AdsWorkspace, customerId: string): Promise<GoogleAccount> {
  const account = await findGoogleAccount(workspace, customerId);
  if (!account) throw new GoogleAccountHiddenError(customerId);
  return account;
}

// ---------------------------------------------------------------------------
// Conversiile contului
// ---------------------------------------------------------------------------

/** Felul unei acțiuni de conversie, din categoria și tipul ei (v26). */
export function googleConversionKind(category: string, type: string): ResultKind {
  if (category === "PHONE_CALL_LEAD" || /CALL/.test(type)) return "call";
  if (category === "SUBMIT_LEAD_FORM") return "form";
  if (["IMPORTED_LEAD", "QUALIFIED_LEAD", "CONVERTED_LEAD", "CONTACT", "REQUEST_QUOTE", "BOOK_APPOINTMENT", "SIGNUP"].includes(category)) {
    return "lead";
  }
  if (category === "PURCHASE") return "purchase";
  return "other";
}

export const GOOGLE_PRIMARY_KEY = "g:conversions";

// ---------------------------------------------------------------------------
// Structura
// ---------------------------------------------------------------------------

interface RawCampaign {
  campaign?: {
    id?: string;
    name?: string;
    status?: string;
    primaryStatus?: string;
    servingStatus?: string;
    advertisingChannelType?: string;
    advertisingChannelSubType?: string;
    biddingStrategyType?: string;
    startDateTime?: string;
    endDateTime?: string;
  };
  campaignBudget?: { amountMicros?: string; totalAmountMicros?: string; period?: string };
}

interface RawAdGroup {
  campaign?: { id?: string };
  adGroup?: { id?: string; name?: string; status?: string; primaryStatus?: string; type?: string; cpcBidMicros?: string };
}

interface RawText {
  text?: string;
}

interface RawAd {
  campaign?: { id?: string };
  adGroup?: { id?: string };
  adGroupAd?: {
    status?: string;
    primaryStatus?: string;
    policySummary?: { approvalStatus?: string; reviewStatus?: string };
    ad?: {
      id?: string;
      name?: string;
      type?: string;
      finalUrls?: string[];
      responsiveSearchAd?: { headlines?: RawText[]; descriptions?: RawText[] };
      demandGenVideoResponsiveAd?: { headlines?: RawText[]; longHeadlines?: RawText[]; descriptions?: RawText[] };
    };
  };
}

const AD_TYPE_LABEL: Record<string, string> = {
  RESPONSIVE_SEARCH_AD: "Anunț de căutare responsive",
  DEMAND_GEN_VIDEO_RESPONSIVE_AD: "Video Demand Gen",
  DEMAND_GEN_MULTI_ASSET_AD: "Imagini Demand Gen",
  RESPONSIVE_DISPLAY_AD: "Display responsive",
  VIDEO_RESPONSIVE_AD: "Video responsive",
  CALL_AD: "Anunț de apel",
};

const GROUP_TYPE_LABEL: Record<string, string> = {
  SEARCH_STANDARD: "Căutare",
  DISPLAY_STANDARD: "Display",
  VIDEO_RESPONSIVE: "Video",
};

function texts(list: RawText[] | undefined): string[] {
  return (list ?? []).map((item) => item.text?.trim() ?? "").filter(Boolean);
}

function campaignEntity(row: RawCampaign, measured: boolean): EntitySnapshot | null {
  const campaign = row.campaign;
  if (!campaign?.id) return null;
  const period = row.campaignBudget?.period;
  const daily = period === "DAILY" || !period ? money(row.campaignBudget?.amountMicros) || null : null;
  const lifetime = money(row.campaignBudget?.totalAmountMicros) || null;
  const channel = campaign.advertisingChannelType ?? "";
  const facts: Array<[string, string]> = [["Tip", CHANNEL_LABEL[channel] ?? (channel || "—")]];
  if (campaign.biddingStrategyType) facts.push(["Licitare", BIDDING_STRATEGY_LABEL[campaign.biddingStrategyType] ?? campaign.biddingStrategyType]);
  if (campaign.startDateTime) facts.push(["Început", campaign.startDateTime.slice(0, 10)]);
  if (campaign.endDateTime && !campaign.endDateTime.startsWith("2037")) facts.push(["Sfârșit", campaign.endDateTime.slice(0, 10)]);
  return {
    level: "campaign",
    platformId: campaign.id,
    campaignId: campaign.id,
    groupId: null,
    name: campaign.name?.trim() || campaign.id,
    status: googleStatus({ status: campaign.status, primaryStatus: campaign.primaryStatus }),
    statusDetail: googleStatusDetail([campaign.status, campaign.primaryStatus]),
    dailyBudget: daily,
    lifetimeBudget: lifetime,
    kind: channel || null,
    defaultResult: measured ? GOOGLE_PRIMARY_KEY : null,
    settings: { facts },
    createdAt: campaign.startDateTime ? campaign.startDateTime.replace(" ", "T") : null,
  };
}

function groupEntity(row: RawAdGroup): EntitySnapshot | null {
  const group = row.adGroup;
  if (!group?.id || !row.campaign?.id) return null;
  const facts: Array<[string, string]> = [];
  if (group.type) facts.push(["Tip", GROUP_TYPE_LABEL[group.type] ?? group.type]);
  if (num(group.cpcBidMicros) > 0) facts.push(["CPC maxim", String(money(group.cpcBidMicros))]);
  return {
    level: "group",
    platformId: group.id,
    campaignId: row.campaign.id,
    groupId: null,
    name: group.name?.trim() || group.id,
    status: googleStatus({ status: group.status, primaryStatus: group.primaryStatus }),
    statusDetail: googleStatusDetail([group.status, group.primaryStatus]),
    dailyBudget: null,
    lifetimeBudget: null,
    kind: group.type ?? null,
    defaultResult: null,
    settings: { facts },
    createdAt: null,
  };
}

function adEntity(row: RawAd): EntitySnapshot | null {
  const item = row.adGroupAd;
  const ad = item?.ad;
  const groupId = row.adGroup?.id;
  if (!ad?.id || !groupId || !row.campaign?.id) return null;
  const search = ad.responsiveSearchAd;
  const video = ad.demandGenVideoResponsiveAd;
  const headlines = texts(search?.headlines).concat(texts(video?.longHeadlines), texts(video?.headlines));
  const descriptions = texts(search?.descriptions).concat(texts(video?.descriptions));
  const approval = item?.policySummary?.approvalStatus;
  const facts: Array<[string, string]> = [["Tip", AD_TYPE_LABEL[ad.type ?? ""] ?? (ad.type || "—")]];
  if (approval) facts.push(["Aprobare", approval]);
  return {
    level: "ad",
    platformId: `${groupId}~${ad.id}`,
    campaignId: row.campaign.id,
    groupId,
    name: ad.name?.trim() || headlines[0] || `Reclama ${ad.id}`,
    status: googleStatus({ status: item?.status, primaryStatus: item?.primaryStatus, approval, review: item?.policySummary?.reviewStatus }),
    statusDetail: googleStatusDetail([item?.status, item?.primaryStatus, approval]),
    dailyBudget: null,
    lifetimeBudget: null,
    kind: ad.type ?? null,
    defaultResult: null,
    settings: { facts, texts: [...headlines, ...descriptions].slice(0, 12), url: ad.finalUrls?.[0] ?? null },
    createdAt: null,
  };
}

const CAMPAIGN_FIELDS =
  "campaign.id, campaign.name, campaign.status, campaign.primary_status, campaign.serving_status, campaign.advertising_channel_type, campaign.advertising_channel_sub_type, campaign.bidding_strategy_type, campaign.start_date_time, campaign.end_date_time, campaign_budget.amount_micros, campaign_budget.total_amount_micros, campaign_budget.period";
const GROUP_FIELDS = "campaign.id, ad_group.id, ad_group.name, ad_group.status, ad_group.primary_status, ad_group.type, ad_group.cpc_bid_micros";
const AD_FIELDS =
  "campaign.id, ad_group.id, ad_group_ad.status, ad_group_ad.primary_status, ad_group_ad.policy_summary.approval_status, ad_group_ad.policy_summary.review_status, ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions, ad_group_ad.ad.demand_gen_video_responsive_ad.headlines, ad_group_ad.ad.demand_gen_video_responsive_ad.long_headlines, ad_group_ad.ad.demand_gen_video_responsive_ad.descriptions";

async function catalogOf(workspace: AdsWorkspace, account: GoogleAccount): Promise<ConversionType[]> {
  const actions = await listConversionActions(workspace, account);
  if (actions.length === 0) return [];
  const primaryKinds = new Set(actions.filter((action) => action.primary).map((action) => googleConversionKind(action.category, action.type)));
  return [
    {
      key: GOOGLE_PRIMARY_KEY,
      label: "Conversiile principale ale contului",
      kind: primaryKinds.size === 1 ? [...primaryKinds][0] : "other",
      primary: true,
    },
    ...actions.map((action) => ({
      key: `g:ca:${action.id}`,
      label: action.name,
      kind: googleConversionKind(action.category, action.type),
      primary: action.primary,
    })),
  ];
}

async function readStructure(workspace: AdsWorkspace, customerId: string): Promise<StructureSnapshot> {
  const account = await accountOf(workspace, customerId);
  const options = { loginCustomerId: account.loginCustomerId };
  const conversions = await catalogOf(workspace, account);
  const measured = conversions.length > 0;

  const [campaigns, groups, ads] = await Promise.all([
    googleSearch<RawCampaign>(workspace, account.info.id, `SELECT ${CAMPAIGN_FIELDS} FROM campaign WHERE campaign.status != 'REMOVED'`, options),
    googleSearch<RawAdGroup>(
      workspace,
      account.info.id,
      `SELECT ${GROUP_FIELDS} FROM ad_group WHERE ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'`,
      options
    ),
    googleSearch<RawAd>(
      workspace,
      account.info.id,
      `SELECT ${AD_FIELDS} FROM ad_group_ad WHERE ad_group_ad.status != 'REMOVED' AND ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'`,
      options
    ),
  ]);

  const entities = [
    ...campaigns.map((row) => campaignEntity(row, measured)),
    ...groups.map(groupEntity),
    ...ads.map(adEntity),
  ].filter((entity): entity is EntitySnapshot => entity !== null);

  return {
    account: {
      name: account.info.name,
      currency: account.info.currency,
      timezone: account.timeZone,
      conversions,
      measured,
    },
    entities,
  };
}

/**
 * Rândurile pe care structura nu le mai are (șterse între timp), după id —
 * Google le întoarce și pe cele șterse când sunt cerute anume.
 */
async function readMissing(
  workspace: AdsWorkspace,
  customerId: string,
  ids: Array<{ level: Level; platformId: string }>
): Promise<EntitySnapshot[]> {
  if (ids.length === 0) return [];
  const account = await accountOf(workspace, customerId);
  const options = { loginCustomerId: account.loginCustomerId };
  const measured = (await listConversionActions(workspace, account)).length > 0;
  const found: EntitySnapshot[] = [];
  const chunks = <T,>(list: T[]) => Array.from({ length: Math.ceil(list.length / 400) }, (_, index) => list.slice(index * 400, index * 400 + 400));

  const campaignIds = ids.filter((item) => item.level === "campaign" && /^\d+$/.test(item.platformId)).map((item) => item.platformId);
  for (const chunk of chunks(campaignIds)) {
    const rows = await googleSearch<RawCampaign>(workspace, account.info.id, `SELECT ${CAMPAIGN_FIELDS} FROM campaign WHERE campaign.id IN (${chunk.join(", ")})`, options);
    for (const row of rows) {
      const entity = campaignEntity(row, measured);
      if (entity) found.push(entity);
    }
  }
  const groupIds = ids.filter((item) => item.level === "group" && /^\d+$/.test(item.platformId)).map((item) => item.platformId);
  for (const chunk of chunks(groupIds)) {
    const rows = await googleSearch<RawAdGroup>(workspace, account.info.id, `SELECT ${GROUP_FIELDS} FROM ad_group WHERE ad_group.id IN (${chunk.join(", ")})`, options);
    for (const row of rows) {
      const entity = groupEntity(row);
      if (entity) found.push(entity);
    }
  }
  const adIds = ids
    .filter((item) => item.level === "ad" && /^\d+~\d+$/.test(item.platformId))
    .map((item) => item.platformId.split("~")[1]);
  for (const chunk of chunks(adIds)) {
    const rows = await googleSearch<RawAd>(workspace, account.info.id, `SELECT ${AD_FIELDS} FROM ad_group_ad WHERE ad_group_ad.ad.id IN (${chunk.join(", ")})`, options);
    for (const row of rows) {
      const entity = adEntity(row);
      if (entity) found.push(entity);
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Cifrele pe zi
// ---------------------------------------------------------------------------

interface RawMetrics {
  costMicros?: string;
  impressions?: string;
  clicks?: string;
  conversions?: number | string;
  allConversions?: number | string;
  videoTrueviewViews?: string;
  phoneCalls?: string;
}

interface RawDailyRow {
  campaign?: { id?: string };
  adGroup?: { id?: string };
  adGroupAd?: { ad?: { id?: string } };
  segments?: { date?: string; conversionAction?: string };
  metrics?: RawMetrics;
}

const METRICS =
  "metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.all_conversions, metrics.video_trueview_views, metrics.phone_calls";

const LEVEL_QUERY: Record<Level, { from: string; ids: string }> = {
  campaign: { from: "campaign", ids: "campaign.id" },
  group: { from: "ad_group", ids: "campaign.id, ad_group.id" },
  ad: { from: "ad_group_ad", ids: "campaign.id, ad_group.id, ad_group_ad.ad.id" },
};

function idOfRow(level: Level, row: RawDailyRow): string | null {
  if (level === "campaign") return row.campaign?.id ?? null;
  if (level === "group") return row.adGroup?.id ?? null;
  const groupId = row.adGroup?.id;
  const adId = row.adGroupAd?.ad?.id;
  return groupId && adId ? `${groupId}~${adId}` : null;
}

async function readDaily(workspace: AdsWorkspace, customerId: string, since: string, until: string): Promise<DailySnapshot[]> {
  const account = await accountOf(workspace, customerId);
  const options = { loginCustomerId: account.loginCustomerId };
  const between = `segments.date BETWEEN '${since}' AND '${until}'`;
  const days = new Map<string, DailySnapshot>();
  const dayOf = (level: Level, platformId: string, date: string): DailySnapshot => {
    const key = `${level}|${platformId}|${date}`;
    let day = days.get(key);
    if (!day) {
      day = { level, platformId, date, spend: 0, impressions: 0, clicks: 0, conversions: {}, extra: {} };
      days.set(key, day);
    }
    return day;
  };

  for (const level of ["campaign", "group", "ad"] as const) {
    const { from, ids } = LEVEL_QUERY[level];
    const [figures, breakdown] = await Promise.all([
      googleSearch<RawDailyRow>(workspace, account.info.id, `SELECT ${ids}, segments.date, ${METRICS} FROM ${from} WHERE ${between}`, options),
      googleSearch<RawDailyRow>(
        workspace,
        account.info.id,
        `SELECT ${ids}, segments.date, segments.conversion_action, metrics.all_conversions FROM ${from} WHERE ${between}`,
        options
      ),
    ]);
    for (const row of figures) {
      const platformId = idOfRow(level, row);
      const date = row.segments?.date;
      if (!platformId || !date) continue;
      const day = dayOf(level, platformId, date);
      const metrics = row.metrics ?? {};
      day.spend = Math.round((day.spend + money(metrics.costMicros)) * 100) / 100;
      day.impressions += Math.round(num(metrics.impressions));
      day.clicks += Math.round(num(metrics.clicks));
      day.conversions[GOOGLE_PRIMARY_KEY] = Math.round(((day.conversions[GOOGLE_PRIMARY_KEY] ?? 0) + num(metrics.conversions)) * 100) / 100;
      const extra = { all_conversions: num(metrics.allConversions), video_views: num(metrics.videoTrueviewViews), phone_calls: num(metrics.phoneCalls) };
      for (const [key, value] of Object.entries(extra)) if (value) day.extra[key] = Math.round(((day.extra[key] ?? 0) + value) * 100) / 100;
    }
    for (const row of breakdown) {
      const platformId = idOfRow(level, row);
      const date = row.segments?.date;
      const actionId = /\/conversionActions\/(\d+)$/.exec(row.segments?.conversionAction ?? "")?.[1];
      const value = num(row.metrics?.allConversions);
      if (!platformId || !date || !actionId || value === 0) continue;
      const day = dayOf(level, platformId, date);
      const key = `g:ca:${actionId}`;
      day.conversions[key] = Math.round(((day.conversions[key] ?? 0) + value) * 100) / 100;
    }
  }
  return [...days.values()];
}

/** Google în modelul comun, legat de spațiul care are cheia. */
export function googleStructureReader(workspace: AdsWorkspace): StructureReader {
  return {
    platform: "google",
    readStructure: (adAccount) => readStructure(workspace, adAccount),
    readDaily: (adAccount, since, until) => readDaily(workspace, adAccount, since, until),
    readMissing: (adAccount, ids) => readMissing(workspace, adAccount, ids),
  };
}
