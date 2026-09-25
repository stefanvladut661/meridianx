# Ghid — portalul de reclame, după faza 5

*Actualizat pe 2026-09-26, la finalul fazei 5 — toate fazele din prompt sunt scrise. Ramura: `feat/ads-portal`.*

Trei documente, în ordinea în care se citesc:

| Fișier | Ce e |
|---|---|
| `lib/ads/GHID.md` | **acesta** — ce ai de făcut acum, ce e de hotărât, ce urmează pe faze, rapoartele fazelor |
| `lib/ads/README.md` | documentația tehnică: formatul planului, exemplele comentate (Meta și TikTok), regulile de validare, maparea pe Meta și pe TikTok, variabilele, pașii pentru tokenuri |
| `lib/ads/PROMPT.md` | promptul complet al portalului, copiat identic din `e:\._media agentie\prompt-ads-portal.md` |

---

## 1. Unde suntem

| Fază | Ce | Stare |
|---|---|---|
| **1** | Schema JSON + validare + previzualizare, fără apeluri la platforme | ✅ gata |
| **2** | Meta: creare campanie pe pauză, cu video deja urcat | ✅ gata pe `feat/ads-portal`, testată pe un Meta fals local — **încă nu pe contul real** |
| **3** | Meta: încărcare video din browser | ✅ gata pe `feat/ads-portal`, testată pe Meta și Supabase falși — **încă nu pe contul real** |
| **4** | Dashboard + cron pentru Meta | ✅ gata pe `feat/ads-portal`, testată pe Meta și Supabase falși — cron-ul cere o linie în `vercel.json` (3.8) |
| **5** | TikTok, peste structura existentă | ✅ gata pe `feat/ads-portal`, testată pe TikTok și Supabase falși — **încă nu pe contul real** |

Migrarea 5 (`admin_emails` + `is_lead_admin()`) e pe `main`; portalul, tot
**fără merge în `main`** — merge-ul îl faci tu sau mi-l ceri explicit.

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
- [ ] `supabase/migrations/00000000000007_ads_uploads.sql` — anticamera
      video-urilor noi (bucket privat `ads-uploads`, 50 MB pe fișier). Fără ea,
      urcarea spune „aplică migrarea 7”.

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

### 2.5 Primul video urcat din portal

- [ ] În același plan, la „Materialul”: **Fișier nou** → **Alege fișierul**
      (MP4, sub 50 MB) → **Urcă în contul …**.
- [ ] Urmărește pașii: urcare în portal → Meta copiază → Meta procesează →
      gata. La final planul trece singur pe video-ul din bibliotecă.
- [ ] În Ads Manager → Media library: video-ul apare cu numele fișierului tău.
- [ ] În Supabase → Storage → `ads-uploads`: bucket-ul e gol (fișierul se
      șterge când Meta termină).
- [ ] Spune-mi dacă s-a oprit undeva — mai ales la „Meta copiază”: e singurul
      pas pe care documentația Meta nu-l descrie complet.
- [ ] Spune-mi ce ai văzut — mai ales dacă ceva e pornit deși portalul l-a
      trimis oprit. Lista a ce n-a putut fi verificat fără un cont real e în
      `lib/ads/README.md` → „Neverificat încă”.

### 2.6 Primele cifre

- [ ] După ce pornești o campanie din Ads Manager și rulează o zi: **Statistici
      → Sincronizează acum**. Compară cheltuiala și lead-urile cu Ads Manager, pe
      aceeași perioadă (atribuirea e cea a setului de reclame, ca acolo).
- [ ] Spune-mi dacă „Lead-uri” diferă de coloana „Results” din Ads Manager.
- [ ] La merge (3.8): linia de cron în `vercel.json`; de atunci, sincronizarea
      rulează singură în fiecare dimineață.

> Pentru Clienți: aceiași pași în portofoliul clienților, cu `META_TOKEN_CLIENTI`.

### 2.7 TikTok

Pașii exacți: `lib/ads/README.md` → „TikTok — token pe termen lung”.

- [ ] Aplicația TikTok for Business, cu permisiunile din tabelul din README;
      așteaptă aprobarea (2–3 zile lucrătoare).
