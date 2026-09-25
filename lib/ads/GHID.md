# Ghid — portalul de reclame, după faza 2

*Actualizat pe 2026-09-25, la finalul fazei 2. Ramura: `feat/ads-portal`.*

Trei documente, în ordinea în care se citesc:

| Fișier | Ce e |
|---|---|
| `lib/ads/GHID.md` | **acesta** — ce ai de făcut acum, ce e de hotărât, ce urmează pe faze, rapoartele fazelor |
| `lib/ads/README.md` | documentația tehnică: formatul planului, exemplul comentat, regulile de validare, maparea pe Meta, variabilele, pașii pentru tokenuri |
| `lib/ads/PROMPT.md` | promptul complet al portalului, copiat identic din `e:\._media agentie\prompt-ads-portal.md` |

---

## 1. Unde suntem

| Fază | Ce | Stare |
|---|---|---|
| **1** | Schema JSON + validare + previzualizare, fără apeluri la platforme | ✅ gata |
| **2** | Meta: creare campanie pe pauză, cu video deja urcat | ✅ gata pe `feat/ads-portal`, testată pe un Meta fals local — **încă nu pe contul real** |
| 3 | Meta: încărcare video din browser | ⬜ așteaptă confirmarea ta |
| 4 | Dashboard + cron pentru Meta | ⬜ |
| 5 | TikTok, peste structura existentă | ⬜ |

Migrarea 5 (`admin_emails` + `is_lead_admin()`) e pe `main`; portalul, tot
**fără merge în `main`**. Regula din prompt rămâne: fază cu fază, commit
separat, nu trec mai departe fără confirmarea ta.

---

## 2. Ce ai de făcut TU acum — ca să creezi prima campanie reală

### 2.1 Aplică migrările, în ordine (Supabase → SQL editor)

- [ ] `supabase/migrations/00000000000005_admin_emails.sql` — un tab, tot
      fișierul, fără selecție.
- [ ] **Imediat după**, în alt tab:
      `insert into public.admin_emails (email) values ('adresa-ta@…');` — aceleași
      adrese ca în `ADMIN_EMAILS` din Vercel. Până atunci panoul de lead-uri
      arată zero lead-uri (nu se pierde nimic).
- [ ] Deschide `/admin`: lead-urile se văd din nou.
- [ ] `supabase/migrations/00000000000006_ads_portal.sql` — tabelele portalului.
      Fără ea, portalul refuză crearea înainte să trimită ceva la Meta și spune
      „aplică migrarea 6”.

### 2.2 Tokenul Meta

Pașii exacți: `lib/ads/README.md` → „Cum generezi tokenurile” (actualizați în faza 2).

- [ ] Aplicația *Business* și System User-ul în portofoliul Meridian.
- [ ] *Assign assets*: contul de reclame (*Manage campaigns*), pagina, pixelul
      (dataset-ul), contul de Instagram.
- [ ] *Generate new token* → expirare **Never** (sau 60 de zile, dacă Meta nu
      mai oferă „Never”) → `ads_management`, `ads_read`, `pages_show_list`,
      `pages_read_engagement`, `pages_manage_ads`.
- [ ] În setările aplicației, **„Require App Secret” oprit**.
- [ ] `META_TOKEN_MERIDIAN` **direct în Vercel**, pe *Preview* (ca să testezi pe
      preview-ul ramurii `feat/ads-portal`) și, la merge, pe *Production*.
      Nu în chat, nu într-un fișier, nu într-un commit.

### 2.3 Beneficiarul și plătitorul (DSA)

Publicul în România = UE, deci Meta cere pe fiecare reclamă cine beneficiază
și cine o plătește.

- [ ] O dată, în Ads Manager → setările contului de reclame → beneficiar și
      plătitor impliciți. **Sau** în fiecare plan: `"dsa_beneficiary"` și
      `"dsa_payor"` în secțiunea `meta`.

Fără ele, „Verifică în Meta” se oprește și spune exact asta (cu sugestiile Meta).

### 2.4 Prima campanie, de test

- [ ] Deschide preview-ul ramurii `feat/ads-portal` (Vercel → Deployments), apoi
      `/admin/ads/nou`.
- [ ] Un plan real, cu **bugetul minim**, cu un video deja urcat în contul de
      reclame (îl alegi din „Alege din biblioteca contului”).
- [ ] **Verifică în Meta** → citește „Ce a găsit Meta”: contul, moneda, pagina,
      pixelul, DSA, fiecare oraș și interes așa cum l-a înțeles Meta.
