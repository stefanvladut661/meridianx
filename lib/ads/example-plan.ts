import type { Platform } from "./constants";
import { parseJsonText } from "./plan-json";
import { PLAN_FORMAT } from "./plan-schema";
import { WORKSPACES, type AdsWorkspace } from "./workspaces";

/**
 * Exemplele complete de plan, comentate: o campanie de tip Leads cu
 * destinație Website, pe Meta și pe TikTok. E formatul pe care îl ceri conversației în care
 * scrii planul.
 *
 * Portalul acceptă comentariile `//` exact așa — exemplul se poate lipi
 * direct. Id-urile sunt evident false (zerouri): se înlocuiesc cu ale tale.
 *
 * Aceeași sursă ajunge în butonul „Încarcă exemplul" și în `README.md`.
 */
export const EXAMPLE_PLAN = `{
  // Opțional. Dacă există, trebuie să fie exact "meridian-ads/1".
  "format": "meridian-ads/1",

  // Spațiul de lucru = portofoliul + tokenul lui. Trebuie să fie același
  // cu cel ales în selectorul de sus, altfel portalul refuză.
  // Variante: meta-meridian, meta-clienti, tiktok-meridian, tiktok-clienti.
  "workspace": "meta-meridian",

  // Contul de reclame: pe Meta "act_" + cifre (sau doar cifrele).
  // Îl găsești în Ads Manager, în meniul de conturi din stânga sus.
  "ad_account": "act_000000000000001",

  "campaign": {
    // Numele din Ads Manager. Setul și reclamele primesc nume derivate.
    "name": "Video imobiliare · testimonial · oct 2026",
    // leads | traffic | sales | video_views | awareness
    "objective": "leads",
    // Pe zi, în moneda contului, ca număr: 60 = 60 lei. Nu bani, nu cenți.
    // Peste plafonul spațiului (lib/ads/workspaces.ts) planul se respinge.
    "daily_budget": 60,
    // RON | EUR | USD — trebuie să fie moneda contului.
    "currency": "RON"
  },

  "audience": {
    // Cel puțin o locație. Tipuri: country (code), region, city (name +
    // country, opțional radius_km). Orașele și regiunile se caută după
    // nume la creare; dacă știi cheia platformei, pune-o în "key".
    "locations": [
      { "type": "city", "name": "București", "country": "RO", "radius_km": 30 },
      { "type": "city", "name": "Cluj-Napoca", "country": "RO", "radius_km": 25 }
    ],
    // 18–65. 65 înseamnă „65 și peste". Implicit 18–65.
    "age_min": 28,
    "age_max": 60,
    // all | male | female. Implicit all.
    "gender": "all",
    // Coduri de limbă din două litere. Listă goală = orice limbă.
    "languages": ["ro"],
    // Interese și comportamente după nume; "id" opțional, dacă îl știi.
    "interests": [
      { "name": "Real estate" },
      { "name": "Real estate development" }
    ],
    "behaviors": [
      { "name": "Small business owners" }
    ]
  },

  // Obligatorie pentru leads și sales: pe ce eveniment optimizează Meta.
  // Site-ul Meridian trimite Lead la trimiterea formularului, plus
  // Contact, Schedule și ViewContent.
  "conversion": {
    // Id-ul pixelului din Events Manager, ca text (între ghilimele).
    "pixel_id": "000000000000003",
    // lead | contact | schedule | complete_registration | purchase | view_content
    "event": "lead"
  },

  "destination": {
    // Deocamdată doar "website".
    "type": "website",
    "url": "https://www.meridianx.ro/video",
    // Se adaugă la URL. Site-ul salvează pe lead source, medium și campaign;
    // content și term ajung doar în statisticile platformei. Macro-urile Meta
    // ({{ad.name}}, {{campaign.name}}) rămân necodate și se înlocuiesc la clic.
    "utm": {
      "source": "facebook",
      "medium": "paid_social",
      "campaign": "video-imobiliare-oct26"
    }
  },

  "creative": {
    // Video deja urcat în contul de reclame:
    //   { "source": "library", "video_id": "…" }
    // Sau fișier nou, ales în portal după verificare:
    //   { "source": "upload", "file_name": "testimonial.mp4" }
    "video": { "source": "library", "video_id": "000000000000004" },
    // "auto" = coperta propusă de platformă. Sau { "url": "https://…" }.
    "thumbnail": "auto",
    // 1–5 variante. Pe Meta se vede cam primul rând și jumătate (~125 de
    // caractere) până la „Vezi mai mult”.
    "primary_texts": [
      "Un apartament se vinde din primele trei secunde de video. Noi le filmăm pe alea trei. Și restul.",
      "Randările arată toate la fel. Filmăm proiectul tău așa cum îl vede cumpărătorul, la lumina reală."
    ],
    // 0–5. Titlul de lângă buton; pe telefon se taie după ~40 de caractere.
    "headlines": ["Video pentru proiectul tău rezidențial"],
    // 0–5. Rândul mic de sub titlu; apare doar în unele plasări.
    "descriptions": ["Răspundem în maxim 24 de ore"],
    // learn_more | get_quote | contact_us | sign_up | apply_now | subscribe | download
    "cta": "get_quote",
    // one_ad_per_text (implicit): câte o reclamă pe text, titlul și descrierea
    // pe același index (sau primele, dacă sunt mai puține).
    // platform_rotates: o singură reclamă, Meta alternează textele.
    "variants": "one_ad_per_text"
  },

  // Obligatorie pe Meta.
  "meta": {
    // Pagina de Facebook în numele căreia apare reclama.
    "page_id": "000000000000002",
    // Opțional: contul de Instagram. Fără el, pe Instagram apare pagina.
    "instagram_account_id": "000000000000005",
    // housing | employment | financial_products_services | issues_elections_politics.
    // Reclama unui client care vinde sau închiriază locuințe intră de regulă
    // la "housing" — la dubiu, verifică politica Meta pentru categorii speciale.
    "special_ad_categories": [],
    // false (implicit): vârsta, genul și locația sunt limite stricte.
    // Interesele, la Lead-uri / Vânzări / Trafic, Meta le lărgește oricum.
    "advantage_audience": false,
    // "automatic" sau o listă: facebook_feed, facebook_reels, facebook_stories,
    // instagram_feed, instagram_reels, instagram_stories.
    "placements": "automatic",
    // Implicit TOATE oprite. Le scriem explicit ca să se vadă în plan.
    "enhancements": {
      "advantage_creative": false,
      "ad_sources": false,
      "multi_advertiser_ads": false
    }
    // Publicul e în UE, deci Meta cere pe reclamă cine beneficiază și cine
    // plătește (DSA). Lipsă = setările contului din Ads Manager; dacă nici
    // contul nu le are, portalul le cere aici:
    // "dsa_beneficiary": "Firma clientului",
    // "dsa_payor": "Firma care plătește reclama"
  }

  // Pe TikTok, în loc de "meta":
  // "tiktok": {
  //   "identity_type": "TT_USER",            // sau BC_AUTH_TT, cu "identity_bc_id"
  //   "identity_id": "…",                    // contul TikTok de pe reclamă (Spark Ads)
  //   "placements": "tiktok_only",           // sau automatic
  //   "enhancements": {
  //     "automatic_enhancements": false,
  //     "auto_add_assets": false,
  //     "translate_and_dub": false,
  //     "music_refresh": false
  //   }
  // }
}
`;

