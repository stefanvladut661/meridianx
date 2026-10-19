# Portalul de reclame — `/admin/ads`

Unealtă internă: lipești un plan de campanie în JSON — sau un lot de zeci de
planuri, scris într-o conversație cu Claude —, îl citești în română, îl
corectezi și îl creezi **pe pauză** în Meta, TikTok sau Google Ads (video pe
YouTube și, din faza 8, campanii de căutare). Plus un dashboard cu cifrele
campaniilor și, pe Google, întreținerea unui cont existent.

Ramurile: `feat/ads-portal` (fazele 1–7) și `feat/ads-google-search` (fazele
8–14, plecată din `feat/ads-portal`). Zona portalului: `app/(admin)/admin/ads/**`,
`lib/ads/**`, `components/ads/**` și migrările lui (6, 7, 8 și, din faza 8,
9 și următoarele). Din faza 6, cu voia omului, și: tag-ul Google Ads pe site
(`lib/google-tag.ts`), `vercel.json` (cron-ul) și CSP-ul din `next.config.ts` —
pe care fazele 8–14 **nu** le mai ating.

**Citește întâi `GHID.md`** — ce e de făcut după fiecare fază și ce e de hotărât.
Promptul complet al portalului e în `PROMPT.md`.

---

## Regula care nu se negociază

**Portalul creează campanii DOAR în stare PAUSED** (pe TikTok:
`operation_status: DISABLE`; pe Google: `status: PAUSED` pe campanie, grup și
reclame, într-o singură cerere atomică). Nu există cod, rută sau buton care să
pornească o campanie. Activarea o face omul, în Ads Manager / TikTok Ads
Manager / Google Ads. Dacă o funcție ar putea trimite statusul de pornire,
designul e greșit.

Consecința oricărei erori de cod trebuie să fie o campanie oprită, nu una care
arde buget. De aici și plafonul de buget pe spațiu de lucru: prinde un zero în
plus înainte ca planul să ajungă la platformă.

**Pe Google, din faza 9, două excepții strânse, fiecare cu garda ei** (vezi
„Faza 9”): **pauza** (`googlePause` poate trimite doar `status: PAUSED`, cu
`updateMask` exact `status`, pe campanii sau grupuri) și **adăugarea care nu
mărește cheltuiala** pe resurse existente (negative pe campanii, liste de
negative, acțiuni de conversie). Nimic altceva nu se modifică, nimic nu se șterge.

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
| 6 | Google Ads (Demand Gen, video pe YouTube), peste aceeași structură | ✅ `feat/ads-portal` — testat pe Google fals (API v26), încă nu pe contul real |
| 7 | Producția în masă: lotul, mai multe video-uri pe plan, „Pentru Claude”, tag-ul Google pe site | ✅ `feat/ads-portal` — testat cap-coadă pe build de producție, cu toate platformele false |
| 8 | Google Search: formatul `meridian-google-search/1`, validarea (cu conflictele negativelor), previzualizarea | ✅ `feat/ads-google-search` — fără niciun apel la Google |
| 9 | Garda nouă: pauza (`googlePause`), negativele pe campanii existente, listele de negative, conversiile; `verify-paused.mjs` extins | ✅ `feat/ads-google-search` — 164 de verificări, fără rețea |
| 10 | Google Search: verificarea cu `validateOnly` și crearea pe pauză a planului de căutare; planurile de căutare în lot; migrarea 9 | ✅ `feat/ads-google-search` — testat pe Google și Supabase falși |
| 11 | Contul existent (`/admin/ads/cont`): campaniile în toate stările, pauza, negativele pe campanii existente, auditul; jurnalul (migrarea 10) | ✅ `feat/ads-google-search` — testat pe Google și Supabase falși |

Commit separat după fiecare fază. Fazele 6 și 7 au fost cerute împreună („bagă și
Google, scopul e producția în masă”), deci au mers fără oprire între ele.

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
| `google/api.ts` | `server-only`: SINGURUL client Google Ads (REST v26). Cheia contului de serviciu → token de acces (JWT, o oră, în memorie). Citiri GAQL + exact două scrieri: `googleMutate` (atomic, cu `assertGooglePaused` înainte de rețea) și urcarea video pe YouTube. Fără update, fără delete. |
| `google/build.ts` | Planul → operațiile `googleAds:mutate` (buget, campanie Demand Gen, grup, public, criterii, materiale, reclame), cu id-uri temporare. Funcții pure. |
| `google/lookup.ts` | Citiri: contul (direct sau prin managerul MCC), conversiile, video-urile YouTube (oEmbed + materialele contului), biblioteca. |
| `google/targeting.ts` | Numele din plan → constantele Google (locații, limbi, segmente de interes). |
| `google/check.ts` | „Verifică în Google": tot ce trebuie să existe + TOATĂ crearea trimisă cu `validateOnly` (Google spune ce ar refuza, fără să creeze nimic). |
| `google/create.ts` | Crearea: o singură cerere atomică — totul sau nimic, totul pe pauză. |
| `google/logo.ts` | Sigla din plan (singura adresă din plan pe care o descarcă serverul): doar https public, PNG/JPEG, pătrată, ≥128×128, ≤5 MB. |
| `google/video.ts` | Video nou pe YouTube (canalul administrat de Google al contului, nelistat) și starea procesării. |
| `google/insights.ts` | Cifrele zilnice (GAQL pe `campaign`, segmentat pe zi) și statusul campaniilor. |
| `google/errors.ts` | Erorile Google spuse în română, cu mesajul lor și `requestId`. |
| `google/brief.ts` | Regulile Google din instrucțiunile pentru Claude. |
| `google/adapter.ts` | Google sub contractul din `platform.ts`. |
| `plan-batch.ts` | Lotul: citirea mai multor planuri, regula banilor (un lot = un proprietar), dublurile din lot, mesajul cu probleme pentru Claude. Izomorf. |
| `claude-brief.ts` | Instrucțiunile pentru conversația cu Claude — compuse din aceleași constante ca validarea — și formatul contextului conturilor. Izomorf. |
| `claude-context.ts` | `server-only`: contextul conturilor citit din platforme (conturi, pagini, pixeli/conversii, identități, video-uri). Doar citiri. |
| `google/search/limits.ts` | Faza 8. Limitele planului de căutare (titluri, cuvinte cheie, materiale, program, operații pe cerere), cu sursa în „Faza 8”. Aceleași în validare, previzualizare și instrucțiunile pentru Claude. Izomorf. |
| `google/search/schema.ts` | Faza 8. Schema Zod a planului de căutare — forma, cu limite largi; obiecte stricte. |
| `google/search/validate.ts` | Faza 8. Validarea în română: schema, regulile încrucișate (plafonul pe suma bugetelor, nume unice, program, anunțuri, materiale), conflictele negativelor, numărul de operații. Izomorf. |
| `google/search/negatives.ts` | Faza 8. Simularea potrivirii negativelor (amplă, frază, exactă) peste cuvintele pozitive; citirea listelor lipite în notația Google Ads Editor. Pură. |
| `google/search/labels.ts` | Faza 8. Locul unei căi din plan, spus cu numele din plan („Campania „Auto” › grupul „Montaj” › anunțul 1”). |
| `google/search/summary.ts` | Faza 8. Planul spus în română, din datele brute, pentru previzualizare. |
| `google/search/build.ts` | Faza 8. Planul → operațiile `googleAds:mutate` (liste comune, bugete, campanii SEARCH, criterii, grupuri, cuvinte, anunțuri responsive, materiale), cu id-uri temporare și rol pe fiecare operație. Pur, izomorf (numără și operațiile pentru previzualizare). |
| `google/search/text.ts` · `phone.ts` | Faza 8. Lungimea textelor cum o numără Google; cuvintele unui cuvânt cheie; caracterele nepermise; telefonul butonului de apel. |
| `google/search/example.ts` | Faza 8. Exemplul complet, comentat (firmă inventată, `example.com`, id-uri din zerouri). |
| `google/search/types.ts` | Faza 8. Ce ajunge în browser din verificarea și crearea unui plan de căutare. |
| `meta/paused.ts` (faza 9) | Garda Google extinsă: listele comune (doar negative), legăturile, materialele pe campanii noi, conversiile fără status, criteriile pe campanii existente doar negative; plus `assertGooglePauseOnly`, garda pauzei. |
| `google/api.ts` (faza 9) | `googlePause`: singura actualizare (`status: PAUSED`, `updateMask: "status"`), după garda ei; cererea `googleAds:mutate` stă într-o singură funcție privată (`sendMutate`). |
| `google/search/check.ts` | Faza 10. „Verifică în Google” pentru planul de căutare: contul și moneda, numele ocupate, conversiile de apel, locațiile și limbile, adresele, apoi tot planul cu `validateOnly`; amprenta. |
| `google/search/create.ts` | Faza 10. Crearea: o singură cerere atomică; un rând pe campanie în `ads_campaigns`, legate prin `plan_group_id`. |
| `google/search/urls.ts` | Faza 10. Adresele finale întrebate scurt (`HEAD`, 6 s, fără redirecționări urmărite, doar https public). |
| `google/targeting.ts` (faza 10) | `resolveLocations` și `resolveLanguages`, reutilizate de căutare; Demand Gen le folosește la fel ca înainte. |
| `google/account/read.ts` | Faza 11. Citirile pe un cont existent (GAQL): campaniile în toate stările cu cifrele pe 30 de zile și de la început, statusurile, cuvintele pozitive, negativele, listele de negative și cuvintele lor; auditul (`change_event`, utilizatorii, facturarea, conversiile). |
| `google/account/negatives.ts` | Faza 11. Lista lipită (notația Google Ads Editor), verificată; operațiile negativelor (pe campanii, în listă, legarea listei) și conflictele cu cuvintele active. Pur. |
| `google/account/service.ts` | Faza 11. Pauza (`googlePause`, după recitirea statusului) și negativele (pregătire cu `validateOnly` + amprentă, apoi trimitere). |
| `google/account/signals.ts` · `labels.ts` · `types.ts` | Faza 11. Semnalele auditului; numele în română ale valorilor Google; tipurile pentru browser. |
| `changes.ts` | Faza 11. Jurnalul modificărilor pe conturile Google (`ads_google_changes`, migrarea 10). |
| `meta/verify-paused.mjs` | `node lib/ads/meta/verify-paused.mjs` — verificarea regulii „doar pe pauză", pe Meta, TikTok și Google, plus producția în masă, căutarea, garda fazei 9 și negativele pe conturi existente (168 de verificări, fără rețea). |

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
| `google-meridian` | Meridian · Google | `GOOGLE_ADS_MERIDIAN` | 500 lei · 100 € |
| `google-clienti` | Clienți · Google | `GOOGLE_ADS_CLIENTI` | 2.500 lei · 500 € · 500 USD |