- [ ] Autorizarea, logat ca admin al Business Center-ului Meridian, cu **toate
      conturile de reclame bifate** → `auth_code` → tokenul (comanda `curl` din
      README, într-o oră de la autorizare).
- [ ] `TIKTOK_TOKEN_MERIDIAN` direct în Vercel (*Preview* + *Production*).
      `app_id` și `secret` nu intră în Vercel.
- [ ] Pe contul de reclame, în TikTok Ads Manager: **Payer information**
      (plătitorul, pentru UE), **identitatea Spark** (contul TikTok legat, cu
      drept de a primi video de la agenție) și **pixelul** site-ului legat.
- [ ] Prima campanie de test: spațiul „Meridian · TikTok” → **Încarcă
      exemplul** → pui contul, identitatea și un video real → **Verifică în
      TikTok** → **Creează pe pauză** → în TikTok Ads Manager verifici că
      totul e oprit, plasarea doar TikTok, fără „Automatic enhancements” și
      fără „Search” → o ștergi.
- [ ] Un video urcat din portal (sub 10 MB, ca să fie sigur — README → „Faza 5
      → Limite”).
- [ ] Spune-mi ce diferă — mai ales linkul spre campanie și dacă regiunile
      României apar la TikTok.

> Pentru Clienți: aceiași pași în Business Center-ul clienților, cu `TIKTOK_TOKEN_CLIENTI`.

---

## 3. Decizii

| # | Ce | Stare |
|---|---|---|
| 3.1 | `is_lead_admin()` | ✅ **Luată de mine**, pe propunerea din ghid: migrarea 5 scrisă exact ca în `PLAN.md`, pe `main`. O aplici tu (2.1). |
| 3.2 | Lista de conturi de reclame vine din token, nu din `workspaces.ts` | ✅ așa e construit: tokenul vede conturile, planul se respinge dacă `ad_account` nu e printre ele. Confirmă. |
| 3.3 | Plafoanele de buget (500 lei / 100 € Meridian, 2.500 lei / 500 € / 500 USD clienți) | ⬜ de confirmat — sau le schimbi în `lib/ads/workspaces.ts`. |
| 3.4 | CSP în `next.config.ts` | ✅ **Nu mai e nevoie pentru urcare**: merge spre Supabase, deja permis. Rămâne doar `img-src` pentru miniaturile de pe CDN-ul Meta (azi doar raportate) — îți cer voie când activezi CSP-ul. |
| 3.5 | „Ad sources” pe Meta | ✅ **Rezolvat:** n-are câmp în API; portalul refuză, una câte una, cele 5 funcții pe care le alimentează (README → „Faza 2”). |
| 3.6 | Video „direct din browser” vs. „niciun token în browser” | ✅ **Luată de mine**, pe propunerea A: browser → Supabase Storage (URL semnat) → Meta descarcă singur. Fără dependență nouă. Limita: 50 MB pe fișier pe Supabase Free (4.3). |
| 3.7 | Istoricul de metrici | ✅ **Luată de mine**, pe propunere: migrarea 6 îngheață zilele mai vechi de 7 (trigger în bază). Spune-mi dacă vrei altfel până la faza 4. |
| 3.8 | Cron-ul | ✅ ruta e în zona portalului (`/admin/ads/sincronizare`, cu `CRON_SECRET`). ⬜ **Îți cer voie** pentru o singură linie în `vercel.json` (în afara zonei, n-am atins-o): `{ "path": "/admin/ads/sincronizare", "schedule": "30 3 * * *" }`. Cron-ul rulează doar pe producție, deci contează la merge. |
| 3.9 | **DSA**: plan → setările contului → eroare; portalul nu completează singur un câmp legal | nou, de confirmat |
| 3.10 | **Dublura**: același plan, creat în ultimele 30 de minute, cere „Creează încă una, intenționat” | de confirmat |
| 3.12 | **Obiectivele și monedele nu se amestecă** în indicatori: la obiective diferite, Statisticile arată afișări și clicuri; rezultatele, după alegerea obiectivului | nou, de confirmat |
| 3.13 | **Statusul citit din Meta se afișează** („Pornită”, „Ștearsă”); portalul tot nu scrie alt status decât pauza | nou, de confirmat |
| 3.11 | **50 MB pe video** cât timp Supabase e pe Free. Alternativa: Supabase Pro (limită până la 500 GB) sau Vercel Blob (dependență nouă) | de hotărât dacă reclamele tale trec des de 50 MB |
| 3.14 | **Trafic pe TikTok = clicuri** (`CLICK` / `CPC`), nu vizualizări de pagină: acelea depind de pixel, iar pixelul site-ului pornește doar după „Acceptă tot”. Pe Meta rămâne „vizualizări de pagină” | nou, de confirmat |
| 3.15 | **TikTok doar cu Spark Ads** (`TT_USER` / `BC_AUTH_TT`): TikTok nu mai acceptă identitatea personalizată. Fiecare client pe TikTok are nevoie de un cont TikTok legat de contul de reclame | nou — nu e o alegere, e regula TikTok; de știut la ofertare |
| 3.16 | **DSA pe TikTok = avertisment**, nu eroare: API-ul n-are câmp; plătitorul se setează o dată pe cont, în TikTok Ads Manager | nou, de confirmat |
| 3.17 | **Lead-uri pe TikTok = conversii web** (`WEB_CONVERSIONS` + `FORM`), nu obiectivul „Lead generation”: același eveniment ca pe site, comparabil cu Meta | nou, de confirmat |

