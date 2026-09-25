import { OBJECTIVES_WITH_CONVERSION, TIKTOK_AGE_GROUPS, type ConversionEvent, type Cta, type Objective } from "../constants";
import { adSetName, buildFinalUrl, deriveAds, tiktokAgeGroups } from "../plan-derive";
import type { Plan } from "../plan-schema";
import { TIKTOK_DISABLED } from "../meta/paused";

/**
 * Planul tradus în corpurile de cerere TikTok API for Business v1.3 —
 * SINGURUL loc care construiește obiectele trimise la TikTok.
 *
 * Funcții pure: primesc planul (cu id-urile de targetare deja rezolvate) și
 * id-urile create la pasul anterior. Statusul vine dintr-o singură constantă
 * (`operation_status: DISABLE`), iar `tiktokCreate` verifică oricum fiecare
 * corp cu `assertTikTokDisabled` înainte de rețea.
 *
 * Campanie MANUALĂ (`/campaign/create/` nu face Smart+). Automatizările care
 * pornesc singure dacă nu le trimitem sunt trimise explicit oprite:
 * îmbunătățirile creative (`creative_auto_enhancement_strategy_list: []`),
 * afișarea în căutare (`search_result_enabled: false`, pornită implicit la
 * obiectivele cu site), publicul „smart", muzica promoțională.
 *
 * Maparea e verificată pe documentația v1.3 (2026-09-25); ce n-a putut fi
 * verificat e în lib/ads/README.md → „Faza 5".
 */

// ---------------------------------------------------------------------------
// Vocabularul TikTok
// ---------------------------------------------------------------------------

/**
 * Obiectivul. Lead-urile și vânzările de pe site merg ca conversii web
 * (`WEB_CONVERSIONS`, optimizare pe evenimentul pixelului) — drumul clasic,
 * cu același eveniment pe care îl trimite site-ul.
 */
export const TIKTOK_OBJECTIVE: Record<Objective, string> = {
  leads: "WEB_CONVERSIONS",
  sales: "WEB_CONVERSIONS",
  traffic: "TRAFFIC",
  video_views: "VIDEO_VIEWS",
  awareness: "REACH",
};

/** `optimization_event` pentru evenimentele site-ului. `null` = fără echivalent. */
export const TIKTOK_OPTIMIZATION_EVENT: Record<ConversionEvent, string | null> = {
  lead: "FORM",
  contact: "CONSULT",
  schedule: null,
  complete_registration: "ON_WEB_REGISTER",
  purchase: "SHOPPING",
  view_content: "ON_WEB_DETAIL",
};

/**
 * Pe ce optimizează grupul și cum se plătește. La Trafic: clicuri, nu
 * vizualizări de pagină — acelea depind de pixel, iar pixelul site-ului
 * pornește doar după acordul cookie (lib/ads/GHID.md, decizia 3.14).
 */
const OPTIMIZATION: Record<Objective, { optimization_goal: string; billing_event: string; promotion_type: string }> = {
  leads: { optimization_goal: "CONVERT", billing_event: "OCPM", promotion_type: "WEBSITE" },
  sales: { optimization_goal: "CONVERT", billing_event: "OCPM", promotion_type: "WEBSITE" },
  traffic: { optimization_goal: "CLICK", billing_event: "CPC", promotion_type: "WEBSITE" },
  video_views: { optimization_goal: "ENGAGED_VIEW", billing_event: "CPV", promotion_type: "WEBSITE_OR_DISPLAY" },
  awareness: { optimization_goal: "REACH", billing_event: "CPM", promotion_type: "WEBSITE_OR_DISPLAY" },
};

/** Butoanele. Pe TikTok, „Descarcă" se cheamă `DOWNLOAD_NOW`. */
export const TIKTOK_CTA: Record<Cta, string> = {
  learn_more: "LEARN_MORE",
  get_quote: "GET_QUOTE",
  contact_us: "CONTACT_US",
  sign_up: "SIGN_UP",
  apply_now: "APPLY_NOW",
  subscribe: "SUBSCRIBE",
  download: "DOWNLOAD_NOW",
};

