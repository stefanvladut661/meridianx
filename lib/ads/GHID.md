# Ghid — portalul de reclame, după faza 1

*Scris pe 2026-09-23, la finalul fazei 1. Ramura: `feat/ads-portal`.*

Trei documente, în ordinea în care se citesc:

| Fișier | Ce e |
|---|---|
| `lib/ads/GHID.md` | **acesta** — ce ai de făcut acum, ce e de hotărât, ce urmează pe faze, raportul fazei 1 |
| `lib/ads/README.md` | documentația tehnică: formatul planului, exemplul comentat, regulile de validare, variabilele, pașii pentru tokenuri |
| `lib/ads/PROMPT.md` | promptul complet al portalului, copiat identic din `e:\._media agentie\prompt-ads-portal.md` |

---

## 1. Unde suntem

| Fază | Ce | Stare |
|---|---|---|
| **1** | Schema JSON + validare + previzualizare, fără apeluri la platforme | ✅ gata — `12bd56d`, `72ec09a`, împinsă pe GitHub, **fără merge în `main`** |
| 2 | Meta: creare campanie pe pauză, cu video deja urcat | ⬜ așteaptă confirmarea ta |
| 3 | Meta: încărcare video din browser | ⬜ |
| 4 | Dashboard + cron pentru Meta | ⬜ |
| 5 | TikTok, peste structura existentă | ⬜ |

Regula din prompt rămâne: **fază cu fază, commit separat, nu trec mai departe fără
confirmarea ta, nu fac merge în `main` fără confirmarea ta.**

---

## 2. Ce ai de făcut TU acum

### 2.1 Uită-te la faza 1

```bash
git checkout feat/ads-portal
npm run dev
```

Apoi `http://localhost:3000/admin/ads/nou` (te loghezi ca în panoul de lead-uri).

- [ ] Apasă **„Încarcă exemplul”** și citește previzualizarea: propoziția de sus,
      secțiunile cu punct verde/galben/roșu, reclamele de la final.
- [ ] Schimbă ceva în formular (bugetul, un text) și vezi cum se rescrie JSON-ul
      din stânga.
- [ ] Cere unei alte conversații un plan real: dă-i secțiunea **„Formatul
      planului”** din `lib/ads/README.md` (tabelul + exemplul comentat) și cere-i
      „un JSON în formatul ăsta”. Lipește ce primești în portal.
- [ ] Încearcă și un plan greșit (buget scris `"50"`, un id scris ca număr, un
      câmp inventat) — mesajele trebuie să-ți spună exact ce să corectezi.

> În dezvoltare, cu `ADMIN_EMAILS` gol în `.env.local`, trece orice cont
> Supabase. În producție, fără `ADMIN_EMAILS`, panoul se blochează intenționat.

### 2.2 Răspunde la deciziile din secțiunea 3

Fără răspunsul la **3.1** (`is_lead_admin()`) nu pot scrie migrarea portalului,
deci nici faza 2.

### 2.3 Pregătește tokenul Meta (pentru faza 2)

Pașii exacți sunt în `lib/ads/README.md` → „Cum generezi tokenurile”. Pe scurt:

- [ ] O aplicație Meta de tip *Business* **în fiecare portofoliu** (Meridian și
      Clienți), cu produsul *Marketing API* și acces cel puțin standard pentru
      `ads_management`. Meta cere ca aplicația și System User-ul să fie în
      același portofoliu.
- [ ] Un System User în fiecare portofoliu (*Settings → Users → System users*).
- [ ] *Assign assets*: conturile de reclame (*Manage campaigns*), paginile,
      pixelul (dataset-ul), contul de Instagram.
- [ ] *Generate new token* → aplicația → expirare **Never** → `ads_management`,
      `ads_read`, `business_management`, `pages_show_list`,
      `pages_read_engagement`.
- [ ] Tokenul **direct în Vercel** (`META_TOKEN_MERIDIAN`, `META_TOKEN_CLIENTI`),
      nu în chat, nu într-un fișier, nu într-un commit.
- [ ] Verifică în Events Manager că pixelul e legat de contul de reclame în care
      vei crea campania.

### 2.4 Separă terminalele (recomandat)

Dacă terminalul de pe `feat/software-page` lucrează **în același director**
`E:\meridianx`, orice `git checkout` al unuia schimbă fișierele de sub celălalt,
iar o ramură nouă creată din ramura greșită ia cu ea commit-urile celeilalte.
Cel mai sigur: un director separat pentru al doilea terminal.

```bash
cd /e/meridianx
git worktree add -b feat/software-page ../meridianx-software main
cd ../meridianx-software
npm install
```

(Dacă `feat/software-page` există deja: `git worktree add ../meridianx-software feat/software-page`.)
Am lăsat `E:\meridianx` pe `main` la finalul fazei 1, tocmai din motivul ăsta.

---

## 3. Decizii de confirmat