---

## 4. Ce mai e de făcut, pe faze

### 4.1–4.2 Faza 2 — gata

Ce face, pe scurt, în anexa „Raportul fazei 2” de la final; tehnic, în
`lib/ads/README.md` → „Faza 2 — crearea pe Meta”. Ce mai trebuie ca să creezi
prima campanie reală: secțiunea 2 de mai sus.

### 4.3 Faza 3 — gata

Varianta A, pe Supabase Storage. De ce și cum: `lib/ads/README.md` → „Faza 3”.
Ce ai de făcut: 2.1 (migrarea 7) și 2.5.

**Limita de 50 MB** (decizia 3.11): un video de 60 s, 1080p, la ~10 Mbps are
~75 MB. Pe Free: exportă la 4–6 Mbps sau urcă-l din Ads Manager și alege-l
din bibliotecă. Pe Pro: o linie în migrare + o constantă în cod.

### 4.4 Faza 4 — gata

Tehnic: `lib/ads/README.md` → „Faza 4”. Ce ai de făcut: 2.6 și decizia 3.8.

### 4.5 Faza 5 — gata

Tehnic: `lib/ads/README.md` → „Faza 5 — TikTok”. Ce ai de făcut: 2.7 și
deciziile 3.14–3.17. Doar tokenul pe Business Center — fără `TIKTOK_APP_ID`
și `TIKTOK_APP_SECRET` în Vercel.

### 4.6 La finalul tuturor fazelor (secțiunea 9 din prompt)

1. Variabilele de adăugat în Vercel — lista completă e în README.
2. Pașii pentru tokenuri — README, verificați pe primul apel real din faza 2.
3. Exemplul de JSON comentat — README și butonul din portal.
4. Ce mai lipsește pentru prima campanie reală — lista 4.2.

---

## 5. Observații

- **Hidratare — găsită și rezolvată în faza 4:** #418-ul rar din fazele 1–2 era
  un bug de reluare a hidratării în React 19.2 canary (Next 15.5), declanșat
  când scriptul de pornire vine din cache înaintea datelor paginii. Remediul și
  măsurătorile: anexa fazei 4.
- **CSP-ul** e încă doar raportat (`CSP_REPORT_ONLY = true` în `next.config.ts`),
  deci nu blochează nimic azi.
- **Pixelul din exemplul Meta** e fals (zerouri), deci portalul avertizează că
  site-ul trimite evenimentele către alt pixel. E avertismentul corect: la un
  plan real, pune pixelul site-ului. Exemplul TikTok folosește deja codul
  pixelului TikTok al site-ului.
- **Utilitarul de test `cdp.mjs`** din directorul temporar al sesiunii a fost
  suprascris de agentul de documentare TikTok; l-am refăcut din istoricul
  sesiunii. Nu atinge repo-ul.
- **`PLAN.md` și `.env.example` nu au fost atinse** — promptul limitează zona la
  fișierele portalului. La merge, notele de aici se pot trece în `PLAN.md`.
- **Panoul de lead-uri** nu are încă link spre `/admin/ads` (capul lui e în
  `(dash)/layout.tsx`, în afara zonei). Portalul are link înapoi spre lead-uri.

