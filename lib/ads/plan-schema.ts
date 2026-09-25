import { z } from "zod";
import {
  CONVERSION_EVENTS,
  CTAS,
  CURRENCIES,
  GENDERS,
  MAX_TEXT_VARIANTS,
  META_PLACEMENTS,
  META_SPECIAL_CATEGORIES,
  OBJECTIVES,
  TIKTOK_IDENTITY_TYPES,
  TIKTOK_PLACEMENTS,
  VARIANT_MODES,
} from "./constants";
import { WORKSPACE_IDS } from "./workspaces";

/**
 * Formatul planului de campanie — contractul dintre conversația în care se
 * scrie planul și portal.
 *
 * O schemă pentru ambele platforme. Ce e comun (public, buget, texte,
 * destinație) stă la rădăcină; ce există doar pe o platformă stă în
 * secțiunea ei (`meta`, `tiktok`). Planul spune în ce spațiu de lucru
 * merge, iar spațiul spune platforma — nu există câmp `platform` separat,
 * ca să nu se poată contrazice cele două.
 *
 * Schema verifică FORMA. Regulile care leagă câmpuri între ele (obiectiv ↔
 * pixel, platformă ↔ secțiune, buget ↔ plafonul spațiului) sunt în
 * `plan-validate.ts`, pe datele brute, ca să apară toate odată, nu pe
 * rând după fiecare corectură.
 *
 * Obiectele sunt STRICTE: un câmp necunoscut e o eroare, nu se ignoră.
 * Planul e scris de altcineva — o cheie greșită ignorată în tăcere
 * (`"age_maximum"`) ar însemna o valoare implicită despre care nu știe
 * nimeni.
 */

export const PLAN_FORMAT = "meridian-ads/1";

/**
 * Id-urile de platformă se scriu ca TEXT. Ca număr, JavaScript rotunjește
 * orice depășește 16 cifre — un id de pagină de 17 cifre devine alt id.
 */
const numericId = z
  .string()
  .trim()
  .regex(/^\d{5,25}$/, { error: "trebuie să conțină doar cifre (între 5 și 25)." });

const httpsUrl = z
  .string()
  .trim()
  .refine(
    (value) => {
      try {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname.includes(".");
      } catch {
        return false;
      }
    },
    { error: "trebuie să fie o adresă completă, care începe cu https://" }
  );

const shortText = (max: number) => z.string().trim().min(1).max(max);

// ---------------------------------------------------------------------------
// Campanie
// ---------------------------------------------------------------------------

export const campaignSchema = z.strictObject({
  name: shortText(200),
  objective: z.enum(OBJECTIVES),
  /** În moneda contului, unități întregi (50 = 50 lei), nu bani/cenți. */
  daily_budget: z
    .number()
    .positive()
    .refine((value) => Math.round(value * 100) === value * 100, {
      error: "poate avea cel mult două zecimale.",
    }),
  currency: z.enum(CURRENCIES),
});

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

const countryCode = z
  .string()
  .trim()
  .regex(/^[A-Z]{2}$/, { error: "trebuie să fie un cod de țară din două litere mari: RO, MD, HU." });

export const locationSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("country"),
    code: countryCode,
  }),
  z.strictObject({
    type: z.literal("region"),
    name: shortText(120),
    country: countryCode,
    /** Cheia platformei, dacă o știi. Altfel se caută după nume la creare. */
    key: z.string().trim().min(1).optional(),
  }),
  z.strictObject({
    type: z.literal("city"),
    name: shortText(120),
    country: countryCode,
    radius_km: z.number().int().min(1).max(80).optional(),
    key: z.string().trim().min(1).optional(),
  }),
]);

const targetingItem = z.strictObject({
  name: shortText(120),
  /** Id-ul de platformă, dacă îl știi. Altfel se caută după nume la creare. */
  id: numericId.optional(),
});