Pe Google, „tokenul" e JSON-ul unui **cont de serviciu** Google Cloud, adăugat
ca utilizator în contul Google Ads (sau în contul manager de deasupra) — vezi
„Google — contul de serviciu". Un cont de serviciu pe portofoliu păstrează
izolarea: cel al clienților nu vede contul agenției.

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

O schemă pentru toate trei platformele. Ce e comun stă la rădăcină; ce există doar pe
o platformă stă în `meta`, `tiktok` sau `google`. Spațiul spune platforma — nu există
câmp `platform` separat, ca să nu se poată contrazice.

| Câmp | Obligatoriu | Ce e |
|---|---|---|
| `format` | nu | `"meridian-ads/1"` |
| `workspace` | da | id din tabelul de mai sus |
| `ad_account` | da | Meta: `act_` + cifre (sau doar cifrele) · TikTok: advertiser_id · Google: 10 cifre (`123-456-7890`) |
| `campaign.name` · `.objective` · `.daily_budget` · `.currency` | da | obiective: `leads`, `traffic`, `sales`, `video_views`, `awareness`; buget pe zi în unități întregi ale monedei |
| `audience.locations[]` | da, minim 1 | `country` (code) · `region` (name, country) · `city` (name, country, `radius_km`) |
| `audience.age_min` / `age_max` | nu (18 / 65) | 18–65; 65 = „65+" |
| `audience.gender` | nu (`all`) | `all`, `male`, `female` |
| `audience.languages[]` | nu (orice) | coduri ISO 639-1: `ro`, `hu` |
| `audience.interests[]` / `behaviors[]` | nu | `{ "name": "…", "id"?: "…" }` — fără id, se caută după nume la creare; `behaviors` doar pe Meta |
| `conversion.pixel_id` · `.event` | da pentru `leads` și `sales` | pe Google, `pixel_id` = id-ul acțiunii de conversie; evenimente: `lead`, `contact`, `schedule`, `complete_registration`, `purchase`, `view_content` |
| `destination` | da | `{ "type": "website", "url": "https://…", "utm"?: { source, medium, campaign, content, term } }` |
| `creative.video` sau `creative.videos[]` | exact unul | `{ "source": "library", "video_id": "…" }` sau `{ "source": "upload", "file_name"?: "…" }`; `videos`: 1–10, reclamele = video × text (cel mult 20). Pe Google, `video_id` = id-ul YouTube (11 caractere) |
| `creative.thumbnail` | nu (`auto`) | `"auto"` sau `{ "url": "https://…" }` |
| `creative.primary_texts[]` | da, 1–5 | pe TikTok ≤100 de caractere; pe Google devin titluri lungi, ≤90 |
| `creative.headlines[]` / `descriptions[]` | nu, 0–5 (pe Google: da, 1–5) | Meta și Google (≤40 / ≤90); TikTok nu le are |
| `creative.cta` | da | `learn_more`, `get_quote`, `contact_us`, `sign_up`, `apply_now`, `subscribe`, `download` |
| `creative.variants` | nu (`one_ad_per_text`) | sau `platform_rotates` (Meta la Lead-uri/Vânzări; Google — recomandat) |
| `meta.page_id` | da pe Meta | |
| `meta.instagram_account_id` · `special_ad_categories[]` · `advantage_audience` · `placements` | nu | `advantage_audience` implicit `false`; `placements` implicit `"automatic"` |
| `meta.enhancements` | nu — **toate `false`** | `advantage_creative`, `ad_sources`, `multi_advertiser_ads` |
| `meta.dsa_beneficiary` · `meta.dsa_payor` | da în UE, dacă contul n-are valori implicite | cine beneficiază și cine plătește reclama (DSA) — apar pe reclamă |
| `tiktok.identity_type` · `identity_id` | da pe TikTok | `TT_USER` sau `BC_AUTH_TT` (Spark Ads); `CUSTOMIZED_USER` se respinge — TikTok n-o mai acceptă |
| `tiktok.identity_bc_id` | da la `BC_AUTH_TT` | Business Center-ul care a autorizat contul TikTok |
| `tiktok.placements` | nu (`tiktok_only`) | sau `automatic` |
| `tiktok.enhancements` | nu — **toate `false`** | `automatic_enhancements`, `auto_add_assets`, `translate_and_dub`, `music_refresh` |
| `google.business_name` · `logo_url` | da pe Google | numele firmei (≤25) și sigla: imagine https pătrată, ≥128×128, PNG/JPEG |
| `google.channels` | nu (`"all"`) | sau o listă: `youtube_in_stream`, `youtube_in_feed`, `youtube_shorts`, `discover`, `gmail`, `display` |
| `google.optimized_targeting` | nu (`false`) | lărgirea automată a publicului |
| `google.enhancements` | nu — **toate `false`** | `video_enhancements`, `text_assets` |

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

### Exemplul complet, comentat — Google, Leads, video pe YouTube

Sursa: `example-plan.ts` (`EXAMPLE_PLAN_GOOGLE`). Id-urile sunt false; video-ul e unul public, de test.

