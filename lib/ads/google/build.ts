import { OBJECTIVES_WITH_CONVERSION, type Cta, type GoogleChannel } from "../constants";
import { adSetName, deriveAds, googleAgeRanges, utmQuery } from "../plan-derive";
import type { Plan } from "../plan-schema";
import { GOOGLE_PAUSED } from "../meta/paused";

/**
 * Planul tradus în operațiile `googleAds:mutate` (Google Ads API v26) —
 * SINGURUL loc care construiește ce pleacă spre Google.
 *
 * O singură cerere, atomică, cu id-uri temporare (negative), în ordinea din
 * exemplul oficial Demand Gen: bugetul → campania → grupul de anunțuri →
 * publicul (Audience: interese, vârstă, gen) → criteriile grupului
 * (locații, limbi, publicul) → materialele (video-urile YouTube, sigla,
 * butonul) → reclamele video. Dacă Google refuză o singură operație, nu se
 * creează nimic. Aceeași listă, cu `validateOnly`, e „Verifică în Google".
 *
 * Statusul vine dintr-o singură constantă (`PAUSED`) pe campanie, grup și
 * reclame; criteriile pleacă FĂRĂ status (active = publicul rămâne cel din
 * plan). Automatizările care pornesc singure — video-urile verticale și
 * scurtate generate de Google, textele luate din pagina de destinație,
 * lărgirea publicului — se trimit explicit oprite, iar `googleMutate`
 * verifică oricum totul cu `assertGooglePaused`.
 *
 * Maparea e verificată pe referința v26 și pe exemplul oficial Demand Gen
 * (2026-10-18); ce n-a putut fi verificat fără un cont real e în
 * lib/ads/README.md → „Faza 6 — Google".
 */

// ---------------------------------------------------------------------------
// Vocabularul Google
// ---------------------------------------------------------------------------

/** Butoanele (CallToActionType) — toate șapte există pe Demand Gen. */
export const GOOGLE_CTA: Record<Cta, string> = {
  learn_more: "LEARN_MORE",
  get_quote: "GET_QUOTE",
  contact_us: "CONTACT_US",
  sign_up: "SIGN_UP",
  apply_now: "APPLY_NOW",
  subscribe: "SUBSCRIBE",
  download: "DOWNLOAD",
};

/** Canalele planului → câmpurile din `channelControls.selectedChannels`. */
export const GOOGLE_CHANNEL_FIELD: Record<GoogleChannel, string> = {
  youtube_in_stream: "youtubeInStream",
  youtube_in_feed: "youtubeInFeed",
  youtube_shorts: "youtubeShorts",
  discover: "discover",
  gmail: "gmail",
  display: "display",
};

/**
 * Automatizările unei reclame video Demand Gen (AssetAutomationType), pe
 * reclamă — pe campanie, setările de automatizare sunt doar pentru
 * Performance Max și Search. Primele trei sunt PORNITE implicit.
 */
export const GOOGLE_VIDEO_AUTOMATIONS = ["GENERATE_VERTICAL_YOUTUBE_VIDEOS", "GENERATE_SHORTER_YOUTUBE_VIDEOS"] as const;
export const GOOGLE_TEXT_AUTOMATIONS = ["GENERATE_LANDING_PAGE_TEXT", "GENERATE_LANDING_PAGE_PREVIEW"] as const;

export const EU_POLITICAL_NONE = "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING";

/** Suma în micro-unități, ca text (int64): 60 lei = "60000000". Multiplu de 10.000, cum cere Google pentru RON și EUR. */
export function toMicros(amount: number): string {
  return String(Math.round(amount * 100) * 10_000);
}

// ---------------------------------------------------------------------------
// Contextul și rolurile operațiilor
// ---------------------------------------------------------------------------

export interface GoogleBuildContext {
  /** Contul, doar cifre. */
  customerId: string;
  geoTargets: string[];
  languageConstants: string[];
  interestIds: string[];
  /** Video-urile YouTube ale planului, în ordine; `asset` = deja material în cont. */
  videos: Array<{ youtubeId: string; asset: string | null }>;
  /** Sigla: urcată acum (bytes) sau deja material în cont. */
  logo: { data: string; hash: string } | { resourceName: string };
  /** Sufix unic pentru numele publicului (Google cere nume unice în cont). */
  uniqueSuffix: string;
}

/** Ce reprezintă fiecare operație — o eroare Google pe operația N devine o eroare pe câmpul din plan. */
export interface OperationRole {
  kind: "budget" | "campaign" | "adgroup" | "audience" | "criterion" | "asset" | "ad";
  label: string;
  /** Calea din plan, când operația vine dintr-un câmp anume. */
  planPath: string | null;
}

export interface GoogleOperations {
  operations: Array<Record<string, unknown>>;
  roles: OperationRole[];
  /** Numele reclamelor, în ordinea operațiilor de reclamă. */
  adNames: string[];
}

