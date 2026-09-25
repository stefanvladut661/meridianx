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

**Portalul creează campanii DOAR în stare PAUSED.** Nu există cod, rută sau
buton care să pornească o campanie. Activarea o face omul, în Ads Manager.
Dacă o funcție ar putea trimite `ACTIVE`, designul e greșit.

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
| 4 | Dashboard + cron pentru Meta | ⬜ |
| 5 | TikTok, peste structura existentă | ⬜ |

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
| `meta/graph.ts` | `server-only`: SINGURUL client Graph API. GET-uri + o singură cale de scriere (`metaPost` → `metaCreate`, `metaUploadImage`), cu `assertPaused` înainte de rețea. Fără update, fără delete. |
| `meta/paused.ts` | Garda: orice câmp de status, la orice adâncime, trebuie să fie `PAUSED`; muchiile de scriere sunt o listă închisă. |
| `meta/build.ts` | Planul → corpurile de cerere v26 (campanie, set, creativ, reclamă). Funcții pure. |
| `meta/lookup.ts` | Citiri: conturile tokenului, pagină, Instagram, pixel, video, biblioteca video, DSA-ul contului. |
| `meta/targeting.ts` | Numele din plan → cheile Meta (orașe, regiuni, limbi, interese, comportamente). |
| `meta/check.ts` | „Verifică în Meta": tot ce trebuie să existe înainte de creare + amprenta planului. |
| `meta/create.ts` | Crearea: copertă → campanie → set → (creativ → reclamă) × N, toate pe pauză. |
| `meta/thumbnail.ts` | Coperta propusă de Meta, descărcată ca s-o urcăm în cont (Meta nu vrea linkuri spre CDN-ul lui). |
| `meta/errors.ts` | Erorile Meta spuse în română, cu mesajul lor original și `fbtrace_id`. |
| `meta/links.ts` | Linkurile spre Ads Manager. |
| `meta/types.ts` | Ce ajunge în browser din verificare și creare. |
| `meta/video.ts` | `server-only`: video nou — Meta îl descarcă de la un link semnat (`file_url`); starea procesării. |
| `staging.ts` | `server-only`: anticamera video-urilor (bucket-ul privat `ads-uploads`, migrarea 7): URL semnat de urcare, link de descărcare pentru Meta, ștergere, curățenie la 6 ore. |
| `meta/verify-paused.mjs` | `node lib/ads/meta/verify-paused.mjs` — verificarea regulii „doar pe pauză" (23 de verificări, fără rețea). |

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
| `audience.interests[]` / `behaviors[]` | nu | `{ "name": "…", "id"?: "…" }` — fără id, se caută după nume la creare |
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
| `tiktok.identity_type` · `identity_id` | da pe TikTok | `CUSTOMIZED_USER`, `TT_USER`, `BC_AUTH_TT` |
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

Pe TikTok, în loc de `meta`:

```jsonc
"tiktok": {
  "identity_type": "CUSTOMIZED_USER",   // sau TT_USER, BC_AUTH_TT
  "identity_id": "…",
  "placements": "tiktok_only",           // sau automatic
  "enhancements": {
    "automatic_enhancements": false,
    "auto_add_assets": false,
    "translate_and_dub": false,
    "music_refresh": false
  }
}
```

### Ce verifică portalul