- [ ] **Creează pe pauză** → **Deschide în Ads Manager**.
- [ ] În Ads Manager, verifică: campania, setul și reclamele sunt **oprite**;
      bugetul pe set; plasările; în reclamă, la „Advantage+ creative”, toate
      îmbunătățirile oprite; „Multi-advertiser ads” oprit.
- [ ] Șterge campania de test din Ads Manager.
- [ ] Spune-mi ce ai văzut — mai ales dacă ceva e pornit deși portalul l-a
      trimis oprit. Lista a ce n-a putut fi verificat fără un cont real e în
      `lib/ads/README.md` → „Neverificat încă”.

> Pentru Clienți: aceiași pași în portofoliul clienților, cu `META_TOKEN_CLIENTI`.

---

## 3. Decizii

| # | Ce | Stare |
|---|---|---|
| 3.1 | `is_lead_admin()` | ✅ **Luată de mine**, pe propunerea din ghid: migrarea 5 scrisă exact ca în `PLAN.md`, pe `main`. O aplici tu (2.1). |
| 3.2 | Lista de conturi de reclame vine din token, nu din `workspaces.ts` | ✅ așa e construit: tokenul vede conturile, planul se respinge dacă `ad_account` nu e printre ele. Confirmă. |
| 3.3 | Plafoanele de buget (500 lei / 100 € Meridian, 2.500 lei / 500 € / 500 USD clienți) | ⬜ de confirmat — sau le schimbi în `lib/ads/workspaces.ts`. |
| 3.4 | Faza 3 are nevoie de `next.config.ts` (CSP) | ⬜ îți cer voie la începutul fazei 3. Între timp, miniaturile de pe CDN-ul Meta apar în raportul CSP (doar raport, nu blochează). |
| 3.5 | „Ad sources” pe Meta | ✅ **Rezolvat:** n-are câmp în API; portalul refuză, una câte una, cele 5 funcții pe care le alimentează (README → „Faza 2”). |
| 3.6 | Video „direct din browser” vs. „niciun token în browser” (faza 3) | ⬜ propunerea rămâne varianta A (4.3). |
| 3.7 | Istoricul de metrici | ✅ **Luată de mine**, pe propunere: migrarea 6 îngheață zilele mai vechi de 7 (trigger în bază). Spune-mi dacă vrei altfel până la faza 4. |
| 3.8 | Cron-ul (faza 4) în `app/api/cron/…` și `vercel.json` | ⬜ îți cer voie la începutul fazei 4. |
| 3.9 | **DSA**: plan → setările contului → eroare; portalul nu completează singur un câmp legal | nou, de confirmat |
| 3.10 | **Dublura**: același plan, creat în ultimele 30 de minute, cere „Creează încă una, intenționat” | nou, de confirmat |

---

## 4. Ce mai e de făcut, pe faze

### 4.1–4.2 Faza 2 — gata

Ce face, pe scurt, în anexa „Raportul fazei 2” de la final; tehnic, în
`lib/ads/README.md` → „Faza 2 — crearea pe Meta”. Ce mai trebuie ca să creezi
prima campanie reală: secțiunea 2 de mai sus.

### 4.3 Faza 3 — încărcare video din browser

Problema: promptul cere ca video-ul să meargă **direct din browser la
platformă**, iar la Meta upload-ul direct cere tokenul în browser — ceea ce
promptul interzice („niciun token în răspuns către browser”). Variantele:

| | Cum | Token în browser | Trece prin Vercel |
|---|---|---|---|
| **A (propusă)** | Browserul urcă fișierul **direct** într-o stocare temporară (Supabase Storage sau Vercel Blob, cu URL semnat, valabil minute); serverul îi dă platformei adresa (`file_url` la Meta, `UPLOAD_BY_URL` la TikTok), așteaptă procesarea, apoi șterge fișierul. | nu | nu |
| B | Browserul urcă direct la Meta, cu tokenul System User-ului | **da** — respins | nu |
| C | Fișierul pe bucăți sub 4,5 MB prin serverul nostru | nu | **da** — contrazice promptul |

Pentru A: Supabase Free limitează un fișier la 50 MB. Reclamele video trec ușor
de atât, deci fie Supabase Pro, fie Vercel Blob (dependență nouă, `@vercel/blob`,
de trecut în `PLAN.md` la „Dependențe noi”). Decizia 3.6.

