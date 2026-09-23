# Portalul de reclame — `/admin/ads`

Unealtă internă: lipești un plan de campanie în JSON, îl citești în română, îl
corectezi și îl creezi **pe pauză** în Meta sau TikTok. Plus un dashboard cu
cifrele campaniilor.

Ramura: `feat/ads-portal`. Zona portalului: `app/(admin)/admin/ads/**`,
`lib/ads/**`, `components/ads/**` și migrarea lui (din faza 2).

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
| 2 | Meta: creare campanie pe pauză, cu video deja urcat | ⬜ |
| 3 | Meta: încărcare video din browser | ⬜ |
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
  texte TikTok peste 100 de caractere, `platform_rotates` pe TikTok.
- **Avertismente (nu blochează):** o îmbunătățire automată pornită, Advantage+
  audience pornit, categorie specială, evenimentul nu e trimis de site-ul
  nostru, alt pixel decât cel al site-ului, UTM-uri duplicate sau pe care
  site-ul nu le salvează pe lead, macro-uri ale celeilalte platforme, texte
  care se taie pe Meta, lipsa titlului, grupele de vârstă TikTok care lărgesc
  intervalul, rază pe TikTok (ignorată), video nou încă neurcat.

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
   `ads_management`, `ads_read`, `business_management`,
   `pages_show_list`, `pages_read_engagement`. Lista exactă se confirmă la
   primul apel real din faza 2: dacă Meta refuză reclama cu o eroare de
   permisiune pe pagină, se adaugă `pages_manage_ads` și se regenerează
   tokenul. Copiază tokenul **o singură dată** — Meta nu ți-l mai arată.
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

## De rezolvat înainte de faza 2 — în afara zonei portalului

- **`is_lead_admin()` nu există încă.** Migrarea 5 (`admin_emails` +
  `is_lead_admin()`) e planificată în `PLAN.md`, dar n-a fost scrisă. Migrarea
  portalului are nevoie de ea pentru RLS „exact ca la lead-uri". Variante: o
  scriu întâi pe ea (migrarea 5, cum e descrisă în `PLAN.md`), apoi migrarea
  portalului; sau migrarea portalului o creează ea (`create or replace`).
- **CSP (`next.config.ts`) pentru faza 3:** încărcarea video din browser
  direct la Meta are nevoie de originile de upload ale Meta în `connect-src`,
  iar miniaturile video din biblioteca contului de CDN-ul Meta în `img-src`.
  Azi CSP-ul e doar raportat (`CSP_REPORT_ONLY = true`), deci nu blochează,
  dar trebuie adăugate înainte să devină activ.
- **Legătura din panoul de lead-uri spre reclame:** capul din `(dash)/layout.tsx`
  nu are link spre `/admin/ads` (portalul are link înapoi spre lead-uri).