```jsonc
{
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

## Faza 6 — Google Ads

Campanii **Demand Gen** — reclame video pe YouTube (înainte și în timpul
video-urilor, în fluxul de video-uri, în Shorts), opțional și pe Discover, Gmail
și rețeaua de display. Google Ads API **v26** (2026-10-14), REST, fără bibliotecă.

### Drumul, pe ecran

Spațiul „Meridian · Google” → „Plan nou” → „Încarcă exemplul” (sau lotul) →
**Verifică în Google**: contul (direct sau prin managerul MCC al contului de
serviciu), moneda, acțiunea de conversie (există, e principală, vine de pe site,
are eticheta pe care o trimite site-ul), video-urile YouTube (publice sau
nelistate), sigla, fiecare nume din targetare — apoi TOATĂ crearea trimisă cu
`validateOnly`: Google spune exact ce ar refuza, fără să creeze nimic. Erorile
Google ajung pe câmpul din plan care le-a produs. **Creează pe pauză** → o
singură cerere atomică → „Creată. Oprită.” + linkul spre Google Ads.

### Autentificarea — fără developer token

Din **2026-09-09**, Google Ads API nu mai folosește developer token: accesul
ține de **proiectul Google Cloud** (nivelurile Test / Explorer / Basic /
Standard). Portalul nu trimite antetul `developer-token`.

Cheia spațiului (`GOOGLE_ADS_MERIDIAN`) = fișierul JSON al unui **cont de
serviciu** (`"type": "service_account"`), lipit ca atare sau în base64. Contul de
serviciu se adaugă direct ca utilizator în Google Ads (din 2024, fără Google
Workspace) — echivalentul System User-ului de la Meta: nu expiră, nu depinde de
parola cuiva, nu cere 2FA. Merge și JSON-ul `authorized_user` (refresh token)
dat de `gcloud auth application-default login`. Tokenul de acces (JWT RS256 →
`oauth2.googleapis.com/token`, o oră) stă doar în memoria procesului.

Contul din plan se găsește singur: dacă cheia îl vede direct, fără
`login-customer-id`; altfel prin managerii pe care îi vede cheia
(`customer_client`), cu `login-customer-id` = managerul. Nimic de configurat.

### Maparea pe Google Ads API v26

| Plan | Google |
|---|---|
| `campaign.daily_budget` | `CampaignBudget.amountMicros` (multiplu de 10.000), `explicitlyShared: false` (implicit Google l-ar face partajat, iar Demand Gen refuză bugete partajate), `period: DAILY` |
| `campaign.objective` | `leads`/`sales` → `maximizeConversions` (conversiile principale ale contului); `traffic` → `targetSpend` (Maximize clicks, fără plafon de CPC). `video_views`/`awareness` → **refuzate**: campaniile Video nu se pot crea din API, în nicio formă |
| — | `advertisingChannelType: DEMAND_GEN`, `status: PAUSED`, `containsEuPoliticalAdvertising: DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING` (obligatoriu în UE), `demandGenCampaignSettings.upgradedTargeting: true` |
| grupul | `AdGroup` cu `status: PAUSED`, `optimizedTargetingEnabled: false`, `audienceSetting.useAudienceGrouped: true`, `demandGenAdGroupSettings.channelControls` (`ALL_CHANNELS` sau `selectedChannels` cu toate cele 7 canale, `maps: false`) |
| `audience.locations` / `languages` | criterii pe grup: `location.geoTargetConstant` (țările: 2000 + codul ISO, RO = 2642; orașele și regiunile: `geoTargetConstants:suggest`), `language.languageConstant` (ro = 1032). **Fără rază**: Demand Gen nu are rază pe grup — avertisment |
| `audience.interests` + vârsta + genul | UN `Audience` pe grup (`audienceSegments.userInterest`, `age.ageRanges` pe grupele Google, `gender`), atașat cu `AdGroupCriterion.audience`. Vârsta necunoscută rămâne afară (`includeUndetermined: false`): vârsta din plan e o limită |
| `creative.videos` | materiale `youtubeVideoAsset` (refolosite dacă sunt deja în cont), 1–5 pe reclamă |
| `google.logo_url` | material `imageAsset.data` (base64), refolosit dacă aceeași siglă e deja în cont (după amprenta fișierului) |
| `creative.cta` | material `callToActionAsset` (toate cele 7 butoane există pe Google) |
| reclama | `AdGroupAd` cu `status: PAUSED` + `demandGenVideoResponsiveAd`: `primary_texts` → `longHeadlines` (≤90), `headlines` (≤40), `descriptions` (≤90), `businessName` (≤25), `logoImages`, `videos`, `callToActions`; `finalUrls` = pagina, UTM în `finalUrlSuffix` |
| `google.enhancements` | pe REclamă (pe campanie, setările sunt doar pentru PMax/Search): `adGroupAdAssetAutomationSettings` cu `OPTED_OUT` pentru `GENERATE_VERTICAL_YOUTUBE_VIDEOS`, `GENERATE_SHORTER_YOUTUBE_VIDEOS` (video) și `GENERATE_LANDING_PAGE_TEXT`, `GENERATE_LANDING_PAGE_PREVIEW` (texte) |
| `variants` | `platform_rotates` (recomandat pe Google) = o reclamă cu toate textele și video-urile; `one_ad_per_text` = video × text, fiecare cu toate titlurile și descrierile |

Garda (`assertGooglePaused`): doar operații `create`, doar tipurile din listă;
campania, grupul și reclamele trebuie să aibă `PAUSED`; ORICE alt câmp `status`
e refuzat — un criteriu „oprit” ar lărga publicul; resursele trebuie să fie în
contul din URL. `partialFailure` nu există în cod.

### Video nou: pe YouTube, prin Google Ads

„Fișier nou” pe Google: browser → anticamera Supabase (ca la Meta/TikTok) →
serverul ia fișierul (≤50 MB) și îl trimite la `YouTubeVideoUploadService`
(din v23.1): protocol „resumable”, pe **canalul administrat de Google al
contului**, **nelistat** — nu trebuie legat niciun canal YouTube. Starea se
citește din `you_tube_video_upload`; la `PROCESSED`, planul trece singur pe
id-ul YouTube (11 caractere). Fișierul din anticameră se șterge la final.

### Cifrele pe Google

GAQL pe `campaign`, segmentat pe zi: cheltuiala = `metrics.cost_micros` /
1.000.000, clicurile, afișările, rezultatele = `metrics.conversions` (Lead-uri,
Vânzări) sau clicurile (Trafic). Statusul: `campaign.status` (ENABLED / PAUSED /
REMOVED — Google întoarce și campaniile șterse).

### Limite

- **Explorer** (nivelul primit de obicei imediat): 2.880 de operații pe zi pe
  conturi reale. O verificare + o creare costă câteva zeci. Pentru volum mare:
  **Basic** (15.000/zi; cere verificarea mărcii proiectului Google Cloud).
- O adresă de email (deci un cont de serviciu) poate fi adăugată în cel mult
  20 de conturi Google Ads; peste, se pune în contul manager (MCC).
- Organizațiile Google Cloud create după 2024-05-03 blochează implicit cheile
  conturilor de serviciu (`iam.managed.disableServiceAccountKeyCreation`); un
  proiect pe un cont Gmail obișnuit nu are blocajul.
- Din 2026-04-01, o singură campanie fără declarația UE din cont blochează
  orice creare din API — portalul o declară mereu; campaniile vechi se declară
  din Google Ads.

### Neverificat încă — se confirmă la prima campanie reală

1. `Audience` cu id temporar în aceeași cerere atomică (nu apare în exemplele
   oficiale). Dacă Google îl refuză, `validateOnly` spune exact asta.
2. Linkul spre o campanie anume: Google nu documentează unul (`ocid` nu se poate
   citi din API). Linkul deschide campaniile contului; dacă ignoră parametrii,
   campania se caută după nume.
3. Câte reclame primește un grup Demand Gen (nedocumentat; portalul face cel
   mult 20) și câte titluri/descrieri primește o reclamă (5, după surse
   neoficiale).
4. Bugetul minim zilnic Demand Gen în lei (Google îl refuză la `validateOnly`
   dacă e prea mic).
5. Urcarea pe YouTube: calea `/resumable/upload/v26/…` (exemplul oficial) și
   timpul de procesare.
6. oEmbed-ul YouTube (folosit ca să spună „privat” / „șters” înainte de Google)
   nu e documentat; decizia finală o ia `validateOnly`.

---

## Faza 7 — producția în masă

Planurile se scriu într-o conversație cu Claude; portalul le verifică pe conturile
reale și le creează oprite. Trei piese:

### „Pentru Claude” (`/admin/ads/claude`)

- **Instrucțiunile**: formatul planului, regulile fiecărei platforme, plafoanele,
  limitele de text, exemplele complete — compuse din aceleași constante ca
  validarea (`claude-brief.ts`), deci nu pot rămâne în urma codului.
- **Contextul conturilor**: citit acum, cu tokenul fiecărui spațiu al
  proprietarului de pe ecran — conturile, paginile și Instagramul (Meta),
  identitățile TikTok, pixelii, acțiunile de conversie Google, video-urile din
  biblioteci, cu id-urile lor. TikTok nu-și poate lista conturile: advertiser_id-ul
  se scrie o dată în pagină (sau vine din campaniile create deja).
- „Copiază tot” → se lipește la începutul conversației cu Claude.

### Lotul (`/admin/ads/lot`)

- Primește `[ {…}, {…} ]` sau `{ "plans": [ … ] }`, cel mult 50 de planuri.
- **Regula banilor**: un lot e al UNUI proprietar (Meridian sau Clienți — cel al
  spațiului de sus); platformele se pot amesteca. Pe server, fiecare plan se
  validează și se verifică în spațiul scris în el, iar proprietarul se compară
  cu al cookie-ului.
- „Verifică tot” → plan cu plan, pe conturile reale. „Creează pe pauză (N)” →
  confirmare cu numărul de campanii pe spațiu și bugetul zilnic total → creare
  plan cu plan, cu „Oprește după planul ăsta”.
- **Dublurile**: un plan identic în lot e o eroare; un plan creat deja în
  ultimele 14 zile se sare („Creată deja — sărită”), nu se dublează — un lot
  lipit a doua oară, după două corecturi, nu creează din nou celelalte opt.
- „Copiază problemele pentru Claude” → mesajul cu toate problemele (validare,
  verificare, creare), pe planuri, gata de lipit în conversație.
- Un lot lipit în „Plan nou” se mută aici cu un clic.

### Mai multe video-uri într-un plan

`"videos": [ {…}, {…} ]` în locul lui `"video"` (1–10). Reclamele = video × text,
toate în același set — platforma împarte bugetul spre ce merge. Cel mult 20 de
reclame pe plan. Pe Meta și TikTok, fiecare video are coperta lui (propusă de
platformă); cu mai multe video-uri, `thumbnail` rămâne `"auto"`. În formular,
„+ încă un video” transformă planul.

### Tag-ul Google Ads pe site

`lib/google-tag.ts` + `<GoogleTag />`: gtag.js se încarcă doar după „Acceptă
tot” (categoria marketing) și doar cu `NEXT_PUBLIC_GOOGLE_ADS_LEAD` setat
(`AW-…/eticheta` conversiei Lead). Consent Mode v2, implementarea „basic”:
starea implicită refuzată, apoi alegerea omului, apoi `config`. La lead
confirmat de server: `gtag('event', 'conversion', { send_to, transaction_id: id-ul lead-ului })`.
Retragerea acordului trimite `consent update` cu denied și scoate scriptul.
Politicile de confidențialitate și cookie-uri (RO + EN) menționează Google.

---

## Faza 8 — planul de căutare (`meridian-google-search/1`)

Căutarea are altă formă decât video: mai multe campanii într-un cont, grupuri,
cuvinte cheie, sute de negative, anunțuri text, materiale. Primește deci **un
format separat**, cu schema lui (`google/search/`); `planSchema` și căile Meta și
TikTok nu se schimbă. `plan-json.ts` recunoaște formatul după `format`: un plan
de căutare lipit în „Plan nou” se mută cu un clic pe pagina **„Căutare”**
(`/admin/ads/cautare`), iar un plan video lipit acolo se mută înapoi.

**Un plan = un cont = mai multe campanii, create într-o singură cerere atomică**
(totul sau nimic). Pe ecran: JSON-ul în stânga; în dreapta, sus, totalul
(campanii, grupuri, cuvinte cheie, negative, anunțuri, operații), suma bugetelor
față de plafonul spațiului și cât consumă planul din operațiile zilnice ale
proiectului Google Cloud; apoi listele comune și fiecare campanie — buget,
licitare, zone și modul de locație, program, rețele, liste legate, negative,
materiale — cu grupurile strânse: cuvintele cheie cu tipul de potrivire,
negativele grupului și **anunțul arătat ca rezultat de căutare Google**, cu
titlurile fixate pe poziția lor și „Altă combinație”. Corecturile se fac în
JSON (sau în conversația din care a venit planul): un plan cu 200 de cuvinte
cheie nu se corectează mai repede într-un formular.

### Formatul

Exemplul complet, comentat (sursa: `google/search/example.ts`; se lipește cu
comentarii cu tot):

```jsonc
{
  // Obligatoriu: așa recunoaște portalul un plan de căutare.
  "format": "meridian-google-search/1",

  // google-meridian sau google-clienti — cel din selectorul de sus.
  "workspace": "google-clienti",

  // Contul Google Ads al clientului, 10 cifre (dreapta sus în Google Ads).
  "ad_account": "000-000-0000",

  // RON | EUR | USD — trebuie să fie moneda contului.
  "currency": "RON",

  // Liste comune de negative: create o dată în cont, legate de oricâte campanii.
  // "key" e numele lor în plan (îl folosesc campaniile); "name", numele din Google Ads.
  "shared_negative_lists": [
    {
      "key": "irelevante",
      "name": "NEG - Irelevante",
      "keywords": [
        { "text": "angajari", "match": "broad" },
        { "text": "locuri de munca", "match": "phrase" },
        { "text": "gratis", "match": "broad" },
        { "text": "pdf", "match": "broad" },
        { "text": "second hand", "match": "phrase" }
      ]
    }
  ],

  "campaigns": [
    {
      // Cheia campaniei în plan (litere mici, cifre, - și _).
      "key": "centrale",
      // Numele din Google Ads — unic în cont.
      "name": "Termo Exemplu - Centrale termice - Cluj - Search",
      // Pe zi, în moneda contului. Plafonul spațiului se aplică pe SUMA campaniilor.
      "daily_budget": 40,
      // maximize_clicks (cu plafon opțional pe clic) sau manual_cpc (max_cpc = licitarea grupurilor).
      "bidding": { "strategy": "maximize_clicks", "max_cpc": 2.5 },
      // Doar căutarea Google: fără parteneri, fără display.
      "networks": { "search_partners": false, "display": false },
      // Țară, regiune sau oraș — întregi, fără rază.
      "locations": [ { "type": "region", "name": "Cluj", "country": "RO" } ],
      "excluded_locations": [],
      // presence = oamenii aflați în zonă; presence_or_interest = și cei interesați de ea, de oriunde.
      "location_mode": "presence",
      "languages": ["ro"],
      // Lipsă sau gol = oricând. Orele din 15 în 15 minute; "24:00" = miezul nopții.
      "schedule": [
        { "days": ["mon", "tue", "wed", "thu", "fri"], "from": "08:00", "to": "19:00" },
        { "days": ["sat"], "from": "09:00", "to": "14:00" }
      ],
      // Listele comune legate de campanie (cheile de mai sus).
      "negative_lists": ["irelevante"],
      // Negative doar pe campania asta: căutările de aer condiționat merg în cealaltă campanie.
      "negatives": [
        { "text": "aer conditionat", "match": "phrase" },
        { "text": "climatizare", "match": "broad" }
      ],
      // UTM pe toată campania (inclusiv linkurile suplimentare). Un grup îl poate înlocui.
      "utm": { "source": "google", "medium": "cpc", "campaign": "centrale-cluj" },
      "assets": {
        // Linkuri suplimentare: text ≤25; descrierile (≤35) — amândouă sau niciuna. Recomandat: cel puțin 4.
        "sitelinks": [
          { "text": "Programează o revizie", "description1": "Alegi ziua și ora online", "description2": "Confirmăm în aceeași zi", "url": "https://www.example.com/revizie/" },
          { "text": "Montaj centrale", "description1": "Montaj autorizat ISCIR", "description2": "Probe și punere în funcțiune", "url": "https://www.example.com/montaj/" },
          { "text": "Prețuri", "description1": "Tarife clare, fără surprize", "description2": "Deplasare inclusă în Cluj", "url": "https://www.example.com/preturi/" },
          { "text": "Contact", "description1": "Sună sau scrie-ne", "description2": "Răspundem în aceeași zi", "url": "https://www.example.com/contact/" }
        ],
        // Mesaje scurte: ≤25 de caractere fiecare.
        "callouts": ["Autorizați ISCIR", "Deplasare în tot județul", "Garanție la manoperă", "Programări și sâmbăta"],
        // Fragmente structurate: antetul dintr-o listă fixă (brands, models, services, types…), 3–10 valori ≤25. Se trimite în limba campaniei.
        "snippets": [
          { "header": "services", "values": ["Montaj centrale", "Revizii anuale", "Reparații", "Coșuri de fum"] }
        ],
        // Butonul de apel: telefonul și, opțional, acțiunea de conversie „apeluri din anunțuri”.
        "call": { "country": "RO", "phone": "0700 000 000", "conversion_action_id": "000000000" }
      },
      "ad_groups": [
        {
          // Numele grupului — unic în campanie.
          "name": "Montaj centrale - Cluj",
          "final_url": "https://www.example.com/montaj/",
          // Cuvintele cheie: broad (amplă), phrase (frază), exact (exactă). ≤80 de caractere, ≤10 cuvinte.
          "keywords": [
            { "text": "montaj centrala termica cluj", "match": "phrase" },
            { "text": "montaj centrala termica", "match": "exact" },
            { "text": "instalare centrala termica cluj", "match": "phrase" }
          ],
          "negatives": [],
          // Până la 3 anunțuri responsive pe grup. Titluri: 3–15, ≤30; descrieri: 2–4, ≤90; căile: ≤15.
          "ads": [
            {
              "headlines": [
                // "pin": 1 = mereu primul. Fixează doar ce trebuie să apară mereu.
                { "text": "Montaj Centrale în Cluj", "pin": 1 },
                { "text": "Instalatori Autorizați ISCIR" },
                { "text": "Ofertă în Aceeași Zi" },
                { "text": "Montaj și Punere în Funcțiune" },
                { "text": "Deplasare în Tot Județul" },
                { "text": "Garanție la Manoperă" },
                { "text": "Programează-te Online" },
                { "text": "Sună Acum pentru Ofertă" },
                { "text": "Centrale în Condensare" },
                { "text": "Verificare la Fața Locului" }
              ],
              "descriptions": [
                "Montăm centrala, facem probele și o punem în funcțiune. Totul cu acte, în Cluj.",
                "Vedem locul înainte de ofertă și îți spunem exact ce trebuie schimbat.",
                { "text": "Programări de luni până sâmbătă. Sună sau scrie-ne pe site.", "pin": 2 }
              ],
              "path1": "montaj",
              "path2": "cluj"
            }
          ]
        },
        {
          "name": "Revizie centrale - Cluj",
          "final_url": "https://www.example.com/revizie/",
          "keywords": [
            { "text": "revizie centrala termica cluj", "match": "phrase" },
            { "text": "revizie centrala", "match": "exact" },
            { "text": "service centrala termica cluj", "match": "phrase" }
          ],
          "negatives": [ { "text": "montaj", "match": "broad" } ],
          "ads": [
            {
              "headlines": [
                { "text": "Revizie Centrală în Cluj", "pin": 1 },
                { "text": "Revizie Anuală cu Acte ISCIR" },
                { "text": "Programare în 2 Minute" },
                { "text": "Tehnicieni Autorizați" },
                { "text": "Verificăm și Coșul de Fum" },
                { "text": "Deplasare în Tot Județul" },
                { "text": "Programări și Sâmbăta" },
                { "text": "Sună Acum" }
              ],
              "descriptions": [
                "Revizia anuală obligatorie, cu procesul-verbal ISCIR. Programezi online sau la telefon.",
                "Curățăm, reglăm și verificăm siguranța centralei. Îți spunem pe loc ce mai are nevoie."
              ],
              "path1": "revizie",
              "path2": "cluj"
            }
          ]
        }
      ]
    },
    {
      "key": "aer-conditionat",
      "name": "Termo Exemplu - Aer conditionat - Cluj - Search",
      "daily_budget": 25,
      "bidding": { "strategy": "maximize_clicks", "max_cpc": 2 },
      "locations": [ { "type": "city", "name": "Cluj-Napoca", "country": "RO" } ],
      "languages": ["ro"],
      "schedule": [ { "days": ["mon", "tue", "wed", "thu", "fri", "sat"], "from": "08:00", "to": "20:00" } ],
      "negative_lists": ["irelevante"],
      "negatives": [ { "text": "centrala", "match": "broad" } ],
      "assets": {
        "sitelinks": [
          { "text": "Montaj aer condiționat", "description1": "Montaj standard într-o zi", "description2": "Fără praf, fără surprize", "url": "https://www.example.com/aer-conditionat/" },
          { "text": "Igienizare", "description1": "Curățare și dezinfectare", "description2": "Recomandat o dată pe an", "url": "https://www.example.com/igienizare/" },
          { "text": "Prețuri", "url": "https://www.example.com/preturi/" },
          { "text": "Contact", "url": "https://www.example.com/contact/" }
        ],
        "callouts": ["Montaj într-o zi", "Garanție la manoperă"],
        "snippets": [
          { "header": "types", "values": ["Inverter", "Multisplit", "Pe tavan", "Pe perete"] }
        ],
        "call": { "country": "RO", "phone": "0700 000 000", "conversion_action_id": "000000000" }
      },
      "ad_groups": [
        {
          "name": "Montaj aer conditionat - Cluj",
          "final_url": "https://www.example.com/aer-conditionat/",
          "utm": { "source": "google", "medium": "cpc", "campaign": "ac-cluj" },
          "keywords": [
            { "text": "montaj aer conditionat cluj", "match": "phrase" },
            { "text": "montaj aer conditionat", "match": "exact" },
            { "text": "pret montaj aer conditionat", "match": "phrase" }
          ],
          "ads": [
            {
              "headlines": [
                { "text": "Montaj Aer Condiționat Cluj", "pin": 1 },
                { "text": "Montaj Standard într-o Zi" },
                { "text": "Preț Clar Înainte de Montaj" },
                { "text": "Garanție la Manoperă" },
                { "text": "Inverter și Multisplit" },
                { "text": "Programează-te Online" },
                { "text": "Sună Acum pentru Ofertă" },
                { "text": "Fără Praf, Fără Surprize" }
              ],
              "descriptions": [
                "Montăm aparatul într-o zi, cu traseu curat și probe la final. Prețul îl știi dinainte.",
                "Te ajutăm să alegi puterea potrivită pentru cameră. Programări de luni până sâmbătă."
              ],
              "path1": "aer-conditionat",
              "path2": "cluj"
            }
          ]
        }
      ]
    }
  ]
}
```

| Câmp | Ce e |
|---|---|
| `format` | **obligatoriu**: `"meridian-google-search/1"` — așa se recunoaște planul |
| `workspace` · `ad_account` · `currency` | spațiul Google, contul (10 cifre), moneda contului |
| `shared_negative_lists[]` | `{ key, name, keywords[] }` — liste comune de negative, create în cont și legate de campanii prin `key` |
| `campaigns[].key` · `.name` | cheia în plan (litere mici, cifre, `-`, `_`) și numele din Google Ads (unic în cont) |
| `.daily_budget` | pe zi, în moneda contului; **plafonul spațiului se aplică pe SUMA campaniilor** |
| `.bidding` | `{ strategy: "maximize_clicks", max_cpc? }` (plafon pe clic, opțional) sau `{ strategy: "manual_cpc", max_cpc }` (licitarea implicită a grupurilor) |
| `.networks` | `{ search_partners: false, display: false }` — implicit doar căutarea Google |
| `.locations[]` · `.excluded_locations[]` | țară (`code`), regiune sau oraș (`name`, `country`, `key?`) — întregi, fără rază |
| `.location_mode` | `presence` (implicit: oamenii din zonă) sau `presence_or_interest` |
| `.languages[]` | coduri ISO (`ro`); lipsă = toate limbile (avertisment) |
| `.schedule[]` | `{ days: ["mon"…"sun"], from: "07:30", to: "19:00" }`; lipsă = oricând |
| `.negative_lists[]` · `.negatives[]` | cheile listelor comune legate; negativele campaniei |
| `.assets` | `sitelinks[] { text, description1?, description2?, url }`, `callouts[]`, `snippets[] { header, values[] }`, `call { country, phone, conversion_action_id? }` |
| `.utm` | UTM pe toată campania (inclusiv linkurile suplimentare), în `finalUrlSuffix` |
| `.ad_groups[]` | `{ name, final_url, utm?, max_cpc?, keywords[], negatives[], ads[] }` |
| `.ads[]` | `{ headlines[{ text, pin? }], descriptions["…" sau { text, pin? }], path1?, path2?, final_url? }` |
| cuvinte cheie | `{ text, match }`, cu `match` = `broad` (amplă), `phrase` (frază) sau `exact` (exactă) |

Aceleași reguli de citire ca la planul video: obiecte stricte („ai vrut…?”),
id-uri ca text, `null` = lipsă, toate problemele odată, în română, cu numele din
plan în mesaj („Campania „…” › grupul „…” › anunțul 1 › titlul 5 („…”): 34 de
caractere, maximum 30.”).

### Ce verifică (fără niciun apel la Google)

Limitele vin din `google/search/limits.ts` — aceleași în validare și în
instrucțiunile pentru Claude. Verificate pe referința v26 (2026-10-19):

| Ce | Regula | Sursa |
|---|---|---|
| Anunțul responsive | 3–15 titluri ≤30, 2–4 descrieri ≤90, `path1`/`path2` ≤15, `path2` cere `path1`; fixări doar pe titlurile 1–3 și descrierile 1–2; titluri și descrieri **unice**; pozițiile 1–2 (titluri) și 1 (descrieri) trebuie să poată fi ocupate; cel mult 3 anunțuri pe grup | ResponsiveSearchAdInfo; ghidul „Create responsive search ads” (v26) |
| Numărarea | doar caracterele „late” (chineză, japoneză, coreeană) contează dublu; diacriticele contează câte unul; textul se aduce la NFC | Google Ads Help 7684791 |
| Cuvintele cheie | ≤80 de caractere, ≤10 cuvinte; nepermise: `@`, `\`, `^`, `,`, `=`, `!`, backtick, `<`, `>`, `[`, `]`, `(`, `)`, `%`, bara verticală, `?`, `;`, `~`, acoladele, ghilimelele; `*` doar în negative | CriterionError (v26); Google Ads Help 2453981; Search Ads 360 Help 9322598 |
| Listele comune | 20 de liste pe cont, 5.000 de cuvinte pe listă; 10.000 de negative pe campanie | ghidul Shared sets (v26); Google Ads Help 6372658 |
| Materialele | link suplimentar: text ≤25, descrieri ≤35, **amândouă sau niciuna**; mesaj scurt ≤25; fragment: antet din lista predefinită, 3–10 valori ≤25; telefon (RO: 10 cifre, fără 09…) | SitelinkAsset, CalloutAsset, StructuredSnippetAsset, CallAsset (v26) |
| Programul | ore 0–24, minute 00/15/30/45, „24:00” = sfârșitul zilei; cel mult 6 intervale pe zi; fără suprapuneri | AdScheduleInfo (v26) |
| Cererea | cel mult **10.000 de operații** într-un `googleAds:mutate`; peste = eroare, **fără împărțire** (s-ar pierde „totul sau nimic”) | Quotas; rate sheet (v26) |

**Conflictele cu negativele.** Pe fiecare campanie, negativele grupului, ale
campaniei și ale listelor legate se potrivesc peste cuvintele cheie pozitive:
amplă = toate cuvintele negativului apar în cuvânt (orice ordine), frază = apar
unul după altul, exactă = identic; fără variante apropiate (`pret` nu blochează
`preț`). Un cuvânt blocat de propriile negative e **eroare**, cu negativul și
locul lui („… e blocat de lista „NEG - Irelevante”: negativul cluj”). Cu ș/ț
scrise cu sedilă într-o parte, e doar avertisment.

**Avertismente:** partenerii de căutare sau rețeaua de display pornite, modul
`presence_or_interest`, fără limbă, „Maximizează clicurile” fără plafon, CPC peste
20 lei / 5 € (un zero în plus?), un clic mai scump decât bugetul zilei, sub 8
titluri, prea multe titluri fixate, domenii diferite în aceeași campanie, sub 4
linkuri suplimentare, buton de apel fără acțiune de conversie, același cuvânt
cheie în două grupuri ale campaniei.

**Operațiile.** Previzualizarea arată câte operații produce planul (din aceeași
construcție care pleacă la Google) și cât consumă din cele 2.880 pe zi ale
nivelului Explorer: verificarea și crearea consumă fiecare numărul întreg. Un
plan cu 4 campanii și ~750 de operații = ~1.500 pe zi cu o verificare și o creare.

### Antetele fragmentelor structurate

Cheile din plan sunt în engleză (`brands`, `models`, `services`, `types`,
`amenities`, `courses`, `degree_programs`, `destinations`, `featured_hotels`,
`insurance_coverage`, `neighborhoods`, `shows`, `styles`); antetul trimis la
Google e cel din lista oficială, **în limba campaniei**: la o campanie cu prima
limbă `ro` — „Mărci”, „Modele”, „Servicii”, „Tipuri”, „Dotări”…; altfel cel
englezesc. (Lista „Structured snippet headers”, v26.)

### Neverificat încă — se confirmă la prima creare reală

1. Dacă un antet românesc e **obligatoriu** pentru anunțurile în română (cele
   localizate sunt acceptate; portalul le trimite pe ele).
2. Dacă cererile cu `validateOnly` se numără în operațiile zilnice (nedocumentat;
   exemplul oficial de limită o sugerează — portalul presupune că da).
3. Dacă `asset.finalUrls` e strict obligatoriu pe un link suplimentar (exemplul
   oficial îl pune; portalul îl pune mereu).

---

## Faza 9 — garda nouă: pauza, negativele pe resurse existente, conversiile

Până acum portalul doar crea, pe pauză. Fazele 10–13 cer trei lucruri noi pe
Google: crearea planului de căutare (liste comune, legături, materiale),
**pauza** campaniilor existente și **negative adăugate pe campanii care rulează**.
Fiecare are o regulă scrisă în gardă, nu în constructori — garda nu se bazează pe
cod, îl verifică.

| Ce | Unde | Regula |
|---|---|---|
| Crearea | `googleMutate` → `assertGooglePaused` (`meta/paused.ts`) | doar `create`, doar tipurile din `GOOGLE_CREATE_OPERATIONS`; campanie, grup, anunț cu `PAUSED`; orice alt `status` refuzat; toate resursele în contul din URL |
| Grupuri, anunțuri, criterii de grup, materiale legate | aceeași gardă | doar în campanii / grupuri create **în aceeași cerere** (id temporar definit în cerere) |
| Criteriu pe o campanie **existentă** | aceeași gardă | permis DOAR `negative: true` + `keyword` și nimic altceva; orice criteriu pozitiv (cuvânt, locație, limbă, program) sau negativ de alt tip — refuzat |
| Liste comune | aceeași gardă | `sharedSetOperation` doar cu `type: NEGATIVE_KEYWORDS`; `sharedCriterionOperation` doar cu `keyword`, doar într-o listă de negative; `campaignSharedSetOperation` doar cu o listă de negative. O listă **existentă** trebuie să fie printre cele citite din cont chiar înainte (`shared_set.type = NEGATIVE_KEYWORDS`), trimise gărzii ca `negativeSharedSets` |
| Acțiunile de conversie | aceeași gardă | `conversionActionOperation.create`, fără status (nu cheltuie bani) |
| Pauza | `googlePause` → `assertGooglePauseOnly` | EXACT `{ campaignOperation | adGroupOperation: { update: { resourceName, status: "PAUSED" }, updateMask: "status" } }`, pe resurse existente din contul din URL. Orice alt câmp în mască sau în obiect, altă valoare, altă resursă, id temporar, `create` sau `remove` — refuzat |
| Nimic altceva | ambele gărzi | fără update pe bugete, licitări, cuvinte, anunțuri, setări; fără `remove` |

**O singură cerere spre Google.** `google/api.ts` are o singură funcție care
trimite `googleAds:mutate` (`sendMutate`), neexportată, chemată doar de
`googleMutate` (după garda creării) și de `googlePause` (după garda pauzei).
`googlePause` primește doar nume de resurse și își construiește singură
operațiile — un apelant nu-i poate strecura alt câmp.

**`verify-paused.mjs`** (rulat înainte de fiecare commit) are acum 164 de
verificări, fără rețea. Pe lângă cele de dinainte, încearcă și vede refuzate:
`ENABLED` pe campanie / grup / anunț, `status` pe un cuvânt cheie, pe o locație
sau pe legarea unui material, update pe buget, pauză cu alt câmp în mască, pauză
cu `ENABLED` sau `REMOVED`, pauză amestecată cu o creare, pauză pe un id temporar
sau pe altă resursă, criteriu pozitiv pe o campanie existentă (cuvânt, locație,
program, un negativ cu încă un criteriu ascuns), negativ într-un grup existent,
listă comună de alt tip decât negative (creată sau existentă, neverificată), alt
criteriu decât un cuvânt într-o listă, acțiune de conversie cu status sau
actualizată, `remove` pe campanie și pe criteriu. Și le vede trecute pe cele
permise: negativ pe o campanie existentă, listă de negative verificată legată de
o campanie existentă, cuvinte adăugate în ea, acțiune de conversie fără status,
pauza pe campanii și grupuri, toate cele 81 de operații ale exemplului de căutare.

---

## Faza 10 — planul de căutare: verificarea și crearea pe pauză

### Drumul, pe ecran

Spațiul Google → **„Căutare”** → lipești planul (sau „Încarcă exemplul”) → îl
citești → **„Verifică în Google”** → panoul „Ce a găsit Google” → **„Creează pe
pauză”** → **„Create pe pauză.”** (sau „Creată pe pauză.” pentru o singură
campanie), cu linkul spre lista de campanii a contului și câte un link pe
campanie. Crearea se deblochează doar pe o verificare fără erori a EXACT
planului de pe ecran; pe server, verificarea se reface și amprenta trebuie să
fie aceeași.

### Ce verifică (`google/search/check.ts`)

1. **Contul** — cheia îl vede direct sau prin managerul MCC (același
   `findGoogleAccount` ca la Demand Gen, cu `login-customer-id`); nu e manager;
   e activ; **moneda contului = `currency`**.
2. **Numele** — campaniile (nesterse) și listele comune (active) cu același nume
   din cont: eroare pe câmpul din plan. Dacă o campanie cu numele ăla a fost
   creată chiar din portal, mesajul spune când — un plan lipit a doua oară nu se
   creează a doua oară.
3. **Butoanele de apel** — acțiunea `conversion_action_id` există și e activă;
   alt tip decât `AD_CALL` = avertisment.
4. **Locațiile și limbile** — rezolvate cu `google/targeting.ts`
   (`resolveLocations`, `resolveLanguages`, scoase din Demand Gen fără să-i
   schimbe comportamentul); aceeași regiune în mai multe campanii se caută o
   dată. Panoul arată „Cluj → Cluj County, Romania (21289)” pe fiecare campanie.
5. **Adresele finale** (grupuri, anunțuri, linkuri suplimentare), fiecare o
   singură dată, câte 8 în paralel, `HEAD` (sau `GET` fără corp, la serverele
   care nu știu `HEAD`), 6 secunde, fără să urmărească redirecționările: 404/410
   = eroare, redirecționare = avertisment (cu ținta; alt domeniu e spus
   explicit), fără răspuns = avertisment. Doar https pe domenii publice — ca la
   siglă.
6. **Google însuși** — dacă nu e nicio eroare până aici, TOT planul pleacă cu
   `validateOnly`, prin `googleMutate` (deci prin gardă). Fiecare refuz Google
   ajunge pe câmpul din plan care l-a produs, cu numele lui („Google refuză
   anunțul 1 din grupul „Montaj”: …”).

### Maparea pe Google Ads API v26

| Plan | Google |
|---|---|
| `shared_negative_lists[]` | `SharedSet { name, type: NEGATIVE_KEYWORDS }` + `SharedCriterion { sharedSet, keyword { text, matchType } }` |
| `daily_budget` | `CampaignBudget { amountMicros, deliveryMethod: STANDARD, period: DAILY, explicitlyShared: false }` — implicit Google l-ar face partajat |
| campania | `Campaign { advertisingChannelType: SEARCH, status: PAUSED, campaignBudget, containsEuPoliticalAdvertising: DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING, finalUrlSuffix? }` (declarația UE rămâne obligatorie pentru România în v26) |
| `networks` | `networkSettings { targetGoogleSearch: true, targetSearchNetwork, targetContentNetwork, targetPartnerSearchNetwork: false }` |
| `bidding` | `maximize_clicks` → `targetSpend { cpcBidCeilingMicros? }` (`targetSpendMicros` e învechit, nu se trimite); `manual_cpc` → `manualCpc { enhancedCpcEnabled: false }` + `AdGroup.cpcBidMicros` |
| `location_mode` | `geoTargetTypeSetting { positiveGeoTargetType: PRESENCE / PRESENCE_OR_INTEREST, negativeGeoTargetType: PRESENCE }` |
| `locations` · `excluded_locations` · `languages` | `CampaignCriterion { location { geoTargetConstant } }` (cu `negative: true` la excluderi), `{ language { languageConstant } }` |
| `schedule` | câte un `CampaignCriterion { adSchedule { dayOfWeek, startHour, startMinute, endHour, endMinute } }` pe zi (`MinuteOfHour`: ZERO / FIFTEEN / THIRTY / FORTY_FIVE; 24:00 = `endHour: 24, ZERO`) |
| `negatives` (campanie) | `CampaignCriterion { negative: true, keyword }` |
| `negative_lists` | `CampaignSharedSet { campaign, sharedSet }` |
| grupul | `AdGroup { status: PAUSED, type: SEARCH_STANDARD, campaign, cpcBidMicros?, finalUrlSuffix? }` |
| `keywords` · `negatives` (grup) | `AdGroupCriterion { keyword }` / `{ negative: true, keyword }` — fără status |
| `ads[]` | `AdGroupAd { status: PAUSED, ad { finalUrls, responsiveSearchAd { headlines[{ text, pinnedField: HEADLINE_n }], descriptions[{ text, pinnedField: DESCRIPTION_n }], path1, path2 } } }` |
| `assets` | `Asset { finalUrls, sitelinkAsset }`, `{ calloutAsset }`, `{ structuredSnippetAsset { header, values } }`, `{ callAsset { countryCode, phoneNumber, callConversionReportingState, callConversionAction? } }` — fiecare material identic creat o dată; `CampaignAsset { campaign, asset, fieldType: SITELINK / CALLOUT / STRUCTURED_SNIPPET / CALL }` |

Ordinea în cerere: listele și cuvintele lor → pe fiecare campanie bugetul,
campania, criteriile ei, legăturile listelor, grupurile, cuvintele, anunțurile →
materialele → legăturile materialelor. Id-urile temporare sunt negative, unice
în cerere, și fiecare e creat înainte să fie folosit (`verify-paused.mjs` o
verifică).

### Crearea (`google/search/create.ts`)

O singură cerere atomică — totul sau nimic, fără „creat pe jumătate”. În
`ads_campaigns`, câte un rând pe campanie (migrarea 9: `channel = 'search'`,
`plan_group_id` comun), cu planul ei (campania + listele comune pe care le
folosește), id-urile grupurilor și ale anunțurilor. Obiectivul rândului e
`leads`: rezultatele numărate de sincronizare sunt conversiile contului
(apeluri, formulare), ca la Demand Gen pe Lead-uri. Lista de campanii scrie
„Căutare” în dreptul lor, iar fișa (`/admin/ads/[id]`) arată campania exact cum a
fost trimisă, cu aceeași previzualizare ca la creare.

**Dublura:** același plan (aceeași amprentă), creat în ultimele 30 de minute
(14 zile în lot), nu se mai trimite: rezultatul spune când și de cine a fost
creat. Oricum, Google n-ar primi a doua oară aceleași nume de campanii.

### Lotul

Planurile de căutare intră în lot (`/admin/ads/lot`) — regulile lotului li se
potrivesc: un lot e al unui singur proprietar (Meridian sau Clienți), fiecare
plan se verifică și se creează în spațiul scris în el, un plan identic e
eroare, un plan creat în ultimele 14 zile se sare. Pe rând apare „Căutare · N
campanii · M grupuri · K cuvinte cheie · X operații”, iar suma bugetelor intră
în totalul lotului. **De știut:** fiecare plan de căutare consumă din operațiile
zilnice ale proiectului Google Cloud (verificarea și crearea, fiecare câte un
plan întreg); la nivelul Explorer (2.880/zi), un lot cu mai multe planuri mari
nu încape într-o zi.

### Verificat (Chrome headless, Google și Supabase falși locali)

Exemplul verificat (81 de operații cu `validateOnly`, contul văzut prin MCC,
regiunea și orașul rezolvate, 6 adrese), creat (o singură cerere reală, doar
`PAUSED` pe campanii, grupuri și anunțuri, niciun `ENABLED` în jurnalul
falsului), apoi verificat a doua oară (numele ocupate, prinse); lista și fișa
campaniei; o adresă 404 (eroare pe câmpul ei); un refuz de politică al Google pe
un titlu (mutat pe anunțul din plan, grupul se deschide la clic); același plan
în lot (citit, verificat, creat; a doua oară — numele ocupate). Fără derulare
laterală la 360, 768, 1024, 1440 și 1920; focusul trece pe panoul verificării,
apoi pe rezultat; fără erori în consolă; reduced-motion.

### Neverificat încă — se confirmă la prima creare reală

1. Mesajele reale ale Google pentru numele duplicate (portalul le prinde oricum
   înainte, din citire).
2. Comportamentul serverelor clienților la `HEAD` (unele răspund 403 roboților:
   portalul îl spune ca avertisment, nu ca eroare).
3. Timpul unei verificări pe un plan cu ~750 de operații (`maxDuration` e 60 s).

---

## Faza 11 — contul existent (`/admin/ads/cont`)

În meniu, „Cont” (doar în spațiile Google). Alegi contul — din lista conturilor
pe care le vede cheia (direct sau sub MCC) sau scriind id-ul — și ai trei vederi
plus „Termeni” (faza 12):

**Campanii.** Toate campaniile contului, în toate stările (Google le întoarce și
pe cele șterse; ele stau la final): nume, id, tip, status, strategia de licitare,
buget pe zi, cost / clicuri / conversii pe ultimele 30 de zile și de la început,
data de start; „din portal” cu link spre fișă la cele create din portal. Filtre
pe tip și status, sortare, totalul celor din filtru deasupra tabelului.
**Pauza:** bifezi campaniile active → „Pune pe pauză (N)” → o fereastră de
confirmare (dialog nativ, cu focusul prins înăuntru, Escape închide) cu lista
exactă și costul lor pe 30 de zile → `googlePause`. Pe server, statusul se citește
din nou chiar înainte: campaniile deja oprite sau șterse se sar, cu motivul.
Fiecare pauză se notează în jurnal (migrarea 10); rândurile din portal trec pe
„Oprită” imediat.

**Negative.** Trei moduri:

| Mod | Ce pleacă spre Google |
|---|---|
| Pe campaniile alese | `CampaignCriterion { negative: true, keyword }` pe fiecare campanie aleasă × fiecare cuvânt; cele deja existente se sar |
| Într-o listă comună existentă | `SharedCriterion { sharedSet, keyword }` (cuvintele care nu sunt deja în listă) și, opțional, `CampaignSharedSet` pentru campaniile alese, nelegate încă |
| Leagă o listă comună de campanii | `CampaignSharedSet { campaign, sharedSet }` |

Lista se lipește câte un cuvânt pe rând, în notația din Google Ads Editor:
`[exactă]`, `"frază"`, `amplă` (fără semne). Doar campaniile de căutare nesterse
se pot alege. „Previzualizează” citește cuvintele cheie pozitive active ale
campaniilor afectate (`ad_group_criterion`), negativele existente
(`campaign_criterion`), listele de negative și cuvintele lor (`shared_set`,
`shared_criterion`, `campaign_shared_set`), caută **conflictele** (aceeași
potrivire ca la faza 8: un negativ care ar bloca un cuvânt activ e eroare, cu
cuvântul, grupul și campania) și trimite tot cu `validateOnly`. „Adaugă” reface
totul pe server și trimite doar dacă amprenta e aceeași. Listele comune trec prin
gardă doar ca liste de negative citite chiar atunci din cont.

**Audit** (doar citire), fiecare bloc citit separat — unul pe care cheia nu-l
poate citi spune de ce, iar restul rămân:

| Bloc | De unde (GAQL, v26) |
|---|---|
| Cine a schimbat ce | `change_event`, ultimele 30 de zile (fereastra maximă), `LIMIT 10000` (obligatoriu), cele mai noi primele: când, cine (email), ce resursă, ce operație, câmpurile, din ce client (interfață, API, scripturi, reguli…). Sus, valurile: „6 campanii create de X pe Y, din API”. Modificările din Google Ads Editor nu apar în `change_event` |
| Cine are acces | `customer_user_access` (email, rol, de când, cine a invitat) + invitațiile în așteptare (`customer_user_access_invitation`) |
| Facturarea | `billing_setup` (status, contul de plăți, profilul) și `account_budget` (limita, consumul) |
| Conversiile | `conversion_action` (nume, tip, categorie, principală/secundară, stare) + conversiile pe 30 de zile pe acțiune (`segments.conversion_action` din `customer` — din `conversion_action` nu se pot cere conversiile) |

**Semnalele**, sus: multe campanii (5+) create de un singur utilizator într-o zi;
acces de administrator pentru o adresă care nu e printre adminii portalului
(`ADMIN_EMAILS`) sau contul de serviciu — poate fi clientul, poate fi o agenție
veche; o conversie principală fără nicio conversie în 30 de zile; nicio
configurare de facturare aprobată; o campanie activă cu peste 150 lei (30 € /
30 USD) cheltuiți în 30 de zile și nicio conversie.

**Jurnalul** („Ce a făcut portalul în contul ăsta”), sub fiecare vedere: pauzele,
negativele, listele legate, acțiunile de conversie trimise din portal, cu cine și
când (`ads_google_changes`, migrarea 10).

### Neverificat încă — se confirmă pe un cont real

1. Intervalul cifrelor „de la început”: interogarea fără filtru de dată întoarce,
   observat, tot istoricul; documentația nu-l fixează (Google păstrează 11 ani
   pentru cifrele nesegmentate).
2. Dacă un cont de serviciu cu acces **Standard** poate citi `customer_user_access`
   prin GAQL (documentația cere Admin pentru gestionarea utilizatorilor, interfața
   arată utilizatorii și rolurilor Standard). Dacă nu, blocul o spune.
3. Dacă facturarea se poate citi la nivelul Explorer și la conturile plătite cu
   cardul (probabil fără rânduri; blocul o spune).
4. Formatul exact al lui `change_date_time` în filtru (portalul trimite
   `'AAAA-LL-ZZ'` și `'AAAA-LL-ZZ 23:59:59'`).

---

## Variabile de mediu

Toate doar pe server, cu o excepție marcată (`NEXT_PUBLIC_`).

| Variabilă | Faza | Ce |
|---|---|---|
| `META_TOKEN_MERIDIAN` | 2 | System User token, portofoliul Meridian |
| `META_TOKEN_CLIENTI` | 2 | System User token, portofoliul clienților |
| `TIKTOK_TOKEN_MERIDIAN` | 5 | token pe termen lung, Business Center Meridian |
| `TIKTOK_TOKEN_CLIENTI` | 5 | token pe termen lung, Business Center clienți |
| `GOOGLE_ADS_MERIDIAN` | 6 | JSON-ul contului de serviciu Google Cloud (sau același JSON în base64) adăugat în contul Google Ads al agenției |
| `GOOGLE_ADS_CLIENTI` | 6 | la fel, alt cont de serviciu, adăugat în conturile clienților (sau în MCC-ul lor) |
| `NEXT_PUBLIC_GOOGLE_ADS_LEAD` | 7 | **publică** (ajunge în pagină, nu e secretă): eticheta conversiei Lead, `AW-123456789/AbCdEf…`. Fără ea, tag-ul Google nu se încarcă deloc |
| `CRON_SECRET` | 4 | există deja (sonda Supabase); îl folosește și cron-ul de cifre |
| `META_GRAPH_URL` | test | DOAR pe calculatorul de dezvoltare: un Meta fals local. Ignorată dacă nu e `http://localhost` / `http://127.0.0.1` — **nu se pune în Vercel**. |
| `TIKTOK_API_URL` | test | La fel, pentru un TikTok fals local. **Nu se pune în Vercel.** |
| `GOOGLE_ADS_API_URL` | test | La fel, pentru un Google fals local (și oEmbed-ul YouTube fals). **Nu se pune în Vercel.** |

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
4. **Tokenul.** Schimbi codul pe token, dintr-un terminal deschis de tine (nu
   din conversația cu Claude — răspunsul conține tokenul). Pe Windows, în
   PowerShell (acolo `curl` e alt program, iar ghilimelele din JSON se pierd):
   ```powershell
   $body = @{ app_id = "…"; secret = "…"; auth_code = "…" } | ConvertTo-Json
   Invoke-RestMethod -Method Post -Uri "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/" -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 5
   ```
   Pe macOS, Linux sau Git Bash:
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