/**
 * Același plan, pe TikTok: ce e comun rămâne, ce ține de TikTok stă în
 * secțiunea `tiktok`. Id-urile sunt evident false.
 */
export const EXAMPLE_PLAN_TIKTOK = `{
  "format": "meridian-ads/1",

  // Pe TikTok: tiktok-meridian sau tiktok-clienti — cel din selectorul de sus.
  "workspace": "tiktok-meridian",

  // advertiser_id-ul contului TikTok, doar cifre. În TikTok Ads Manager,
  // sus, sub numele contului.
  "ad_account": "7000000000000000001",

  "campaign": {
    "name": "Video imobiliare · testimonial · TikTok · oct 2026",
    "objective": "leads",
    // Pe zi, pe grupul de reclame, în moneda contului. TikTok cere cel puțin 20.
    "daily_budget": 60,
    "currency": "RON"
  },

  "audience": {
    // TikTok nu targetează pe rază. Regiunile și orașele merg doar unde
    // TikTok le are în listă — verificarea îți spune dacă nu le are.
    "locations": [
      { "type": "country", "code": "RO" }
    ],
    // Pe grupe întregi: 18–24, 25–34, 35–44, 45–54, 55+.
    "age_min": 25,
    "age_max": 54,
    "gender": "all",
    "languages": ["ro"],
    // Categoriile de interes TikTok, în engleză, ca în TikTok Ads Manager.
    // Comportamentele (behaviors) nu se folosesc pe TikTok.
    "interests": [
      { "name": "Real Estate" }
    ]
  },

  "conversion": {
    // Id-ul numeric al pixelului SAU codul lui — cel din codul site-ului.
    "pixel_id": "DAN9FTJC77U07P78RH10",
    // lead = formular trimis. Pe TikTok, site-ul trimite lead, contact și view_content.
    "event": "lead"
  },

  "destination": {
    "type": "website",
    "url": "https://www.meridianx.ro/video",
    // Macro-urile TikTok (__CAMPAIGN_NAME__, __CID__) se înlocuiesc la clic.
    "utm": {
      "source": "tiktok",
      "medium": "paid_social",
      "campaign": "video-imobiliare-oct26"
    }
  },

  "creative": {
    // Video deja în biblioteca contului TikTok, sau { "source": "upload" }.
    "video": { "source": "library", "video_id": "v10033g50000fake00001" },
    "thumbnail": "auto",
    // Cel mult 100 de caractere, fără emoji. O reclamă pentru fiecare text.
    // Pe TikTok nu există titlu și descriere.
    "primary_texts": [
      "Un apartament se vinde din primele trei secunde de video. Noi le filmăm.",
      "Filmăm proiectul tău așa cum îl vede cumpărătorul, la lumina reală."
    ],
    "cta": "get_quote"
  },

  // Obligatorie pe TikTok.
  "tiktok": {
    // Reclama apare în numele unui cont TikTok (Spark Ads). TikTok nu mai
    // acceptă identitatea personalizată (nume + avatar fără cont).
    //   TT_USER    — contul TikTok legat de contul de reclame;
    //   BC_AUTH_TT — cont autorizat în Business Center, cu "identity_bc_id".
    "identity_type": "TT_USER",
    // Verificarea portalului îți arată identitățile pe care le vede contul.
    "identity_id": "7100000000000000009",
    // tiktok_only (implicit) | automatic
    "placements": "tiktok_only",
    // Toate oprite. Auto-add assets și Translate and dub există doar în Smart+.
    "enhancements": {
      "automatic_enhancements": false,
      "auto_add_assets": false,
      "translate_and_dub": false,
      "music_refresh": false
    }
  }
}
`;