Restul fazei: starea procesării afișată (încarcă → procesează → gata), ca
interfața să nu pară blocată; crearea se deblochează abia când platforma
spune că video-ul e gata. Plus CSP-ul din `next.config.ts` (decizia 3.4).

### 4.4 Faza 4 — dashboard + cron (Meta)

- **Cron zilnic** (Vercel Cron, gardă `CRON_SECRET` — variabila există deja):
  trage cifrele din Meta Insights pentru fiecare spațiu cu token și le scrie în
  `ads_metrics_daily`; fiecare rulare scrie un rând în `ads_runs`.
- **Dashboard-ul citește doar din bază**, niciodată din API.
- **Metrici**: cheltuială, afișări, click-uri, CTR, CPC, CPM, rezultate
  (lead-uri), cost per rezultat — pe campanie, pe zi, cu comparație între
  perioade.
- **Istoric permanent**: platformele nu țin datele la infinit.
- **Decizia 3.7**: Meta atribuie conversiile cu întârziere (fereastra de
  atribuire merge până la 7 zile după clic). Dacă actualizăm doar ziua curentă,
  lead-urile atribuite mai târziu zilelor trecute nu mai ajung niciodată în
  bază. Propun: actualizăm ultimele 7 zile la fiecare rulare, iar zilele mai
  vechi rămân înghețate.
- **Ecranele** `/admin/ads/statistici` și `/admin/ads/[id]`. Înainte de grafice
  citesc skill-ul `dataviz`, cum cere promptul.
- Pe Vercel Hobby, cron-urile rulează cel mult o dată pe zi (±59 min) —
  suficient pentru cifre zilnice.

### 4.5 Faza 5 — TikTok

- Același plan, altă traducere: obiective, grupe de vârstă, identitate,
  evenimente (`SubmitForm` în loc de `Lead`), texte de maxim 100 de caractere.
- Token pe termen lung (pașii în README) + probabil `TIKTOK_APP_ID` și
  `TIKTOK_APP_SECRET`.
- Campanii manuale, nu Smart+: îmbunătățirile TikTok (automatic enhancements,
  auto-add assets, translate and dub, music refresh) țin de Smart+ și rămân
  oprite.
- Cifrele în același cron și în aceleași tabele.
- Detaliile API se verifică pe documentația curentă la începutul fazei.

### 4.6 La finalul tuturor fazelor (secțiunea 9 din prompt)

1. Variabilele de adăugat în Vercel — lista completă e în README.
2. Pașii pentru tokenuri — README, verificați pe primul apel real din faza 2.
3. Exemplul de JSON comentat — README și butonul din portal.
4. Ce mai lipsește pentru prima campanie reală — lista 4.2.

---

## 5. Observații

- **Hidratare:** pe build-ul de producție, eroarea React #418 apare rar și
  nereprodus: o dată în faza 1 (din peste 70 de încărcări) și o dată în faza 2
  (din ~170, pe `/admin/ads`, fără să se repete pe aceeași pagină în alte 40
  de încărcări). Cauza nu e cunoscută.
- **CSP-ul** e încă doar raportat (`CSP_REPORT_ONLY = true` în `next.config.ts`),
  deci nu blochează nimic azi.
- **Pixelul din exemplu** e fals (zerouri), deci portalul avertizează că
  site-ul trimite evenimentele către alt pixel. E avertismentul corect: la un
  plan real, pune pixelul site-ului.
- **`PLAN.md` și `.env.example` nu au fost atinse** — promptul limitează zona la
  fișierele portalului. La merge, notele de aici se pot trece în `PLAN.md`.
- **Panoul de lead-uri** nu are încă link spre `/admin/ads` (capul lui e în
  `(dash)/layout.tsx`, în afara zonei). Portalul are link înapoi spre lead-uri.

---

## Anexă — raportul fazei 2

### Ce face portalul acum (Meta, spațiu cu token)

- **„Verifică în Meta”** citește contul real: contul (și moneda lui), pagina,
  Instagramul, pixelul, video-ul, beneficiarul și plătitorul DSA și fiecare
  nume din targetare. Panoul „Ce a găsit Meta” arată ce intră efectiv în
  targetare („București (+30 km) → Bucharest, Romania”).
- **„Creează pe pauză”** se deblochează doar după o verificare fără erori a
  exact planului de pe ecran. Pe server, verificarea se reface și se compară
  amprenta; dacă ceva s-a schimbat între timp, cere o nouă verificare.
- Crearea: coperta urcată în cont → campania → setul → creativ + reclamă
  pentru fiecare text. **Toate cu `status: PAUSED`.** La final: „Creată.
  Oprită.” și linkul direct spre Ads Manager.
