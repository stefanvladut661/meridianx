import "server-only";

import type { AdsWorkspace } from "../workspaces";
import { addDays } from "../metrics";
import type { ConversionType, DailySnapshot, EntitySnapshot, Level, ResultKind, StructureReader, StructureSnapshot } from "../model/types";
import { tiktokStatus } from "../model/status";
import { tiktokGet, tiktokGetAll } from "./api";

/**
 * Contul TikTok în modelul comun (v2): campaniile, grupurile și reclamele, cu
 * starea (`secondary_status`) și bugetul lor, plus cifrele pe zi. Doar citiri,
 * prin `api.ts`. Referința: TikTok API for Business v1.3 (vezi README → „TikTok —
 * conexiunea v2”).
 *
 * - Listele întorc implicit doar ce nu e șters; cele șterse se citesc după id,
 *   cu filtrul de stare `STATUS_DELETE` (`readMissing`).
 * - Bugetul e în moneda contului (nu în subunități); `BUDGET_MODE_DAY` și cel
 *   dinamic sunt pe zi, `BUDGET_MODE_TOTAL` pe toată durata, `INFINITE` = fără
 *   buget la nivelul ăla (de obicei e pe campanie, cu optimizarea bugetului).
 * - Cifrele: raportul de bază (`/report/integrated/get/`) la nivel de reclamă, pe
 *   zi, cu reclamele șterse incluse (`ad_status: STATUS_ALL`); grupurile și
 *   campaniile sunt suma reclamelor lor. Ferestre de cel mult 30 de zile (limita
 *   TikTok cu dimensiunea „zi”).
 */

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const PAGE = 1000;
const WINDOW_DAYS = 30;

// ---------------------------------------------------------------------------
// Conversiile: metricile raportului care pot fi „rezultat”
// ---------------------------------------------------------------------------

/** Metricile raportului de bază care numără un rezultat (v1.3, „Basic metrics”). */
export const TIKTOK_RESULTS: ReadonlyArray<{ metric: string; label: string; kind: ResultKind }> = [
  { metric: "conversion", label: "Conversiile pe care optimizează grupul", kind: "lead" },
  { metric: "form", label: "Formulare trimise pe site (pixel)", kind: "lead" },
  { metric: "onsite_form", label: "Formulare instant, în TikTok", kind: "form" },
  { metric: "online_consult", label: "Contacte de pe site", kind: "lead" },
  { metric: "button_click", label: "Clicuri pe butoane de contact", kind: "lead" },
  { metric: "user_registration", label: "Înregistrări pe site", kind: "lead" },
  { metric: "complete_payment", label: "Plăți pe site", kind: "purchase" },
];

const RESULT_METRICS = TIKTOK_RESULTS.map((item) => item.metric);

/** Ce numără un grup, din ce optimizează. null = nimic de numărat (trafic, acoperire, vizionări). */
function resultOfAdGroup(group: RawAdGroup): string | null {
  if (group.promotion_type === "LEAD_GENERATION" || group.optimization_goal === "LEAD_GENERATION") return "onsite_form";
  if (group.optimization_goal !== "CONVERT" && group.optimization_goal !== "VALUE") return null;
  switch (group.optimization_event) {
    case "FORM":
      return "form";
    case "CONSULT":
      return "online_consult";
    case "BUTTON":
      return "button_click";
    case "ON_WEB_REGISTER":
      return "user_registration";
    case "SHOPPING":
      return "complete_payment";
    default:
      return group.optimization_event ? "conversion" : null;
  }
}

// ---------------------------------------------------------------------------
// Structura
// ---------------------------------------------------------------------------

interface RawCampaign {
  campaign_id?: string | number;
  campaign_name?: string;
  objective_type?: string;
  budget?: number | string;
  budget_mode?: string;
  operation_status?: string;
  secondary_status?: string;
  create_time?: string;
  budget_optimize_on?: boolean;
}

interface RawAdGroup {
  adgroup_id?: string | number;
  adgroup_name?: string;
  campaign_id?: string | number;
  budget?: number | string;
  budget_mode?: string;
  operation_status?: string;
  secondary_status?: string;
  optimization_goal?: string;
  optimization_event?: string;
  promotion_type?: string;
  billing_event?: string;
  pixel_id?: string | number;
  create_time?: string;
  schedule_start_time?: string;
  schedule_end_time?: string;
}

interface RawAd {
  ad_id?: string | number;
  ad_name?: string;
  adgroup_id?: string | number;
  campaign_id?: string | number;
  operation_status?: string;
  secondary_status?: string;
  ad_text?: string;
  call_to_action?: string;
  landing_page_url?: string;
  video_id?: string;
  create_time?: string;
}