export const audienceSchema = z.strictObject({
  locations: z.array(locationSchema).min(1).max(25),
  age_min: z.number().int().min(18).max(65).default(18),
  /** 65 înseamnă „65 și peste". */
  age_max: z.number().int().min(18).max(65).default(65),
  gender: z.enum(GENDERS).default("all"),
  /** Coduri ISO 639-1 (`ro`, `hu`). Listă goală = orice limbă. */
  languages: z
    .array(
      z
        .string()
        .trim()
        .regex(/^[a-z]{2}$/, { error: "trebuie să fie un cod de limbă din două litere mici: ro, en, hu." })
    )
    .max(10)
    .default([]),
  interests: z.array(targetingItem).max(25).default([]),
  behaviors: z.array(targetingItem).max(25).default([]),
});

// ---------------------------------------------------------------------------
// Conversie și destinație
// ---------------------------------------------------------------------------

/**
 * Pixelul: pe Meta, id-ul numeric; pe TikTok, id-ul numeric SAU codul
 * pixelului (`DAN9FTJC…`, cel din codul site-ului) — portalul îl traduce în
 * id la verificare. Regula pe platformă e în `plan-validate.ts`.
 */
const pixelId = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{5,40}$/, { error: "trebuie să conțină doar litere și cifre (între 5 și 40)." });

export const conversionSchema = z.strictObject({
  pixel_id: pixelId,
  event: z.enum(CONVERSION_EVENTS),
});

const utmValue = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[^\s&=#?]+$/, { error: "nu poate conține spații sau caracterele & = # ?" });

export const utmSchema = z.strictObject({
  source: utmValue.optional(),
  medium: utmValue.optional(),
  campaign: utmValue.optional(),
  content: utmValue.optional(),
  term: utmValue.optional(),
});

export const destinationSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("website"),
    url: httpsUrl,
    utm: utmSchema.optional(),
  }),
]);

// ---------------------------------------------------------------------------
// Material
// ---------------------------------------------------------------------------

export const videoSchema = z.discriminatedUnion("source", [
  /** Video deja urcat în biblioteca contului de reclame. */
  z.strictObject({
    source: z.literal("library"),
    video_id: z.string().trim().min(1).max(64),
  }),
  /** Fișier nou, ales în portal la pasul de încărcare. */
  z.strictObject({
    source: z.literal("upload"),
    file_name: z.string().trim().min(1).max(200).optional(),
  }),
]);

export const creativeSchema = z.strictObject({
  video: videoSchema,
  /** `auto` = coperta generată de platformă din video. */
  thumbnail: z.union([z.literal("auto"), z.strictObject({ url: httpsUrl })]).default("auto"),
  primary_texts: z.array(shortText(2000)).min(1).max(MAX_TEXT_VARIANTS),
  headlines: z.array(shortText(255)).max(MAX_TEXT_VARIANTS).default([]),
  descriptions: z.array(shortText(255)).max(MAX_TEXT_VARIANTS).default([]),
  cta: z.enum(CTAS),
  variants: z.enum(VARIANT_MODES).default("one_ad_per_text"),
});

// ---------------------------------------------------------------------------
// Secțiunile de platformă
// ---------------------------------------------------------------------------

/** Implicit TOATE oprite. `prefault({})` le completează când lipsește secțiunea. */
export const metaEnhancementsSchema = z
  .strictObject({
    advantage_creative: z.boolean().default(false),
    ad_sources: z.boolean().default(false),
    multi_advertiser_ads: z.boolean().default(false),
  })
  .prefault({});

export const metaSchema = z.strictObject({
  page_id: numericId,
  instagram_account_id: numericId.optional(),
  special_ad_categories: z.array(z.enum(META_SPECIAL_CATEGORIES)).max(4).default([]),
  /** Oprit: vârsta și interesele din plan sunt limite, nu sugestii. */
  advantage_audience: z.boolean().default(false),
  placements: z
    .union([z.literal("automatic"), z.array(z.enum(META_PLACEMENTS)).min(1)])
    .default("automatic"),
  enhancements: metaEnhancementsSchema,
  /**
   * DSA (UE): cine beneficiază de reclamă și cine o plătește — apar în
   * „De ce văd reclama asta”. Obligatorii pe Meta când publicul e în UE.
   * Lipsă = valorile implicite ale contului de reclame, dacă sunt setate.
   */
  dsa_beneficiary: shortText(512).optional(),
  dsa_payor: shortText(512).optional(),
});

