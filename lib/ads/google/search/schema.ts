import { z } from "zod";
import { CURRENCIES } from "../../constants";
import { countryCode, httpsUrl, locationSchema, numericId, shortText, utmSchema } from "../../plan-schema";
import { WORKSPACE_IDS } from "../../workspaces";
import {
  AD_GROUPS_PER_CAMPAIGN_MAX,
  AD_GROUP_NAME_MAX,
  BIDDING_STRATEGIES,
  CAMPAIGNS_PER_PLAN_MAX,
  CAMPAIGN_NAME_MAX,
  CAMPAIGN_NEGATIVES_MAX,
  DAYS,
  LOCATION_MODES,
  MATCH_TYPES,
  RSA_PER_AD_GROUP_MAX,
  SEARCH_PLAN_FORMAT,
  SHARED_NEGATIVE_KEYWORDS_MAX,
  SHARED_NEGATIVE_LISTS_MAX,
  SNIPPET_HEADERS,
  type SnippetHeader,
} from "./limits";

/**
 * Planul de căutare — `meridian-google-search/1`.
 *
 * Alt format decât planul video (`meridian-ads/1`): căutarea are mai multe
 * campanii într-un cont, grupuri, cuvinte cheie, negative, anunțuri text și
 * materiale, și nicio componentă video. Un plan = un cont = mai multe
 * campanii, create într-o singură cerere atomică.
 *
 * Schema verifică FORMA, cu limite largi. Limitele Google (30 de caractere pe
 * titlu, 80 pe cuvântul cheie…) se verifică în `validate.ts`, unde caracterele
 * se numără cum le numără Google și mesajul spune exact câte sunt. Obiectele
 * sunt stricte, ca în planul video: o cheie necunoscută e o eroare, cu „ai
 * vrut…?”.
 */

/** Cheia internă din plan (`auto-local`), folosită de legături între secțiuni. */
const keySchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9_-]{0,39}$/, {
    error: "trebuie să fie o cheie scurtă: litere mici, cifre, - și _ (de exemplu „auto-local”).",
  });

/** Bani: în moneda contului, cel mult două zecimale (17 = 17 lei). */
const money = z
  .number()
  .positive()
  .refine((value) => Math.round(value * 100) === value * 100, { error: "poate avea cel mult două zecimale." });

const time = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, { error: "trebuie scrisă ca oră:minut, cu două cifre fiecare: „07:30”." });

const languageCode = z
  .string()
  .trim()
  .regex(/^[a-z]{2}$/, { error: "trebuie să fie un cod de limbă din două litere mici: ro, en, hu." });

export const keywordSchema = z.strictObject({
  text: z.string().trim().min(1).max(200),
  match: z.enum(MATCH_TYPES),
});

export const sharedNegativeListSchema = z.strictObject({
  key: keySchema,
  /** Numele listei în cont (Biblioteca comună → Liste de cuvinte cheie negative). */
  name: shortText(255),
  keywords: z.array(keywordSchema).min(1).max(SHARED_NEGATIVE_KEYWORDS_MAX),
});

export const scheduleSchema = z.strictObject({
  days: z.array(z.enum(DAYS)).min(1).max(7),
  from: time,
  to: time,
});

export const sitelinkSchema = z.strictObject({
  text: shortText(100),
  description1: shortText(200).optional(),
  description2: shortText(200).optional(),
  url: httpsUrl,
});

const snippetHeaderKeys = Object.keys(SNIPPET_HEADERS) as [SnippetHeader, ...SnippetHeader[]];

export const snippetSchema = z.strictObject({
  header: z.enum(snippetHeaderKeys),
  values: z.array(shortText(100)).min(1).max(30),
});

export const callSchema = z.strictObject({
  country: countryCode,
  phone: z.string().trim().min(3).max(30),
  /** Acțiunea de conversie pentru apelurile din anunț (tipul „apeluri din anunțuri”). */
  conversion_action_id: numericId.optional(),
});

export const assetsSchema = z
  .strictObject({
    sitelinks: z.array(sitelinkSchema).max(50).default([]),
    callouts: z.array(shortText(100)).max(50).default([]),
    snippets: z.array(snippetSchema).max(50).default([]),
    call: callSchema.optional(),
  })
  .prefault({});

export const headlineSchema = z.strictObject({
  text: shortText(200),
  /** Poziția fixată: 1, 2 sau 3. Fără = Google alege poziția. */
  pin: z.number().int().min(1).max(3).optional(),
});

/** O descriere: text simplu sau `{ text, pin }` (pin 1 sau 2). Ieșirea e mereu obiect. */
export const descriptionSchema = z
  .union([
    shortText(400),
    z.strictObject({
      text: shortText(400),
      pin: z.number().int().min(1).max(2).optional(),
    }),
  ])
  .transform((value) => (typeof value === "string" ? { text: value } : value));

export const responsiveAdSchema = z.strictObject({
  headlines: z.array(headlineSchema).min(1).max(40),
  descriptions: z.array(descriptionSchema).min(1).max(12),
  path1: shortText(100).optional(),
  path2: shortText(100).optional(),
  /** Lipsă = URL-ul grupului. */
  final_url: httpsUrl.optional(),
});