### Google — contul de serviciu (nu expiră)

Fără developer token (retras pe 2026-09-09). Pașii se fac o dată pentru fiecare
portofoliu (Meridian, Clienți), fiecare cu contul lui de serviciu:

1. **Google Cloud** (console.cloud.google.com) → un proiect nou (de exemplu
   „meridian-ads-portal”), pe un cont Google al agenției. Proiectul trebuie să
   aibă facturarea activă sau deloc — cele pe „Free Trial” sunt respinse la
   accesul Explorer (problemă cunoscută la Google).
2. **APIs & Services → Library → „Google Ads API” → Enable.**
3. **Accesul la conturi reale:** pagina „Google Ads API” → Overview
   (console.cloud.google.com/google/ads-apis/overview) → aplici; acceptă
   termenii. Explorer (2.880 de operații/zi) vine de obicei pe loc; Basic
   (15.000/zi) cere verificarea mărcii proiectului (ecranul OAuth pe „External”
   și „In production”).
4. **IAM & Admin → Service Accounts → Create**: un nume („portal-meridian”), fără
   roluri în proiect. Apoi contul → **Keys → Add key → JSON** → se descarcă un
   fișier `.json`. Dacă Google spune că organizația blochează cheile, un admin
   al organizației dezactivează politica `iam.managed.disableServiceAccountKeyCreation`
   pentru proiect (sau proiectul se face pe un cont Gmail, fără organizație).