const AGE_GROUP_ENUM: Record<string, string> = {
  "18–24": "AGE_18_24",
  "25–34": "AGE_25_34",
  "35–44": "AGE_35_44",
  "45–54": "AGE_45_54",
  "55+": "AGE_55_100",
};

/** Ora de start: acum, în UTC, forma cerută de TikTok. */
export function tiktokStartTime(now: Date = new Date()): string {
  return now.toISOString().slice(0, 19).replace("T", " ");
}

function finalUrl(plan: Plan): string {
  return buildFinalUrl(plan.destination.url, plan.destination.utm ?? null) ?? plan.destination.url;
}

// ---------------------------------------------------------------------------
// Campania
// ---------------------------------------------------------------------------

export function buildCampaign(plan: Plan, advertiserId: string): Record<string, unknown> {
  return {
    advertiser_id: advertiserId,
    campaign_name: plan.campaign.name,
    objective_type: TIKTOK_OBJECTIVE[plan.campaign.objective],
    // „Vânzări" pe TikTok = conversii web afișate ca vânzări în Ads Manager.
    ...(plan.campaign.objective === "sales" ? { virtual_objective_type: "SALES", sales_destination: "WEBSITE" } : {}),
    // Bugetul stă pe grup; campania fără plafon propriu și fără CBO.
    budget_mode: "BUDGET_MODE_INFINITE",
    operation_status: TIKTOK_DISABLED,
  };
}

// ---------------------------------------------------------------------------
// Grupul de reclame
// ---------------------------------------------------------------------------

export interface AdGroupContext {
  campaignId: string;
  locationIds: string[];
  languageCodes: string[];
  interestIds: string[];
  /** Id-ul numeric al pixelului, la obiectivele cu conversie. */
  pixelId: string | null;
  startTime: string;
}

export function ageGroupsOf(plan: Plan): string[] {
  const groups = tiktokAgeGroups(plan.audience.age_min, plan.audience.age_max)?.groups ?? TIKTOK_AGE_GROUPS;
  return groups.map((group) => AGE_GROUP_ENUM[group.label]).filter(Boolean);
}

export function buildAdGroup(plan: Plan, advertiserId: string, context: AdGroupContext): Record<string, unknown> {
  const objective = plan.campaign.objective;
  const optimization = OPTIMIZATION[objective];
  const conversion = OBJECTIVES_WITH_CONVERSION.includes(objective) ? plan.conversion : undefined;
  const tiktok = plan.tiktok;

  return {
    advertiser_id: advertiserId,
    campaign_id: context.campaignId,
    adgroup_name: adSetName(plan.campaign.name),
    promotion_type: optimization.promotion_type,
    // Plasările: doar TikTok (implicit în plan) sau automate.
    ...(tiktok?.placements === "automatic"
      ? { placement_type: "PLACEMENT_TYPE_AUTOMATIC" }
      : { placement_type: "PLACEMENT_TYPE_NORMAL", placements: ["PLACEMENT_TIKTOK"] }),
    // Implicit PORNIT la obiectivele cu site: reclama ar apărea și în căutare.
    search_result_enabled: false,
    location_ids: context.locationIds,
    age_groups: ageGroupsOf(plan),
    gender:
      plan.audience.gender === "male" ? "GENDER_MALE" : plan.audience.gender === "female" ? "GENDER_FEMALE" : "GENDER_UNLIMITED",
    ...(context.languageCodes.length > 0 ? { languages: context.languageCodes } : {}),
    ...(context.interestIds.length > 0 ? { interest_category_ids: context.interestIds } : {}),
    // Fără lărgirea automată a publicului.
    smart_audience_enabled: false,
    smart_interest_behavior_enabled: false,
    creative_material_mode: "CUSTOM",
    budget_mode: "BUDGET_MODE_DAY",
    budget: plan.campaign.daily_budget,
    schedule_type: "SCHEDULE_FROM_NOW",
    schedule_start_time: context.startTime,
    optimization_goal: optimization.optimization_goal,
    billing_event: optimization.billing_event,
    bid_type: "BID_TYPE_NO_BID",
    pacing: "PACING_MODE_SMOOTH",
    ...(conversion && context.pixelId
      ? {
          pixel_id: context.pixelId,
          optimization_event: TIKTOK_OPTIMIZATION_EVENT[conversion.event],
          // Fără optimizarea pe un al doilea eveniment, „mai adânc" în pâlnie.
          deep_funnel_optimization_status: "OFF",
        }
      : {}),
    operation_status: TIKTOK_DISABLED,
  };
}

