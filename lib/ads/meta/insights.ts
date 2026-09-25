import "server-only";

import type { ConversionEvent, Objective } from "../constants";
import type { AdsWorkspace } from "../workspaces";
import { metaGet, metaGetAll } from "./graph";

/**
 * Cifrele zilnice din Meta Insights, pe campanie — doar citire.
 *
 * O singură cerere pe cont de reclame (`level=campaign`, filtrată pe
 * campaniile portalului, `time_increment=1`), nu una pe campanie: contează
 * pentru limita de cereri a contului.
 *
 * „Clicuri" = clicuri pe link (`inline_link_clicks`), ca în coloanele
 * implicite din Ads Manager (CTR și CPC „link"). „Rezultate" = ce urmărește
 * obiectivul campaniei: evenimentul de pixel la Lead-uri/Vânzări,
 * vizualizările paginii de destinație la Trafic, ThruPlay la video,
 * acoperirea la Notorietate. Răspunsul brut rămâne în `raw`.
 */

interface ActionValue {
  action_type?: string;
  value?: string;
}

interface RawInsight {
  campaign_id?: string;
  date_start?: string;
  date_stop?: string;
  spend?: string;
  impressions?: string;
  inline_link_clicks?: string;
  clicks?: string;
  reach?: string;
  actions?: ActionValue[];
  video_thruplay_watched_actions?: ActionValue[];
}

export interface InsightDay {
  platformId: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  raw: RawInsight;
}

export interface InsightCampaign {
  platformId: string;
  objective: Objective;
  event: ConversionEvent | null;
}

const FIELDS = [
  "campaign_id",
  // Coloana „Results” din Ads Manager; forma elementelor nu e documentată
  // strict, deci doar se păstrează în `raw`, pentru comparații ulterioare.
  "results",
  "spend",
  "impressions",
  "inline_link_clicks",
  "clicks",
  "reach",
  "actions",
  "video_thruplay_watched_actions",
].join(",");

/**
 * Tipul de acțiune al evenimentului de pe site, cum îl raportează Meta
 * (AdsActionStats, v26). UN SINGUR tip pe campanie: `lead` înseamnă „toate
 * lead-urile, de pe site și din Meta” și le include deja pe cele din pixel —
 * adunate, s-ar număra de două ori. La fel `omni_*` și `*_total`.
 */
export const PIXEL_ACTION: Record<ConversionEvent, string> = {
  lead: "offsite_conversion.fb_pixel_lead",
  contact: "contact_website",
  schedule: "schedule_website",
  complete_registration: "offsite_conversion.fb_pixel_complete_registration",
  purchase: "offsite_conversion.fb_pixel_purchase",
  view_content: "offsite_conversion.fb_pixel_view_content",
};

function num(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function actionValue(list: ActionValue[] | undefined, type: string): number {
  return num(list?.find((action) => action.action_type === type)?.value);
}

export function resultsOf(row: RawInsight, objective: Objective, event: ConversionEvent | null): number {
  switch (objective) {
    case "leads":
    case "sales":
      return event ? actionValue(row.actions, PIXEL_ACTION[event]) : 0;
    case "traffic":
      return actionValue(row.actions, "landing_page_view");
    case "video_views":
      return actionValue(row.video_thruplay_watched_actions, "video_view");
    case "awareness":
      return num(row.reach);
  }
}

export async function fetchCampaignInsights(
  workspace: AdsWorkspace,
  adAccount: string,
  input: { campaigns: InsightCampaign[]; since: string; until: string }
): Promise<InsightDay[]> {
  if (input.campaigns.length === 0) return [];
  const byId = new Map(input.campaigns.map((campaign) => [campaign.platformId, campaign]));

  const raw = await metaGetAll<RawInsight>(
    workspace,
    `/${adAccount}/insights`,
    {
      level: "campaign",
      fields: FIELDS,
      time_increment: 1,
      time_range: { since: input.since, until: input.until },
      filtering: [{ field: "campaign.id", operator: "IN", value: [...byId.keys()] }],
      // Ca în Ads Manager: fereastra de atribuire a setului de reclame.
      use_unified_attribution_setting: true,
      limit: 500,
    },
    50_000
  );

  return raw.flatMap((row) => {
    const campaign = row.campaign_id ? byId.get(row.campaign_id) : undefined;
    if (!campaign || !row.date_start) return [];
    return [
      {
        platformId: campaign.platformId,
        date: row.date_start,
        spend: Math.round(num(row.spend) * 100) / 100,
        impressions: Math.round(num(row.impressions)),
        clicks: Math.round(num(row.inline_link_clicks)),
        results: resultsOf(row, campaign.objective, campaign.event),
        raw: row,
      },
    ];
  });
}

/**
 * Statusul de livrare curent (`effective_status`), pe id de campanie.
 * Câte o citire pe campanie, nu lista contului: lista nu întoarce
 * campaniile șterse, iar o campanie de test ștearsă din Ads Manager trebuie
 * să apară ștearsă și aici. Un id pe care Meta nu-l mai dă e sărit.
 */
export async function fetchCampaignStatuses(
  workspace: AdsWorkspace,
  _adAccount: string,
  platformIds: string[]
): Promise<Map<string, string>> {
  const statuses = new Map<string, string>();
  for (let index = 0; index < platformIds.length; index += 10) {
    const chunk = platformIds.slice(index, index + 10);
    const results = await Promise.allSettled(
      chunk.map((id) => metaGet<{ id: string; effective_status?: string }>(workspace, `/${id}`, { fields: "id,effective_status" }))
    );
    results.forEach((result, position) => {
      if (result.status === "fulfilled" && result.value.effective_status) {
        statuses.set(chunk[position], result.value.effective_status);
      }
    });
  }
  return statuses;
}
