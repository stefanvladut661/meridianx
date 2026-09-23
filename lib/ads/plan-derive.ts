import {
  CURRENCY_LABEL,
  TIKTOK_AGE_GROUPS,
  type Currency,
  type Platform,
  type VariantMode,
} from "./constants";

/**
 * Ce se calculează din plan: URL-ul final, reclamele care ies din texte,
 * grupele de vârstă TikTok, bugetul pe lună. Funcții pure, aceleași în
 * previzualizare și, din faza 2, la creare — ca omul să vadă exact ce se
 * trimite, nu o aproximare a lui.
 */

// ---------------------------------------------------------------------------
// Bani
// ---------------------------------------------------------------------------

/** Zile medii într-o lună (365,25 / 12). */
const DAYS_PER_MONTH = 30.44;

export function formatMoney(amount: number, currency: Currency | null): string {
  const number = new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return currency ? `${number} ${CURRENCY_LABEL[currency]}` : number;
}

export function monthlyBudget(daily: number): number {
  return Math.round(daily * DAYS_PER_MONTH);
}

/**
 * „15 caractere", „125 de caractere", „101 caractere": în română, „de" apare
 * după numerele ale căror ultime două cifre nu sunt între 01 și 19.
 */
export function countOf(count: number, word: string): string {
  const rest = count % 100;
  const withDe = count !== 0 && !(rest >= 1 && rest <= 19);
  return `${count} ${withDe ? "de " : ""}${word}`;
}

// ---------------------------------------------------------------------------
// URL final
// ---------------------------------------------------------------------------

export const UTM_KEYS = ["source", "medium", "campaign", "content", "term"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];

/** Macro-urile platformelor rămân necodate, altfel nu se mai înlocuiesc. */
const MACRO = /(\{\{[a-z_.]+\}\}|__[A-Z_]+__)/;
const META_MACRO = /\{\{[a-z_.]+\}\}/;
const TIKTOK_MACRO = /__[A-Z_]+__/;

function encodeKeepingMacros(value: string): string {
  return value
    .split(MACRO)
    .map((part) => (MACRO.test(part) ? part : encodeURIComponent(part)))
    .join("");
}

/** Macro-ul aparține celeilalte platforme — nu se va înlocui. */
export function foreignMacro(value: string, platform: Platform): string | null {
  const pattern = platform === "meta" ? TIKTOK_MACRO : META_MACRO;
  return pattern.exec(value)?.[0] ?? null;
}

/**
 * Adresa pe care ajunge omul după clic: URL-ul din plan + parametrii UTM,
 * în ordinea standard, înainte de `#`. `null` dacă URL-ul nu se parsează.
 */
export function buildFinalUrl(
  url: string,
  utm: Partial<Record<UtmKey, string>> | null
): string | null {
  try {
    new URL(url);
  } catch {
    return null;
  }

  const params = UTM_KEYS.flatMap((key) => {
    const value = utm?.[key];
    return value ? [`utm_${key}=${encodeKeepingMacros(value)}`] : [];
  });
  if (params.length === 0) return url;

  const hashIndex = url.indexOf("#");
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : url.slice(hashIndex);
  const separator = base.includes("?") ? (base.endsWith("?") || base.endsWith("&") ? "" : "&") : "?";
  return `${base}${separator}${params.join("&")}${hash}`;
}

/** Parametrii `utm_*` deja prezenți în URL-ul din plan. */
export function utmAlreadyInUrl(url: string): UtmKey[] {
  try {
    const search = new URL(url).searchParams;
    return UTM_KEYS.filter((key) => search.has(`utm_${key}`));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Vârsta pe TikTok
// ---------------------------------------------------------------------------

/**
 * TikTok targetează pe grupe întregi. Intervalul din plan devine reuniunea
 * grupelor pe care le atinge — deci poate doar să se lărgească.
 */
export function tiktokAgeGroups(min: number, max: number) {
  const groups = TIKTOK_AGE_GROUPS.filter((group) => group.max >= min && group.min <= max);
  if (groups.length === 0) return null;
  const first = groups[0];
  const last = groups[groups.length - 1];
  return {
    groups,
    min: first.min,
    max: last.max,
    widened: first.min !== min || last.max !== max,
  };
}

export function ageLabel(min: number, max: number): string {
  return max >= 65 ? `${min}–65+ ani` : `${min}–${max} ani`;
}

// ---------------------------------------------------------------------------
// Reclamele care ies din texte
// ---------------------------------------------------------------------------

export interface DerivedAd {
  name: string;
  primaryTexts: string[];
  headlines: string[];
  descriptions: string[];
}

/**
 * `one_ad_per_text`: o reclamă pe text principal. Titlul și descrierea
 * merg pe același index; dacă sunt mai puține, se repetă primul.
 * `platform_rotates`: o reclamă cu toate variantele; platforma alege.
 */
export function deriveAds(input: {
  campaignName: string;
  primaryTexts: string[];
  headlines: string[];
  descriptions: string[];
  mode: VariantMode;
}): DerivedAd[] {
  const { campaignName, primaryTexts, headlines, descriptions, mode } = input;
  const base = campaignName || "Campanie";

  if (mode === "platform_rotates") {
    return primaryTexts.length === 0
      ? []
      : [{ name: `${base} · reclamă`, primaryTexts, headlines, descriptions }];
  }

  return primaryTexts.map((text, index) => {
    const headline = headlines[index] ?? headlines[0];
    const description = descriptions[index] ?? descriptions[0];
    return {
      name: `${base} · text ${index + 1}`,
      primaryTexts: [text],
      headlines: headline ? [headline] : [],
      descriptions: description ? [description] : [],
    };
  });
}

export function adSetName(campaignName: string): string {
  return `${campaignName || "Campanie"} · public`;
}