/**
 * Același plan, pe Google: o campanie Demand Gen — reclame video pe YouTube
 * (în fluxul de video-uri, în Shorts, înainte de video-uri). Id-urile sunt
 * evident false; video-ul e unul public, de test.
 */
export const EXAMPLE_PLAN_GOOGLE = `{
  "format": "meridian-ads/1",

  // Pe Google: google-meridian sau google-clienti — cel din selectorul de sus.
  "workspace": "google-meridian",

  // Id-ul contului Google Ads: 10 cifre, cu sau fără cratime (dreapta sus în Google Ads).
  "ad_account": "123-456-7890",

  "campaign": {
    "name": "Video imobiliare · testimonial · Google · oct 2026",
    // leads și traffic. Vizualizările și notorietatea pe YouTube se fac din Google Ads.
    "objective": "leads",
    // Pe zi, în moneda contului.
    "daily_budget": 60,
    "currency": "RON"
  },

  "audience": {
    // Țară, regiune sau oraș. Google țintește orașul întreg — fără rază.
    "locations": [
      { "type": "city", "name": "București", "country": "RO" },
      { "type": "city", "name": "Cluj-Napoca", "country": "RO" }
    ],
    // Pe Google, vârsta merge pe grupe: 18–24, 25–34, 35–44, 45–54, 55–64, 65+.
    "age_min": 25,
    "age_max": 64,
    "gender": "all",
    "languages": ["ro"],
    // Segmentele de public Google („în piață" și „afinitate"), în engleză, ca în Google Ads.
    "interests": [
      { "name": "Real Estate" }
    ]
  },

  // Obligatorie la leads: acțiunea de conversie din Google Ads (Obiective → Conversii),
  // cu id-ul ei numeric. Site-ul trimite conversia prin tag-ul Google (lib/google-tag.ts).
  "conversion": {
    "pixel_id": "700000001",
    "event": "lead"
  },

  "destination": {
    "type": "website",
    "url": "https://www.meridianx.ro/video",
    // ValueTrack ({campaignid}, {creative}) se înlocuiește la clic.
    "utm": {
      "source": "google",
      "medium": "paid_video",
      "campaign": "video-imobiliare-oct26"
    }
  },

  "creative": {
    // Video-uri de pe YouTube (id-ul de 11 caractere din link), publice sau nelistate.
    // Sau { "source": "upload" }: portalul îl urcă pe YouTube, nelistat, prin Google Ads.
    "videos": [
      { "source": "library", "video_id": "aqz-KE-bpKQ" }
    ],
    "thumbnail": "auto",
    // Pe Google, textele principale devin titluri lungi: cel mult 90 de caractere.
    "primary_texts": [
      "Un apartament se vinde din primele trei secunde de video. Noi le filmăm pe alea trei."
    ],
    // Titluri scurte (cel puțin unul, maxim 40 de caractere) și descrieri (cel puțin una, maxim 90).
    "headlines": ["Video pentru proiectul tău", "Filmăm la lumina reală"],
    "descriptions": ["Testimoniale și tururi video pentru dezvoltatori imobiliari. Ofertă în 24 de ore."],
    "cta": "get_quote",
    // platform_rotates (recomandat pe Google): o reclamă cu toate textele și video-urile, Google le combină.
    "variants": "platform_rotates"
  },

  // Obligatorie pe Google.
  "google": {
    // Numele firmei, cum apare pe reclamă (cel mult 25 de caractere).
    "business_name": "MERIDIAN",
    // Sigla: imagine pătrată, minim 128×128, PNG sau JPEG, la o adresă https.
    "logo_url": "https://www.meridianx.ro/brand/icon-512.png",
    // "all" sau o listă: youtube_in_stream, youtube_in_feed, youtube_shorts, discover, gmail, display.
    "channels": ["youtube_in_stream", "youtube_in_feed", "youtube_shorts"],
    // Lărgirea automată a publicului: oprită — vârsta, locațiile și interesele sunt limite.
    "optimized_targeting": false,
    // Implicit oprite: Google nu remixează video-ul și nu scrie texte în locul tău.
    "enhancements": {
      "video_enhancements": false,
      "text_assets": false
    }
  }
}
`;

