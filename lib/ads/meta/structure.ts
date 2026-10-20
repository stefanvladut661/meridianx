import "server-only";

import type { AdsWorkspace } from "../workspaces";
import { addDays } from "../metrics";
import type { ConversionType, DailySnapshot, EntitySnapshot, Level, ResultKind, StructureReader, StructureSnapshot } from "../model/types";
import { META_LISTED_STATUSES, metaStatus } from "../model/status";
import { MetaApiError, metaGet, metaGetAll } from "./graph";

/**
 * Contul Meta în modelul comun (v2): campaniile, seturile (grupurile) și
 * reclamele, cu starea (`effective_status`) și bugetul lor, plus cifrele pe zi.
 * Doar citiri, prin `graph.ts`. Referința: Marketing API v26 (vezi README →
 * „Faza 3 v2”).
 *
 * - Listele contului întorc implicit doar ce nu e arhivat sau șters; filtrul
 *   `effective_status` le include pe cele arhivate. Cele șterse se citesc doar
 *   după id (`readMissing`).
 * - Bugetele vin în subunitățile monedei (6000 = 60 lei); se împart la 100, sau
 *   la 1 la monedele fără subunități (JPY, KRW, HUF, CLP, TWD, ISK).
 * - Cifrele: o cerere `insights` pe cont la nivel de reclamă, pe zi
 *   (`time_increment=1`), cu reclamele șterse și arhivate incluse (altfel ar
 *   lipsi din sumă); seturile și campaniile sunt suma reclamelor lor — cheltuiala,
 *   afișările, clicurile și acțiunile se adună (acoperirea nu, deci nu se ține).
 *   Ferestre de cel mult 30 de zile; la timeout, fereastra se înjumătățește.
 */

const NO_MINOR_UNITS = new Set(["JPY", "KRW", "HUF", "CLP", "TWD", "ISK"]);

function money(value: unknown, currency: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round((parsed / (NO_MINOR_UNITS.has(currency) ? 1 : 100)) * 100) / 100;
}

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// ---------------------------------------------------------------------------
// Conversiile: tipurile de acțiune care contează ca rezultat
// ---------------------------------------------------------------------------

/** Tipurile de acțiune (AdsActionStats v26) care pot fi „rezultat”. Un singur contor pe campanie. */
export const META_ACTIONS: ReadonlyArray<{ type: string; label: string; kind: ResultKind }> = [
  { type: "offsite_conversion.fb_pixel_lead", label: "Lead-uri de pe site (pixel)", kind: "lead" },
  { type: "onsite_conversion.lead_grouped", label: "Formulare instant, în Meta", kind: "form" },
  { type: "lead", label: "Toate lead-urile (site + formulare Meta)", kind: "lead" },
  { type: "click_to_call_call_confirm", label: "Apeluri din reclamă (estimate de Meta)", kind: "call" },
  { type: "click_to_call_native_call_placed", label: "Apeluri inițiate din reclamă", kind: "call" },
  { type: "contact_website", label: "Contact de pe site", kind: "lead" },
  { type: "contact_total", label: "Contact (toate canalele)", kind: "lead" },
  { type: "schedule_website", label: "Programări de pe site", kind: "lead" },
  { type: "schedule_total", label: "Programări (toate canalele)", kind: "lead" },
  { type: "submit_application_total", label: "Aplicații trimise", kind: "form" },
  { type: "offsite_conversion.fb_pixel_complete_registration", label: "Înregistrări pe site", kind: "lead" },
  { type: "offsite_conversion.fb_pixel_purchase", label: "Vânzări pe site", kind: "purchase" },
  { type: "onsite_conversion.messaging_conversation_started_7d", label: "Conversații începute", kind: "lead" },
];

const KEPT_ACTIONS = new Set(META_ACTIONS.map((action) => action.type));
const isKept = (type: string) => KEPT_ACTIONS.has(type) || type.startsWith("offsite_conversion.custom.");

const EVENT_ACTION: Record<string, string> = {
  LEAD: "offsite_conversion.fb_pixel_lead",
  CONTACT: "contact_website",
  SCHEDULE: "schedule_website",
  COMPLETE_REGISTRATION: "offsite_conversion.fb_pixel_complete_registration",
  PURCHASE: "offsite_conversion.fb_pixel_purchase",
  SUBMIT_APPLICATION: "submit_application_total",
};

