/**
 * Limitele planului de căutare — aceleași în validare, în previzualizare și
 * în instrucțiunile pentru Claude (`google/brief.ts`), ca să nu poată rămâne
 * una în urma celeilalte. Fișier izomorf, fără dependențe.
 *
 * Fiecare număr e verificat pe referința Google Ads API v26 sau pe centrul de
 * ajutor Google Ads; sursa e în lib/ads/README.md → „Faza 8”.
 */

export const SEARCH_PLAN_FORMAT = "meridian-google-search/1";

// ---------------------------------------------------------------------------
// Anunțul de căutare responsive (ResponsiveSearchAdInfo)
// ---------------------------------------------------------------------------

export const RSA_HEADLINES_MIN = 3;
export const RSA_HEADLINES_MAX = 15;
export const RSA_HEADLINE_MAX = 30;
export const RSA_DESCRIPTIONS_MIN = 2;
export const RSA_DESCRIPTIONS_MAX = 4;
export const RSA_DESCRIPTION_MAX = 90;
export const RSA_PATH_MAX = 15;
/** Pozițiile pe care se poate fixa un titlu (HEADLINE_1…3) și o descriere (DESCRIPTION_1…2). */
export const RSA_HEADLINE_PINS = [1, 2, 3] as const;
export const RSA_DESCRIPTION_PINS = [1, 2] as const;
/** Sub atâtea titluri, Google are puține combinații de încercat — avertisment, nu eroare. */
export const RSA_HEADLINES_RECOMMENDED = 8;
/** Anunțuri responsive active într-un grup. */
export const RSA_PER_AD_GROUP_MAX = 3;

// ---------------------------------------------------------------------------
// Cuvinte cheie
// ---------------------------------------------------------------------------

export const MATCH_TYPES = ["broad", "phrase", "exact"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

export const MATCH_TYPE_LABEL: Record<MatchType, string> = {
  broad: "amplă",
  phrase: "frază",
  exact: "exactă",
};

/** `KeywordMatchType` din API. */
export const GOOGLE_MATCH_TYPE: Record<MatchType, string> = {
  broad: "BROAD",
  phrase: "PHRASE",
  exact: "EXACT",
};

export const KEYWORD_MAX_CHARS = 80;
export const KEYWORD_MAX_WORDS = 10;
/**
 * Caracterele pe care Google le refuză într-un cuvânt cheie
 * (`KEYWORD_HAS_INVALID_CHARS`), după lista din centrul de ajutor Google Ads
 * (plus acoladele, din lista Search Ads 360). Parantezele drepte și
 * ghilimelele sunt sintaxa tipului de potrivire din interfață, nu text.
 */
export const KEYWORD_FORBIDDEN_CHARS = ["@", "\\", "^", ",", "=", "!", "`", "<", ">", "[", "]", "(", ")", "%", "|", "?", ";", "~", "{", "}", '"'];
/** Steluța e permisă doar în negative. */
export const KEYWORD_POSITIVE_ONLY_FORBIDDEN = ["*"];

/** Liste comune de negative într-un cont și cuvinte într-o listă. */
export const SHARED_NEGATIVE_LISTS_MAX = 20;
export const SHARED_NEGATIVE_KEYWORDS_MAX = 5_000;
/** Negative pe o campanie (fără listele comune). */
export const CAMPAIGN_NEGATIVES_MAX = 10_000;

// ---------------------------------------------------------------------------
// Materiale (assets) pe campanie
// ---------------------------------------------------------------------------

export const SITELINK_TEXT_MAX = 25;
export const SITELINK_DESCRIPTION_MAX = 35;
/** Sub atâtea linkuri suplimentare, Google le arată rar — avertisment. */
export const SITELINKS_RECOMMENDED = 4;
export const SITELINKS_MAX = 20;
export const CALLOUT_MAX = 25;
export const CALLOUTS_MAX = 20;
export const SNIPPET_VALUE_MAX = 25;
export const SNIPPET_VALUES_MIN = 3;
export const SNIPPET_VALUES_MAX = 10;
export const SNIPPETS_MAX = 20;

/**
 * Antetele predefinite ale fragmentelor structurate (lista „Structured
 * snippet headers” din documentația v26). Antetul trimis trebuie să fie
 * EXACT unul din listă, în limba anunțului: la o campanie în română se
 * trimite antetul românesc, altfel cel englezesc.
 */
export const SNIPPET_HEADERS = {
  amenities: { en: "Amenities", ro: "Dotări" },
  brands: { en: "Brands", ro: "Mărci" },
  courses: { en: "Courses", ro: "Cursuri" },
  degree_programs: { en: "Degree programs", ro: "Programe de studiu" },
  destinations: { en: "Destinations", ro: "Destinații" },
  featured_hotels: { en: "Featured hotels", ro: "Hoteluri prezentate" },
  insurance_coverage: { en: "Insurance coverage", ro: "Asigurare" },
  models: { en: "Models", ro: "Modele" },
  neighborhoods: { en: "Neighborhoods", ro: "Cartiere" },
  services: { en: "Services", ro: "Servicii" },
  shows: { en: "Shows", ro: "Emisiuni" },
  styles: { en: "Styles", ro: "Stiluri" },
  types: { en: "Types", ro: "Tipuri" },
} as const;
export type SnippetHeader = keyof typeof SNIPPET_HEADERS;

export const SNIPPET_HEADER_LABEL: Record<SnippetHeader, string> = Object.fromEntries(
  Object.entries(SNIPPET_HEADERS).map(([key, header]) => [key, header.ro])
) as Record<SnippetHeader, string>;

/** Antetul trimis la Google: în română dacă prima limbă a campaniei e româna, altfel în engleză. */
export function snippetHeaderText(header: SnippetHeader, languages: readonly string[]): string {
  return languages[0] === "ro" ? SNIPPET_HEADERS[header].ro : SNIPPET_HEADERS[header].en;
}

// ---------------------------------------------------------------------------
// Campanie
// ---------------------------------------------------------------------------

export const BIDDING_STRATEGIES = ["maximize_clicks", "manual_cpc"] as const;
export type BiddingStrategy = (typeof BIDDING_STRATEGIES)[number];

export const BIDDING_LABEL: Record<BiddingStrategy, string> = {
  maximize_clicks: "Maximizează clicurile",
  manual_cpc: "CPC manual",
};

export const LOCATION_MODES = ["presence", "presence_or_interest"] as const;
export type LocationMode = (typeof LOCATION_MODES)[number];

export const LOCATION_MODE_LABEL: Record<LocationMode, string> = {
  presence: "oameni aflați în zonă (sau care trec des pe acolo)",
  presence_or_interest: "oameni din zonă sau interesați de ea, de oriunde",
};

/** `PositiveGeoTargetType` din API. */
export const GOOGLE_LOCATION_MODE: Record<LocationMode, string> = {
  presence: "PRESENCE",
  presence_or_interest: "PRESENCE_OR_INTEREST",
};

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];

