import {
  COUNTRY_LABEL,
  CTA_LABEL,
  CURRENCIES,
  GENDER_LABEL,
  LANGUAGE_LABEL,
  OBJECTIVE_LABEL,
  type Cta,
  type Currency,
  type Gender,
  type Objective,
  type Platform,
  type VariantMode,
} from "./constants";
import {
  ageLabel,
  buildFinalUrl,
  deriveAds,
  formatMoney,
  monthlyBudget,
  tiktokAgeGroups,
  UTM_KEYS,
  type DerivedAd,
  type UtmKey,
} from "./plan-derive";
import { asArray, asNumber, asRecord, asString, asStringList, getIn } from "./plan-path";

/**
 * Planul spus în română — din datele BRUTE, deci și dintr-un plan cu
 * greșeli. Ce lipsește sau e greșit apare ca „—", nu ca o invenție: o
 * previzualizare care completează singură golurile ar minți exact acolo
 * unde omul are nevoie de adevăr.
 */

export function locationLabel(location: unknown): string | null {
  const record = asRecord(location);
  if (!record) return null;
  const type = record.type;
  const country = asString(record.country) ?? asString(record.code);
  const countryName = country ? (COUNTRY_LABEL[country] ?? country) : null;

  if (type === "country") return countryName;
  const name = asString(record.name);
  if (!name) return null;
  if (type === "region") return `regiunea ${name}${countryName && country !== "RO" ? `, ${countryName}` : ""}`;
  if (type === "city") {
    const radius = asNumber(record.radius_km);
    return `${name}${radius ? ` (+${radius} km)` : ""}${countryName && country !== "RO" ? `, ${countryName}` : ""}`;
  }
  return name;
}

/** „București, Cluj-Napoca și Iași" */
export function joinRo(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} și ${items[items.length - 1]}`;
}

export interface PlanSummary {
  objective: string | null;
  /** Există în plan, dar nu e o valoare acceptată — alt mesaj decât „lipsește". */
  objectiveInvalid: boolean;
  budget: string | null;
  budgetInvalid: boolean;
  monthly: string | null;
  places: string[];
  age: string;
  /** Pe TikTok, intervalul real după grupele de vârstă. */
  platformAge: string | null;
  gender: string;
  languages: string | null;
  interests: string[];
  behaviors: string[];
  finalUrl: string | null;
  ads: DerivedAd[];
  cta: string | null;
  ctaInvalid: boolean;
}

export function summarizePlan(raw: Record<string, unknown>, platform: Platform): PlanSummary {
  const objective = getIn(raw, "campaign.objective");
  const currencyRaw = getIn(raw, "campaign.currency");
  const currency = CURRENCIES.includes(currencyRaw as Currency) ? (currencyRaw as Currency) : null;
  const daily = asNumber(getIn(raw, "campaign.daily_budget"));

  const ageMin = asNumber(getIn(raw, "audience.age_min")) ?? 18;
  const ageMax = asNumber(getIn(raw, "audience.age_max")) ?? 65;
  const groups = platform === "tiktok" && ageMin <= ageMax ? tiktokAgeGroups(ageMin, ageMax) : null;

  const genderRaw = getIn(raw, "audience.gender") ?? "all";
  const languages = asStringList(getIn(raw, "audience.languages"));

  const url = asString(getIn(raw, "destination.url"));
  const utm = asRecord(getIn(raw, "destination.utm")) ?? {};
  const utmValues: Partial<Record<UtmKey, string>> = {};
  for (const key of UTM_KEYS) {
    const value = asString(utm[key]);
    if (value) utmValues[key] = value;
  }

  const ctaRaw = getIn(raw, "creative.cta");
  const variants = getIn(raw, "creative.variants");

  return {
    objective:
      typeof objective === "string" && objective in OBJECTIVE_LABEL
        ? OBJECTIVE_LABEL[objective as Objective]
        : null,
    objectiveInvalid: objective !== undefined && !(typeof objective === "string" && objective in OBJECTIVE_LABEL),
    budget: daily !== null ? `${formatMoney(daily, currency)} pe zi` : null,
    budgetInvalid: daily === null && getIn(raw, "campaign.daily_budget") !== undefined,
    monthly: daily !== null ? `≈ ${formatMoney(monthlyBudget(daily), currency)} pe lună` : null,
    places: asArray(getIn(raw, "audience.locations"))
      .map(locationLabel)
      .filter((label): label is string => Boolean(label)),
    age: ageLabel(ageMin, ageMax),
    platformAge: groups?.widened ? ageLabel(groups.min, groups.max) : null,
    gender:
      typeof genderRaw === "string" && genderRaw in GENDER_LABEL
        ? GENDER_LABEL[genderRaw as Gender]
        : "—",
    languages:
      languages.length > 0
        ? joinRo(languages.map((code) => LANGUAGE_LABEL[code] ?? code))
        : null,
    interests: asArray(getIn(raw, "audience.interests"))
      .map((item) => asString(asRecord(item)?.name))
      .filter((name): name is string => Boolean(name)),
    behaviors: asArray(getIn(raw, "audience.behaviors"))
      .map((item) => asString(asRecord(item)?.name))
      .filter((name): name is string => Boolean(name)),
    finalUrl: url ? buildFinalUrl(url, utmValues) : null,
    ads: deriveAds({
      campaignName: asString(getIn(raw, "campaign.name")) ?? "",
      primaryTexts: asStringList(getIn(raw, "creative.primary_texts")),
      // TikTok nu are titlu și descriere — nu le arătăm pe reclame.
      headlines: platform === "meta" ? asStringList(getIn(raw, "creative.headlines")) : [],
      descriptions: platform === "meta" ? asStringList(getIn(raw, "creative.descriptions")) : [],
      mode: (variants === "platform_rotates" ? "platform_rotates" : "one_ad_per_text") as VariantMode,
    }),
    cta:
      typeof ctaRaw === "string" && ctaRaw in CTA_LABEL ? CTA_LABEL[ctaRaw as Cta] : null,
    ctaInvalid: ctaRaw !== undefined && !(typeof ctaRaw === "string" && ctaRaw in CTA_LABEL),
  };
}