export const adGroupSchema = z.strictObject({
  name: shortText(AD_GROUP_NAME_MAX),
  final_url: httpsUrl,
  utm: utmSchema.optional(),
  /** Licitarea grupului — doar la `manual_cpc`. */
  max_cpc: money.optional(),
  keywords: z.array(keywordSchema).min(1).max(2_000),
  negatives: z.array(keywordSchema).max(5_000).default([]),
  ads: z.array(responsiveAdSchema).min(1).max(RSA_PER_AD_GROUP_MAX),
});

export const biddingSchema = z.strictObject({
  strategy: z.enum(BIDDING_STRATEGIES),
  /** La `maximize_clicks`: plafonul de CPC (opțional). La `manual_cpc`: licitarea implicită a grupurilor. */
  max_cpc: money.optional(),
});

export const networksSchema = z
  .strictObject({
    search_partners: z.boolean().default(false),
    display: z.boolean().default(false),
  })
  .prefault({});

export const searchCampaignSchema = z.strictObject({
  key: keySchema,
  name: shortText(CAMPAIGN_NAME_MAX),
  daily_budget: money,
  bidding: biddingSchema,
  networks: networksSchema,
  locations: z.array(locationSchema).min(1).max(100),
  excluded_locations: z.array(locationSchema).max(100).default([]),
  location_mode: z.enum(LOCATION_MODES).default("presence"),
  languages: z.array(languageCode).max(20).default([]),
  /** Lipsă sau gol = oricând. */
  schedule: z.array(scheduleSchema).max(42).default([]),
  /** Cheile listelor din `shared_negative_lists`. */
  negative_lists: z.array(keySchema).max(SHARED_NEGATIVE_LISTS_MAX).default([]),
  negatives: z.array(keywordSchema).max(CAMPAIGN_NEGATIVES_MAX).default([]),
  assets: assetsSchema,
  /** UTM pe toată campania (inclusiv linkurile suplimentare). Grupul îl poate înlocui cu al lui. */
  utm: utmSchema.optional(),
  ad_groups: z.array(adGroupSchema).min(1).max(AD_GROUPS_PER_CAMPAIGN_MAX),
});

export const searchPlanSchema = z.strictObject({
  format: z.literal(SEARCH_PLAN_FORMAT),
  workspace: z.enum(WORKSPACE_IDS),
  /** Contul Google Ads, 10 cifre (`123-456-7890` sau `1234567890`). */
  ad_account: z.string().trim().min(1).max(40),
  currency: z.enum(CURRENCIES),
  shared_negative_lists: z.array(sharedNegativeListSchema).max(SHARED_NEGATIVE_LISTS_MAX).default([]),
  campaigns: z.array(searchCampaignSchema).min(1).max(CAMPAIGNS_PER_PLAN_MAX),
});

export type SearchPlan = z.output<typeof searchPlanSchema>;
export type SearchCampaign = z.output<typeof searchCampaignSchema>;
export type SearchAdGroup = z.output<typeof adGroupSchema>;
export type SearchAd = z.output<typeof responsiveAdSchema>;
export type SearchKeyword = z.output<typeof keywordSchema>;
export type SearchSchedule = z.output<typeof scheduleSchema>;
export type SearchAssets = z.output<typeof assetsSchema>;

// ---------------------------------------------------------------------------
// Cheile cunoscute — pentru „ai vrut să scrii …?”
// ---------------------------------------------------------------------------

function unionKeys(options: ReadonlyArray<{ shape: Record<string, unknown> }>): string[] {
  return [...new Set(options.flatMap((option) => Object.keys(option.shape)))];
}

const keywordKeys = Object.keys(keywordSchema.shape);

/** Calea obiectului (cu `#` în loc de index) → cheile acceptate acolo. */
export const SEARCH_KNOWN_KEYS: Record<string, string[]> = {
  "": Object.keys(searchPlanSchema.shape),
  "shared_negative_lists.#": Object.keys(sharedNegativeListSchema.shape),
  "shared_negative_lists.#.keywords.#": keywordKeys,
  "campaigns.#": Object.keys(searchCampaignSchema.shape),
  "campaigns.#.bidding": Object.keys(biddingSchema.shape),
  "campaigns.#.networks": ["search_partners", "display"],
  "campaigns.#.locations.#": unionKeys(locationSchema.options),
  "campaigns.#.excluded_locations.#": unionKeys(locationSchema.options),
  "campaigns.#.schedule.#": Object.keys(scheduleSchema.shape),
  "campaigns.#.negatives.#": keywordKeys,
  "campaigns.#.assets": ["sitelinks", "callouts", "snippets", "call"],
  "campaigns.#.assets.sitelinks.#": Object.keys(sitelinkSchema.shape),
  "campaigns.#.assets.snippets.#": Object.keys(snippetSchema.shape),
  "campaigns.#.assets.call": Object.keys(callSchema.shape),
  "campaigns.#.utm": Object.keys(utmSchema.shape),
  "campaigns.#.ad_groups.#": Object.keys(adGroupSchema.shape),
  "campaigns.#.ad_groups.#.utm": Object.keys(utmSchema.shape),
  "campaigns.#.ad_groups.#.keywords.#": keywordKeys,
  "campaigns.#.ad_groups.#.negatives.#": keywordKeys,
  "campaigns.#.ad_groups.#.ads.#": Object.keys(responsiveAdSchema.shape),
  "campaigns.#.ad_groups.#.ads.#.headlines.#": Object.keys(headlineSchema.shape),
  "campaigns.#.ad_groups.#.ads.#.descriptions.#": ["text", "pin"],
};