export const DAY_LABEL: Record<Day, string> = {
  mon: "luni",
  tue: "marți",
  wed: "miercuri",
  thu: "joi",
  fri: "vineri",
  sat: "sâmbătă",
  sun: "duminică",
};

/** `DayOfWeek` din API. */
export const GOOGLE_DAY: Record<Day, string> = {
  mon: "MONDAY",
  tue: "TUESDAY",
  wed: "WEDNESDAY",
  thu: "THURSDAY",
  fri: "FRIDAY",
  sat: "SATURDAY",
  sun: "SUNDAY",
};

/** Intervalele programului pe aceeași zi, pe o campanie. */
export const SCHEDULE_PER_DAY_MAX = 6;
/** `MinuteOfHour`: programul merge din 15 în 15 minute. */
export const SCHEDULE_MINUTES = { 0: "ZERO", 15: "FIFTEEN", 30: "THIRTY", 45: "FORTY_FIVE" } as const;

/** Google: 256 (`StringLengthError.TOO_LONG`); 255 lasă loc de rotunjire. */
export const CAMPAIGN_NAME_MAX = 255;
export const AD_GROUP_NAME_MAX = 255;
export const CAMPAIGNS_PER_PLAN_MAX = 25;
export const AD_GROUPS_PER_CAMPAIGN_MAX = 100;

/**
 * Peste atâta pe clic, licitarea e aproape sigur o greșeală de scriere
 * (un zero în plus). Avertisment, pe monedă.
 */
export const MAX_CPC_SANE: Record<string, number> = { RON: 20, EUR: 5, USD: 5 };

// ---------------------------------------------------------------------------
// Cererea
// ---------------------------------------------------------------------------

/**
 * Operații într-o singură cerere `googleAds:mutate`. Planul se creează
 * într-o singură cerere (totul sau nimic), deci peste limită planul se
 * împarte de om, nu de portal.
 */
export const MUTATE_OPERATIONS_MAX = 10_000;

/**
 * Operațiile pe zi ale proiectului Google Cloud la nivelul de acces Explorer
 * (conturi reale). Fiecare operație dintr-o cerere se numără; o verificare
 * cu `validateOnly` se numără foarte probabil la fel (nedocumentat, vezi
 * README). Previzualizarea arată cât consumă planul din ea.
 */
export const EXPLORER_DAILY_OPERATIONS = 2_880;
