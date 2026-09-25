import {
  CONVERSION_EVENT_NAME,
  OBJECTIVES_WITH_CONVERSION,
  type ConversionEvent,
  type Cta,
  type MetaPlacement,
  type Objective,
} from "../constants";
import { adSetName, buildFinalUrl, deriveAds, type DerivedAd } from "../plan-derive";
import type { Plan } from "../plan-schema";
import { PAUSED } from "./paused";

/**
 * Planul tradus în corpurile de cerere ale Marketing API (v26.0) — SINGURUL
 * loc care construiește obiectele trimise la Meta.
 *
 * Funcții pure: primesc planul (cu cheile de targetare deja rezolvate) și
 * id-urile create la pasul anterior, întorc exact ce pleacă. Statusul vine
 * dintr-o singură constantă, iar `metaPost` verifică oricum fiecare corp cu
 * `assertPaused` înainte de rețea.
 *
 * Îmbunătățirile automate se trimit EXPLICIT oprite. Nu ne bazăm pe
 * valorile implicite ale Meta: se schimbă de la o versiune la alta, iar mai
 * multe sunt pornite implicit (adapt_to_placement, description_automation,
 * inline_comment, multi-advertiser).
 *
 * Maparea e verificată pe documentația Meta și pe SDK-ul oficial v26.0.2
 * (2026-09-25). Ce n-a putut fi verificat e notat în lib/ads/README.md.
 */

// ---------------------------------------------------------------------------
// Vocabularul Meta
// ---------------------------------------------------------------------------

/** Obiectivele ODAX (Outcome-Driven Ad Experiences). */
export const META_OBJECTIVE: Record<Objective, string> = {
  leads: "OUTCOME_LEADS",
  traffic: "OUTCOME_TRAFFIC",
  sales: "OUTCOME_SALES",
  video_views: "OUTCOME_ENGAGEMENT",
  awareness: "OUTCOME_AWARENESS",
};

/** `custom_event_type` pentru `promoted_object`, din evenimentul planului. */
export const META_CUSTOM_EVENT: Record<ConversionEvent, string> = {
  lead: "LEAD",
  contact: "CONTACT",
  schedule: "SCHEDULE",
  complete_registration: "COMPLETE_REGISTRATION",
  purchase: "PURCHASE",
  view_content: "CONTENT_VIEW",
};

export const META_CTA: Record<Cta, string> = {
  learn_more: "LEARN_MORE",
  get_quote: "GET_QUOTE",
  contact_us: "CONTACT_US",
  sign_up: "SIGN_UP",
  apply_now: "APPLY_NOW",
  subscribe: "SUBSCRIBE",
  download: "DOWNLOAD",
};

/**
 * Pe ce optimizează setul, pe obiectiv. La trafic, `destination_type` nu
 * se trimite (valorile documentate sunt Messenger, WhatsApp, apel);
 * la vizualizări video, `ON_VIDEO` ține de obiectivul Engagement.
 */
const OPTIMIZATION: Record<
  Objective,
  { optimization_goal: string; destination_type?: string; promotesPage?: boolean }
> = {
  leads: { optimization_goal: "OFFSITE_CONVERSIONS", destination_type: "WEBSITE" },
  sales: { optimization_goal: "OFFSITE_CONVERSIONS", destination_type: "WEBSITE" },
  traffic: { optimization_goal: "LANDING_PAGE_VIEWS" },
  video_views: { optimization_goal: "THRUPLAY", destination_type: "ON_VIDEO" },
  awareness: { optimization_goal: "REACH", promotesPage: true },
};

/** Plasările planului → platforma și poziția Meta. */
const PLACEMENT: Record<MetaPlacement, { platform: "facebook" | "instagram"; position: string }> = {
  facebook_feed: { platform: "facebook", position: "feed" },
  facebook_reels: { platform: "facebook", position: "facebook_reels" },
  facebook_stories: { platform: "facebook", position: "story" },
  instagram_feed: { platform: "instagram", position: "stream" },
  instagram_reels: { platform: "instagram", position: "reels" },
  instagram_stories: { platform: "instagram", position: "story" },
};

/**
 * Advantage+ creative, funcție cu funcție. Pachetul `standard_enhancements`
 * e refuzat de Meta din v22; fiecare funcție se refuză separat. Cheile sunt
 * cele din SDK-ul oficial v26.0.2 (`AdCreativeFeaturesSpec`) care privesc o
 * reclamă video cu destinație site; cele de catalog, magazin sau WhatsApp
 * nu se trimit. O funcție care nu se aplică unui video e scoasă de Meta,
 * nu respinsă.
 */
