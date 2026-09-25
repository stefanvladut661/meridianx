# Portalul de reclame — `/admin/ads`

Unealtă internă: lipești un plan de campanie în JSON, îl citești în română, îl
corectezi și îl creezi **pe pauză** în Meta sau TikTok. Plus un dashboard cu
cifrele campaniilor.

Ramura: `feat/ads-portal`. Zona portalului: `app/(admin)/admin/ads/**`,
`lib/ads/**`, `components/ads/**` și migrarea lui (din faza 2).

**Citește întâi `GHID.md`** — ce e de făcut după fiecare fază și ce e de hotărât.
Promptul complet al portalului e în `PROMPT.md`.

---

## Regula care nu se negociază

**Portalul creează campanii DOAR în stare PAUSED** (pe TikTok:
`operation_status: DISABLE`). Nu există cod, rută sau buton care să pornească
o campanie. Activarea o face omul, în Ads Manager. Dacă o funcție ar putea
trimite statusul de pornire, designul e greșit.

Consecința oricărei erori de cod trebuie să fie o campanie oprită, nu una care
arde buget. De aici și plafonul de buget pe spațiu de lucru: prinde un zero în
plus înainte ca planul să ajungă la platformă.

**Repo-ul e public.** Niciun token, id de cont sau secret în cod, în commit, în
log sau în răspuns către browser. Datele de test sunt evident false (zerouri).

---

## Fazele

| Fază | Ce | Stare |
|---|---|---|
| 1 | Schema JSON + validare + previzualizare, fără apeluri la platforme | ✅ `feat/ads-portal` |
| 2 | Meta: creare campanie pe pauză, cu video deja urcat | ✅ `feat/ads-portal` — testat pe Meta fals, încă nu pe contul real |
| 3 | Meta: încărcare video din browser | ✅ `feat/ads-portal` — testat pe Meta și Supabase falși, încă nu pe contul real |
| 4 | Dashboard + cron pentru Meta | ✅ `feat/ads-portal` — testat pe Meta și Supabase falși; cron-ul cere o linie în `vercel.json` (vezi „Faza 4”) |
| 5 | TikTok, peste structura existentă | ✅ `feat/ads-portal` — testat pe TikTok și Supabase falși, încă nu pe contul real |

Commit separat după fiecare fază; nu se trece mai departe fără confirmarea omului.

---

## Fișierele