- **Erori (blochează crearea):** câmpuri lipsă sau de alt tip, valori care nu
  există (cu „ai vrut …?"), câmpuri necunoscute, plan pentru alt spațiu decât
  cel afișat, secțiunea platformei lipsă, formatul contului, pixel lipsă la
  `leads`/`sales`, eveniment fără echivalent pe platformă (Programare pe
  TikTok), buget peste plafonul spațiului, monedă fără plafon, vârstă inversată,
  texte TikTok peste 100 de caractere, `platform_rotates` pe TikTok. Pe Meta,
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

## Variabile de mediu

Toate doar pe server; niciuna cu prefix `NEXT_PUBLIC_`.

| Variabilă | Faza | Ce |
|---|---|---|
| `META_TOKEN_MERIDIAN` | 2 | System User token, portofoliul Meridian |
| `META_TOKEN_CLIENTI` | 2 | System User token, portofoliul clienților |
| `TIKTOK_TOKEN_MERIDIAN` | 5 | token pe termen lung, Business Center Meridian |
| `TIKTOK_TOKEN_CLIENTI` | 5 | token pe termen lung, Business Center clienți |
| `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET` | 5 | aplicația TikTok for Business (lista de conturi autorizate o cere) — de confirmat în faza 5 |
| `CRON_SECRET` | 4 | există deja (sonda Supabase); îl folosește și cron-ul de cifre |
| `META_GRAPH_URL` | test | DOAR pe calculatorul de dezvoltare: un Meta fals local. Ignorată dacă nu e `http://localhost` / `http://127.0.0.1` — **nu se pune în Vercel**. |

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

TikTok nu are System User ca Meta. Echivalentul e tokenul pe termen lung din
autorizarea unei aplicații TikTok for Business: **nu expiră**, dar devine
invalid dacă autorizarea e retrasă. Tot câte unul pe Business Center.

1. [business-api.tiktok.com](https://business-api.tiktok.com) → *My Apps* →
   *Create*. Scopes: gestionare conturi de reclame, reclame, creative,
   rapoarte. *Advertiser redirect URL*: o pagină a ta (poate fi
   `https://www.meridianx.ro/`). Aplicația intră în verificare la TikTok.
2. După aprobare, deschizi linkul de autorizare al aplicației, logat ca admin
   al Business Center-ului, și bifezi conturile de reclame ale acelui BC.
3. TikTok te trimite la redirect URL cu `auth_code` în adresă. Codul e valabil
   **o oră și o singură folosire**.
4. Schimbi codul pe token: `POST /open_api/v1.3/oauth2/access_token/` cu
   `app_id`, `secret`, `auth_code`. Răspunsul conține `access_token`.
5. Vercel: `TIKTOK_TOKEN_MERIDIAN` / `TIKTOK_TOKEN_CLIENTI`, plus
   `TIKTOK_APP_ID` și `TIKTOK_APP_SECRET`.

Detaliile TikTok se confirmă pe documentația curentă în faza 5, înainte de cod.

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

## Decizii luate în faza 3 (de confirmat de om)

1. **Stocarea temporară = Supabase Storage** (bucket privat, migrarea 7), nu
   Vercel Blob: fără dependență nouă, fără cont nou, fără modificare în CSP
   (originea Supabase e deja în `connect-src`). Prețul: 50 MB pe fișier cât
   timp proiectul e pe Free.
2. **Fișierul temporar se șterge când Meta termină** (gata sau eroare), nu
   imediat după cerere; uitat, după 6 ore.
3. **Planul trece singur pe video-ul din bibliotecă** când Meta spune „gata".

## De rezolvat — în afara zonei portalului

- **Migrările 5, 6 și 7 se aplică de om**, în SQL editor, în ordine. Imediat
  după migrarea 5: `insert into public.admin_emails (email) values (…)` cu
  aceleași adrese ca în `ADMIN_EMAILS` — altfel panoul de lead-uri arată zero
  lead-uri (nu se pierde nimic, doar lista e goală).
- **CSP (`next.config.ts`):** miniaturile din biblioteca video și din
  verificare vin de pe CDN-ul Meta (`*.fbcdn.net`) — azi CSP-ul doar
  raportează, deci se văd, dar trebuie adăugate în `img-src` înainte ca
  CSP-ul să devină activ. Urcarea din faza 3 NU cere nimic în plus: merge
  spre Supabase, deja în `connect-src`.
- **Legătura din panoul de lead-uri spre reclame:** capul din `(dash)/layout.tsx`
  nu are link spre `/admin/ads` (portalul are link înapoi spre lead-uri).
