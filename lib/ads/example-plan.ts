/**
 * Exemplul complet de plan, comentat: o campanie Meta de tip Leads cu
 * destinație Website. E formatul pe care îl ceri conversației în care
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
    // false (implicit): vârsta și interesele sunt limite, nu sugestii.
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
  }

  // Pe TikTok, în loc de "meta":
  // "tiktok": {
  //   "identity_type": "CUSTOMIZED_USER",   // sau TT_USER, BC_AUTH_TT
  //   "identity_id": "…",
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