export const tiktokEnhancementsSchema = z
  .strictObject({
    automatic_enhancements: z.boolean().default(false),
    auto_add_assets: z.boolean().default(false),
    translate_and_dub: z.boolean().default(false),
    music_refresh: z.boolean().default(false),
  })
  .prefault({});

export const tiktokSchema = z.strictObject({
  identity_type: z.enum(TIKTOK_IDENTITY_TYPES),
  identity_id: z.string().trim().min(1).max(64),
  /** Business Center-ul care a autorizat contul TikTok. Cerut doar la `BC_AUTH_TT`. */
  identity_bc_id: numericId.optional(),
  placements: z.enum(TIKTOK_PLACEMENTS).default("tiktok_only"),
  enhancements: tiktokEnhancementsSchema,
});

// ---------------------------------------------------------------------------
// Planul
// ---------------------------------------------------------------------------

export const planSchema = z.strictObject({
  /** Opțional. Dacă există, trebuie să fie exact `meridian-ads/1`. */
  format: z.literal(PLAN_FORMAT).optional(),
  workspace: z.enum(WORKSPACE_IDS),
  /** Meta: `act_` + cifre (sau doar cifrele). TikTok: advertiser_id, doar cifre. */
  ad_account: z.string().trim().min(1).max(40),
  campaign: campaignSchema,
  audience: audienceSchema,
  /** Obligatorie pentru obiectivele `leads` și `sales`. */
  conversion: conversionSchema.optional(),
  destination: destinationSchema,
  creative: creativeSchema,
  /** Obligatorie când spațiul e pe Meta. */
  meta: metaSchema.optional(),
  /** Obligatorie când spațiul e pe TikTok. */
  tiktok: tiktokSchema.optional(),
});

export type Plan = z.output<typeof planSchema>;
export type PlanInput = z.input<typeof planSchema>;
export type PlanLocation = z.output<typeof locationSchema>;
export type PlanCreative = z.output<typeof creativeSchema>;

// ---------------------------------------------------------------------------
// Cheile cunoscute — pentru „ai vrut să scrii …?" la câmpurile necunoscute
// ---------------------------------------------------------------------------

function unionKeys(options: ReadonlyArray<{ shape: Record<string, unknown> }>): string[] {
  return [...new Set(options.flatMap((option) => Object.keys(option.shape)))];
}

/** Calea obiectului (cu `#` în loc de index) → cheile acceptate acolo. */
export const KNOWN_KEYS: Record<string, string[]> = {
  "": Object.keys(planSchema.shape),
  campaign: Object.keys(campaignSchema.shape),
  audience: Object.keys(audienceSchema.shape),
  "audience.locations.#": unionKeys(locationSchema.options),
  "audience.interests.#": Object.keys(targetingItem.shape),
  "audience.behaviors.#": Object.keys(targetingItem.shape),
  conversion: Object.keys(conversionSchema.shape),
  destination: unionKeys(destinationSchema.options),
  "destination.utm": Object.keys(utmSchema.shape),
  creative: Object.keys(creativeSchema.shape),
  "creative.video": unionKeys(videoSchema.options),
  "creative.thumbnail": ["url"],
  meta: Object.keys(metaSchema.shape),
  "meta.enhancements": ["advantage_creative", "ad_sources", "multi_advertiser_ads"],
  tiktok: Object.keys(tiktokSchema.shape),
  "tiktok.enhancements": [
    "automatic_enhancements",
    "auto_add_assets",
    "translate_and_dub",
    "music_refresh",
  ],
};
