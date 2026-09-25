/**
 * Vocabularul portalului de reclame — valorile permise în plan și numele
 * lor în română.
 *
 * Planul folosește valori COMUNE (`leads`, `get_quote`), nu pe cele ale
 * platformelor (`OUTCOME_LEADS`, `GET_QUOTE`): același plan se citește la
 * fel pe Meta și pe TikTok, iar traducerea în câmpurile fiecărui API se
 * face într-un singur loc, la creare (fazele 2 și 5). Etichetele de aici
 * sunt ce vede omul în previzualizare.
 *
 * Fișierul e izomorf (fără env, fără server): îl importă și schema, și
 * interfața.
 */

export const PLATFORMS = ["meta", "tiktok"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  meta: "Meta",
  tiktok: "TikTok",
};

/** Moneda contului de reclame. Se compară cu moneda reală la creare. */
export const CURRENCIES = ["RON", "EUR", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_LABEL: Record<Currency, string> = {
  RON: "lei",
  EUR: "€",
  USD: "USD",
};

// ---------------------------------------------------------------------------
// Campanie
// ---------------------------------------------------------------------------

export const OBJECTIVES = ["leads", "traffic", "sales", "video_views", "awareness"] as const;
export type Objective = (typeof OBJECTIVES)[number];

export const OBJECTIVE_LABEL: Record<Objective, string> = {
  leads: "Lead-uri",
  traffic: "Trafic",
  sales: "Vânzări",
  video_views: "Vizualizări video",
  awareness: "Notorietate",
};

/**
 * Ce numără „rezultat” la fiecare obiectiv — și cum se cheamă costul lui.
 * La Notorietate, acoperirea e pe zi: însumată pe mai multe zile, un om
 * văzut în două zile contează de două ori. Eticheta o spune.
 */
export const RESULT_LABEL: Record<Objective, { plural: string; cost: string; unit: string }> = {
  leads: { plural: "Lead-uri", cost: "Cost pe lead", unit: "lead-uri" },
  sales: { plural: "Vânzări", cost: "Cost pe vânzare", unit: "vânzări" },
  traffic: { plural: "Vizite pe pagină", cost: "Cost pe vizită", unit: "vizite" },
  video_views: { plural: "Vizionări ThruPlay", cost: "Cost pe ThruPlay", unit: "ThruPlay" },
  awareness: { plural: "Acoperire (sumă pe zile)", cost: "Cost pe persoană atinsă", unit: "oameni" },
};

/** Obiectivele care optimizează pe un eveniment de pe site, deci cer pixel. */
export const OBJECTIVES_WITH_CONVERSION: readonly Objective[] = ["leads", "sales"];

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export const GENDERS = ["all", "male", "female"] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABEL: Record<Gender, string> = {
  all: "toate genurile",
  male: "doar bărbați",
  female: "doar femei",
};

/** Limbile cu nume în română. Orice alt cod ISO 639-1 e acceptat și afișat ca atare. */
export const LANGUAGE_LABEL: Record<string, string> = {
  ro: "română",
  en: "engleză",
  hu: "maghiară",
  de: "germană",
  fr: "franceză",
  it: "italiană",
  es: "spaniolă",
  uk: "ucraineană",
  ru: "rusă",
  bg: "bulgară",
};

export const COUNTRY_LABEL: Record<string, string> = {
  RO: "România",
  MD: "Republica Moldova",
  HU: "Ungaria",
  BG: "Bulgaria",
  DE: "Germania",
  AT: "Austria",
  IT: "Italia",
  ES: "Spania",
  FR: "Franța",
  GB: "Regatul Unit",
};

/**
 * Grupele de vârstă ale TikTok. Meta primește orice interval 18–65;
 * TikTok doar grupe întregi, deci un interval care taie o grupă se lărgește.
 */
export const TIKTOK_AGE_GROUPS: ReadonlyArray<{ min: number; max: number; label: string }> = [
  { min: 18, max: 24, label: "18–24" },
  { min: 25, max: 34, label: "25–34" },
  { min: 35, max: 44, label: "35–44" },
  { min: 45, max: 54, label: "45–54" },
  { min: 55, max: 65, label: "55+" },
];

// ---------------------------------------------------------------------------
// Conversie
// ---------------------------------------------------------------------------

export const CONVERSION_EVENTS = [
  "lead",
  "contact",
  "schedule",
  "complete_registration",
  "purchase",
  "view_content",
] as const;
export type ConversionEvent = (typeof CONVERSION_EVENTS)[number];

export const CONVERSION_EVENT_LABEL: Record<ConversionEvent, string> = {
  lead: "Lead — formular trimis",
  contact: "Contact — telefon, WhatsApp sau email",
  schedule: "Programare",
  complete_registration: "Înregistrare completă",
  purchase: "Cumpărare",
  view_content: "Vizualizare de pagină",
};

/**
 * Numele evenimentului de pixel pe fiecare platformă. `null` = platforma
 * nu are echivalent standard, deci planul se respinge.
 */
export const CONVERSION_EVENT_NAME: Record<ConversionEvent, Record<Platform, string | null>> = {
  lead: { meta: "Lead", tiktok: "SubmitForm" },
  contact: { meta: "Contact", tiktok: "Contact" },
  schedule: { meta: "Schedule", tiktok: null },
  complete_registration: { meta: "CompleteRegistration", tiktok: "CompleteRegistration" },
  purchase: { meta: "Purchase", tiktok: "CompletePayment" },
  view_content: { meta: "ViewContent", tiktok: "ViewContent" },
};

/**
 * Ce trimite EFECTIV site-ul agenției (lib/meta-pixel.ts, lib/tiktok-pixel.ts).
 * Dacă destinația e pe domeniul nostru și evenimentul nu e aici, campania
 * ar optimiza pe ceva ce nu se întâmplă niciodată.
 */
export const SITE_SENDS: Record<Platform, readonly ConversionEvent[]> = {
  meta: ["lead", "contact", "schedule", "view_content"],
  tiktok: ["lead", "contact", "view_content"],
};

/** Parametrii UTM pe care site-ul îi salvează pe lead (lib/utm.ts). */
export const SITE_STORED_UTM = ["source", "medium", "campaign"] as const;

// ---------------------------------------------------------------------------
// Material
// ---------------------------------------------------------------------------

export const CTAS = [
  "learn_more",
  "get_quote",
  "contact_us",
  "sign_up",
  "apply_now",
  "subscribe",
  "download",
] as const;
export type Cta = (typeof CTAS)[number];

/**
 * Eticheta aproximativă. Textul exact de pe buton îl pune platforma, în
 * limba celui care vede reclama — de-aia previzualizarea arată și codul.
 */
export const CTA_LABEL: Record<Cta, string> = {
  learn_more: "Află mai multe",
  get_quote: "Cere ofertă",
  contact_us: "Contactează-ne",
  sign_up: "Înscrie-te",
  apply_now: "Aplică acum",
  subscribe: "Abonează-te",
  download: "Descarcă",
};

export const VARIANT_MODES = ["one_ad_per_text", "platform_rotates"] as const;
export type VariantMode = (typeof VARIANT_MODES)[number];

export const VARIANT_MODE_LABEL: Record<VariantMode, string> = {
  one_ad_per_text: "O reclamă pentru fiecare text",
  platform_rotates: "O singură reclamă, platforma alternează textele",
};

export const MAX_TEXT_VARIANTS = 5;

/**
 * Video nou urcat din portal. Trece prin stocarea temporară din Supabase
 * (migrarea 7), iar limita de acolo e limita de aici: 50 MB pe planul Free.
 * Pe Pro se ridică în ambele locuri, cu același număr.
 */
export const VIDEO_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
export const VIDEO_UPLOAD_TYPES = ["video/mp4", "video/quicktime"] as const;
export type VideoUploadType = (typeof VIDEO_UPLOAD_TYPES)[number];

/** TikTok taie textul reclamei la 100 de caractere; Meta îl ascunde după ~125. */
export const TIKTOK_AD_TEXT_MAX = 100;
export const META_PRIMARY_TEXT_VISIBLE = 125;
export const META_HEADLINE_VISIBLE = 40;

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const META_SPECIAL_CATEGORIES = [
  "housing",
  "employment",
  "financial_products_services",
  "issues_elections_politics",
] as const;
export type MetaSpecialCategory = (typeof META_SPECIAL_CATEGORIES)[number];

export const META_SPECIAL_CATEGORY_LABEL: Record<MetaSpecialCategory, string> = {
  housing: "Locuințe (imobiliare)",
  employment: "Locuri de muncă",
  financial_products_services: "Produse și servicii financiare",
  issues_elections_politics: "Politică și alegeri",
};

export const META_PLACEMENTS = [
  "facebook_feed",
  "facebook_reels",
  "facebook_stories",
  "instagram_feed",
  "instagram_reels",
  "instagram_stories",
] as const;
export type MetaPlacement = (typeof META_PLACEMENTS)[number];

export const META_PLACEMENT_LABEL: Record<MetaPlacement, string> = {
  facebook_feed: "Facebook — flux",
  facebook_reels: "Facebook — Reels",
  facebook_stories: "Facebook — Stories",
  instagram_feed: "Instagram — flux",
  instagram_reels: "Instagram — Reels",
  instagram_stories: "Instagram — Stories",
};

/**
 * „Îmbunătățirile" automate. Implicit TOATE oprite: un testimonial filmat
 * nu se lasă rescris, remixat sau dublat de platformă.
 *
 * Maparea pe câmpurile API se face la creare (faza 2 pentru Meta, faza 5
 * pentru TikTok), unde fiecare se trimite EXPLICIT ca oprit — nu ne bazăm
 * pe valorile implicite ale platformei, care se schimbă de la o versiune
 * la alta.
 */
export const META_ENHANCEMENTS = [
  "advantage_creative",
  "ad_sources",
  "multi_advertiser_ads",
] as const;
export type MetaEnhancement = (typeof META_ENHANCEMENTS)[number];

export const META_ENHANCEMENT_LABEL: Record<MetaEnhancement, { title: string; body: string }> = {
  advantage_creative: {
    title: "Advantage+ creative enhancements",
    body: "Meta decupează sau extinde cadrul, adaugă muzică și subtitrări, rescrie, traduce sau dublează textul, generează butoane și rezumate.",
  },
  ad_sources: {
    title: "Ad sources",
    // Nu are un câmp propriu în Marketing API: portalul refuză, una câte una,
    // funcțiile pe care le alimentează (lib/ads/meta/build.ts → AD_SOURCES_FEATURES).
    body: "Meta ia informații de pe site-ul sau pagina ta și le adaugă pe reclamă: linkuri spre alte pagini, rezumate, detalii care apar treptat, locații de magazin.",
  },
  multi_advertiser_ads: {
    title: "Multi-advertiser ads",
    body: "Reclama apare într-un carusel lângă reclamele altor firme.",
  },
};

// ---------------------------------------------------------------------------
// TikTok
// ---------------------------------------------------------------------------

export const TIKTOK_IDENTITY_TYPES = ["CUSTOMIZED_USER", "TT_USER", "BC_AUTH_TT"] as const;
export type TikTokIdentityType = (typeof TIKTOK_IDENTITY_TYPES)[number];

export const TIKTOK_IDENTITY_LABEL: Record<TikTokIdentityType, string> = {
  CUSTOMIZED_USER: "Identitate personalizată (nume + avatar, fără cont TikTok)",
  TT_USER: "Contul TikTok legat de contul de reclame",
  BC_AUTH_TT: "Cont TikTok autorizat în Business Center",
};

export const TIKTOK_PLACEMENTS = ["automatic", "tiktok_only"] as const;
export type TikTokPlacement = (typeof TIKTOK_PLACEMENTS)[number];

export const TIKTOK_PLACEMENT_LABEL: Record<TikTokPlacement, string> = {
  automatic: "Automat (TikTok și aplicațiile partenere)",
  tiktok_only: "Doar în TikTok",
};

export const TIKTOK_ENHANCEMENTS = [
  "automatic_enhancements",
  "auto_add_assets",
  "translate_and_dub",
  "music_refresh",
] as const;
export type TikTokEnhancement = (typeof TIKTOK_ENHANCEMENTS)[number];

export const TIKTOK_ENHANCEMENT_LABEL: Record<TikTokEnhancement, { title: string; body: string }> = {
  automatic_enhancements: {
    title: "Automatic enhancements",
    body: "TikTok retușează calitatea, redimensionează și reface începutul clipului.",
  },
  auto_add_assets: {
    title: "Auto-add assets",
    body: "TikTok adaugă singur materiale noi în campanie cât timp rulează.",
  },
  translate_and_dub: {
    title: "Translate and dub",
    body: "TikTok traduce și dublează vocea în alte limbi.",
  },
  music_refresh: {
    title: "Music refresh",
    body: "TikTok înlocuiește muzica cu piese din biblioteca lui.",
  },
};