5. **Google Ads** → contul de reclame (sau contul manager MCC, dacă există) →
   **Admin → Acces și securitate → Utilizatori → „+”** → adresa contului de
   serviciu (`…@….iam.gserviceaccount.com`) → nivelul **Standard** → „Add account”.
   Pe conturile cu mai mult de 3 admini, Google poate cere aprobarea unui al
   doilea admin.
6. **Vercel → Settings → Environment Variables:** `GOOGLE_ADS_MERIDIAN` =
   conținutul întreg al fișierului `.json` (sau același conținut în base64),
   pe *Preview* și *Production*. Fișierul se șterge apoi de pe calculator.
   Nu în chat, nu într-un commit.

Verificarea portalului spune exact ce lipsește: „cheia nu vede contul” (pasul
5), „proiectul are doar acces de test” (pasul 3), „cheia nu e JSON” (pasul 6).

**Conversia „Lead” și tag-ul de pe site:** Google Ads → Obiective → Conversii →
„+ Creează acțiune de conversie” → site-ul `www.meridianx.ro` → categoria
„Trimitere formular pentru clienți potențiali” → „Manual, cu cod” →
Numărare: **Una** → salvezi → „Configurează eticheta” → copiezi `send_to`
(`AW-…/…`) în Vercel ca `NEXT_PUBLIC_GOOGLE_ADS_LEAD` → redeploy. Acțiunea
trebuie să fie **principală**; id-ul ei (din adresa paginii, `ctId=`) e
`conversion.pixel_id` în planuri — contextul pentru Claude îl arată singur.

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