export const META_CREATIVE_FEATURES = [
  "adapt_to_placement",
  "add_text_overlay",
  "ads_with_benefits",
  "audio",
  "biz_ai",
  "creative_stickers",
  "cv_transformation",
  "description_automation",
  "dynamic_cta_text",
  "enable_ncs_testimonials",
  "enhance_cta",
  "feed_caption_optimization",
  "generate_cta",
  "hyperlink_formatting",
  "ig_video_native_subtitle",
  "inline_comment",
  "media_type_automation",
  "music_generation",
  "pac_genai_recomposition",
  "pac_recomposition",
  "pac_relaxation",
  "profile_card",
  "profile_extension",
  "replace_media_text",
  "text_extraction_for_headline",
  "text_extraction_for_tap_target",
  "text_formatting_optimization",
  "text_generation",
  "text_optimizations",
  "text_overlay_translation",
  "text_translation",
  "translate_voiceover",
  "video_auto_crop",
  "video_filtering",
  "video_highlight",
  "video_highlights",
  "video_to_image",
  "video_uncrop",
  "video_voiceover",
] as const;

/**
 * „Ad sources" din Ads Manager n-are un câmp propriu în API: e sursa
 * (site, pagină, magazin) din care Meta alimentează funcțiile de mai jos.
 * Oprit în plan = fiecare dintre ele refuzată explicit.
 */
export const AD_SOURCES_FEATURES = [
  "local_store_extension",
  "reveal_details_over_time",
  "show_destination_blurbs",
  "show_summary",
  "site_extensions",
] as const;

// ---------------------------------------------------------------------------
// Bani și domeniu
// ---------------------------------------------------------------------------

/** RON, EUR și USD au două zecimale: 60 lei = 6000 de bani. */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

/** Sufixe cu două niveluri, ca `shop.firma.com.ro` să dea `firma.com.ro`. */
const TWO_LEVEL_SUFFIXES = new Set(["com.ro", "org.ro", "info.ro", "co.uk", "com.md", "co.at"]);

/**
 * Domeniul pe care se întâmplă conversia (`conversion_domain`), cerut pe
 * reclamele care optimizează pe un eveniment de pixel: domeniul
 * înregistrabil, fără `www.` și fără subdomenii.
 */
export function conversionDomain(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  const labels = host.split(".");
  if (labels.length <= 2) return host;
  const lastTwo = labels.slice(-2).join(".");
  return TWO_LEVEL_SUFFIXES.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo;
}

// ---------------------------------------------------------------------------
// Campania
// ---------------------------------------------------------------------------

export function buildCampaign(plan: Plan): Record<string, unknown> {
  const categories = (plan.meta?.special_ad_categories ?? []).map((category) => category.toUpperCase());
  const countries = [
    ...new Set(plan.audience.locations.map((location) => (location.type === "country" ? location.code : location.country))),
  ];
  return {
    name: plan.campaign.name,
    objective: META_OBJECTIVE[plan.campaign.objective],
    status: PAUSED,
    buying_type: "AUCTION",
    // Listă goală = nicio categorie specială (forma documentată).
    special_ad_categories: categories,
    ...(categories.length > 0 ? { special_ad_category_country: countries } : {}),
    // Bugetul stă pe set, nu pe campanie; obligatoriu din v24. `false` =
    // fiecare set cheltuie doar bugetul lui. Fără buget pe campanie, Meta
    // nu transformă campania în „Advantage+".
    is_adset_budget_sharing_enabled: false,
  };
}

// ---------------------------------------------------------------------------
// Setul de reclame
// ---------------------------------------------------------------------------