// ---------------------------------------------------------------------------
// Reclamele
// ---------------------------------------------------------------------------

export interface AdsContext {
  adGroupId: string;
  videoId: string;
  /** Coperta: `image_id` din biblioteca de imagini a contului. */
  coverImageId: string;
  pixelId: string | null;
}

/**
 * Îmbunătățirile creative ale unei reclame manuale. Doar patru există pe
 * reclamele manuale (VIDEO_QUALITY, MUSIC_REFRESH, IMAGE_QUALITY,
 * IMAGE_RESIZE); oprit în plan = lista goală, trimisă explicit (pentru
 * unele conturi, TikTok le pornește implicit). „Auto-add assets" și
 * „Translate and dub" există doar în Smart+, deci pe campaniile portalului
 * sunt oprite oricum.
 */
export function enhancementStrategies(plan: Plan): string[] {
  const enhancements = plan.tiktok?.enhancements;
  return [
    ...(enhancements?.automatic_enhancements ? ["VIDEO_QUALITY"] : []),
    ...(enhancements?.music_refresh ? ["MUSIC_REFRESH"] : []),
  ];
}

export function buildAds(plan: Plan, advertiserId: string, context: AdsContext): Record<string, unknown> {
  const tiktok = plan.tiktok;
  if (!tiktok) throw new Error("Planul TikTok fără secțiunea tiktok — validarea trebuia să-l oprească.");
  const ads = deriveAds({
    campaignName: plan.campaign.name,
    primaryTexts: plan.creative.primary_texts,
    headlines: [],
    descriptions: [],
    mode: "one_ad_per_text",
  });

  return {
    advertiser_id: advertiserId,
    adgroup_id: context.adGroupId,
    creatives: ads.map((ad) => ({
      ad_name: ad.name,
      identity_type: tiktok.identity_type,
      identity_id: tiktok.identity_id,
      ...(tiktok.identity_type === "BC_AUTH_TT" && tiktok.identity_bc_id
        ? { identity_authorized_bc_id: tiktok.identity_bc_id }
        : {}),
      ad_format: "SINGLE_VIDEO",
      video_id: context.videoId,
      image_ids: [context.coverImageId],
      ad_text: ad.primaryTexts[0],
      call_to_action: TIKTOK_CTA[plan.creative.cta],
      landing_page_url: finalUrl(plan),
      // Număr în JSON, cu toate cele 19 cifre: BigInt, serializat exact de `api.ts`.
      ...(context.pixelId && /^\d+$/.test(context.pixelId) ? { tracking_pixel_id: BigInt(context.pixelId) } : {}),
      creative_auto_enhancement_strategy_list: enhancementStrategies(plan),
      // Destinația rămâne pagina din plan; TikTok n-o înlocuiește cu alta.
      dynamic_destination: "UNSET",
      // Lipsă = TikTok leagă singur toate seturile de evenimente offline ale contului.
      tracking_offline_event_set_ids: [],
      // Spark Ads: postarea există doar ca reclamă, nu apare pe profil.
      dark_post_status: "ON",
      promotional_music_disabled: true,
      creative_authorized: false,
    })),
    operation_status: TIKTOK_DISABLED,
  };
}