## Decizii luate în fazele 6–7 (de confirmat de om)

1. **Google = Demand Gen.** Campaniile Video (vizualizări, acoperire) nu se pot
   crea din API; `video_views` și `awareness` se refuză pe Google, cu explicația.
2. **Contul de serviciu**, nu refresh token: recomandarea Google pentru o
   unealtă pe conturile proprii; nu expiră, nu cere 2FA sau passkey.
3. **Totul oprit și pe Google**: campania, grupul ȘI reclamele `PAUSED` (exemplul
   oficial lasă grupul și reclamele pornite sub campania oprită; regula portalului
   e mai strictă). În Google Ads, la activare: bifezi campania, grupul și
   reclamele → „Activează”.
4. **Conversiile pe Google = obiectivele principale ale contului** (fără
   modificarea obiectivelor campaniei, care ar cere operații de actualizare).
   Verificarea avertizează când contul are și alte conversii principale.
5. **Vârsta necunoscută rămâne afară** pe Google, ca vârsta din plan să fie o
   limită, ca pe Meta și TikTok. Costă din acoperire; se schimbă într-o linie
   (`google/build.ts`, `includeUndetermined`).
6. **Lotul = un proprietar** (Meridian sau Clienți), orice platformă; dublurile
   din ultimele 14 zile se sar.