export function buildTargeting(plan: Plan, locales: number[]): Record<string, unknown> {
  const { audience } = plan;
  const countries: string[] = [];
  const regions: Array<{ key: string }> = [];
  const cities: Array<{ key: string; radius?: number; distance_unit?: string }> = [];

  for (const location of audience.locations) {
    if (location.type === "country") countries.push(location.code);
    else if (location.type === "region" && location.key) regions.push({ key: location.key });
    else if (location.type === "city" && location.key) {
      cities.push(
        location.radius_km
          ? { key: location.key, radius: location.radius_km, distance_unit: "kilometer" }
          : { key: location.key }
      );
    }
  }

  const interests = audience.interests.flatMap((item) => (item.id ? [{ id: item.id, name: item.name }] : []));
  const behaviors = audience.behaviors.flatMap((item) => (item.id ? [{ id: item.id, name: item.name }] : []));
  const meta = plan.meta;

  const targeting: Record<string, unknown> = {
    geo_locations: {
      ...(countries.length > 0 ? { countries } : {}),
      ...(regions.length > 0 ? { regions } : {}),
      ...(cities.length > 0 ? { cities } : {}),
      location_types: ["home", "recent"],
    },
    age_min: audience.age_min,
    age_max: audience.age_max,
    ...(audience.gender === "male" ? { genders: [1] } : audience.gender === "female" ? { genders: [2] } : {}),
    ...(locales.length > 0 ? { locales } : {}),
    ...(interests.length > 0 || behaviors.length > 0
      ? {
          flexible_spec: [
            {
              ...(interests.length > 0 ? { interests } : {}),
              ...(behaviors.length > 0 ? { behaviors } : {}),
            },
          ],
        }
      : {}),
    // Obligatoriu din v23 când vârsta, genul sau interesele nu sunt cele
    // implicite; îl trimitem mereu. 0 = vârsta și genul sunt limite stricte.
    targeting_automation: { advantage_audience: meta?.advantage_audience ? 1 : 0 },
  };

  if (meta && Array.isArray(meta.placements)) {
    const chosen = meta.placements.map((placement) => PLACEMENT[placement]);
    const facebook = chosen.filter((item) => item.platform === "facebook").map((item) => item.position);
    const instagram = chosen.filter((item) => item.platform === "instagram").map((item) => item.position);
    targeting.publisher_platforms = [
      ...(facebook.length > 0 ? ["facebook"] : []),
      ...(instagram.length > 0 ? ["instagram"] : []),
    ];
    if (facebook.length > 0) targeting.facebook_positions = facebook;
    if (instagram.length > 0) targeting.instagram_positions = instagram;
  }

  return targeting;
}

export interface Dsa {
  beneficiary: string;
  payor: string;
}

export interface AdSetContext {
  campaignId: string;
  locales: number[];
  /** Beneficiarul și plătitorul — obligatorii în UE (DSA); null în afara UE. */
  dsa: Dsa | null;
}

export function buildAdSet(plan: Plan, context: AdSetContext): Record<string, unknown> {
  const objective = plan.campaign.objective;
  const optimization = OPTIMIZATION[objective];
  const conversion = OBJECTIVES_WITH_CONVERSION.includes(objective) ? plan.conversion : undefined;
  const promotedObject = conversion
    ? { pixel_id: conversion.pixel_id, custom_event_type: META_CUSTOM_EVENT[conversion.event] }
    : optimization.promotesPage && plan.meta
      ? { page_id: plan.meta.page_id }
      : null;

  return {
    name: adSetName(plan.campaign.name),
    campaign_id: context.campaignId,
    status: PAUSED,
    daily_budget: toMinorUnits(plan.campaign.daily_budget),
    billing_event: "IMPRESSIONS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    optimization_goal: optimization.optimization_goal,
    ...(optimization.destination_type ? { destination_type: optimization.destination_type } : {}),
    ...(promotedObject ? { promoted_object: promotedObject } : {}),
    // Alternarea textelor pe Meta = dynamic creative: o reclamă pe set.
    ...(plan.creative.variants === "platform_rotates" ? { is_dynamic_creative: true } : {}),
    targeting: buildTargeting(plan, context.locales),
    ...(context.dsa ? { dsa_beneficiary: context.dsa.beneficiary, dsa_payor: context.dsa.payor } : {}),
  };
}

// ---------------------------------------------------------------------------
// Creative și reclame
// ---------------------------------------------------------------------------

/**
 * Îmbunătățirile, ca listă de câmpuri. Oprit în plan (implicit) = OPT_OUT
 * trimis explicit pentru fiecare funcție a grupului. Pornit în plan = nu
 * trimitem nimic pentru grupul ăla — decide Meta, iar previzualizarea a
 * avertizat deja.
 */
export function buildEnhancements(plan: Plan): Record<string, unknown> {
  const enhancements = plan.meta?.enhancements ?? {
    advantage_creative: false,
    ad_sources: false,
    multi_advertiser_ads: false,
  };
  const features = [
    ...(enhancements.advantage_creative ? [] : META_CREATIVE_FEATURES),
    ...(enhancements.ad_sources ? [] : AD_SOURCES_FEATURES),
  ];
  return {
    ...(features.length > 0
      ? {
          degrees_of_freedom_spec: {
            creative_features_spec: Object.fromEntries(
              features.map((feature) => [feature, { enroll_status: "OPT_OUT" }])
            ),
          },
        }
      : {}),
    ...(enhancements.multi_advertiser_ads ? {} : { contextual_multi_ads: { enroll_status: "OPT_OUT" } }),
  };
}