const CAMPAIGN_FIELDS = ["campaign_id", "campaign_name", "objective_type", "budget", "budget_mode", "operation_status", "secondary_status", "create_time", "budget_optimize_on"];
const ADGROUP_FIELDS = [
  "adgroup_id",
  "adgroup_name",
  "campaign_id",
  "budget",
  "budget_mode",
  "operation_status",
  "secondary_status",
  "optimization_goal",
  "optimization_event",
  "promotion_type",
  "billing_event",
  "pixel_id",
  "create_time",
  "schedule_start_time",
  "schedule_end_time",
];
const AD_FIELDS = ["ad_id", "ad_name", "adgroup_id", "campaign_id", "operation_status", "secondary_status", "ad_text", "call_to_action", "landing_page_url", "video_id", "create_time"];

const OBJECTIVE_LABEL: Record<string, string> = {
  WEB_CONVERSIONS: "Conversii pe site",
  LEAD_GENERATION: "Lead-uri",
  TRAFFIC: "Trafic",
  REACH: "Acoperire",
  VIDEO_VIEWS: "Vizionări",
  ENGAGEMENT: "Interacțiune",
  PRODUCT_SALES: "Vânzări",
};

const id = (value: unknown) => (value === undefined || value === null ? null : String(value));
/** „2026-10-01 09:00:00” (UTC, TikTok) → ISO. */
const time = (value: string | undefined) => (value ? `${value.replace(" ", "T")}Z` : null);

function budgets(mode: string | undefined, value: unknown): { daily: number | null; lifetime: number | null } {
  const amount = num(value) > 0 ? Math.round(num(value) * 100) / 100 : null;
  if (mode === "BUDGET_MODE_DAY" || mode === "BUDGET_MODE_DYNAMIC_DAILY_BUDGET") return { daily: amount, lifetime: null };
  if (mode === "BUDGET_MODE_TOTAL") return { daily: null, lifetime: amount };
  return { daily: null, lifetime: null };
}

function campaignEntity(row: RawCampaign, defaults: Map<string, string | null>): EntitySnapshot | null {
  const campaignId = id(row.campaign_id);
  if (!campaignId) return null;
  const { daily, lifetime } = budgets(row.budget_mode, row.budget);
  const facts: Array<[string, string]> = [];
  if (row.objective_type) facts.push(["Obiectiv", OBJECTIVE_LABEL[row.objective_type] ?? row.objective_type]);
  if (row.budget_optimize_on) facts.push(["Bugetul", "pe campanie (optimizat de TikTok între grupuri)"]);
  const result = defaults.get(campaignId);
  return {
    level: "campaign",
    platformId: campaignId,
    campaignId,
    groupId: null,
    name: row.campaign_name?.trim() || campaignId,
    status: tiktokStatus(row.secondary_status, row.operation_status),
    statusDetail: row.secondary_status ?? row.operation_status ?? null,
    dailyBudget: daily,
    lifetimeBudget: lifetime,
    kind: row.objective_type ?? null,
    defaultResult: result ? `t:${result}` : null,
    settings: { facts },
    createdAt: time(row.create_time),
  };
}

function adGroupEntity(row: RawAdGroup): EntitySnapshot | null {
  const groupId = id(row.adgroup_id);
  const campaignId = id(row.campaign_id);
  if (!groupId || !campaignId) return null;
  const { daily, lifetime } = budgets(row.budget_mode, row.budget);
  const facts: Array<[string, string]> = [];
  if (row.optimization_goal) facts.push(["Optimizare", row.optimization_goal]);
  if (row.optimization_event) facts.push(["Eveniment", row.optimization_event]);
  if (row.pixel_id) facts.push(["Pixel", String(row.pixel_id)]);
  if (row.promotion_type) facts.push(["Destinație", row.promotion_type]);
  if (row.schedule_start_time) facts.push(["Început", row.schedule_start_time.slice(0, 10)]);
  if (row.schedule_end_time) facts.push(["Sfârșit", row.schedule_end_time.slice(0, 10)]);
  return {
    level: "group",
    platformId: groupId,
    campaignId,
    groupId: null,
    name: row.adgroup_name?.trim() || groupId,
    status: tiktokStatus(row.secondary_status, row.operation_status),
    statusDetail: row.secondary_status ?? row.operation_status ?? null,
    dailyBudget: daily,
    lifetimeBudget: lifetime,
    kind: row.optimization_goal ?? null,
    defaultResult: null,
    settings: { facts },
    createdAt: time(row.create_time),
  };
}