7. **20 de reclame pe plan**, 10 video-uri; cu mai multe video-uri, coperta e
   cea propusă de platformă.
8. **Tag-ul Google pe site** doar după „Acceptă tot” și doar cu eticheta setată;
   Google adăugat în politicile site-ului.
9. **Cron-ul de cifre în `vercel.json`** (`30 3 * * *` UTC = 06:30 la noi; Vercel
   permite 100 de cron-uri pe proiect, zilnice și pe Hobby).

## De rezolvat — în afara zonei portalului

- **Baza de date:** `supabase/portal-reclame.sql` — un singur fișier, rulat o dată
  în SQL editor (e suma migrărilor 5–8, scrisă să poată rula oricât de des).
  Apoi `insert into public.admin_emails (email) values (…) on conflict do nothing;`
  cu aceleași adrese ca în `ADMIN_EMAILS`.
- **CSP (`next.config.ts`):** făcut în faza 7 — miniaturile Meta, TikTok și
  YouTube în `img-src`, tag-ul Google în `script-src` / `connect-src` /
  `frame-src`. CSP-ul e încă doar raportat (`CSP_REPORT_ONLY = true`).
- **Legătura din panoul de lead-uri spre reclame:** făcută (linkul „Reclame” din
  capul panoului).

## Decizii luate (fazele 8–14)