---

## Anexă — raportul fazei 5

### Ce face portalul acum (TikTok, spațiu cu token)

- **Verifică în TikTok:** contul și moneda, identitatea Spark (disponibilă, cu
  drept de „push”), pixelul după id sau după codul din site (și dacă a primit
  evenimentul), video-ul convertit, locațiile / limbile / interesele traduse în
  id-uri TikTok, suprapunerile de locații, avertismentul DSA.
- **Creează pe pauză:** copertă → campanie → grup → reclame (o cerere), toate cu
  `operation_status: DISABLE`, cu toate automatizările trimise explicit oprite.
- **Video nou din browser**, prin aceeași anticameră Supabase.
- **Cifre și status** în aceleași ecrane, cu rapoarte în ferestre de 30 de zile.
- **Structura:** `lib/ads/platform.ts` — acțiunile și sincronizarea aleg
  adaptorul după spațiu; Meta și TikTok au fiecare o singură cale de scriere,
  cu garda ei.

### Verificat (Chrome, pe TikTok și Supabase falși, build de producție)

- **Fluxul TikTok cap-coadă, 65 de verificări:** exemplul pe spațiul curent,
  verificarea (cont, identitate, pixel după cod, România, interes, limbă, video,
  DSA), crearea (4 cereri: copertă, campanie, grup, reclame — toate `DISABLE`,
  tokenul doar în antet), id-ul pixelului de 19 cifre trimis exact, dublura,
  planurile refuzate (identitate personalizată, buget sub 20, comportamente,
  identitate fără „push”, oraș suprapus peste țară), eroarea la jumătate
  (campania oprită, notată „parțial”, mesajul TikTok în română cu `request_id`),
  video nou (conversia, trecerea planului pe video, anticamera golită),
  biblioteca, sincronizarea (3 ferestre de ≤30 de zile pentru 70 de zile,
  statusul `secondary_status`, campania ștearsă găsită).
- **Garda:** `verify-paused.mjs` — 48 de verificări (Meta și TikTok), fără rețea.
- **Regresii Meta:** creare, erori, urcare video, statistici — toate trecute.
- **Hidratare:** 0 erori în 48 de încărcări, în spațiul TikTok, la 1440 și 360.
- **Lățimi:** fără scroll orizontal la 360 pe listă, plan nou, verificare,
  statistici, fișa campaniei.
- TypeScript strict și ESLint fără erori; build de producție.

### Neverificat — cere contul real

Lista din `lib/ads/README.md` → „Faza 5 → Neverificat încă”: linkul spre o
campanie anume, regiunile României la TikTok, video-urile mari prin link,
filtrul pentru campaniile șterse, refuzul fără plătitor.

### Surse

Documentația TikTok API for Business v1.3, citită pe 2026-09-25 din sursa
portalului lor (`business-api.tiktok.com/portal/docs`): campanie, grup,
reclamă, identități, pixeli, video, imagini, regiuni, raport integrat, coduri
de eroare, permisiuni, limite de cereri; centrul de ajutor TikTok pentru
plătitorul din UE.

---

## Anexă — raportul fazei 4

### Ce face portalul acum

- **Sincronizarea cifrelor** din Meta Insights în `ads_metrics_daily`: o cerere
  pe cont de reclame, ultimele 7 zile + golul de la ultima rulare reușită (prima
  rulare aduce tot, de la crearea campaniilor). Zilele mai vechi de 7 se scriu o
  singură dată și nu se mai ating. Statusul campaniei se citește din Meta.
  Fiecare rulare, în `ads_runs`.
- **Pornită de** cron (`/admin/ads/sincronizare`, cu `CRON_SECRET`) sau de
  „Sincronizează acum” din Statistici (spațiul curent, cel mult o dată la 2
  minute).
- **`/admin/ads/statistici`**: perioada (7 / 30 / 90 de zile), obiectivul,
  moneda; indicatorii cu schimbarea față de perioada dinainte; cheltuiala și
  rezultatele pe zi; tabelul pe campanii; toate cifrele pe zile, ca tabel.
- **`/admin/ads/[id]`**: fișa campaniei — ultimele 7 zile, totalul de la
  creare, graficele, tabelul, materialul și reclamele cum au fost trimise.