const temp = (customerId: string, collection: string, id: number) => `customers/${customerId}/${collection}/${id}`;

/**
 * Dimensiunile publicului (Audience) din plan: interesele, vârsta (un singur
 * interval, pe grupele Google), genul. Fără nicio restricție = nicio dimensiune.
 */
export function audienceDimensions(plan: Plan, customerId: string, interestIds: string[]): Array<Record<string, unknown>> {
  const dimensions: Array<Record<string, unknown>> = [];
  if (interestIds.length > 0) {
    dimensions.push({
      audienceSegments: {
        segments: interestIds.map((id) => ({ userInterest: { userInterestCategory: `customers/${customerId}/userInterests/${id}` } })),
      },
    });
  }
  const groups = googleAgeRanges(plan.audience.age_min, plan.audience.age_max)?.groups ?? [];
  const everyone = groups.length === 0 || (groups[0].min === 18 && groups[groups.length - 1].min === 65);
  if (!everyone) {
    const last = groups[groups.length - 1];
    dimensions.push({
      age: {
        // 65+ nu are capăt de sus. Vârsta necunoscută rămâne afară: vârsta din plan e o limită.
        ageRanges: [{ minAge: groups[0].min, ...(last.min === 65 ? {} : { maxAge: last.max }) }],
        includeUndetermined: false,
      },
    });
  }
  if (plan.audience.gender !== "all") {
    dimensions.push({ gender: { genders: [plan.audience.gender === "male" ? "MALE" : "FEMALE"], includeUndetermined: false } });
  }
  return dimensions;
}