/**
 * Exemplul pentru spațiul pe care lucrezi: platforma lui și id-ul lui în
 * `workspace`, ca exemplul să treacă de verificarea „același spațiu”.
 */
export function examplePlanFor(workspace: { id: string; platform: Platform }): string {
  const text = EXAMPLE_BY_PLATFORM[workspace.platform];
  return text.replace(/"workspace": "[a-z-]+"/, `"workspace": "${workspace.id}"`);
}

export const EXAMPLE_BY_PLATFORM: Record<Platform, string> = {
  meta: EXAMPLE_PLAN,
  tiktok: EXAMPLE_PLAN_TIKTOK,
  google: EXAMPLE_PLAN_GOOGLE,
};

/**
 * Un lot de exemplu: aceeași campanie pe fiecare platformă, în spațiile
 * proprietarului ales sus. Fără comentarii — un lot se citește pe rânduri,
 * iar explicațiile câmpurilor stau în exemplele de mai sus.
 */
export function exampleBatchFor(owner: AdsWorkspace["owner"]): string {
  const plans = WORKSPACES.filter((workspace) => workspace.owner === owner).flatMap((workspace) => {
    const parsed = parseJsonText(EXAMPLE_BY_PLATFORM[workspace.platform]);
    if (!parsed.ok || !parsed.value || typeof parsed.value !== "object") return [];
    const plan = parsed.value as Record<string, unknown>;
    delete plan.format;
    plan.workspace = workspace.id;
    return [plan];
  });
  return JSON.stringify({ format: PLAN_FORMAT, plans }, null, 2);
}