/**
 * Coperta video-ului: `hash` = imagine urcată în contul de reclame (coperta
 * propusă de Meta, descărcată și urcată de portal); `url` = imaginea din plan,
 * pe care Meta o descarcă singur.
 */
export type Thumbnail = { hash: string } | { url: string };

export interface CreativeContext {
  videoId: string;
  thumbnail: Thumbnail;
}

function finalUrl(plan: Plan): string {
  const destination = plan.destination;
  return buildFinalUrl(destination.url, destination.utm ?? null) ?? destination.url;
}

function identity(plan: Plan): Record<string, unknown> {
  const meta = plan.meta;
  if (!meta) throw new Error("Planul Meta fără secțiunea meta — validarea trebuia să-l oprească.");
  return {
    page_id: meta.page_id,
    // `instagram_actor_id` e retras din 2025-09-09 pe toate versiunile.
    ...(meta.instagram_account_id ? { instagram_user_id: meta.instagram_account_id } : {}),
  };
}

/** O reclamă = un text principal (+ titlul și descrierea de pe același index). */
function singleCreative(plan: Plan, ad: DerivedAd, context: CreativeContext): Record<string, unknown> {
  return {
    name: ad.name,
    object_story_spec: {
      ...identity(plan),
      video_data: {
        video_id: context.videoId,
        ...("hash" in context.thumbnail ? { image_hash: context.thumbnail.hash } : { image_url: context.thumbnail.url }),
        message: ad.primaryTexts[0],
        ...(ad.headlines[0] ? { title: ad.headlines[0] } : {}),
        ...(ad.descriptions[0] ? { link_description: ad.descriptions[0] } : {}),
        call_to_action: { type: META_CTA[plan.creative.cta], value: { link: finalUrl(plan) } },
      },
    },
    ...buildEnhancements(plan),
  };
}

/** Dynamic creative: o reclamă cu toate variantele; Meta alternează textele. */
function rotatingCreative(plan: Plan, ad: DerivedAd, context: CreativeContext): Record<string, unknown> {
  return {
    name: ad.name,
    object_story_spec: identity(plan),
    asset_feed_spec: {
      videos: [
        {
          video_id: context.videoId,
          ...("hash" in context.thumbnail
            ? { thumbnail_hash: context.thumbnail.hash }
            : { thumbnail_url: context.thumbnail.url }),
        },
      ],
      bodies: ad.primaryTexts.map((text) => ({ text })),
      ...(ad.headlines.length > 0 ? { titles: ad.headlines.map((text) => ({ text })) } : {}),
      ...(ad.descriptions.length > 0 ? { descriptions: ad.descriptions.map((text) => ({ text })) } : {}),
      call_to_action_types: [META_CTA[plan.creative.cta]],
      link_urls: [{ website_url: finalUrl(plan) }],
      ad_formats: ["SINGLE_VIDEO"],
    },
    ...buildEnhancements(plan),
  };
}

export interface PlannedAd {
  name: string;
  creative: Record<string, unknown>;
}

/** Reclamele planului, fiecare cu creativul ei — în ordinea din plan. */
export function buildCreatives(plan: Plan, context: CreativeContext): PlannedAd[] {
  const ads = deriveAds({
    campaignName: plan.campaign.name,
    primaryTexts: plan.creative.primary_texts,
    headlines: plan.creative.headlines,
    descriptions: plan.creative.descriptions,
    mode: plan.creative.variants,
  });
  return ads.map((ad) => ({
    name: ad.name,
    creative:
      plan.creative.variants === "platform_rotates"
        ? rotatingCreative(plan, ad, context)
        : singleCreative(plan, ad, context),
  }));
}

export function buildAd(
  plan: Plan,
  input: { name: string; adSetId: string; creativeId: string }
): Record<string, unknown> {
  // Cerut de Meta pe reclamele unei campanii care optimizează pe pixel.
  const domain = OBJECTIVES_WITH_CONVERSION.includes(plan.campaign.objective)
    ? conversionDomain(plan.destination.url)
    : null;
  return {
    name: input.name,
    adset_id: input.adSetId,
    creative: { creative_id: input.creativeId },
    status: PAUSED,
    ...(domain ? { conversion_domain: domain } : {}),
  };
}

/** Evenimentul Meta al planului, pentru mesaje („Lead"). */
export function metaEventName(event: ConversionEvent): string {
  return CONVERSION_EVENT_NAME[event].meta ?? event;
}