Promptul fazelor 8–14 cere lucru de la cap la coadă, fără confirmare între faze;
unde a fost de ales, am ales varianta cea mai sigură și mai simplă și am notat-o aici.

1. **Faza 8 — o pagină separată, `/admin/ads/cautare`**, nu „Plan nou” cu două
   formate: previzualizarea, verificarea și rezultatul sunt altele (mai multe
   campanii, fără video, fără formular de câmpuri). „Plan nou” recunoaște planul
   de căutare și îl mută acolo cu un clic (și invers).
2. **Faza 8 — corecturile se fac în JSON**, nu într-un formular: un plan de
   căutare are sute de rânduri. Erorile duc la locul lor (grupul se deschide).
3. **Faza 8 — două strategii de licitare**: `maximize_clicks` (cu plafon de CPC
   opțional) și `manual_cpc` (fără CPC îmbunătățit, oprit oricum de Google pe
   căutare din 2025). „Maximizează conversiile” nu e în format: un cont refăcut
   de la zero nu are încă conversii pe care să optimizeze. Se adaugă ușor.
4. **Faza 8 — `max_cpc` pe grup la „Maximizează clicurile” e eroare**, nu
   avertisment: Google îl ignoră acolo, iar un plafon ignorat în tăcere ar fi o
   valoare în care crede cineva. Plafonul stă pe campanie.
5. **Faza 8 — locațiile de căutare fără rază**: orașe, regiuni, țări întregi
   (aceeași rezolvare ca la Demand Gen, `google/targeting.ts`). Raza ar cere
   coordonate; se poate adăuga ca tip nou de locație.
6. **Faza 8 — UTM pe campanie și pe grup**, în `finalUrlSuffix` (al campaniei
   acoperă și linkurile suplimentare; al grupului îl înlocuiește pe al campaniei).
7. **Faza 8 — titlurile și descrierile duplicate se compară fără majuscule**
   (poate mai strict decât Google): două titluri care diferă doar prin
   majuscule sunt aproape sigur o greșeală.
8. **Faza 8 — antetul fragmentului structurat în limba campaniei** (română la
   prima limbă `ro`), din lista oficială v26.
9. **Faza 8 — materialele identice din campanii diferite se creează o singură
   dată** și se leagă de fiecare campanie (același mesaj scurt pe patru campanii
   = un material, patru legături).
10. **Faza 9 — negativele pe un GRUP existent sunt refuzate**: promptul permite
   negative doar pe campanii existente (și în liste). Propunerile din termenii de
   căutare merg deci pe campanie sau într-o listă comună, nu pe grup.
11. **Faza 9 — listele existente se verifică prin citire, chiar înainte de
   trimitere**: garda nu poate ști singură tipul unei liste din cont; apelantul
   îi dă lista citită (`negativeSharedSets`), iar o listă necitită e refuzată.
12. **Faza 9 — pauza merge și pe grupuri** (garda o permite, cum cere promptul),
   dar interfața pune pe pauză doar campanii.
13. **Faza 9 — o singură funcție de rețea pentru mutate** (`sendMutate`, privată),
   cu două uși, fiecare cu garda ei; `verify-paused.mjs` verifică structura.
14. **Faza 10 — un rând pe campanie, cu `plan_group_id`** (migrarea 9) și
   `channel = 'search'`: campaniile apar în listă, în statistici și în
   sincronizare ca oricare altele; rândurile aceluiași plan rămân legate.
15. **Faza 10 — obiectivul rândurilor de căutare e `leads`**: rezultatele sunt
   conversiile contului (apeluri, formulare). Clicurile se văd oricum separat.
16. **Faza 10 — citirile tolerează migrarea 9 neaplicată**: lista și fișa cad pe
   coloanele vechi, deci un deploy înaintea migrării nu strică pagina; doar
   crearea unui plan de căutare cere migrarea (și spune asta).
17. **Faza 10 — fără „Creează încă o dată, intenționat” la căutare**: Google n-ar
   primi aceleași nume a doua oară; dublura trimite la campaniile existente.
18. **Faza 10 — adresele se întreabă cu `HEAD`, fără redirecționări urmărite**;
   un 403 sau o lipsă de răspuns sunt avertismente (mulți servere blochează
   roboții), doar 404/410/5xx sunt erori.
19. **Faza 10 — planurile de căutare intră în lot**, cu aceleași reguli; cu
   avertismentul despre operațiile zilnice în README.
20. **Faza 11 — negativele doar pe campanii de căutare**: pe Performance Max și
   pe celelalte tipuri, negativele de campanie nu se aplică la fel; portalul nu le
   oferă acolo.
21. **Faza 11 — „adminii cunoscuți” = `ADMIN_EMAILS` + contul de serviciu**: o
   listă de adrese „ale clientului” per cont ar fi o setare nouă; semnalul spune
   „poate fi clientul” și nu blochează nimic.
22. **Faza 11 — pauza recitește statusul chiar înainte** și trimite doar
   campaniile active; o campanie oprită între timp se sare, cu motivul.
23. **Faza 11 — pauza nu trece prin `validateOnly`**: e o singură operație pe
   campanie, iar garda ei permite doar `status: PAUSED`; dialogul de confirmare
   ține locul previzualizării.
24. **Faza 11 — jurnal separat (`ads_google_changes`, migrarea 10)**, nu în
   `ads_campaigns`: pauzele și negativele se fac și pe campanii pe care portalul
   nu le-a creat.
25. **Faza 11 — cifrele contului se citesc pe loc din Google** (nu din
   sincronizarea zilnică): pagina e pentru conturi preluate, cu campanii pe care
   portalul nu le urmărește.

## De făcut de om (fazele 8–14)

Ce nu ține de zona portalului sau nu se poate face din cod. Fiecare punct spune
exact ce și de ce.

1. **Migrarea 9** (`supabase/migrations/00000000000009_ads_google_search.sql`):
   lipită în Supabase → SQL Editor → Run, după migrările 5–8. Fără ea, crearea
   unui plan de căutare reușește în Google Ads, dar nu se notează în portal
   (mesajul o spune). Se poate rula de mai multe ori.
2. **`supabase/portal-reclame.sql`** (fișierul „o singură lipire”) e în afara
   zonei fazelor 8–14, deci nu l-am atins: la merge, migrările 9 și următoarele se
   adaugă la finalul lui (sunt scrise să poată rula de mai multe ori) — sau se
   rulează separat, în ordine.
3. **Migrarea 10** (`supabase/migrations/00000000000010_ads_google_changes.sql`):
   jurnalul pauzelor și negativelor. Fără ea, pauza și negativele merg în Google
   Ads, dar nu se notează (mesajul o spune).
4. **Accesul contului de serviciu la contul clientului** — pentru „Cont”, contul de
   serviciu `GOOGLE_ADS_CLIENTI` trebuie să vadă contul: adăugat ca utilizator
   **Standard** direct în cont sau în MCC-ul agenției, cu contul clientului legat
   sub MCC (pașii, în raportul final și în „Faza 11”). Pentru blocul „Cine are
   acces” e posibil să fie nevoie de **Admin**; restul merge cu Standard.