| # | Ce | Propunerea mea |
|---|---|---|
| 3.1 | **`is_lead_admin()` nu există.** Migrarea 5 (`admin_emails` + `is_lead_admin()`) e descrisă în `PLAN.md`, dar n-a fost scrisă. Portalul are nevoie de ea pentru RLS „exact ca la lead-uri”. | Scriu **întâi migrarea 5** exact cum e descrisă în `PLAN.md` (închide și accesul oricărui cont Supabase la lead-uri), apoi migrarea portalului. După aplicare, inserezi în `admin_emails` aceleași adrese ca în `ADMIN_EMAILS`. |
| 3.2 | **Lista de conturi de reclame nu stă în `workspaces.ts`** — repo public, id-urile de cont nu intră în cod. | Lista vine din token: System User-ul vede exact conturile atribuite lui. Adăugarea unui portofoliu rămâne „un obiect + o variabilă”. |
| 3.3 | **Plafoanele de buget** (alese de mine). | 500 lei / 100 € pe zi pentru Meridian, 2.500 lei / 500 € / 500 USD pentru clienți. Spune-mi alte cifre, sau le schimbi în `lib/ads/workspaces.ts`. |
| 3.4 | **Faza 3 are nevoie de `next.config.ts`** (CSP) — fișier pe care nu-l ating fără voie. | Îți cer voie la începutul fazei 3, cu lista exactă de origini. |
| 3.5 | **„Ad sources” de pe Meta** — n-am găsit câmpul corespunzător în documentația publică. | Rămâne oprit în schemă; îl mapez în faza 2 pe documentația curentă și îți spun ce am găsit. |
| 3.6 | **Video „direct din browser” vs. „niciun token în browser”** (faza 3, vezi 4.3). | Varianta A de mai jos. |
| 3.7 | **Istoricul de metrici** (faza 4, vezi 4.4): promptul spune „se actualizează doar ziua curentă”. | Actualizez ultimele 7 zile, restul rămâne înghețat. |
| 3.8 | **Cron-ul (faza 4)** stă în `app/api/cron/…` și `vercel.json` — în afara zonei portalului. | Îți cer voie la începutul fazei 4. |

---

## 4. Ce mai e de făcut, pe faze

### 4.1 Faza 2 — Meta: creare pe pauză, cu video deja urcat

- **Migrarea** (după 3.1): `ads_campaigns`, `ads_metrics_daily`, `ads_runs`, cu
  RLS activ și acces doar prin `is_lead_admin()`. Scrierile trec prin service
  role, după ce acțiunea a verificat sesiunea (la fel ca la lead-uri). Fiecare
  `update`/`delete` cu `where` explicit (Supabase rulează `safeupdate`).
- **Clientul Meta** (`lib/ads/meta/…`, `server-only`): `fetch` la Graph API,
  tokenul citit doar în funcția care face apelul, niciodată logat.
- **Conturile spațiului** din token (`/me/adaccounts`): planul se respinge dacă
  `ad_account` nu e printre ele, sau dacă moneda contului diferă de `currency`.
- **Rezolvarea numelor**: orașe, regiuni, limbi, interese, comportamente fără
  id → căutare prin Targeting Search. Portalul îți arată ce a găsit (ex.
  „Cluj-Napoca → Cluj-Napoca, Cluj County, Romania”) **înainte** de creare.
- **Crearea**, într-o singură acțiune de server, cu planul revalidat pe server:
  campanie → set de reclame → creative → reclame, **toate cu `status: PAUSED`**.
  Îmbunătățirile automate trimise explicit ca oprite (nu ne bazăm pe valorile
  implicite ale Meta).
- **Garda anti-ACTIVE**: un singur loc construiește obiectele trimise; un test
  verifică `status === "PAUSED"` la fiecare nivel, iar șirul `ACTIVE` nu apare
  nicăieri în `lib/ads`.
- **Eșec la jumătate** (campania s-a creat, reclama nu): nimic nu se pornește.
  Portalul arată ce s-a creat, cu link, și eroarea Meta în română.
- **După creare**: rândul în `ads_campaigns` (cu planul întreg în `plan_json`) și
  linkul direct spre campanie în Ads Manager.
- **Alegerea video-ului din bibliotecă** (listă din contul de reclame) — cerută
  explicit în prompt; se poate face tot în faza 2, pentru că nu implică upload.
- **Ecranul `/admin/ads`** începe să listeze campaniile din `ads_campaigns`.

### 4.2 Faza 2 — ce trebuie să existe ca să creezi prima campanie reală

- [ ] Decizia 3.1 + migrarea aplicată în SQL editor.
- [ ] `META_TOKEN_MERIDIAN` în Vercel (pașii din 2.3), redeploy.
- [ ] `ADMIN_EMAILS` setat în Vercel (e deja, pentru lead-uri).
- [ ] Pagina de Facebook și pixelul accesibile contului de reclame și System User-ului.
- [ ] Un video deja urcat în biblioteca contului (până la faza 3).
- [ ] Codul fazei 2, verificat cu o campanie de test creată pe pauză și ștearsă
      apoi de tine din Ads Manager.

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

- **Hidratare:** pe build-ul de producție, eroarea React #418 a apărut **o
  singură dată** și nu s-a mai reprodus în peste 70 de încărcări (inclusiv cu
  serverul pornit la rece). Cauza nu e cunoscută.
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