- Toate îmbunătățirile automate pleacă **explicit oprite**: 39 de funcții
  Advantage+ creative, cele 5 alimentate de „Ad sources”, multi-advertiser,
  Advantage+ audience.
- Același plan creat de două ori în 30 de minute → cere confirmare.
- O eroare la jumătate lasă totul oprit, cu link și mesajul Meta în română
  (plus textul lor original și `fbtrace_id`, pentru suport).
- `/admin/ads` listează campaniile create, din toate spațiile.
- „Alege din biblioteca contului” — video-urile deja urcate, cu miniatură.

### Garda „doar pe pauză”

- O singură cale de scriere spre Meta (`metaPost`), care verifică fiecare
  corp de cerere înainte de rețea: orice câmp de status, la orice adâncime,
  trebuie să fie `PAUSED`.
- Nu există funcție de modificare sau de ștergere a unei campanii.
- Statusul de pornire nu apare scris nicăieri în codul portalului.
- `node lib/ads/meta/verify-paused.mjs` verifică toate astea (21 de verificări).

### Verificat

- TypeScript, ESLint, build de producție verzi; `verify-paused` 21/21.
- Cap-coadă în Chrome, pe un Meta și un Supabase falși, locali, în dev și pe
  build de producție: verificare → creare (7 cereri: copertă, campanie, set,
  2 × creativ + reclamă, toate `PAUSED`) → dublură blocată → listă.
  Tokenul pleacă doar în antet, spre Graph API; descărcarea copertei nu-l
  primește; nu apare în logul serverului.
- Erorile: DSA lipsă (cu sugestia Meta), refuz la reclamă (la jumătate,
  notat `partial`), refuz la campanie (nimic creat), migrarea 6 neaplicată
  (nimic trimis la Meta), plan schimbat după verificare.
- 360 și 1440 px fără scroll orizontal; reduced-motion; drumul complet de la
  tastatură, cu focusul mutat pe rezultatul verificării și al creării.
- Hidratarea: 170 de încărcări, un singur #418 (vezi „Observații”).

### Neverificat — cere contul real

Lista din `lib/ads/README.md` → „Neverificat încă”. Cel mai important: dacă
Meta respectă toate opt-out-urile pe un video (muzica, mai ales), linkul spre
Ads Manager și bugetul minim în lei.

### Surse