function adEntity(row: RawAd): EntitySnapshot | null {
  const adId = id(row.ad_id);
  const groupId = id(row.adgroup_id);
  const campaignId = id(row.campaign_id);
  if (!adId || !groupId || !campaignId) return null;
  const facts: Array<[string, string]> = [];
  if (row.call_to_action) facts.push(["Buton", row.call_to_action]);
  if (row.video_id) facts.push(["Video", row.video_id]);
  return {
    level: "ad",
    platformId: adId,
    campaignId,
    groupId,
    name: row.ad_name?.trim() || adId,
    status: tiktokStatus(row.secondary_status, row.operation_status),
    statusDetail: row.secondary_status ?? row.operation_status ?? null,
    dailyBudget: null,
    lifetimeBudget: null,
    kind: null,
    defaultResult: null,
    settings: { facts, texts: row.ad_text ? [row.ad_text] : [], url: row.landing_page_url ?? null },
    createdAt: time(row.create_time),
  };
}

function campaignDefaults(groups: RawAdGroup[]): Map<string, string | null> {
  const votes = new Map<string, Map<string, number>>();
  for (const group of groups) {
    const result = resultOfAdGroup(group);
    const campaignId = id(group.campaign_id);
    if (!campaignId || !result) continue;
    const counts = votes.get(campaignId) ?? new Map<string, number>();
    counts.set(result, (counts.get(result) ?? 0) + 1);
    votes.set(campaignId, counts);
  }
  const out = new Map<string, string | null>();
  for (const [campaignId, counts] of votes) out.set(campaignId, [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null);
  return out;
}

async function readAccount(workspace: AdsWorkspace, advertiserId: string) {
  const data = await tiktokGet<{ list?: Array<{ advertiser_id?: string | number; name?: string; currency?: string; display_timezone?: string; timezone?: string }> }>(
    workspace,
    "/advertiser/info/",
    { advertiser_ids: [advertiserId], fields: ["advertiser_id", "name", "currency", "timezone", "display_timezone"] }
  );
  return (data.list ?? []).find((item) => String(item.advertiser_id) === advertiserId) ?? null;
}

async function readStructure(workspace: AdsWorkspace, advertiserId: string): Promise<StructureSnapshot> {
  const account = await readAccount(workspace, advertiserId);
  if (!account) throw new Error(`Tokenul spațiului nu vede contul TikTok ${advertiserId}.`);
  const list = (path: string, fields: string[], max: number) =>
    tiktokGetAll<Record<string, unknown>>(workspace, path, { advertiser_id: advertiserId, fields }, "list", max, PAGE);
  const [campaigns, groups, ads, pixels] = await Promise.all([
    list("/campaign/get/", CAMPAIGN_FIELDS, 5000) as Promise<RawCampaign[]>,
    list("/adgroup/get/", ADGROUP_FIELDS, 10_000) as Promise<RawAdGroup[]>,
    list("/ad/get/", AD_FIELDS, 20_000) as Promise<RawAd[]>,
    tiktokGet<{ pixels?: unknown[] }>(workspace, "/pixel/list/", { advertiser_id: advertiserId, page_size: 5 })
      .then((data) => data.pixels ?? [])
      .catch(() => []),
  ]);

  const defaults = campaignDefaults(groups);
  const optimized = new Set([...defaults.values()].filter(Boolean).map((metric) => `t:${metric}`));
  const conversions: ConversionType[] = TIKTOK_RESULTS.map((item) => ({ key: `t:${item.metric}`, label: item.label, kind: item.kind, primary: optimized.has(`t:${item.metric}`) }));

  const entities = [...campaigns.map((row) => campaignEntity(row, defaults)), ...groups.map(adGroupEntity), ...ads.map(adEntity)].filter(
    (entity): entity is EntitySnapshot => entity !== null
  );
  return {
    account: {
      name: account.name?.trim() || advertiserId,
      currency: account.currency ?? "RON",
      timezone: account.display_timezone ?? account.timezone ?? null,
      conversions,
      measured: pixels.length > 0 || optimized.size > 0,
    },
    entities,
  };
}

/** Rândurile șterse între timp, după id (lista implicită nu le întoarce). */
async function readMissing(workspace: AdsWorkspace, advertiserId: string, ids: Array<{ level: Level; platformId: string }>): Promise<EntitySnapshot[]> {
  const found: EntitySnapshot[] = [];
  const read = async (path: string, key: string, fields: string[], wanted: string[]) => {
    const rows: Array<Record<string, unknown>> = [];
    for (let index = 0; index < wanted.length; index += 100) {
      const chunk = wanted.slice(index, index + 100);
      for (const status of ["STATUS_DELETE", "STATUS_ALL"]) {
        try {
          rows.push(
            ...(await tiktokGetAll<Record<string, unknown>>(workspace, path, { advertiser_id: advertiserId, fields, filtering: { [key]: chunk, primary_status: status } }, "list", 1000, PAGE))
          );
          break;
        } catch {
          // Un filtru de stare refuzat pe nivelul ăsta: încercăm următorul.
        }
      }
    }
    return rows;
  };
  const pick = (level: Level) => ids.filter((item) => item.level === level && /^\d+$/.test(item.platformId)).map((item) => item.platformId);
  for (const row of await read("/campaign/get/", "campaign_ids", CAMPAIGN_FIELDS, pick("campaign"))) {
    const entity = campaignEntity(row as RawCampaign, new Map());
    if (entity) found.push(entity);
  }
  for (const row of await read("/adgroup/get/", "adgroup_ids", ADGROUP_FIELDS, pick("group"))) {
    const entity = adGroupEntity(row as RawAdGroup);
    if (entity) found.push(entity);
  }
  for (const row of await read("/ad/get/", "ad_ids", AD_FIELDS, pick("ad"))) {
    const entity = adEntity(row as RawAd);
    if (entity) found.push(entity);
  }
  const seen = new Set<string>();
  return found.filter((entity) => {
    const key = `${entity.level}|${entity.platformId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Cifrele pe zi
// ---------------------------------------------------------------------------

interface RawReportRow {
  dimensions?: { ad_id?: string | number; stat_time_day?: string };
  metrics?: Record<string, string | number | undefined>;
}

const METRICS = ["spend", "impressions", "clicks", "video_watched_2s", "video_watched_6s", "campaign_id", "adgroup_id", ...RESULT_METRICS];

async function readDaily(workspace: AdsWorkspace, advertiserId: string, since: string, until: string): Promise<DailySnapshot[]> {
  const days = new Map<string, DailySnapshot>();
  const add = (level: Level, platformId: string, date: string, metrics: Record<string, string | number | undefined>) => {
    const key = `${level}|${platformId}|${date}`;
    const target = days.get(key) ?? { level, platformId, date, spend: 0, impressions: 0, clicks: 0, conversions: {}, extra: {} };
    target.spend = Math.round((target.spend + num(metrics.spend)) * 100) / 100;
    target.impressions += Math.round(num(metrics.impressions));
    target.clicks += Math.round(num(metrics.clicks));
    for (const metric of RESULT_METRICS) {
      const value = num(metrics[metric]);
      if (value) target.conversions[`t:${metric}`] = Math.round(((target.conversions[`t:${metric}`] ?? 0) + value) * 100) / 100;
    }
    const twoSeconds = num(metrics.video_watched_2s);
    const sixSeconds = num(metrics.video_watched_6s);
    if (twoSeconds) target.extra.video_2s = (target.extra.video_2s ?? 0) + twoSeconds;
    if (sixSeconds) target.extra.video_6s = (target.extra.video_6s ?? 0) + sixSeconds;
    days.set(key, target);
  };

  for (let start = since; start <= until; start = addDays(start, WINDOW_DAYS)) {
    const end = [addDays(start, WINDOW_DAYS - 1), until].sort()[0];
    const rows = await tiktokGetAll<RawReportRow>(
      workspace,
      "/report/integrated/get/",
      {
        advertiser_id: advertiserId,
        report_type: "BASIC",
        data_level: "AUCTION_AD",
        dimensions: ["ad_id", "stat_time_day"],
        metrics: METRICS,
        start_date: start,
        end_date: end,
        // Reclamele șterse intră și ele: altfel sumele grupurilor și campaniilor ar fi mai mici.
        filtering: [{ field_name: "ad_status", filter_type: "IN", filter_value: JSON.stringify(["STATUS_ALL"]) }],
      },
      "list",
      200_000,
      PAGE
    );
    for (const row of rows) {
      const adId = id(row.dimensions?.ad_id);
      const date = row.dimensions?.stat_time_day?.slice(0, 10);
      const metrics = row.metrics ?? {};
      if (!adId || !date) continue;
      add("ad", adId, date, metrics);
      const groupId = id(metrics.adgroup_id);
      const campaignId = id(metrics.campaign_id);
      if (groupId) add("group", groupId, date, metrics);
      if (campaignId) add("campaign", campaignId, date, metrics);
    }
  }
  return [...days.values()];
}

/** TikTok în modelul comun, legat de spațiul care are tokenul. */
export function tiktokStructureReader(workspace: AdsWorkspace): StructureReader {
  return {
    platform: "tiktok",
    readStructure: (advertiserId) => readStructure(workspace, advertiserId),
    readDaily: (advertiserId, since, until) => readDaily(workspace, advertiserId, since, until),
    readMissing: (advertiserId, ids) => readMissing(workspace, advertiserId, ids),
  };
}