| Fișier | Ce face |
|---|---|
| `workspaces.ts` | Spațiile de lucru: nume, platformă, variabila tokenului, plafonul de buget. Izomorf. |
| `workspaces.server.ts` | `server-only`: dacă tokenul e setat, spațiul curent (cookie). |
| `constants.ts` | Vocabularul planului (obiective, CTA, evenimente…) și etichetele în română. |
| `plan-schema.ts` | Schema Zod — forma planului. Obiecte stricte. |
| `plan-validate.ts` | Mesajele în română, regulile încrucișate, avertismentele. Izomorf: rulează în browser acum și pe server din faza 2. |
| `plan-json.ts` | Citirea textului lipit: acceptă ```json, comentarii `//`, virgule finale. |
| `plan-derive.ts` | URL-ul final cu UTM, reclamele care ies din texte, grupele de vârstă TikTok. |
| `plan-summary.ts` | Planul spus în română, din datele brute. |
| `example-plan.ts` | Exemplul comentat — sursa unică (butonul „Încarcă exemplul" și secțiunea de mai jos). |
| `store.ts` | `server-only`: tabelele portalului (migrarea 6). Citire prin sesiune (RLS), scriere prin service role. |
| `platform.ts` | `server-only`: contractul comun al platformelor și `adapterFor(platform)` — acțiunile și sincronizarea nu știu nimic despre Meta sau TikTok. |
| `types.ts` | Ce ajunge în browser din verificare și creare, pe ambele platforme. |
| `links.ts` | Linkurile spre Ads Manager și TikTok Ads Manager. |
| `fingerprint.ts` | Amprenta care leagă verificarea de creare. |
| `meta/graph.ts` | `server-only`: SINGURUL client Graph API. GET-uri + o singură cale de scriere (`metaPost` → `metaCreate`, `metaUploadImage`), cu `assertPaused` înainte de rețea. Fără update, fără delete. |
| `meta/paused.ts` | Garda, pe ambele platforme: orice câmp de status, la orice adâncime, trebuie să fie `PAUSED` (Meta) sau `DISABLE` (TikTok); căile de scriere sunt o listă închisă. |
| `meta/build.ts` | Planul → corpurile de cerere v26 (campanie, set, creativ, reclamă). Funcții pure. |
| `meta/lookup.ts` | Citiri: conturile tokenului, pagină, Instagram, pixel, video, biblioteca video, DSA-ul contului. |
| `meta/targeting.ts` | Numele din plan → cheile Meta (orașe, regiuni, limbi, interese, comportamente). |
| `meta/check.ts` | „Verifică în Meta": tot ce trebuie să existe înainte de creare + amprenta planului. |
| `meta/create.ts` | Crearea: copertă → campanie → set → (creativ → reclamă) × N, toate pe pauză. |
| `meta/thumbnail.ts` | Coperta propusă de Meta, descărcată ca s-o urcăm în cont (Meta nu vrea linkuri spre CDN-ul lui). |
| `meta/errors.ts` | Erorile Meta spuse în română, cu mesajul lor original și `fbtrace_id`. |
| `meta/video.ts` | `server-only`: video nou — Meta îl descarcă de la un link semnat (`file_url`); starea procesării. |
| `staging.ts` | `server-only`: anticamera video-urilor (bucket-ul privat `ads-uploads`, migrarea 7): URL semnat de urcare, link de descărcare pentru Meta, ștergere, curățenie la 6 ore. |
| `meta/insights.ts` | `server-only`: cifrele zilnice din Insights (o cerere pe cont) și statusul de livrare al fiecărei campanii. |
| `sync.ts` | `server-only`: sincronizarea Insights → `ads_metrics_daily`, cu jurnalul în `ads_runs`. |
| `stats.ts` | `server-only`: citirea cifrelor pentru ecrane, prin sesiune (RLS) — niciodată din API. |
| `../../components/ads/hydrate-when-parsed.tsx` | Hidratarea portalului abia după citirea completă a paginii (vezi „Hidratarea”). |
| `metrics.ts` | Calculele pure: totaluri, CTR/CPC/CPM/cost pe rezultat din sume, perioade, comparații, formatare. |
| `tiktok/api.ts` | `server-only`: SINGURUL client TikTok. GET-uri + o singură cale de scriere (`tiktokCreate`), cu `assertTikTokDisabled` înainte de rețea. Fără update, fără delete. Id-urile de 19 cifre trec exact. |
| `tiktok/build.ts` | Planul → corpurile de cerere v1.3 (campanie, grup, reclame). Funcții pure. |
| `tiktok/lookup.ts` | Citiri: contul, identitățile, pixelul, video-ul, biblioteca. |
| `tiktok/targeting.ts` | Numele din plan → id-urile TikTok (țări, regiuni, orașe, limbi, interese). |
| `tiktok/check.ts` | „Verifică în TikTok" + amprenta planului. |
| `tiktok/create.ts` | Crearea: copertă → campanie → grup → reclame (o cerere), toate oprite. |
| `tiktok/video.ts` | Video nou prin link (`UPLOAD_BY_URL`) și starea conversiei. |
| `tiktok/insights.ts` | Cifrele zilnice (ferestre de 30 de zile) și statusul campaniilor. |
| `tiktok/errors.ts` | Erorile TikTok spuse în română, cu mesajul lor și `request_id`. |
| `tiktok/adapter.ts` | TikTok sub contractul din `platform.ts`. |
| `meta/verify-paused.mjs` | `node lib/ads/meta/verify-paused.mjs` — verificarea regulii „doar pe pauză", Meta și TikTok (48 de verificări, fără rețea). |

---

## Spațiile de lucru

Un spațiu = un business portfolio (Meta) sau un Business Center (TikTok) = **un
token**. Fiecare operație primește un singur spațiu și folosește doar tokenul
lui; nicio funcție nu citește două tokenuri în același apel.

| Id | Afișat | Variabila tokenului | Plafon / zi |
|---|---|---|---|
| `meta-meridian` | Meridian · Meta | `META_TOKEN_MERIDIAN` | 500 lei · 100 € |
| `meta-clienti` | Clienți · Meta | `META_TOKEN_CLIENTI` | 2.500 lei · 500 € · 500 USD |
| `tiktok-meridian` | Meridian · TikTok | `TIKTOK_TOKEN_MERIDIAN` | 500 lei · 100 € |
| `tiktok-clienti` | Clienți · TikTok | `TIKTOK_TOKEN_CLIENTI` | 2.500 lei · 500 € · 500 USD |

**Portofoliu nou** = un obiect nou în `WORKSPACES` + variabila lui în Vercel.

**De ce nu stă lista de conturi de reclame în fișier:** repo-ul e public. Lista
vine din token, la conectare (faza 2): un System User vede exact conturile care
i-au fost atribuite, deci izolarea o garantează platforma. Planul spune contul
(`ad_account`), iar la creare portalul verifică că e unul dintre conturile
tokenului spațiului.

Spațiul curent stă într-un cookie (`meridian_ads_spatiu`, `httpOnly`) și e
mereu vizibil în capul paginii. Un plan pentru alt spațiu decât cel afișat se
respinge, cu două ieșiri: „Treci în …" sau „Scrie … în plan".

---

## Formatul planului

O schemă pentru ambele platforme. Ce e comun stă la rădăcină; ce există doar pe
o platformă stă în `meta` sau `tiktok`. Spațiul spune platforma — nu există
câmp `platform` separat, ca să nu se poată contrazice.

| Câmp | Obligatoriu | Ce e |
|---|---|---|
| `format` | nu | `"meridian-ads/1"` |
| `workspace` | da | id din tabelul de mai sus |
| `ad_account` | da | Meta: `act_` + cifre (sau doar cifrele) · TikTok: advertiser_id |
| `campaign.name` · `.objective` · `.daily_budget` · `.currency` | da | obiective: `leads`, `traffic`, `sales`, `video_views`, `awareness`; buget pe zi în unități întregi ale monedei |
| `audience.locations[]` | da, minim 1 | `country` (code) · `region` (name, country) · `city` (name, country, `radius_km`) |
| `audience.age_min` / `age_max` | nu (18 / 65) | 18–65; 65 = „65+" |
| `audience.gender` | nu (`all`) | `all`, `male`, `female` |
| `audience.languages[]` | nu (orice) | coduri ISO 639-1: `ro`, `hu` |
| `audience.interests[]` / `behaviors[]` | nu | `{ "name": "…", "id"?: "…" }` — fără id, se caută după nume la creare; `behaviors` doar pe Meta |
| `conversion.pixel_id` · `.event` | da pentru `leads` și `sales` | evenimente: `lead`, `contact`, `schedule`, `complete_registration`, `purchase`, `view_content` |
| `destination` | da | `{ "type": "website", "url": "https://…", "utm"?: { source, medium, campaign, content, term } }` |
| `creative.video` | da | `{ "source": "library", "video_id": "…" }` sau `{ "source": "upload", "file_name"?: "…" }` |
| `creative.thumbnail` | nu (`auto`) | `"auto"` sau `{ "url": "https://…" }` |
| `creative.primary_texts[]` | da, 1–5 | |
| `creative.headlines[]` / `descriptions[]` | nu, 0–5 | doar Meta |
| `creative.cta` | da | `learn_more`, `get_quote`, `contact_us`, `sign_up`, `apply_now`, `subscribe`, `download` |
| `creative.variants` | nu (`one_ad_per_text`) | sau `platform_rotates` (doar Meta) |
| `meta.page_id` | da pe Meta | |
| `meta.instagram_account_id` · `special_ad_categories[]` · `advantage_audience` · `placements` | nu | `advantage_audience` implicit `false`; `placements` implicit `"automatic"` |
| `meta.enhancements` | nu — **toate `false`** | `advantage_creative`, `ad_sources`, `multi_advertiser_ads` |
| `meta.dsa_beneficiary` · `meta.dsa_payor` | da în UE, dacă contul n-are valori implicite | cine beneficiază și cine plătește reclama (DSA) — apar pe reclamă |
| `tiktok.identity_type` · `identity_id` | da pe TikTok | `TT_USER` sau `BC_AUTH_TT` (Spark Ads); `CUSTOMIZED_USER` se respinge — TikTok n-o mai acceptă |
| `tiktok.identity_bc_id` | da la `BC_AUTH_TT` | Business Center-ul care a autorizat contul TikTok |
| `tiktok.placements` | nu (`tiktok_only`) | sau `automatic` |
| `tiktok.enhancements` | nu — **toate `false`** | `automatic_enhancements`, `auto_add_assets`, `translate_and_dub`, `music_refresh` |

Reguli de citire:

- **Id-urile se scriu ca text**, între ghilimele. Ca număr, JavaScript
  rotunjește orice trece de 16 cifre — alt cont, altă pagină.
- **`null` = câmp lipsă.** `"instagram_account_id": null` e același lucru cu a
  nu-l scrie.
- **Câmp necunoscut = eroare**, cu „ai vrut …?". O cheie greșită ignorată în
  tăcere ar însemna o valoare implicită despre care nu știe nimeni.

### Exemplul complet, comentat — Meta, Leads, destinație Website

Sursa: `example-plan.ts`. Se poate lipi direct în portal, cu comentarii cu tot.

```jsonc
{
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
}
```

### Exemplul complet, comentat — TikTok, Leads, destinație Website

În spațiile TikTok, „Încarcă exemplul” dă exact acest plan.

```jsonc
{
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
```

### Ce verifică portalul

- **Erori (blochează crearea):** câmpuri lipsă sau de alt tip, valori care nu
  există (cu „ai vrut …?"), câmpuri necunoscute, plan pentru alt spațiu decât
  cel afișat, secțiunea platformei lipsă, formatul contului, pixel lipsă la
  `leads`/`sales`, eveniment fără echivalent pe platformă (Programare pe
  TikTok), buget peste plafonul spațiului, monedă fără plafon, vârstă inversată,
  texte TikTok peste 100 de caractere, `platform_rotates` pe TikTok. Pe TikTok,
  în plus: identitatea personalizată (`CUSTOMIZED_USER`), `BC_AUTH_TT` fără
  `identity_bc_id`, bugetul sub 20, comportamentele, „Auto-add assets” și
  „Translate and dub” pornite (există doar în Smart+). Pe Meta,
  în plus (ce ar refuza Meta abia la setul de reclame, după ce campania
  există deja): rază de oraș sub 17 km, Facebook Stories fără Facebook flux
  sau Instagram Stories, Advantage+ audience cu vârsta maximă sub 65 sau cea
  minimă peste 25, `platform_rotates` în afara obiectivelor Lead-uri și Vânzări.
- **Avertismente (nu blochează):** o îmbunătățire automată pornită, Advantage+
  audience pornit, categorie specială, evenimentul nu e trimis de site-ul
  nostru, alt pixel decât cel al site-ului, UTM-uri duplicate sau pe care
  site-ul nu le salvează pe lead, macro-uri ale celeilalte platforme, texte
  care se taie pe Meta, lipsa titlului, grupele de vârstă TikTok care lărgesc
  intervalul, rază pe TikTok (ignorată), video nou încă neurcat, interese la
  Lead-uri / Vânzări / Trafic pe Meta (Meta le lărgește oricum — extinderea
  targetării detaliate nu se poate opri din API).

---

## Faza 2 — crearea pe Meta

### Drumul, pe ecran

1. Planul valid → **Verifică în Meta**. Serverul citește, cu tokenul
   spațiului: conturile pe care le vede tokenul (planul se respinge dacă
   `ad_account` nu e printre ele sau dacă moneda contului diferă de
   `currency`), pagina, Instagramul, pixelul, video-ul (trebuie să fie gata
   procesat), beneficiarul și plătitorul DSA (din plan sau din setările
   contului) și caută fiecare nume din targetare.
2. Panoul **„Ce a găsit Meta"** arată tot: „București (+30 km) → Bucharest,
   Romania", „Real estate → Real estate (Interests › Business and industry)".
   Asta intră în targetare, nu textul din plan. Un nume negăsit = eroare.
3. **Creează pe pauză** se deblochează doar pe o verificare fără erori a
   EXACT planului de pe ecran. O corectură după verificare o face veche.
4. Pe server, crearea reface verificarea și compară amprenta (SHA-256 din
   planul cu cheile rezolvate + cont + DSA). Diferită → „verifică din nou".
   Același plan creat în ultimele 30 de minute → cere confirmare explicită
   („Creează încă una, intenționat"): a doua campanie = buget dublu.
5. Ordinea creării: coperta (urcată în cont) → campania → setul → pentru
   fiecare reclamă, creativul și reclama. **Toate cu `status: PAUSED`.**
6. La o eroare după campanie, crearea se oprește. Ce apucase să se creeze
   rămâne oprit, se arată cu link și se notează în bază ca `partial`.
   Nimic nu se șterge automat.
7. Rândul din `ads_campaigns` are planul întreg (cu cheile rezolvate), cine
   l-a creat și id-urile obiectelor. `/admin/ads` le listează.

Biblioteca video: pe Meta, cu token, **„Alege din biblioteca contului"**
deschide cele mai noi 60 de video-uri ale contului din plan. Unul încă în
procesare se vede, dar nu se poate alege.

### Maparea pe Marketing API v26.0

Verificată pe documentația Meta și pe SDK-ul oficial v26.0.2 (2026-09-25).
v24.0 se oprește pe 2026-10-06; portalul folosește v26.0.

| Plan | Meta |
|---|---|
| `leads` | `OUTCOME_LEADS` · set `OFFSITE_CONVERSIONS`, `destination_type: WEBSITE`, `promoted_object {pixel_id, custom_event_type: LEAD}` |
| `sales` | `OUTCOME_SALES` · la fel, cu `PURCHASE` |
| `traffic` | `OUTCOME_TRAFFIC` · `LANDING_PAGE_VIEWS` (fără `destination_type`) |
| `video_views` | `OUTCOME_ENGAGEMENT` · `THRUPLAY`, `destination_type: ON_VIDEO` |
| `awareness` | `OUTCOME_AWARENESS` · `REACH`, `promoted_object {page_id}` |
| buget | pe set, în subunități (60 lei → `6000`); campania are `is_adset_budget_sharing_enabled: false` (obligatoriu din v24) |
| public | `geo_locations` (țări, regiuni, orașe cu rază în km), `age_min/max`, `genders`, `locales`, `flexible_spec` (interese, comportamente), `targeting_automation.advantage_audience` trimis mereu (0/1) |
| DSA | `dsa_beneficiary`, `dsa_payor` pe set, când publicul e în UE |
| creativ | `object_story_spec.video_data` (video, `image_hash` al copertei, text, titlu, descriere, buton cu linkul final); Instagram prin `instagram_user_id` |
| îmbunătățiri | `degrees_of_freedom_spec.creative_features_spec`: 39 de funcții Advantage+ + 5 ale „Ad sources", fiecare `OPT_OUT`; `contextual_multi_ads: OPT_OUT` |
| `platform_rotates` | dynamic creative: `is_dynamic_creative` pe set + `asset_feed_spec`; doar Lead-uri și Vânzări |
| reclamă | `adset_id`, `creative_id`, `status: PAUSED`, `conversion_domain` (domeniul destinației) la campaniile cu pixel |

**„Ad sources"** nu are un câmp în API: e sursa (site, pagină, magazin) din
care Meta alimentează linkurile spre site, rezumatele, detaliile care apar
treptat și locațiile. Oprit în plan = fiecare dintre ele refuzată explicit
(`site_extensions`, `show_summary`, `show_destination_blurbs`,
`reveal_details_over_time`, `local_store_extension`).

**Ce nu se poate opri din API:** la `OFFSITE_CONVERSIONS` și
`LANDING_PAGE_VIEWS`, Meta extinde singur interesele (Advantage detailed
targeting). Vârsta, genul și locația rămân limite. Portalul avertizează.

### Neverificat încă — se confirmă la prima campanie reală

1. Linkul spre Ads Manager (`adsmanager.facebook.com/adsmanager/manage/campaigns?act=…&selected_campaign_ids=…`) — format observat, nedocumentat.
2. `/me/adaccounts` pentru un System User — folosit larg, nedocumentat explicit.
3. Forma exactă a răspunsului `/dsa_recommendations` (se citește tolerant, doar pentru mesaj).
4. `placement_soft_opt_out` (v24, Lead-uri/Vânzări): până la 5% din buget poate merge în plasări excluse. Valoarea implicită nu e documentată — de citit pe setul creat, în Ads Manager.
5. Muzica adăugată automat pe video: portalul refuză `music_generation` și `audio`; dacă Meta tot pune muzică, se adaugă `asset_feed_spec.audios` gol.
6. Bugetul minim zilnic în RON/EUR — nedocumentat; o sumă prea mică o refuză Meta la set (campania rămâne goală, oprită).
7. Dynamic creative pe video (`platform_rotates`) — documentat, dar netestat pe un cont real.

**Testul recomandat:** prima campanie reală cu bugetul minim, creată pe
pauză, verificată în Ads Manager (setul, plasările, îmbunătățirile din
creativ), apoi ștearsă de tine din Ads Manager.

---

## Faza 3 — video nou, din browser

### De ce așa

Promptul cere două lucruri care, la Meta, se bat cap în cap: video-ul să
meargă „direct din browser la platformă" și niciun token în browser. Toate
căile documentate de urcare la Meta (chunked, Resumable Upload API,
`rupload.facebook.com`) cer tokenul complet în cererea de urcare; nu există
un token doar pentru urcare (verificat 2026-09-25). Iar prin serverul nostru
nu poate trece (Vercel: 4,5 MB pe cerere).

Drumul ales (varianta A din `GHID.md`): **browser → stocare temporară →
Meta descarcă singur.** Fișierul nu trece prin Vercel, tokenul nu ajunge în
browser, iar browserul primește doar un URL semnat valabil pentru UN fișier.

### Pașii, pe ecran (la „Materialul", cu „Fișier nou")

1. **Alege fișierul** — MP4 sau MOV, cel mult 50 MB (verificat în browser,
   înainte de orice trimitere).
2. **Urcă în contul …** → serverul verifică sesiunea, spațiul și că tokenul
   vede contul, curăță anticamera de urcări uitate (peste 6 ore) și dă un URL
   semnat de urcare (Supabase, valabil 2 ore). Numele din anticameră e
   `spațiu--moment--uuid.mp4`, fără numele fișierului omului.
3. Browserul urcă fișierul cu un singur `PUT`, cu progres real în MB și
   buton „Oprește urcarea".
4. Serverul face un link de descărcare semnat (3 ore) și cere Meta
   `POST /act_…/advideos` cu `file_url` și `name` (numele fișierului, ca să-l
   recunoști în bibliotecă). Meta răspunde cu id-ul video-ului.
5. Browserul întreabă starea la 3 secunde: „Meta copiază fișierul" (cu
   procent, când Meta îl dă) → „Meta procesează" → gata. Documentația nu
   spune dacă Meta descarcă înainte sau după ce răspunde, deci **fișierul din
   anticameră se șterge abia când starea e `ready` sau eroare**.
6. Gata → planul trece singur pe `{ "source": "library", "video_id": "…" }`, cu
   nota „Urcat acum: …". De aici drumul e cel din faza 2: „Verifică în Meta",
   „Creează pe pauză".

Închiderea paginii în mijlocul urcării cere confirmare. Un video pe care
Meta îl termină după ce ai plecat rămâne în biblioteca contului: îl alegi din
„Alege din biblioteca contului".

### Limite

| | |
|---|---|
| Supabase Free | 50 MB pe fișier (limita globală a proiectului; bucket-ul nu o poate depăși) |
| Supabase Pro | până la 500 GB; se ridică în migrarea 7 (`file_size_limit`) și în `VIDEO_UPLOAD_MAX_BYTES`. Peste ~6 MB Supabase recomandă urcarea resumabilă (TUS); portalul face un singur `PUT` — suficient pentru 50 MB, de trecut pe TUS dacă ridici limita mult. |
| Meta | video de reclamă până la 4 GB; MP4/MOV, H.264, sunet AAC stereo, fără liste de editare |
| Vercel | cererile noastre rămân mici (câțiva KB); `maxDuration = 60` pe `/admin/ads/nou` |

Un video de 60 de secunde, 1080p, la ~10 Mbps are ~75 MB — **peste limita
de pe Free.** Exportă reclamele la 4–6 Mbps (tot 1080p) sau urcă-le din
Ads Manager și alege-le din bibliotecă.

### Neverificat încă — se confirmă la primul video real

1. Dacă Meta descarcă `file_url` în timpul cererii sau după (portalul
   funcționează în ambele cazuri).
2. Dacă Meta acceptă un link Supabase semnat (fără antet de autentificare;
   robots.txt-ul Supabase nu blochează crawlerul Meta — verificat pe host).
3. Valorile exacte ale `processing_phase.status`; eroarea e citită și din
   `errors[]`, și din `error`, pentru că documentația și SDK-ul diferă.

---

## Faza 4 — cifrele: sincronizare zilnică și statistici

### Sincronizarea

- **Cine o pornește:** cron-ul zilnic (`GET /admin/ads/sincronizare`, cu
  `Authorization: Bearer <CRON_SECRET>` — 401 altfel) și butonul
  **„Sincronizează acum”** din Statistici (doar spațiul curent, cel mult o dată
  la 2 minute).
- **O cerere Insights pe cont de reclame**, nu una pe campanie:
  `GET /act_…/insights?level=campaign&time_increment=1&filtering=[campaign.id IN …]`,
  cu `use_unified_attribution_setting=true` (ca în Ads Manager).
- **Intervalul:** ultimele 7 zile la fiecare rulare, plus golul de la ultima
  rulare reușită (dacă cron-ul a lipsit câteva zile). Prima rulare aduce tot, de
  la crearea celei mai vechi campanii (Meta păstrează 37 de luni).
- **De ce 7 zile:** Meta își mai corectează cifrele „o pereche de zile” după
  (niciodată după 28), iar conversiile de pe site se raportează în ziua în care
  se întâmplă, nu în ziua clicului.
- **Istoricul:** o zi mai veche de 7 zile se scrie o singură dată (rândurile
  lipsă se adaugă, cele existente rămân). Baza refuză oricum actualizarea lor
  (trigger în migrarea 6).
- **Statusul:** `effective_status` al fiecărei campanii se citește la fiecare
  sincronizare — după ce o pornești din Ads Manager, portalul arată „Pornită”;
  după ce o ștergi, „Ștearsă”. Doar afișare: portalul tot nu trimite alt status
  decât pauza.
- **Jurnalul:** fiecare rulare e un rând în `ads_runs` (`ok` / `partial` /
  `failed`, câte campanii, mesajele de eroare în română). Răspunsul rutei de cron
  are doar starea și numere — niciun id de cont.

### Ce numără fiecare cifră

| Cifra | De unde |
|---|---|
| Cheltuială | `spend` (în unitățile monedei contului) |
| Afișări | `impressions` |
| Clicuri pe link | `inline_link_clicks` — ce folosește Ads Manager pentru CTR și CPC „link” |
| CTR / CPC / CPM | calculate din SUME (niciodată media rapoartelor zilnice) |
| Rezultate | după obiectivul campaniei: Lead-uri → `offsite_conversion.fb_pixel_lead`; Vânzări → `…fb_pixel_purchase`; Contact → `contact_website`; Programare → `schedule_website`; Trafic → `landing_page_view`; Video → `video_thruplay_watched_actions`; Notorietate → `reach` |

Un singur tip de acțiune pe campanie: `lead` include deja lead-urile din pixel;
adunate, s-ar număra de două ori. Câmpul `results` din Insights (coloana
„Results”) se păstrează în `raw`, pentru comparații.

**Obiective amestecate:** lead-urile nu se adună cu vizitele pe pagină. Când
spațiul are campanii cu obiective diferite, Statisticile arată afișări și
clicuri; rezultatele și costul lor apar după ce alegi un obiectiv din filtru.
La fel monedele: RON și EUR nu se adună — filtrul de monedă.

**Notorietate:** acoperirea e pe zi; însumată pe mai multe zile, un om văzut în
două zile contează de două ori. Eticheta o spune.

### Ecranele

- **`/admin/ads/statistici`** — filtrele pe un rând (perioada 7 / 30 / 90 de
  zile, obiectivul, moneda), indicatorii cu schimbarea față de aceeași durată de
  dinainte (săgeată + procent; verde = mai bine, roșu = mai rău, cheltuiala
  neutră), cheltuiala și rezultatele pe zi (două grafice, nu o axă dublă), tabelul
  pe campanii și toate cifrele pe zile, ca tabel.
- **`/admin/ads/[id]`** — o campanie: ultimele 7 zile comparate cu cele 7 de
  dinainte, totalul de la creare, graficele pe zile (cel mult 120), tabelul
  complet, materialul și reclamele exact cum au fost trimise, planul JSON salvat.
- **`/admin/ads`** — fiecare campanie cu cheltuiala și rezultatele de la creare
  și statusul citit din Meta; rândul duce la fișă.

Graficele urmează skill-ul `dataviz`: o singură serie, coloane de cel mult 24
px, grilă subțire, culoarea `#3987e5` validată cu `validate_palette.js` pe
suprafața panoului; hover și săgețile stânga/dreapta dau aceeași fișă a zilei.

### Cron-ul — ce lipsește ca să ruleze singur

Ruta stă în zona portalului, deci n-a fost nevoie de `app/api/cron`. Programarea
însă stă în `vercel.json`, în afara zonei — **n-am atins-o**. La merge, o linie:

```json
{ "path": "/admin/ads/sincronizare", "schedule": "30 3 * * *" }
```

(03:30 UTC = 06:30 vara, 05:30 iarna; Vercel Hobby rulează cron-urile o dată pe
zi, cu o toleranță de până la 59 de minute, doar pe producție.) `CRON_SECRET`
există deja în proiect (sonda Supabase). Până atunci, cifrele vin din
„Sincronizează acum”.

### Neverificat încă — la primele cifre reale

1. Forma exactă a elementelor din `results` (nedocumentată strict; stă doar în `raw`).
2. Șirul de filtru `campaign.id` (documentat e operatorul `IN` și notația cu punct).
3. Că zilele fără livrare lipsesc din răspuns (portalul le tratează oricum ca zero).
4. Numerele de lead-uri față de Ads Manager: de comparat pe o campanie reală, pe aceeași perioadă.

### Hidratarea (eroarea React #418) — rezolvată

Paginile mari (liste, tabele) primesc datele RSC în mai multe bucăți, ca
scripturi puse DUPĂ scriptul care pornește hidratarea. Când acel script vine
din cache, rulează înainte ca browserul să citească bucățile de după el. React
ajunge la o bucată lipsă, se oprește, iar la reluare (React 19.2 canary, inclus
în Next 15.5 — și în 15.5.26) „revendică” a doua oară elementul HTML la care se
oprise: găsește `<li>` unde aștepta `<ol>`, `<caption>` unde aștepta
`<table>`, și reconstruiește toată pagina în browser. Asta era și #418-ul rar
din fazele 1–2; în faza 4, cu pagini mai mari, ajunsese la ~1 din 4 încărcări
pe fișa campaniei.

**Remediul:** `components/ads/hydrate-when-parsed.tsx`, în jurul layout-ului
portalului. Dacă documentul încă se citește când începe hidratarea, componenta
așteaptă `DOMContentLoaded` (atunci toate bucățile au sosit); fiind o
componentă-funcție, reluarea ei nu revendică nimic din DOM. Pe server și la
navigarea între pagini nu așteaptă nimic. Măsurat pe build de producție: 0
erori în 128 de încărcări (față de 11 din 40 înainte) și 0 în 45 în dev.

Încercări respinse, cu măsurători: granițe `<Suspense>` (au mutat problema pe
`<main>` și, în layout, au stricat scripturile de streaming `$RS`) și
componente transparente între elementele HTML și rândurile lor (au scăzut doar
rata). Detalii în `GHID.md`, anexa fazei 4.

## Faza 5 — TikTok

Aceeași interfață ca pe Meta, alt adaptor. Acțiunile portalului și
sincronizarea aleg platforma după spațiul de lucru (`platform.ts`) și nu mai
știu nimic despre Meta sau TikTok. Regula pauzei stă în fiecare adaptor, la
singura lui cale de scriere: `tiktokCreate` → `assertTikTokDisabled` →
`POST`.

### Drumul, pe ecran

1. Treci în spațiul TikTok din selector. „Încarcă exemplul” dă un plan
   TikTok, deja pe spațiul curent.
2. **Verifică în TikTok.** Serverul citește, cu tokenul spațiului:
   - **contul** (`/advertiser/info/`): tokenul trebuie să-l vadă, iar moneda
     trebuie să fie cea din plan;
   - **identitatea** (`/identity/get/`): contul TikTok de pe reclamă,
     disponibil și cu dreptul de a primi video urcat de agenție (`can_push_video`);
   - **pixelul** (`/pixel/list/`), după id sau după cod, și dacă a primit deja
     evenimentul pe care optimizează campania;
   - **video-ul** (`/file/video/ad/info/`), convertit complet;
   - **locațiile** (`/tool/region/`), **limbile** și **interesele**: numele din
     plan → id-uri TikTok, cu refuz pentru locațiile care se suprapun;
   - un **avertisment DSA** pe publicul din UE (mai jos).
3. **Creează pe pauză:** coperta (propusă de TikTok sau cea din plan, urcată
   în biblioteca contului) → campania → grupul de reclame → reclamele, toate
   într-o singură cerere. Toate cu `operation_status: DISABLE`.
4. Rezultatul: linkul spre campanie în TikTok Ads Manager. De acolo o verifici
   și o pornești tu.

**Video nou** — ca pe Meta: browser → stocarea temporară → TikTok îl descarcă
de la un link semnat (`UPLOAD_BY_URL`) → portalul așteaptă conversia → planul
trece singur pe video-ul din bibliotecă.

**Cifrele** — aceeași sincronizare (cron + buton), aceleași ecrane.

### Maparea pe TikTok API for Business v1.3

Verificată pe documentația v1.3 (2026-09-25).

| Plan | TikTok |
|---|---|
| `leads` | `WEB_CONVERSIONS` · grup `promotion_type: WEBSITE`, `CONVERT` / `OCPM`, `pixel_id`, `optimization_event: FORM` |
| `sales` | la fel, cu `SHOPPING`; campania are `virtual_objective_type: SALES`, `sales_destination: WEBSITE` (apare ca Vânzări în Ads Manager) |
| `traffic` | `TRAFFIC` · `CLICK` / `CPC` (decizia 3.14) |
| `video_views` | `VIDEO_VIEWS` · `ENGAGED_VIEW` / `CPV` — vizionări de cel puțin 6 secunde (`VIDEO_VIEW` nu mai există) |
| `awareness` | `REACH` · `REACH` / `CPM` |
| evenimente | `lead` → `FORM`, `contact` → `CONSULT`, `complete_registration` → `ON_WEB_REGISTER`, `purchase` → `SHOPPING`, `view_content` → `ON_WEB_DETAIL`; `schedule` nu are echivalent (planul se respinge) |
| buget | campania `BUDGET_MODE_INFINITE`; grupul `BUDGET_MODE_DAY`, minim 20 (RON, EUR, USD), `BID_TYPE_NO_BID` (livrare maximă), `PACING_MODE_SMOOTH` |
| program | `SCHEDULE_FROM_NOW`, startul = momentul creării, în UTC |
| plasări | `PLACEMENT_TYPE_NORMAL` + `PLACEMENT_TIKTOK` (implicit) sau `PLACEMENT_TYPE_AUTOMATIC` |
| public | `location_ids`, `age_groups` (grupe întregi, de la 18 — cerința UE), `gender`, `languages`, `interest_category_ids` |
| reclamă | `SINGLE_VIDEO`, `video_id`, o copertă în `image_ids`, `ad_text` (≤100, fără emoji), `call_to_action` (`download` → `DOWNLOAD_NOW`), linkul final cu UTM, `tracking_pixel_id` = pixelul grupului |
| identitate | Spark Ads: `TT_USER`, sau `BC_AUTH_TT` + `identity_authorized_bc_id`; `dark_post_status: ON` — postarea există doar ca reclamă, nu apare pe profil |

**Automatizările, trimise explicit oprite** — unele pornesc singure dacă nu le
trimiți:

| Ce | Câmp | Trimis |
|---|---|---|
| Îmbunătățiri automate (calitate video, muzică) | reclamă · `creative_auto_enhancement_strategy_list` | `[]` (`VIDEO_QUALITY` / `MUSIC_REFRESH` doar dacă planul le pornește) |
| Afișare și în căutare | grup · `search_result_enabled` | `false` — altfel TikTok o pornește singur la Trafic și Conversii |
| Public lărgit automat | grup · `smart_audience_enabled`, `smart_interest_behavior_enabled` | `false` |
| Material generat automat | grup · `creative_material_mode` | `CUSTOM` |
| Optimizare pe un al doilea eveniment | grup · `deep_funnel_optimization_status` | `OFF` |
| Destinație înlocuită automat | reclamă · `dynamic_destination` | `UNSET` |
| Seturi de evenimente offline legate automat | reclamă · `tracking_offline_event_set_ids` | `[]` |
| Muzică promoțională, duet, stitch | reclamă · `promotional_music_disabled` | `true` |
| Reclama arătată în Creative Center | reclamă · `creative_authorized` | `false` |

„Auto-add assets” și „Translate and dub” există doar în campaniile Smart+.
Portalul face campanii manuale (`/campaign/create/` nu face Smart+), deci ele
sunt oprite prin construcție; un plan care le pornește se respinge.

**Ce refuză portalul înainte să ajungă la TikTok:** identitatea
personalizată (`CUSTOMIZED_USER` — TikTok n-o mai acceptă pe plasarea TikTok,
nici la conturile vechi), `BC_AUTH_TT` fără `identity_bc_id`, bugetul sub 20,
comportamentele (TikTok le targetează altfel), regiunile și orașele pe care
TikTok nu le are, locațiile suprapuse, o identitate fără drept de „push”.

**DSA pe TikTok:** API-ul v1.3 nu are câmp pentru plătitor sau beneficiar.
TikTok cere informațiile despre plătitor (*Payer information*) pe reclamele
din UE și nu publică reclama fără ele — se completează **o dată pe cont, în
TikTok Ads Manager**. Portalul avertizează la fiecare verificare cu public în UE.

**Id-urile de 19 cifre:** TikTok are id-uri mai lungi decât ține exact un număr
JavaScript. La trimitere, `tracking_pixel_id` (număr, în documentație) pleacă
cu toate cifrele; la citire, un număr prea mare rămâne text (Node 22+).

### Cifrele pe TikTok

- Raportul `/report/integrated/get/` (`BASIC`, `AUCTION_CAMPAIGN`, pe campanie
  și zi): o cerere pe cont și pe fereastră de cel mult 30 de zile (limita
  TikTok cu dimensiunea „zi”), cel mult 100 de campanii pe cerere.
- **Rezultate:** `conversion` (evenimentul pixelului pe care optimizează
  grupul) la Lead-uri și Vânzări, `clicks` la Trafic, `engaged_view` (6 s) la
  video, `reach` la Notorietate. Rândul brut, cu `result` (coloana „Results”
  din Ads Manager), rămâne în `raw`. Etichetele de pe ecran spun „Clicuri” și
  „Vizionări de 6 s” acolo unde TikTok numără altceva decât Meta.
- **Statusul:** `secondary_status` din `/campaign/get/` (spune și de ce nu
  livrează: buget epuizat, respinsă), altfel `operation_status`. Campaniile
  șterse se caută separat — lista implicită nu le întoarce.
- TikTok corectează cifrele a doua zi (reparația zilnică rulează la 12:00
  UTC); fereastra de 7 zile a portalului le prinde.

### Limite

| | |
|---|---|
| Video prin link (`UPLOAD_BY_URL`) | documentația spune „mai bine sub 10 MB”, iar cererea are 10 secunde la TikTok. Un fișier de 50 MB poate pica; atunci îl urci din TikTok Ads Manager și îl alegi din bibliotecă. Exportă reclamele la 4–6 Mbps. |
| Rate limit | 10 cereri/s, 600/min pe aplicație; după o limită pe minut, 5 minute pauză — mesajul o spune |
| Text | 100 de caractere, fără emoji; fără titlu și descriere |

### Neverificat încă — se confirmă la prima campanie reală

1. Linkul spre o campanie anume (`ads.tiktok.com/i18n/perf/campaign?aadvid=…&keyword=…`) — nedocumentat; sigur e doar lista de campanii a contului.
2. Dacă România are regiuni și orașe în `/tool/region/` (anexa documentației nu le listează; portalul spune clar dacă nu le găsește).
3. Numele exacte ale categoriilor de interes și câmpurile din `/tool/interest_category/` (citite tolerant).
4. Filtrul `secondary_status: CAMPAIGN_STATUS_DELETE` la `/campaign/get/` (dacă TikTok îl refuză, statusul rămâne cel vechi, fără eroare).
5. Dacă TikTok descarcă un video mare în timpul cererii `UPLOAD_BY_URL` (vezi „Limite”).
6. Conturile încă în verificare la TikTok (`STATUS_PENDING_*`): portalul lasă crearea, campania fiind oprită oricum.
7. Dacă API-ul refuză crearea reclamei când lipsesc informațiile despre plătitor.
8. Valorile implicite pentru comentarii și descărcarea video-ului (portalul nu le atinge).

**Testul recomandat:** ca pe Meta — prima campanie reală cu 20 lei pe zi,
creată oprită, verificată în TikTok Ads Manager (grupul, plasările, identitatea,
îmbunătățirile din reclamă), apoi ștearsă de tine.

---

## Variabile de mediu

Toate doar pe server; niciuna cu prefix `NEXT_PUBLIC_`.

| Variabilă | Faza | Ce |
|---|---|---|
| `META_TOKEN_MERIDIAN` | 2 | System User token, portofoliul Meridian |
| `META_TOKEN_CLIENTI` | 2 | System User token, portofoliul clienților |
| `TIKTOK_TOKEN_MERIDIAN` | 5 | token pe termen lung, Business Center Meridian |
| `TIKTOK_TOKEN_CLIENTI` | 5 | token pe termen lung, Business Center clienți |
| `CRON_SECRET` | 4 | există deja (sonda Supabase); îl folosește și cron-ul de cifre |
| `META_GRAPH_URL` | test | DOAR pe calculatorul de dezvoltare: un Meta fals local. Ignorată dacă nu e `http://localhost` / `http://127.0.0.1` — **nu se pune în Vercel**. |
| `TIKTOK_API_URL` | test | La fel, pentru un TikTok fals local. **Nu se pune în Vercel.** |

`app_id` și `secret` ale aplicației TikTok **nu** intră în Vercel: se folosesc o
singură dată, la schimbarea codului pe token (mai jos).

Portalul funcționează fără ele: un spațiu fără token se poate folosi pentru
verificarea planurilor, iar selectorul arată „fără token".

---

## Cum generezi tokenurile

### Meta — System User token (nu expiră)

Tokenurile de utilizator mor în 60 de zile; cel de System User poate fi setat
să nu expire. **Pașii se fac o dată pentru FIECARE portofoliu** — Meta cere ca
System User-ul și aplicația să aparțină aceluiași portofoliu, deci fiecare
portofoliu are aplicația lui și tokenul lui. Asta e și izolarea pe care o vrem.

1. **Aplicația.** În [developers.facebook.com](https://developers.facebook.com/apps)
   → *Create app* → tip *Business*, iar ca portofoliu alegi portofoliul în
   care lucrezi (Meridian, apoi separat Clienți). Adaugă produsul
   *Marketing API*. Meta instalează pe un System User doar aplicațiile cu
   acces *Ads Management Standard Access* sau mai mult — verifică în
   *App Review → Permissions and Features* că `ads_management` are cel puțin
   acces standard.
2. **System User-ul.** [business.facebook.com](https://business.facebook.com) →
   portofoliul → *Settings* → *Users* → *System users* → *Add*. Nume:
   `meridian-portal`. Rol: *Admin* doar dacă trebuie să gestioneze alți
   utilizatori; altfel *Employee* ajunge.
3. **Accesul la active.** Pe System User → *Assign assets*:
   - **Ad accounts** — conturile în care portalul creează campanii, cu
     *Manage campaigns* (sau *Full control*).
   - **Pages** — paginile în numele cărora apar reclamele.
   - **Datasets / Pixels** — pixelul pe care optimizează campaniile.
   - **Instagram accounts** — dacă folosești `instagram_account_id`.
4. **Tokenul.** Pe System User → *Generate new token* → alegi aplicația de la
   pasul 1 → **Token expiration: Never** → permisiuni:
   `ads_management`, `ads_read`, `pages_show_list`,
   `pages_read_engagement`, `pages_manage_ads`. Obligatorii pentru creare
   sunt `ads_management` (care le cere pe cele două `pages_*` de citire);
   `ads_read` e pentru cifre (faza 4); `pages_manage_ads` e plasa de
   siguranță pentru reclamele în numele paginii. `business_management` nu
   trebuie. Copiază tokenul **o singură dată** — Meta nu ți-l mai arată.
   - Meta recomandă de la o vreme tokenuri de System User cu expirare la 60
     de zile, iar unele portofolii le impun. Dacă „Never" nu apare, alege 60
     de zile: când expiră, portalul spune „tokenul nu mai e valid" și
     generezi altul.
   - În setările aplicației, lasă **„Require App Secret" oprit**. Pornit,
     Meta cere pe fiecare apel o semnătură cu secretul aplicației, pe care
     portalul nu o trimite.
5. **Vercel** → proiectul → *Settings → Environment Variables* →
   `META_TOKEN_MERIDIAN` (respectiv `META_TOKEN_CLIENTI`), pe *Production*
   (și *Preview* doar dacă vrei să creezi campanii din preview-uri), apoi
   redeploy.

Tokenul nu se pune nicăieri altundeva: nu în `.env.example`, nu în chat, nu
într-un commit. Dacă ajunge din greșeală undeva public: System User →
*Revoke tokens*, apoi generezi altul.

### TikTok — token pe termen lung (echivalentul)

TikTok nu are System User. Echivalentul e tokenul pe termen lung dat de
autorizarea unei aplicații TikTok for Business: **nu expiră**, devine invalid
doar dacă autorizarea e retrasă. Câte unul pe Business Center:
`TIKTOK_TOKEN_MERIDIAN` și `TIKTOK_TOKEN_CLIENTI`. Tokenul poartă doar
permisiunile bifate la autorizare, nu pe toate cele cerute de aplicație.

1. **Aplicația.** [business-api.tiktok.com](https://business-api.tiktok.com/portal)
   → *My Apps* → *Create an app*. *Advertiser redirect URL*:
   `https://www.meridianx.ro/` — TikTok te trimite acolo cu codul, pagina nu
   trebuie să facă nimic. Permisiunile (scopes) de cerut:

   | Permisiune (id) | Pentru |
   |---|---|
   | Read Ad Account Information (100) | contul, moneda, starea |
   | Read / Create Campaigns (200, 201) | crearea pe pauză, statusul |
   | Read / Create Ad Groups (210, 211) | grupul de reclame |
   | Read / Create Ads (220, 221) | reclamele |
   | Consolidated Report (44) | cifrele |
   | Create Images (601) | coperta |
   | Read Video Library (610) · Create Videos (611) · Video Thumbnails (612) | biblioteca, video nou, coperta propusă |
   | Query Identity (693) | identitatea Spark |
   | Read Pixels (800) | pixelul |

   Plus ce oferă aplicația pentru căutările de targetare (regiuni, limbi,
   interese) — documentația nu spune ce permisiune le acoperă; dacă
   verificarea spune „nu are voie” la locații, adaugă-o. **Nu cere**
   permisiuni de actualizare sau ștergere: portalul nu le folosește.
   Aplicația intră în verificare la TikTok (2–3 zile lucrătoare).
2. **Autorizarea.** După aprobare, deschizi *Advertiser authorization URL* al
   aplicației, logat cu contul TikTok for Business care e admin în Business
   Center, și **bifezi toate conturile de reclame** pe care le va folosi
   portalul. Un cont nebifat = „tokenul nu vede contul”.
3. **Codul.** TikTok te trimite la redirect URL cu `auth_code=…` în adresă.
   E valabil **o oră** și merge **o singură dată**.
4. **Tokenul.** Schimbi codul pe token, din terminal:
   ```bash
   curl -X POST https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/ \
     -H "Content-Type: application/json" \
     -d '{"app_id": "…", "secret": "…", "auth_code": "…"}'
   ```
   Răspunsul: `data.access_token` (tokenul), `data.advertiser_ids` (conturile
   autorizate) și `data.scope` (permisiunile primite — verifică să fie toate
   din tabel).
5. **Vercel** → `TIKTOK_TOKEN_MERIDIAN` (respectiv `TIKTOK_TOKEN_CLIENTI`), pe
   *Production* (și *Preview*, ca să testezi pe ramură), apoi redeploy.
   `app_id` și `secret` **nu** trebuie în Vercel: portalul lucrează doar cu
   tokenul.
6. Pașii 2–5 se repetă pentru celălalt Business Center.

**Pe fiecare cont de reclame, o singură dată, în TikTok Ads Manager:**

- **Payer information** — plătitorul, pentru reclamele din UE. Fără ea,
  TikTok nu publică reclama când o pornești.
- **Identitatea Spark** — contul TikTok în numele căruia apar reclamele,
  legat de contul de reclame (`TT_USER`) sau autorizat în Business Center
  (`BC_AUTH_TT`), cu dreptul de a primi video urcat de agenție. Verificarea
  portalului arată identitățile pe care le vede contul.
- **Pixelul** site-ului (`DAN9FTJC77U07P78RH10`) legat de contul de reclame,
  pentru campaniile de Lead-uri.

Dacă tokenul ajunge undeva public: retragi autorizarea aplicației (în
Business Center sau cu `POST /oauth2/revoke_token/`), apoi refaci pașii 2–5.

---

## Decizii luate în faza 1 (de confirmat de om)

1. **Lista de conturi de reclame vine din token, nu din fișier** — cererea
   „lista de ad accounts în `workspaces.ts`" intra în conflict cu „niciun id de
   cont în cod" într-un repo public.
2. **Plafoanele de buget** din tabel sunt alese de asistent, ca plasă de
   siguranță. Se schimbă în `workspaces.ts`.
3. **Chei în engleză, mesaje în română.** Cheile se potrivesc cu conceptele din
   API-uri (le generează mai sigur o altă conversație); tot ce citește omul e
   în română.
4. **O reclamă pe text** implicit (`one_ad_per_text`): rezultatele se văd pe
   fiecare text. Pe TikTok e singurul mod — alternarea automată ține de
   optimizările creative, oprite.
5. **Destinație: doar `website`** deocamdată. Formular instant Meta sau
   WhatsApp se pot adăuga ca variante noi ale lui `destination`.
6. **Planul supraviețuiește unui refresh** în același tab (`sessionStorage`,
   nu `localStorage`: conține id-uri de cont).
7. Portalul stă la `app/(admin)/admin/ads/`, **în afara grupului `(dash)`**,
   cu layout propriu (aceeași gardă `getAdminUser()`), ca selectorul de spațiu
   să fie în capul paginii.

## Decizii luate în faza 2 (de confirmat de om)

1. **Migrarea 5 scrisă întâi**, exact cum o descrie `PLAN.md` (propunerea
   3.1 din `GHID.md`), pe `main`; migrarea portalului e a 6-a și depinde de ea.
2. **Verificare, apoi creare** — două butoane, nu unul. Crearea refuză o
   verificare veche și o amprentă diferită.
3. **Dublura**: același plan verificat, creat în ultimele 30 de minute,
   cere confirmare explicită.
4. **DSA**: plan → setările contului → eroare. Portalul nu completează
   singur un câmp legal (arată doar sugestiile Meta).
5. **Coperta propusă de Meta se urcă în cont** (`/adimages`), fiindcă Meta
   cere să nu primească linkuri spre CDN-ul lui. O copertă din plan
   (`{ "url" }`) o descarcă Meta singur.
6. **Eroare la jumătate**: nimic nu se șterge automat; totul rămâne oprit,
   cu link, notat `partial`.
7. **Istoricul de cifre**: migrarea 6 îngheață în bază zilele mai vechi de 7
   (propunerea 3.7) — un `update` pe ele e refuzat de un trigger.

## Decizii luate în faza 4 (de confirmat de om)

1. **Ruta de cron în zona portalului** (`/admin/ads/sincronizare`), nu în
   `app/api/cron`: aceeași protecție (`CRON_SECRET`), fără fișiere din afara
   zonei. Doar linia din `vercel.json` rămâne de adăugat, cu voia ta.
2. **Fereastra de 7 zile rămâne** (decizia 3.7): documentația Meta spune că
   cifrele se stabilizează în câteva zile, iar conversiile de pe site se
   raportează în ziua conversiei.
3. **„Sincronizează acum”** sincronizează doar spațiul curent, cel mult o dată
   la 2 minute.
4. **Obiectivele și monedele nu se amestecă** în indicatori (vezi „Faza 4”).
5. **Statusul citit din Meta se afișează** („Pornită”, „Ștearsă”); portalul tot
   nu scrie niciodată alt status decât pauza.


## Decizii luate în faza 3 (de confirmat de om)

1. **Stocarea temporară = Supabase Storage** (bucket privat, migrarea 7), nu
   Vercel Blob: fără dependență nouă, fără cont nou, fără modificare în CSP
   (originea Supabase e deja în `connect-src`). Prețul: 50 MB pe fișier cât
   timp proiectul e pe Free.
2. **Fișierul temporar se șterge când Meta termină** (gata sau eroare), nu
   imediat după cerere; uitat, după 6 ore.
3. **Planul trece singur pe video-ul din bibliotecă** când Meta spune „gata".

## Decizii luate în faza 5 (de confirmat de om)

1. **Doar Spark Ads** (`TT_USER` / `BC_AUTH_TT`): TikTok nu mai acceptă
   identitatea personalizată pe plasarea TikTok. Fiecare client pe TikTok are
   nevoie de un cont TikTok legat sau autorizat.
2. **Trafic = clicuri** pe TikTok (decizia 3.14 din `GHID.md`).
3. **Lead-uri = conversii web** (`WEB_CONVERSIONS` + `FORM`), nu obiectivul
   TikTok „Lead generation”: același eveniment pe care îl trimite site-ul,
   comparabil cu Meta.
4. **Contul se verifică direct** (`/advertiser/info/`), nu din lista
   tokenului: lista ar cere secretul aplicației, pe care portalul nu-l ține.
5. **Coperta propusă de TikTok se urcă în cont** (linkul ei expiră într-o oră).
6. **DSA pe TikTok = avertisment**, nu eroare: nu există câmp în API; se
   setează o dată pe cont.
7. **Comportamentele se resping pe TikTok** în loc să fie sărite în tăcere.
8. **„Încarcă exemplul” dă planul platformei și spațiului curent.**
9. **Structura comună** (`platform.ts`): `types.ts` și `links.ts` au ieșit
   din `meta/`; acțiunile și sincronizarea aleg adaptorul după spațiu.

## De rezolvat — în afara zonei portalului

- **Migrările 5, 6 și 7 se aplică de om**, în SQL editor, în ordine. Imediat
  după migrarea 5: `insert into public.admin_emails (email) values (…)` cu
  aceleași adrese ca în `ADMIN_EMAILS` — altfel panoul de lead-uri arată zero
  lead-uri (nu se pierde nimic, doar lista e goală).
- **CSP (`next.config.ts`):** miniaturile din biblioteca video și din
  verificare vin de pe CDN-ul Meta (`*.fbcdn.net`) și de pe cel TikTok
  (domeniile apar în raportul CSP la primele miniaturi reale) — azi CSP-ul doar
  raportează, deci se văd, dar trebuie adăugate în `img-src` înainte ca
  CSP-ul să devină activ. Urcarea din faza 3 NU cere nimic în plus: merge
  spre Supabase, deja în `connect-src`.
- **Legătura din panoul de lead-uri spre reclame:** capul din `(dash)/layout.tsx`
  nu are link spre `/admin/ads` (portalul are link înapoi spre lead-uri).