/** Ce numără un set de reclame, din ce optimizează el. null = nimic de numărat (trafic, acoperire). */
function resultOfAdSet(adset: RawAdSet): string | null {
  const promoted = adset.promoted_object ?? {};
  switch (adset.optimization_goal) {
    case "OFFSITE_CONVERSIONS":
    case "VALUE":
      if (promoted.custom_conversion_id) return `offsite_conversion.custom.${promoted.custom_conversion_id}`;
      return promoted.custom_event_type ? (EVENT_ACTION[promoted.custom_event_type] ?? null) : null;
    case "LEAD_GENERATION":
    case "QUALITY_LEAD":
      return "onsite_conversion.lead_grouped";
    case "QUALITY_CALL":
    case "MEANINGFUL_CALL_ATTEMPT":
      return "click_to_call_call_confirm";
    case "CONVERSATIONS":
      return "onsite_conversion.messaging_conversation_started_7d";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Structura
// ---------------------------------------------------------------------------

interface RawCampaign {
  id?: string;
  name?: string;
  status?: string;
  effective_status?: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_strategy?: string;
  created_time?: string;
  start_time?: string;
  stop_time?: string;
  special_ad_categories?: string[];
}

interface RawAdSet {
  id?: string;
  name?: string;
  campaign_id?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal?: string;
  billing_event?: string;
  destination_type?: string;
  promoted_object?: { pixel_id?: string; custom_event_type?: string; custom_conversion_id?: string; page_id?: string };
  created_time?: string;
  start_time?: string;
  end_time?: string;
}

interface RawAd {
  id?: string;
  name?: string;
  adset_id?: string;
  campaign_id?: string;
  status?: string;
  effective_status?: string;
  created_time?: string;
  creative?: {
    id?: string;
    thumbnail_url?: string;
    body?: string;
    title?: string;
    object_story_spec?: { video_data?: { message?: string; title?: string; call_to_action?: { value?: { link?: string } } }; link_data?: { message?: string; name?: string; link?: string } };
  };
}

const OBJECTIVE_LABEL: Record<string, string> = {
  OUTCOME_LEADS: "Lead-uri",
  OUTCOME_SALES: "Vânzări",
  OUTCOME_TRAFFIC: "Trafic",
  OUTCOME_ENGAGEMENT: "Interacțiune",
  OUTCOME_AWARENESS: "Notorietate",
  OUTCOME_APP_PROMOTION: "Aplicații",
};

const GOAL_LABEL: Record<string, string> = {
  OFFSITE_CONVERSIONS: "Conversii pe site",
  LEAD_GENERATION: "Formulare instant",
  QUALITY_LEAD: "Lead-uri de calitate",
  QUALITY_CALL: "Apeluri",
  MEANINGFUL_CALL_ATTEMPT: "Apeluri",
  CONVERSATIONS: "Conversații",
  LINK_CLICKS: "Clicuri pe link",
  LANDING_PAGE_VIEWS: "Vizualizări ale paginii",
  THRUPLAY: "ThruPlay",
  REACH: "Acoperire",
  IMPRESSIONS: "Afișări",
};

const day = (iso: string | undefined) => (iso ? iso.slice(0, 10) : null);

const CAMPAIGN_FIELDS = "id,name,status,effective_status,objective,daily_budget,lifetime_budget,bid_strategy,created_time,start_time,stop_time,special_ad_categories";
const ADSET_FIELDS =
  "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,destination_type,promoted_object,created_time,start_time,end_time";
const AD_FIELDS = "id,name,adset_id,campaign_id,status,effective_status,created_time,creative{id,thumbnail_url,body,title,object_story_spec}";

function campaignEntity(row: RawCampaign, currency: string, defaults: Map<string, string | null>): EntitySnapshot | null {
  if (!row.id) return null;
  const facts: Array<[string, string]> = [];
  if (row.objective) facts.push(["Obiectiv", OBJECTIVE_LABEL[row.objective] ?? row.objective]);
  if (row.bid_strategy) facts.push(["Licitare", row.bid_strategy]);
  if (day(row.start_time)) facts.push(["Început", day(row.start_time)!]);
  if (day(row.stop_time)) facts.push(["Sfârșit", day(row.stop_time)!]);
  if (row.special_ad_categories?.length && !row.special_ad_categories.includes("NONE")) facts.push(["Categorie specială", row.special_ad_categories.join(", ")]);
  return {
    level: "campaign",
    platformId: row.id,
    campaignId: row.id,
    groupId: null,
    name: row.name?.trim() || row.id,
    status: metaStatus(row.effective_status),
    statusDetail: row.effective_status ?? row.status ?? null,
    dailyBudget: money(row.daily_budget, currency),
    lifetimeBudget: money(row.lifetime_budget, currency),
    kind: row.objective ?? null,
    defaultResult: defaults.get(row.id) ? `m:${defaults.get(row.id)}` : null,
    settings: { facts },
    createdAt: row.created_time ?? null,
  };
}

function adSetEntity(row: RawAdSet, currency: string): EntitySnapshot | null {
  if (!row.id || !row.campaign_id) return null;
  const facts: Array<[string, string]> = [];
  if (row.optimization_goal) facts.push(["Optimizare", GOAL_LABEL[row.optimization_goal] ?? row.optimization_goal]);
  if (row.promoted_object?.custom_event_type) facts.push(["Eveniment", row.promoted_object.custom_event_type]);
  if (row.promoted_object?.pixel_id) facts.push(["Pixel", row.promoted_object.pixel_id]);
  if (row.destination_type) facts.push(["Destinație", row.destination_type]);
  if (row.billing_event) facts.push(["Plată pe", row.billing_event]);
  if (day(row.start_time)) facts.push(["Început", day(row.start_time)!]);
  if (day(row.end_time)) facts.push(["Sfârșit", day(row.end_time)!]);
  return {
    level: "group",
    platformId: row.id,
    campaignId: row.campaign_id,
    groupId: null,
    name: row.name?.trim() || row.id,
    status: metaStatus(row.effective_status),
    statusDetail: row.effective_status ?? row.status ?? null,
    dailyBudget: money(row.daily_budget, currency),
    lifetimeBudget: money(row.lifetime_budget, currency),
    kind: row.optimization_goal ?? null,
    defaultResult: null,
    settings: { facts },
    createdAt: row.created_time ?? null,
  };
}

function adEntity(row: RawAd): EntitySnapshot | null {
  if (!row.id || !row.adset_id || !row.campaign_id) return null;
  const creative = row.creative;
  const story = creative?.object_story_spec;
  const texts = [creative?.title, creative?.body, story?.video_data?.title, story?.video_data?.message, story?.link_data?.name, story?.link_data?.message]
    .map((text) => text?.trim())
    .filter((text): text is string => Boolean(text));
  return {
    level: "ad",
    platformId: row.id,
    campaignId: row.campaign_id,
    groupId: row.adset_id,
    name: row.name?.trim() || row.id,
    status: metaStatus(row.effective_status),
    statusDetail: row.effective_status ?? row.status ?? null,
    dailyBudget: null,
    lifetimeBudget: null,
    kind: null,
    defaultResult: null,
    settings: {
      facts: creative?.id ? [["Material (creativ)", creative.id]] : [],
      texts: [...new Set(texts)].slice(0, 8),
      url: story?.video_data?.call_to_action?.value?.link ?? story?.link_data?.link ?? null,
      thumbnail: creative?.thumbnail_url ?? null,
    },
    createdAt: row.created_time ?? null,
  };
}

/** Rezultatul implicit al fiecărei campanii: cel mai des întâlnit printre seturile ei. */
function campaignDefaults(adsets: RawAdSet[]): Map<string, string | null> {
  const votes = new Map<string, Map<string, number>>();
  for (const adset of adsets) {
    const result = resultOfAdSet(adset);
    if (!adset.campaign_id || !result) continue;
    const counts = votes.get(adset.campaign_id) ?? new Map<string, number>();
    counts.set(result, (counts.get(result) ?? 0) + 1);
    votes.set(adset.campaign_id, counts);
  }
  const out = new Map<string, string | null>();
  for (const [campaignId, counts] of votes) out.set(campaignId, [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null);
  return out;
}

async function readAccount(workspace: AdsWorkspace, adAccount: string) {
  return metaGet<{ id?: string; name?: string; currency?: string; timezone_name?: string }>(workspace, `/${adAccount}`, { fields: "id,name,currency,timezone_name" });
}

async function readStructure(workspace: AdsWorkspace, adAccount: string): Promise<StructureSnapshot> {
  const account = await readAccount(workspace, adAccount);
  const currency = account.currency ?? "RON";
  const listed = { effective_status: META_LISTED_STATUSES, limit: 200 };
  const [campaigns, adsets, ads, pixels, customs] = await Promise.all([
    metaGetAll<RawCampaign>(workspace, `/${adAccount}/campaigns`, { ...listed, fields: CAMPAIGN_FIELDS }, 5000),
    metaGetAll<RawAdSet>(workspace, `/${adAccount}/adsets`, { ...listed, fields: ADSET_FIELDS }, 10_000),
    metaGetAll<RawAd>(workspace, `/${adAccount}/ads`, { ...listed, fields: AD_FIELDS }, 20_000),
    metaGetAll<{ id?: string }>(workspace, `/${adAccount}/adspixels`, { fields: "id", limit: 5 }, 5).catch(() => []),
    metaGetAll<{ id?: string; name?: string; custom_event_type?: string }>(workspace, `/${adAccount}/customconversions`, { fields: "id,name,custom_event_type", limit: 100 }, 200).catch(
      () => []
    ),
  ]);

  const defaults = campaignDefaults(adsets);
  const conversions: ConversionType[] = [
    ...META_ACTIONS.map((action) => ({ key: `m:${action.type}`, label: action.label, kind: action.kind, primary: false })),
    ...customs
      .filter((custom) => custom.id)
      .map((custom) => ({
        key: `m:offsite_conversion.custom.${custom.id}`,
        label: `Conversie personalizată: ${custom.name ?? custom.id}`,
        kind: (custom.custom_event_type === "PURCHASE" ? "purchase" : "lead") as ResultKind,
        primary: false,
      })),
  ];
  // „Primary” = tipul pe care optimizează măcar o campanie a contului.
  const optimized = new Set([...defaults.values()].filter(Boolean).map((type) => `m:${type}`));
  for (const conversion of conversions) conversion.primary = optimized.has(conversion.key);

  const entities = [
    ...campaigns.map((row) => campaignEntity(row, currency, defaults)),
    ...adsets.map((row) => adSetEntity(row, currency)),
    ...ads.map(adEntity),
  ].filter((entity): entity is EntitySnapshot => entity !== null);

  return {
    account: {
      name: account.name?.trim() || adAccount,
      currency,
      timezone: account.timezone_name ?? null,
      conversions,
      measured: pixels.length > 0 || optimized.size > 0 || customs.length > 0,
    },
    entities,
  };
}

/** Rândurile șterse (citite doar după id), câte 50 pe cerere (`?ids=`). */
async function readMissing(workspace: AdsWorkspace, adAccount: string, ids: Array<{ level: Level; platformId: string }>): Promise<EntitySnapshot[]> {
  if (ids.length === 0) return [];
  const account = await readAccount(workspace, adAccount);
  const currency = account.currency ?? "RON";
  const found: EntitySnapshot[] = [];
  const fields: Record<Level, string> = { campaign: CAMPAIGN_FIELDS, group: ADSET_FIELDS, ad: AD_FIELDS };
  for (const level of ["campaign", "group", "ad"] as const) {
    const wanted = ids.filter((item) => item.level === level && /^\d+$/.test(item.platformId)).map((item) => item.platformId);
    for (let index = 0; index < wanted.length; index += 50) {
      const chunk = wanted.slice(index, index + 50);
      let rows: Record<string, unknown> = {};
      try {
        rows = await metaGet<Record<string, unknown>>(workspace, "/", { ids: chunk.join(","), fields: fields[level] });
      } catch (error) {
        // Un id pe care Meta nu-l mai dă deloc: rândul rămâne cu ultima stare (sau „nu mai apare”).
        if (error instanceof MetaApiError && error.info.code === 100) continue;
        throw error;
      }
      for (const value of Object.values(rows)) {
        const entity =
          level === "campaign"
            ? campaignEntity(value as RawCampaign, currency, new Map())
            : level === "group"
              ? adSetEntity(value as RawAdSet, currency)
              : adEntity(value as RawAd);
        if (entity) found.push(entity);
      }
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Cifrele pe zi
// ---------------------------------------------------------------------------

interface ActionValue {
  action_type?: string;
  value?: string;
}

interface RawInsight {
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  date_start?: string;
  spend?: string;
  impressions?: string;
  inline_link_clicks?: string;
  clicks?: string;
  actions?: ActionValue[];
  video_thruplay_watched_actions?: ActionValue[];
}

const INSIGHT_FIELDS = "campaign_id,adset_id,ad_id,date_start,spend,impressions,inline_link_clicks,clicks,actions,video_thruplay_watched_actions";
const WINDOW_DAYS = 30;

/** Timeout de raport la Meta (prea mult de calculat): fereastra se înjumătățește. */
function isTooBig(error: unknown): boolean {
  if (!(error instanceof MetaApiError)) return false;
  const { code, subcode } = error.info;
  return (code === 100 && subcode === 1504018) || (code === 2 && subcode === 1504038) || (code === -3 && subcode === 1504045);
}

function daysBetween(since: string, until: string): number {
  return Math.round((Date.parse(`${until}T00:00:00Z`) - Date.parse(`${since}T00:00:00Z`)) / 86_400_000) + 1;
}

async function insightsWindow(workspace: AdsWorkspace, adAccount: string, since: string, until: string): Promise<RawInsight[]> {
  try {
    return await metaGetAll<RawInsight>(
      workspace,
      `/${adAccount}/insights`,
      {
        level: "ad",
        fields: INSIGHT_FIELDS,
        time_increment: 1,
        time_range: { since, until },
        // Reclamele șterse și arhivate intră și ele: altfel sumele seturilor și campaniilor ar fi mai mici.
        filtering: [{ field: "ad.effective_status", operator: "IN", value: [...META_LISTED_STATUSES, "DELETED"] }],
        use_unified_attribution_setting: true,
        limit: 500,
      },
      200_000
    );
  } catch (error) {
    const length = daysBetween(since, until);
    if (!isTooBig(error) || length <= 1) throw error;
    const middle = addDays(since, Math.floor(length / 2) - 1);
    return [...(await insightsWindow(workspace, adAccount, since, middle)), ...(await insightsWindow(workspace, adAccount, addDays(middle, 1), until))];
  }
}

async function readDaily(workspace: AdsWorkspace, adAccount: string, since: string, until: string): Promise<DailySnapshot[]> {
  const days = new Map<string, DailySnapshot>();
  const add = (level: Level, platformId: string, date: string, row: RawInsight) => {
    const key = `${level}|${platformId}|${date}`;
    const target = days.get(key) ?? { level, platformId, date, spend: 0, impressions: 0, clicks: 0, conversions: {}, extra: {} };
    target.spend = Math.round((target.spend + num(row.spend)) * 100) / 100;
    target.impressions += Math.round(num(row.impressions));
    target.clicks += Math.round(num(row.inline_link_clicks));
    for (const action of row.actions ?? []) {
      if (!action.action_type || !isKept(action.action_type)) continue;
      const name = `m:${action.action_type}`;
      target.conversions[name] = Math.round(((target.conversions[name] ?? 0) + num(action.value)) * 100) / 100;
    }
    const allClicks = num(row.clicks);
    if (allClicks) target.extra.all_clicks = (target.extra.all_clicks ?? 0) + allClicks;
    const thruplay = num(row.video_thruplay_watched_actions?.find((action) => action.action_type === "video_view")?.value);
    if (thruplay) target.extra.thruplay = (target.extra.thruplay ?? 0) + thruplay;
    days.set(key, target);
  };

  for (let start = since; start <= until; start = addDays(start, WINDOW_DAYS)) {
    const end = [addDays(start, WINDOW_DAYS - 1), until].sort()[0];
    for (const row of await insightsWindow(workspace, adAccount, start, end)) {
      if (!row.date_start) continue;
      if (row.ad_id) add("ad", row.ad_id, row.date_start, row);
      if (row.adset_id) add("group", row.adset_id, row.date_start, row);
      if (row.campaign_id) add("campaign", row.campaign_id, row.date_start, row);
    }
  }
  return [...days.values()];
}

/** Meta în modelul comun, legat de spațiul care are tokenul. */
export function metaStructureReader(workspace: AdsWorkspace): StructureReader {
  return {
    platform: "meta",
    readStructure: (adAccount) => readStructure(workspace, adAccount),
    readDaily: (adAccount, since, until) => readDaily(workspace, adAccount, since, until),
    readMissing: (adAccount, ids) => readMissing(workspace, adAccount, ids),
  };
}