- [Graph API — changelog](https://developers.facebook.com/docs/graph-api/changelog/) (v26.0; v24.0 oprită pe 2026-10-06)
- [Ad set — referință](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign/) (DSA, `targeting_automation`)
- [Campanie — referință](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/) (`is_adset_budget_sharing_enabled`)
- [Advantage+ creative](https://developers.facebook.com/docs/marketing-api/creative/advantage-creative/) și [SDK-ul oficial v26.0.2](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adcreativefeaturesspec.py) (cheile `creative_features_spec`)
- [Multi-advertiser ads](https://developers.facebook.com/docs/marketing-api/creative/multi-advertiser-ads/)
- [Targeting search](https://developers.facebook.com/docs/marketing-api/audiences/reference/targeting-search/)
- [Ad sources — Help Center](https://www.facebook.com/business/help/3787607341463348)

---

## Anexă — raportul fazei 1, cum a apărut în terminal

Faza 1 e gata: schema JSON, validarea în română și ecranul de previzualizare,
fără niciun apel către Meta sau TikTok. Codul e pe `feat/ads-portal` (două
commit-uri), împins pe GitHub, fără merge în `main`. Nu trec la faza 2 până nu
confirmi.

### Ce poți face acum

- **`/admin/ads/nou`**: lipești planul în stânga și îl citești în dreapta.
  - **Ce vezi:** o propoziție în română (cui se adresează, cât costă pe zi și pe
    lună), apoi reclamele care ies din el, cu textul fiecăreia.
  - **Ce corectezi:** orice câmp, direct din formular. JSON-ul se rescrie singur,
    gata de copiat înapoi.
- **Butonul „Creează pe pauză”** e dezactivat și are motivul scris lângă el. Sus
  stă mesajul „Se creează oprită”: nicio rută din portal nu poate porni o
  campanie.
- **Validarea în română** arată toate problemele odată și spune ce să scrii în
  loc. Exemple:
  - „Bugetul zilnic: „50” e scris între ghilimele, deci e text. Scrie numărul
    fără ghilimele: 50.”
  - „Obiectivul campaniei: textul „lead” nu e o valoare acceptată. Ai vrut
    „leads”?”
  - Un id scris ca număr: JavaScript îl rotunjește, deci ar arăta spre alt cont.
    Portalul îl respinge.
  - Bugetul peste plafonul spațiului de lucru e respins, ca să prindă un zero în
    plus.
  - Un plan pentru alt spațiu decât cel afișat sus e respins.
- **Avertismente** (nu blochează crearea): pixel diferit de cel al site-ului,
  evenimente pe care site-ul nu le trimite, texte care se taie, o îmbunătățire
  automată pornită.
- **Selectorul de spațiu de lucru** e mereu vizibil sus. E galben când lucrezi pe
  banii clienților.
- **Îmbunătățirile automate** (Advantage+, Multi-advertiser, cele patru de pe
  TikTok) sunt oprite implicit.

**Verificat:** TypeScript și ESLint trec, iar build-ul de producție e verde. Am
verificat în Chrome, pe un Supabase fals local, la 360–1920px, cu reduced-motion
și de la tastatură. Nu am găsit nepotriviri de hidratare, cu o excepție: eroarea
React #418 a apărut o singură dată și nu am mai reprodus-o în peste 70 de
încărcări. Nu știu ce a cauzat-o.

**Ca s-o vezi local:** `git checkout feat/ads-portal`, apoi `npm run dev` și
deschizi `/admin/ads/nou`. Am lăsat directorul pe `main`, pentru că nu știu dacă
celălalt terminal lucrează în același director. Dacă da, riscați să vă schimbați
ramurile unul altuia. Cel mai sigur ar fi un `git worktree` separat pentru unul
dintre voi.

### De hotărât înainte de faza 2

1. **`is_lead_admin()` nu există.** Migrarea 5 (`admin_emails` +
   `is_lead_admin()`) apare în `PLAN.md` doar ca plan. Migrarea portalului are
   nevoie de ea pentru RLS. O scriu întâi pe ea, cum e descrisă în `PLAN.md`?
2. **Lista de conturi de reclame nu stă în `workspaces.ts`.** Cererea ta intra în
   conflict cu regula „niciun id de cont în cod” într-un repo public. Lista vine
   din token: System User-ul vede doar conturile atribuite lui.
3. **Plafoanele de buget le-am ales eu:** 500 lei/zi pentru Meridian, 2.500 lei/zi
   pentru clienți. Se schimbă în `lib/ads/workspaces.ts`.
4. **Faza 3 cere o modificare în `next.config.ts`:** CSP-ul trebuie să permită
   încărcarea directă la Meta. Îți cer voie atunci.
5. **„Ad sources”:** nu am găsit câmpul corespunzător în documentația publică
   Meta. Îl păstrez oprit în schemă și îl mapez în faza 2, pe documentația
   curentă.

### Formatul: exemplul complet, comentat (Meta · Leads · Website)

Sursa e `lib/ads/example-plan.ts` (varianta cu toate comentariile e în
`README.md`). Se lipește direct, cu comentarii cu tot, sau din butonul „Încarcă
exemplul”. Id-urile sunt zerouri și se înlocuiesc cu ale tale.

```jsonc
{
  "format": "meridian-ads/1",                // opțional
  "workspace": "meta-meridian",              // meta-meridian | meta-clienti | tiktok-meridian | tiktok-clienti — același cu selectorul
  "ad_account": "act_000000000000001",       // Meta: act_ + cifre; TikTok: advertiser_id
  "campaign": {
    "name": "Video imobiliare · testimonial · oct 2026",
    "objective": "leads",                    // leads | traffic | sales | video_views | awareness
    "daily_budget": 60,                      // pe zi, număr, unități întregi (60 = 60 lei)
    "currency": "RON"                        // RON | EUR | USD — moneda contului
  },
  "audience": {
    "locations": [                           // minim una: country (code) | region | city (+ radius_km)
      { "type": "city", "name": "București", "country": "RO", "radius_km": 30 },
      { "type": "city", "name": "Cluj-Napoca", "country": "RO", "radius_km": 25 }
    ],
    "age_min": 28, "age_max": 60,            // 18–65, 65 = 65+
    "gender": "all",                         // all | male | female
    "languages": ["ro"],                     // gol = orice limbă
    "interests": [{ "name": "Real estate" }, { "name": "Real estate development" }],  // id opțional
    "behaviors": [{ "name": "Small business owners" }]
  },
  "conversion": {                            // obligatorie la leads și sales
    "pixel_id": "000000000000003",           // id-urile se scriu ca TEXT
    "event": "lead"                          // lead | contact | schedule | complete_registration | purchase | view_content
  },
  "destination": {
    "type": "website",
    "url": "https://www.meridianx.ro/video",
    "utm": { "source": "facebook", "medium": "paid_social", "campaign": "video-imobiliare-oct26" }
  },
  "creative": {
    "video": { "source": "library", "video_id": "000000000000004" },  // sau { "source": "upload" }
    "thumbnail": "auto",
    "primary_texts": [
      "Un apartament se vinde din primele trei secunde de video. Noi le filmăm pe alea trei. Și restul.",
      "Randările arată toate la fel. Filmăm proiectul tău așa cum îl vede cumpărătorul, la lumina reală."
    ],
    "headlines": ["Video pentru proiectul tău rezidențial"],
    "descriptions": ["Răspundem în maxim 24 de ore"],
    "cta": "get_quote",                      // learn_more | get_quote | contact_us | sign_up | apply_now | subscribe | download
    "variants": "one_ad_per_text"            // sau platform_rotates (doar Meta)
  },
  "meta": {                                  // obligatorie pe Meta (pe TikTok: "tiktok": { identity_type, identity_id, ... })
    "page_id": "000000000000002",
    "instagram_account_id": "000000000000005",
    "special_ad_categories": [],             // "housing" pentru clienții care vând/închiriază locuințe
    "advantage_audience": false,
    "placements": "automatic",
    "enhancements": { "advantage_creative": false, "ad_sources": false, "multi_advertiser_ads": false }
  }
}
```

Tabelul complet al câmpurilor, varianta TikTok și toate regulile de validare
sunt în `lib/ads/README.md`.

### Tokenurile, pe scurt (pașii completi sunt în README)

**Meta (System User, nu expiră).** Faci pașii o dată pentru fiecare portofoliu.
Meta cere ca aplicația și System User-ul să fie în același portofoliu, deci
fiecare portofoliu are aplicația lui.

1. Creezi o aplicație Meta de tip Business, în portofoliul respectiv, cu
   Marketing API și cel puțin acces standard.
2. În Business Settings: Users → System users → Add.
3. La „Assign assets” îi dai conturile de reclame (Manage campaigns), paginile,
   pixelul și contul de Instagram.
4. „Generate new token” → aplicația → expirare **Never** → `ads_management`,
   `ads_read`, `business_management`, `pages_show_list`, `pages_read_engagement`.
5. Pui tokenul în Vercel: `META_TOKEN_MERIDIAN` / `META_TOKEN_CLIENTI`.

**TikTok.** TikTok nu are System User. Echivalentul e tokenul pe termen lung
obținut din autorizarea unei aplicații TikTok for Business: nu expiră, dar
devine invalid dacă retragi autorizarea.

1. Autorizezi aplicația ca admin al Business Center-ului.
2. Primești un `auth_code`, valabil o oră și o singură folosire.
3. Îl schimbi pe token cu `POST /oauth2/access_token/`.
4. Pui tokenul în `TIKTOK_TOKEN_MERIDIAN` / `TIKTOK_TOKEN_CLIENTI`. Probabil vor
   trebui și `TIKTOK_APP_ID` și `TIKTOK_APP_SECRET`; confirm în faza 5.

Nu am atins `PLAN.md` și `.env.example`, pentru că ai limitat zona la fișierele
portalului. Notele de coordonare sunt în `lib/ads/README.md`. Dacă vrei, le trec
în `PLAN.md` la merge.

### Surse

- [Meta — System Users: creare](https://developers.facebook.com/docs/marketing-api/system-users/create-retrieve-update)
- [Meta — System Users: aplicații și tokenuri](https://developers.facebook.com/docs/marketing-api/system-users/install-apps-and-generate-tokens)
- [TikTok — Generate an access token](https://ads.tiktok.com/gateway/docs/index?identify_key=c0138ffadd90a955c1f0670a56fe348d1d40680b3c89461e09f78ed26785164b&language=ENGLISH&doc_id=1738373164380162)
- [TikTok Marketing API v1.3 explicat](https://soku.ai/blog/tiktok-marketing-api-v1-3-explained)
- [Advantage+ creative enhancements, ghid 2026](https://adsuploader.com/blog/advantage-plus-creative-enhancements)
- [TikTok Symphony Automation](https://ads.tiktok.com/business/en-US/blog/symphony-automation)
