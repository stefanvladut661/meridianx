import {
  CURRENCY_LABEL,
  GOOGLE_AGE_RANGES,
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

/**
 * Macro-urile platformelor rămân necodate, altfel nu se mai înlocuiesc:
 * Meta `{{campaign.name}}`, TikTok `__CAMPAIGN_NAME__`, Google (ValueTrack)
 * `{campaignid}`.
 */
const MACRO = /(\{\{[a-z_.]+\}\}|__[A-Z_]+__|\{[a-z_]+\})/;
const PLATFORM_MACRO: Record<Platform, RegExp> = {
  meta: /\{\{[a-z_.]+\}\}/,
  tiktok: /__[A-Z_]+__/,
  google: /(?<!\{)\{[a-z_]+\}(?!\})/,
};

function encodeKeepingMacros(value: string): string {
  return value
    .split(MACRO)
    .map((part) => (MACRO.test(part) ? part : encodeURIComponent(part)))
    .join("");
}

/** Macro-ul aparține altei platforme — nu se va înlocui. */
export function foreignMacro(value: string, platform: Platform): string | null {
  for (const [other, pattern] of Object.entries(PLATFORM_MACRO) as Array<[Platform, RegExp]>) {
    if (other === platform) continue;
    const found = pattern.exec(value)?.[0];
    if (found) return found;
  }
  return null;
}

/** Platforma căreia îi aparține un macro, pentru mesaje. */
export function macroPlatform(macro: string): Platform | null {
  return (Object.entries(PLATFORM_MACRO) as Array<[Platform, RegExp]>).find(([, pattern]) => pattern.test(macro))?.[0] ?? null;
}

/** Parametrii UTM ca șir de interogare, fără `?` — pentru `finalUrlSuffix` pe Google. */
export function utmQuery(utm: Partial<Record<UtmKey, string>> | null): string {
  return UTM_KEYS.flatMap((key) => {
    const value = utm?.[key];
    return value ? [`utm_${key}=${encodeKeepingMacros(value)}`] : [];
  }).join("&");
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
  return ageGroupsOf(min, max, TIKTOK_AGE_GROUPS);
}

/** Grupele de vârstă ale Google (AgeRangeType), la fel: intervalul doar se lărgește. */
export function googleAgeRanges(min: number, max: number) {
  return ageGroupsOf(min, max, GOOGLE_AGE_RANGES);
}

function ageGroupsOf(min: number, max: number, all: ReadonlyArray<{ min: number; max: number; label: string }>) {
  const groups = all.filter((group) => group.max >= min && group.min <= max);
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
  /** Video-urile reclamei, ca poziții în lista din plan (de la 0). */
  videoIndexes: number[];
}

/**
 * `one_ad_per_text`: o reclamă pe fiecare video × text principal. Titlul și
 * descrierea merg pe indexul textului; dacă sunt mai puține, se repetă primul.
 * `platform_rotates`: o reclamă cu toate variantele (texte și video-uri);
 * platforma alege.
 *
 * Cu un singur video, numele rămân cele dinainte de producția în masă
 * („… · text 2"), ca planurile vechi să dea exact aceleași reclame.
 */
export function deriveAds(input: {
  campaignName: string;
  primaryTexts: string[];
  headlines: string[];
  descriptions: string[];
  mode: VariantMode;
  /** Câte video-uri are planul. Implicit unul. */
  videoCount?: number;
  /**
   * Fiecare reclamă primește TOATE titlurile și descrierile (Google le
   * combină singur), nu doar pe cele de pe indexul textului.
   */
  shareHeadlines?: boolean;
}): DerivedAd[] {
  const { campaignName, primaryTexts, headlines, descriptions, mode, shareHeadlines } = input;
  const videoCount = Math.max(1, input.videoCount ?? 1);
  const base = campaignName || "Campanie";
  const allVideos = Array.from({ length: videoCount }, (_, index) => index);

  if (mode === "platform_rotates") {
    return primaryTexts.length === 0
      ? []
      : [{ name: `${base} · reclamă`, primaryTexts, headlines, descriptions, videoIndexes: allVideos }];
  }

  return allVideos.flatMap((videoIndex) =>
    primaryTexts.map((text, index) => {
      const headline = headlines[index] ?? headlines[0];
      const description = descriptions[index] ?? descriptions[0];
      const name =
        videoCount === 1
          ? `${base} · text ${index + 1}`
          : primaryTexts.length === 1
            ? `${base} · video ${videoIndex + 1}`
            : `${base} · video ${videoIndex + 1} · text ${index + 1}`;
      return {
        name,
        primaryTexts: [text],
        headlines: shareHeadlines ? headlines : headline ? [headline] : [],
        descriptions: shareHeadlines ? descriptions : description ? [description] : [],
        videoIndexes: [videoIndex],
      };
    })
  );
}

// ---------------------------------------------------------------------------
// Video-urile planului
// ---------------------------------------------------------------------------

export type VideoRef = { source: "library"; video_id: string } | { source: "upload"; file_name?: string };

/** Lista video-urilor din planul validat: `videos`, sau `video` ca listă de unul. */
export function videosOf(creative: { video?: VideoRef; videos?: VideoRef[] }): VideoRef[] {
  if (creative.videos && creative.videos.length > 0) return creative.videos;
  return creative.video ? [creative.video] : [];
}

/**
 * Același lucru pe planul BRUT (previzualizare, lot): fiecare video cu calea
 * lui din plan, ca un mesaj să poată arăta exact câmpul.
 */
export function rawVideosOf(raw: unknown): Array<{ path: string; value: unknown }> {
  const creative = raw && typeof raw === "object" ? (raw as { creative?: unknown }).creative : undefined;
  if (!creative || typeof creative !== "object") return [];
  const record = creative as { video?: unknown; videos?: unknown };
  if (Array.isArray(record.videos)) {
    return record.videos.map((value, index) => ({ path: `creative.videos.${index}`, value }));
  }
  return record.video !== undefined ? [{ path: "creative.video", value: record.video }] : [];
}

export function adSetName(campaignName: string): string {
  return `${campaignName || "Campanie"} · public`;
}