- **`/admin/ads`**: cheltuiala, rezultatele și statusul pe fiecare rând; rândul
  duce la fișă.

### Verificat (Chrome, pe Meta și Supabase falși, dev și producție)

- Sincronizarea: 4 campanii (două monede, două obiective), 204 zile scrise
  dintr-o singură cerere pe cont; a doua apăsare în 2 minute refuzată fără
  cerere la Meta; o resincronizare completă cu cifre schimbate de Meta a
  actualizat ziua de acum 2 zile (21,31 → 24,31 lei) și a lăsat neatinsă o zi de
  acum 40 de zile (27,35 lei) — fără nicio eroare de la trigger-ul din bază.
- Cron: 401 fără secret și cu secret greșit, 200 și sincronizare cu secretul bun.
- Statistici: obiective amestecate → afișări și clicuri, nu „rezultate”
  adunate; filtrat pe Lead-uri → „Lead-uri” / „Cost pe lead”; EUR separat de
  RON; graficul se citește și din săgeți.
- 360, 768, 1024, 1440, 1920 px fără derulare laterală a paginii (tabelele
  largi derulează în chenarul lor); tastatura; reduced-motion.
- Regresie: creare pe pauză, erori, urcare video — toate trec.
- Culoarea graficelor (`#3987e5`) validată cu scriptul din skill-ul `dataviz`.

### Hidratarea — cauza #418 și remediul

| Varianta (build de producție) | Încărcări cu #418 |
|---|---|
| Fără nimic (fișa campaniei) | ~1 din 4 (4/30, 6/16) |
| Granițe `<Suspense>` în layout | tot ~1 din 7 + erori noi `$RS` (streaming stricat) |
| Componente transparente la liste/tabele | 8 din 48 |
| Granițe pe secțiuni + componente transparente | 1 din 48 (în dev, problema s-a mutat pe `<main>`) |
| **Hidratare după `DOMContentLoaded`** (`hydrate-when-parsed.tsx`) | **0 din 128** (și 0 din 45 în dev) |

Cauza, dovedită pe pași: HTML-ul serverului e identic byte cu byte la o
încărcare bună și la una cu eroare; nimic din afara React nu atinge DOM-ul
înainte de eroare; cu cache-ul browserului oprit eroarea dispare; în dev, React
arată mereu același tipar (`<li>` unde aștepta `<ol>`, `<caption>` unde aștepta
`<table>`) cu stiva în `replaySuspendedUnitOfWork`. Next 15.5.26 are același
React canary, deci o actualizare minoră nu ajută.

## Anexă — raportul fazei 3

- **Urcarea**: la „Materialul” → „Fișier nou” → alegi fișierul (MP4/MOV, sub
  50 MB) → „Urcă în contul …”. Patru pași vizibili: urcare în portal (progres
  în MB, cu „Oprește urcarea”) → Meta copiază → Meta procesează → gata. La
  final planul trece singur pe video-ul din bibliotecă.
- **Tokenul nu ajunge în browser**: browserul primește doar un URL semnat
  Supabase pentru un singur fișier. Meta descarcă fișierul de la un link
  semnat, valabil 3 ore; fișierul se șterge când Meta spune „gata” sau
  „eroare”, iar urcările uitate, după 6 ore.
- **Garda**: `advideos` e a șasea muchie de scriere, tot prin `metaPost`;
  `verify-paused` are acum 23 de verificări.
- **Verificat** (Chrome, pe Meta și Supabase falși, dev și producție):
  urcare reușită până la „gata” și creare pe pauză cu video-ul urcat; Meta
  care descarcă abia după ce a răspuns (fișierul era încă acolo); fișier
  prea mare oprit în browser, fără nicio cerere; eroare de procesare Meta
  (mesajul lor, anticamera golită, „Urcă din nou”); oprire la jumătate (nimic
  rămas, nimic trimis la Meta); 360 și 1280 px fără scroll orizontal;
  tastatură (câmpul de fișier cu nume accesibil în română și focus vizibil);
  hidratare curată în 30 de încărcări; regresia fazei 2 trece.
- **Neverificat**: cu un fișier real, pe contul real — vezi README → „Faza 3”
  → „Neverificat încă”.

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