export function buildGoogleOperations(plan: Plan, context: GoogleBuildContext): GoogleOperations {
  const google = plan.google;
  if (!google) throw new Error("Planul Google fără secțiunea google — validarea trebuia să-l oprească.");
  const cid = context.customerId;
  const operations: Array<Record<string, unknown>> = [];
  const roles: OperationRole[] = [];
  const push = (operation: Record<string, unknown>, role: OperationRole) => {
    operations.push(operation);
    roles.push(role);
  };

  const budget = temp(cid, "campaignBudgets", -1);
  const campaign = temp(cid, "campaigns", -2);
  const adGroup = temp(cid, "adGroups", -3);
  const audience = temp(cid, "audiences", -4);
  const conversion = OBJECTIVES_WITH_CONVERSION.includes(plan.campaign.objective);

  // 1. Bugetul, propriu campaniei. Nepartajat trebuie spus explicit (implicit Google îl face partajat).
  push(
    {
      campaignBudgetOperation: {
        create: {
          resourceName: budget,
          name: `${plan.campaign.name} · buget · ${context.uniqueSuffix}`,
          amountMicros: toMicros(plan.campaign.daily_budget),
          deliveryMethod: "STANDARD",
          period: "DAILY",
          explicitlyShared: false,
        },
      },
    },
    { kind: "budget", label: "bugetul", planPath: "campaign.daily_budget" }
  );

  // 2. Campania Demand Gen, OPRITĂ.
  push(
    {
      campaignOperation: {
        create: {
          resourceName: campaign,
          name: plan.campaign.name,
          status: GOOGLE_PAUSED,
          advertisingChannelType: "DEMAND_GEN",
          campaignBudget: budget,
          // Lead-uri și Vânzări: conversiile principale ale contului. Trafic: clicuri (Maximize clicks, fără plafon de CPC).
          ...(conversion ? { maximizeConversions: {} } : { targetSpend: {} }),
          containsEuPoliticalAdvertising: EU_POLITICAL_NONE,
          // Locațiile și limbile stau pe grupul de anunțuri.
          demandGenCampaignSettings: { upgradedTargeting: true },
        },
      },
    },
    { kind: "campaign", label: "campania", planPath: "campaign" }
  );

  // 3. Grupul de anunțuri: canalele, publicul fără lărgire automată.
  const channels = google.channels;
  push(
    {
      adGroupOperation: {
        create: {
          resourceName: adGroup,
          name: adSetName(plan.campaign.name),
          campaign,
          status: GOOGLE_PAUSED,
          optimizedTargetingEnabled: google.optimized_targeting,
          // Publicul se atașează ca Audience (interese, vârstă, gen). Imuabil.
          audienceSetting: { useAudienceGrouped: true },
          demandGenAdGroupSettings: {
            channelControls:
              channels === "all"
                ? { channelStrategy: "ALL_CHANNELS" }
                : {
                    selectedChannels: {
                      ...Object.fromEntries(
                        (Object.keys(GOOGLE_CHANNEL_FIELD) as GoogleChannel[]).map((channel) => [
                          GOOGLE_CHANNEL_FIELD[channel],
                          channels.includes(channel),
                        ])
                      ),
                      maps: false,
                    },
                  },
          },
        },
      },
    },
    { kind: "adgroup", label: "grupul de anunțuri", planPath: "google.channels" }
  );

  // 4. Publicul: un singur Audience pe grup, cu toate restricțiile din plan.
  const dimensions = audienceDimensions(plan, cid, context.interestIds);
  if (dimensions.length > 0) {
    push(
      {
        audienceOperation: {
          create: {
            resourceName: audience,
            name: `${plan.campaign.name} · public · ${context.uniqueSuffix}`.slice(0, 255),
            dimensions,
          },
        },
      },
      { kind: "audience", label: "publicul (interese, vârstă, gen)", planPath: context.interestIds.length > 0 ? "audience.interests" : "audience.age_min" }
    );
  }

  // 5. Criteriile grupului — fără status (active).
  context.geoTargets.forEach((geoTargetConstant, index) =>
    push(
      { adGroupCriterionOperation: { create: { adGroup, location: { geoTargetConstant } } } },
      { kind: "criterion", label: `locația ${index + 1}`, planPath: `audience.locations.${index}` }
    )
  );
  context.languageConstants.forEach((languageConstant, index) =>
    push(
      { adGroupCriterionOperation: { create: { adGroup, language: { languageConstant } } } },
      { kind: "criterion", label: `limba ${index + 1}`, planPath: `audience.languages.${index}` }
    )
  );
  if (dimensions.length > 0) {
    push(
      { adGroupCriterionOperation: { create: { adGroup, audience: { audience } } } },
      { kind: "criterion", label: "publicul", planPath: "audience" }
    );
  }

  // 6. Materialele: video-urile YouTube (refolosite dacă sunt deja în cont), sigla, butonul.
  const single = !plan.creative.videos;
  const videoAssets = context.videos.map((video, index) => {
    if (video.asset) return video.asset;
    const resourceName = temp(cid, "assets", -10 - index);
    push(
      { assetOperation: { create: { resourceName, youtubeVideoAsset: { youtubeVideoId: video.youtubeId } } } },
      {
        kind: "asset",
        label: single ? "video-ul" : `video-ul ${index + 1}`,
        planPath: single ? "creative.video.video_id" : `creative.videos.${index}.video_id`,
      }
    );
    return resourceName;
  });

  let logoAsset: string;
  if ("resourceName" in context.logo) {
    logoAsset = context.logo.resourceName;
  } else {
    logoAsset = temp(cid, "assets", -40);
    push(
      {
        assetOperation: {
          create: { resourceName: logoAsset, name: `Siglă · ${google.business_name} · ${context.logo.hash}`, imageAsset: { data: context.logo.data } },
        },
      },
      { kind: "asset", label: "sigla", planPath: "google.logo_url" }
    );
  }

  const ctaAsset = temp(cid, "assets", -41);
  push(
    { assetOperation: { create: { resourceName: ctaAsset, callToActionAsset: { callToAction: GOOGLE_CTA[plan.creative.cta] } } } },
    { kind: "asset", label: "butonul", planPath: "creative.cta" }
  );

  // 7. Reclamele video Demand Gen, OPRITE. Titlul lung = textul reclamei (la
  //    alternare, toate textele); titlurile și descrierile toate — Google le combină.
  const ads = deriveAds({
    campaignName: plan.campaign.name,
    primaryTexts: plan.creative.primary_texts,
    headlines: plan.creative.headlines,
    descriptions: plan.creative.descriptions,
    mode: plan.creative.variants,
    videoCount: context.videos.length,
    shareHeadlines: true,
  });
  const automations = [
    ...(google.enhancements.video_enhancements ? [] : GOOGLE_VIDEO_AUTOMATIONS),
    ...(google.enhancements.text_assets ? [] : GOOGLE_TEXT_AUTOMATIONS),
  ];
  const finalUrlSuffix = utmQuery(plan.destination.utm ?? null);
  ads.forEach((ad, index) => {
    push(
      {
        adGroupAdOperation: {
          create: {
            adGroup,
            status: GOOGLE_PAUSED,
            ...(automations.length > 0
              ? {
                  adGroupAdAssetAutomationSettings: automations.map((type) => ({
                    assetAutomationType: type,
                    assetAutomationStatus: "OPTED_OUT",
                  })),
                }
              : {}),
            ad: {
              name: ad.name,
              finalUrls: [plan.destination.url],
              ...(finalUrlSuffix ? { finalUrlSuffix } : {}),
              demandGenVideoResponsiveAd: {
                headlines: ad.headlines.map((text) => ({ text })),
                longHeadlines: ad.primaryTexts.map((text) => ({ text })),
                descriptions: ad.descriptions.map((text) => ({ text })),
                videos: ad.videoIndexes.map((videoIndex) => ({ asset: videoAssets[videoIndex] })),
                logoImages: [{ asset: logoAsset }],
                businessName: { text: google.business_name },
                callToActions: [{ asset: ctaAsset }],
              },
            },
          },
        },
      },
      { kind: "ad", label: ads.length > 1 ? `reclama ${index + 1}` : "reclama", planPath: "creative" }
    );
  });

  return { operations, roles, adNames: ads.map((ad) => ad.name) };
}
