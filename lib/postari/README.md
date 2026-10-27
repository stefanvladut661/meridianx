# Postări — `/admin/postari`

Clipurile terminate de pe Google Drive pleacă singure pe conturile Meridian:

- **Instagram:** complet automat, la ora din plan.
- **TikTok:** clipul ajunge la ora din plan în ciornele din aplicația TikTok; îl publici tu de acolo, cu descrierea copiată din admin.

Totul pornește dintr-un plan JSON (lipit de tine sau scris de Claude din `manifest.json`), care se verifică, se previzualizează și se aprobă o dată. Deocamdată doar conturile Meridian, nu ale clienților.

Zona modulului: `app/(admin)/admin/postari/**`, `lib/postari/**`, `components/postari/**` și migrările `00000000000024_*` în sus. Din `lib/firma` se importă doar conexiunea Drive (`lib/firma/drive/google.ts`), fără nicio schimbare acolo.

**Ramura:** `feat/postari`, pornită din `feat/admin-firma`, pentru că `feat/admin-firma` nu e încă în `main` (la 27 octombrie 2026 `main` e la „Portal reclame v2, faza 6”). Când `feat/admin-firma` intră în `main`, ramura asta se poate muta peste `main` fără conflicte: nu atinge fișiere din afara zonei.

---

## Regulile care nu se schimbă (și unde le ține codul)

| Regulă | Cum e ținută |
|---|---|
| Nimic nu pleacă fără „Aprobă planul” | Un plan doar lipit sau generat nu intră în coadă. Coada are doar postări din planuri aprobate. |
| Postările publicate nu se șterg și nu se modifică | Clienții Instagram și TikTok din `lib/postari` n-au funcții de ștergere sau de editare. `lib/postari/verify-api.mjs` pică dacă apare vreuna sau dacă se folosește alt endpoint decât cele permise. |
| Aceeași postare nu pleacă de două ori | Postarea e luată din coadă printr-o funcție din bază (`for update skip locked` + termen de lucru). Containerul Instagram se salvează înainte de publicare și se publică doar cel salvat. Înainte de o republicare după o întrerupere, se citește starea containerului (`PUBLISHED` = deja publicat). |
| Tokenurile nu stau în Vercel și nici în clar | Instagram și TikTok expiră, deci stau în Supabase, criptate cu AES-256-GCM. Cheia de criptare (`POSTARI_TOKEN_KEY`) stă doar în Vercel. În repo nu sunt tokenuri, chei, nume de conturi sau de clienți. |
| Token care nu se mai poate reînnoi = coada oprită | Coada se oprește singură, cu motivul scris, și pleacă o alertă pe email. Pornește la loc din „Pornește coada”, după ce reconectezi contul. |
| RLS pe tabelele noi | Fiecare tabel `postari_*` are RLS activ și o politică de citire doar pentru `is_lead_admin()`. Scrierile trec prin cheia de service, pe server. |
| Fiecare acțiune intră în istoric | `postari_istoric`: cine, ce, când, rezultatul. Se scrie din fiecare acțiune de server și din fiecare rulare a cozii. |
| Pe conturile reale, nimic cât se lucrează | Testele rulează pe Drive, Instagram, TikTok, Anthropic și Supabase Storage simulate. Proba reală o faci tu, cu un singur clip (vezi „De testat cu contul real”). |

---

## Planul (faza 0)

### Ce am citit

- `CLAUDE.md`: zonele, fișierele înghețate, regula duplicării locale în loc de atingeri în zona altcuiva.
- **Adminul firmei** (`lib/firma`, `components/firma`, `app/(admin)/admin/firma`): cadrul (meniu în stânga, bara de sus, panou lateral), tema albă a portalului (`app/(admin)/admin/ads/portal.css`, clasa `.ads-portal`), accesul la bază (cheia de service, după verificarea sesiunii), istoricul, setările, cron-ul cu secret.
- **Conexiunea Drive** (`lib/firma/drive/google.ts`): OAuth ca tine sau cont de serviciu, din aceleași variabile din Vercel. Exportă `checkFolder`, `findChild`, `listChildren`, `downloadFile`, `driveMode`, `DriveError`.
- **Portalul de reclame** (`lib/ads`, `components/ads`): importul planului JSON (lipire iertătoare: blocuri ```json, comentarii, virgule la final), verificarea pe rânduri, anticamera video din Supabase Storage cu link semnat și ștergere după.
- `reclame-video/scripts/assemble.mjs`: clipurile finale sunt H.264 (CRF 14), AAC, 1080×1920, 30 fps, cu `+faststart`.

### Ecranele

| Ecran | Ce face |
|---|---|
| **Coada** (`/admin/postari`) | Calendarul pe zile și lista postărilor cu starea fiecăreia: planificată, în lucru, publicată (cu link), trimisă în ciorne, eșuată (cu motivul și „Reîncearcă”), scoasă. „Oprește coada” / „Pornește coada”, „Scoate din coadă” pe o postare care n-a rulat, alertele, ultima rulare. |
| **Plan nou** (`/admin/postari/plan`) | Lipești sau urci un plan JSON, ori îl scrie Claude din `manifest.json`. Verificarea, previzualizarea (clipul, descrierea, platformele, ora) și „Aprobă planul”. |
| **De publicat pe TikTok** (`/admin/postari/tiktok`) | Gândit pentru telefon: fiecare clip trimis în ciorne, cu descrierea și hashtag-urile, „Copiază” și „Publicat”. |
| **Istoric** (`/admin/postari/istoric`) | Fiecare acțiune și fiecare rulare. |
| **Setări** (`/admin/postari/setari`) | Folderul de pe Drive, sloturile implicite, plafoanele pe 24 de ore, emailul pentru alerte, conturile Instagram și TikTok, starea programării. |

Același design ca restul adminului: cadrul firmei, cu aceleași clase, duplicat în `components/postari/` (CLAUDE.md permite duplicarea temporară; unificarea cadrului se hotărăște la final, cu celelalte terminale).

### Modelul de date (migrările 24 și următoarele)

| Tabel | Ce ține |
|---|---|
| `postari_setari` | Un rând: folderul principal de pe Drive, sloturile implicite (ore, fus), plafoanele pe 24 de ore (Instagram 50, TikTok 5), distanța minimă între postări, emailul pentru alerte, starea cozii (pornită/oprită, motivul, cine și când). |
| `postari_istoric` | Cine, ce, când, rezultatul. |
| `postari_clipuri` | Ce s-a citit din fiecare clip de pe Drive (mărime, lățime, înălțime, durată, cadre pe secundă, codecuri, poziția indexului `moov`), ca un plan să nu descarce de două ori același fișier. |
| `postari_planuri` | Planurile aprobate: JSON-ul, folderul, amprenta (același plan nu se aprobă de două ori), cine și când. |
| `postari` | Câte un rând pe postare și platformă: fișierul, descrierea, ora, starea, pasul, încercările, eroarea, linkul, plus ce trebuie ca o rulare întreruptă să reia de unde a rămas (containerul Instagram, `publish_id`-ul TikTok, cât s-a urcat). |
| `postari_conturi` | Contul Instagram și contul TikTok: id-ul, numele, tokenurile criptate, când expiră, ultima reînnoire, starea. |
| `postari_rulari` | Fiecare rulare a cozii: când, cât a durat, ce a făcut. |
| `postari_alerte` | Ce alertă a plecat pe email, ca aceeași să nu plece de două ori în aceeași zi. |
| bucket `postari-temp` | Copia temporară a clipului pentru Instagram (privat; se șterge după publicare sau după eșecul definitiv). |

### Fazele

1. **Drive și `manifest.json`.** Folderul principal ales în Setări. Subfolderul planului (`"folder": "meridian reclame/lot-1"`), găsit pe nume. Lista clipurilor și citirea `manifest.json` după un format scris aici, pentru terminalul de reclame. Citirea clipului: mărimea, formatul, codecurile, durata, cadrele pe secundă și poziția `moov`, direct din MP4.
2. **Planul JSON.** Formatul, citirea iertătoare, verificarea (fișierele există, sunt 9:16, intră în limitele Instagram și TikTok, orele nu se suprapun, plafoanele pe 24 de ore), sloturile completate singure, previzualizarea, importul și „Aprobă planul”.
3. **Claude.** Din `manifest.json` iese un plan cu descrieri și hashtag-uri, pe care îl corectezi înainte de verificare.
4. **Coada și programarea.** Endpoint-ul `/admin/postari/cron`, apelat de Supabase Cron la 5 minute, cu secret. Luarea din coadă fără dubluri, bugetul de timp al unei rulări, reluarea de unde a rămas, reîncercările, „Oprește coada” / „Pornește coada”, „Scoate din coadă”, „Reîncearcă”.
5. **Instagram.** Tokenul (lipit din panoul Meta) criptat și reînnoit singur. Copia în `postari-temp` pe bucăți (TUS, reluabilă), linkul semnat, containerul, așteptarea procesării, publicarea, linkul postării, ștergerea copiei, plafonul pe 24 de ore.
6. **TikTok.** Conectarea prin OAuth (redirect pe www.meridianx.ro), tokenul criptat și reînnoit, trimiterea în ciorne pe bucăți, verificarea că a ajuns, lista „De publicat pe TikTok”.
7. **Ecranul complet.** Calendarul, panoul postării, alertele pe email și în ecran, istoricul, verificarea finală la 360 px și cu tastatura.

### Critica planului (CLAUDE.md §9)

Dacă briefu-ar fi fost pentru altă agenție, aș fi ajuns la „un calendar cu un buton de programare”, la fel ca orice unealtă de social media. Am schimbat trei lucruri, fiindcă problema reală a Meridian e alta:

- **Verificarea citește fișierul, nu numele lui.** Un plan cu 30 de clipuri e sigur doar dacă fiecare clip intră în limitele platformei înainte de aprobare. Așa că se citesc din MP4 dimensiunile, durata, cadrele pe secundă, codecurile, debitul și poziția `moov`, nu doar ce scrie în manifest. Instagram cere „moov atom at the front of the file” și cel mult 25 Mbps, iar clipurile Remotion pleacă la CRF 14, deci debitul poate trece de limită.
- **TikTok e un drum cu om la capăt, nu o postare automată ratată.** Pagina „De publicat pe TikTok” e făcută pentru telefonul pe care vine notificarea: descrierea mare, „Copiază” cu un deget, „Publicat”. Când TikTok raportează singur că ai publicat (`PUBLISH_COMPLETE`), clipul se marchează singur.
- **Plafoanele vin din documentație, nu din bun-simț.** Instagram: plafonul e setare și pornește de la 50. TikTok: cel mult 5 ciorne nepublicate în 24 de ore, altfel refuză. Verificarea planului le numără pe ferestre de 24 de ore, inclusiv cu ce e deja în coadă.

---

## Decizii

- **Instagram: Instagram Login, cu tokenul generat în panoul Meta.** Documentația Meta dă trei variante:
  - **Instagram Login:** „serves Instagram professional accounts without requiring a linked Facebook Page”. Pentru propriul cont, tokenul se face direct în panou: Instagram → *API setup with Instagram business login* → *Generate token*. „Access tokens from the App Dashboard are long-lived and are valid for 60 days.” Se reînnoiește prin `GET graph.instagram.com/refresh_access_token`, cu o singură condiție: tokenul să aibă cel puțin 24 de ore și să nu fi expirat.
  - **Facebook Login:** cere o pagină de Facebook legată de cont, un token de pagină și permisiuni în plus.
  - **„Unified Login”:** varianta nouă, „recommended for new integrations”, pe `graph.facebook.com`, cu un token de tip „Business Integration System User”. Documentația ei nu dă un token direct în panou pentru propriul cont.

  Așa că am ales Instagram Login. Fără redirect, fără pagină de Facebook: lipești tokenul în Setări o dată, iar adminul îl reînnoiește singur, săptămânal.
  - **Permisiunile:** `instagram_business_basic` și `instagram_business_content_publish`.
  - **Acces:** pentru un cont cu rol pe aplicație ajunge *Standard Access*. Pagina de App Review spune „My app is only for a business I own or manage” → „Not required”.
- **Instagram: linkul public vine din Supabase Storage.** Cu Instagram Login, API-ul primește clipul doar ca `video_url` public: urcarea reluabilă direct la Meta e documentată doar pentru Facebook Login for Business. Așa că, la ora postării, clipul se copiază de pe Drive în bucket-ul privat `postari-temp`. Instagram primește un link semnat, valabil 2 ore, iar copia se șterge după publicare sau după eșecul definitiv.
  - **Copia se urcă pe bucăți de 6 MB, prin protocolul TUS.** Supabase cere exact 6 MB. Dacă o rulare se oprește la jumătate, următoarea reia de la ultimul octet confirmat.
  - **Limita planului gratuit Supabase e de 50 MB pe fișier.** Verificarea planului refuză pentru Instagram un clip mai mare și spune ce de făcut. Limita e setare, ca să crească odată cu un plan plătit.
- **TikTok: doar ciorne, iar descrierea se copiază.** Am verificat în documentație: `POST /v2/post/publish/inbox/video/init/` primește doar `source_info`, fără titlu sau descriere (doar postarea directă are `post_info.title`). Așa că fluxul e cel din prompt: clipul ajunge în ciorne, iar descrierea stă în admin, cu „Copiază”.
  - **Urcarea:** `FILE_UPLOAD`, pe bucăți trimise în ordine. `PULL_FROM_URL` cere un domeniu verificat la TikTok, iar linkurile Supabase nu sunt pe domeniul nostru.
  - **Statusul:** se citește după trimitere. `SEND_TO_USER_INBOX` înseamnă trimisă în ciorne, `FAILED` înseamnă eșuată, cu motivul tradus. `PUBLISH_COMPLETE` înseamnă că ai publicat-o tu din aplicație.
- **Drive: doar ce exportă `lib/firma/drive/google.ts`.** Exportul nu are câmpurile video ale Drive-ului (`videoMediaMetadata`) și nici descărcarea pe bucăți (`Range`). Am lucrat cu ce există, fără să schimb `lib/firma`:
  - **Dimensiunile, durata, codecurile și `moov`** se citesc din fișierul descărcat întreg, cu un cititor de MP4 scris aici (`lib/postari/mp4.ts`). Rezultatul se ține în `postari_clipuri`, după id-ul și mărimea fișierului, deci un clip se descarcă o singură dată pentru verificare.
  - **Previzualizarea clipului** e playerul Drive-ului, încărcat doar la „Vezi clipul”, plus „Deschide în Drive”. Politica CSP e încă în modul „doar raportare”, deci merge. Când CSP devine obligatorie, `next.config.ts` (nu e zona mea) are nevoie de `https://drive.google.com` la `frame-src`.
  - **Exportul care ar ajuta:** un rând în `lib/firma/drive/google.ts`, care să exporte cererea autentificată (`driveFetch`). Ar aduce miniaturi și descărcare pe bucăți. Nu e necesar: ți-l propun, nu l-am făcut.
- **Programarea: Supabase Cron, la 5 minute.** Vercel Hobby rulează joburi doar o dată pe zi („Hobby accounts are limited to daily cron jobs”).
  - **Jobul:** e SQL, cu `pg_cron` și `pg_net`, și apelează `POST /admin/postari/cron` cu un secret separat (`POSTARI_CRON_SECRET`).
  - **Timeout-ul:** `net.http_post` are implicit 2 secunde, așa că SQL-ul pune 60 de secunde.
  - **Durata unei rulări:** endpoint-ul are `maxDuration = 60` și un buget intern de 45 de secunde. Merge și fără Fluid compute, unde Hobby oprește funcțiile la 60 de secunde. Ce nu încape se reia la rularea următoare.
- **Secretul cron-ului stă în Supabase Vault.** E seiful bazei de date Supabase (`vault.create_secret`), cum recomandă documentația lor, și **nu are legătură cu vault-ul MERIDIAN** din `/vault`, pe care nu-l ating. Dacă nu-l vrei acolo, SQL-ul are și varianta cu secretul scris direct în job.
- **Tokenurile: criptate pe server, nu în vault-ul MERIDIAN.** Vault-ul MERIDIAN e criptat în browser: serverul nu-l poate deschide, deci un cron n-ar putea reînnoi tokenurile de acolo. Am urmat regula adminului firmei, cu cheile în Vercel și datele în Supabase:
  - tokenurile stau în `postari_conturi`, criptate cu AES-256-GCM (`node:crypto`, fără pachete noi);
  - cheia de criptare e `POSTARI_TOKEN_KEY`, pusă doar în Vercel;
  - un token criptat pentru Instagram nu se poate muta pe rândul TikTok: platforma intră în datele autentificate ale criptării.
- **Fără pachete noi.** Totul e cu ce e deja în `package.json`: `zod`, `@anthropic-ai/sdk`, `resend`, `@supabase/supabase-js`, plus `node:crypto`. TUS e scris direct pe `fetch`.
- **Emailurile de alertă** pleacă prin Resend, cu aceleași variabile (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`), dintr-un trimițător mic în `lib/postari`. Din `lib/firma` se importă doar Drive-ul.

---

## Planul JSON

Un plan e un lot de postări dintr-un singur subfolder de pe Drive. Îl lipești la **Postări → Plan nou** (sau îl încarci ca `.json`), ori îl scrie Claude din `manifest.json`.

```json
{
  "format": "meridian-postari/1",
  "nume": "Lot 1 — restaurante",
  "folder": "meridian reclame/lot-1",
  "sloturi": { "start": "2026-11-02", "ore": ["12:30", "19:00"], "fus": "Europe/Bucharest" },
  "postari": [
    {
      "fisier": "333f_h3-c2_9x16_larven.mp4",
      "platforme": ["instagram", "tiktok"],
      "ora": null,
      "descriere": "Ai mese goale marțea seara? …",
      "hashtaguri": ["restaurant", "bucuresti"],
      "instagram": { "tip": "trial_reel", "absolvire": "automat" },
      "tiktok": { "mod": "ciorna" }
    },
    {
      "fisier": "mihai_h1-c1_9x16_shopify.mp4",
      "platforme": ["instagram"],
      "ora": "2026-11-02 19:00",
      "descriere": "Clienții tăi te caută pe telefon. Cere o ofertă.",
      "hashtaguri": ["marketing"],
      "instagram": { "tip": "reel", "in_feed": true, "coperta_ms": 1500 }
    }
  ]
}
```

| Câmp | Obligatoriu | Ce e |
|---|---|---|
| `folder` | da | Subfolderul de pe Drive. Cu sau fără numele folderului principal în față (`meridian reclame/lot-1` = `lot-1`). Literele mari și diacriticele nu contează. |
| `postari` | da | Lista postărilor, cel mult 200. |
| `postari[].fisier` | da | Numele clipului din subfolder. |
| `postari[].platforme` | da | `["instagram"]`, `["tiktok"]` sau amândouă. O postare pe două platforme devine două rânduri în coadă, la aceeași oră. |
| `postari[].ora` | nu | `null` sau lipsă = următorul slot liber. Altfel `"AAAA-LL-ZZ HH:MM"`, în fusul planului, sau o oră ISO cu fus (`2026-11-02T19:00:00+02:00`). |
| `postari[].descriere` | nu | Textul postării. Pe Instagram pleacă cu hashtag-urile la final. Pe TikTok îl copiezi tu, din „De publicat pe TikTok”. |
| `postari[].hashtaguri` | nu | Cu sau fără `#`. Doar litere, cifre și `_`. Cele care apar deja în descriere nu se repetă. |
| `postari[].instagram.tip` | nu | `reel` (implicit) sau `trial_reel`. Un Trial Reel se arată întâi doar celor care nu te urmăresc. |
| `postari[].instagram.absolvire` | nu | Doar la `trial_reel`. `manual` (implicit): îl treci tu la urmăritori, din aplicație. `automat`: Instagram îl trece singur dacă merge bine la cei care nu te urmăresc. |
| `postari[].instagram.in_feed` | nu | Doar la `reel`: apare și în feed, nu doar la Reels (implicit `true`). |
| `postari[].instagram.coperta_ms` | nu | Cadrul de copertă, în milisecunde de la început. |
| `postari[].tiktok.mod` | nu | Doar `ciorna`. Postarea directă nu e construită. |
| `sloturi` | nu | `ore` (HH:MM), `start` (ziua de la care se caută; implicit mâine) și `fus`. Fără `sloturi`, se iau cele din Setări. |
| `nume`, `fus`, `format` | nu | Numele lotului (în istoric și în coadă), fusul pentru orele fixe când lipsesc `sloturi`, versiunea formatului. |

**Ce iartă citirea:** blocurile ` ```json ` din jur, comentariile `//` și `/* */`, virgulele de la final. **Ce nu iartă:** un câmp necunoscut (`descrire` în loc de `descriere`) e eroare, nu se ignoră, ca o descriere să nu se piardă fără să afli. La fel ghilimelele tipografice (`„ ”`) puse în locul celor drepte.

**Cum se pun orele:**
1. Întâi orele fixe. Fiecare trebuie să fie la cel puțin 10 minute de acum și la cel puțin „distanța minimă” din Setări (implicit 15 minute) de orice altă postare pe aceeași platformă, din plan sau din coadă.
2. Apoi postările fără oră, în ordinea din listă, fiecare în primul slot liber de la `start` încolo. Un slot e liber dacă respectă distanța minimă și plafonul pe 24 de ore pe fiecare platformă a postării.
3. **Plafoanele pe 24 de ore** se numără pe ferestre mobile de 24 de ore, cu tot ce e deja în coadă sau a plecat în ultimele 24 de ore. Instagram: plafonul din Setări (implicit 50). TikTok: cel mult 5 ciorne în 24 de ore.

**Ce verifică „Verifică planul”:** folderul și fiecare fișier (citit din MP4: 9:16, codecuri, cadre pe secundă, durată, debit, `moov`, mărime), limitele fiecărei platforme, descrierea (2200 de caractere, 30 de hashtag-uri, 20 de @ pe Instagram), orele, suprapunerile și plafoanele. Atenționări, care nu opresc aprobarea: același clip de două ori pe aceeași platformă, un clip deja publicat sau deja în coadă, o postare fără descriere.

**Aprobarea:** „Aprobă planul” e activ doar fără erori și cu toate clipurile citite. Serverul verifică planul din nou, chiar înainte de scriere, și aprobă doar dacă orele ies exact ca în previzualizarea pe care ai văzut-o. Același plan (același conținut) nu se aprobă de două ori.

---

## Variabilele din Vercel

| Variabilă | Ce e | Faza |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN` (sau `GOOGLE_SERVICE_ACCOUNT_JSON`) | Aceleași ca la adminul firmei. Nu se pune nimic nou pentru Drive. | 1 |
| `ANTHROPIC_API_KEY` | Aceeași ca la adminul firmei, pentru descrierile scrise de Claude. | 3 |
| `POSTARI_CRON_SECRET` | Secretul cu care Supabase Cron apelează coada. Orice șir aleator de 32+ caractere. Același șir merge în Supabase Vault (vezi „Programarea”). | 4 |
| `POSTARI_TOKEN_KEY` | Cheia care criptează tokenurile Instagram și TikTok: 32 de octeți în base64 (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`). Nu se mai schimbă după conectarea conturilor. | 5 |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | Aplicația de dezvoltator TikTok (Login Kit + Content Posting API, Upload). Pași la „TikTok”. | 6 |
| `TIKTOK_REDIRECT_URI` (opțional) | Doar dacă adresa de întoarcere e alta decât `https://www.meridianx.ro/admin/postari/conturi/tiktok/callback`. | 6 |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Aceleași ca la lead-uri, pentru alerte. | 7 |

Pașii exacți, la „Ce ai de făcut”, mai jos.

---

## Ce ai de făcut

### Pentru terminalul de reclame (pe calculator)

Lipește-i secțiunea asta terminalului care face clipurile cu Remotion.

**Unde pune clipurile**
- Drive pentru desktop ține Drive-ul pe `G:`. Folderul e `G:\My Drive\meridian reclame` (cu interfața în română: `G:\Drive-ul meu\meridian reclame`). Ce se copiază acolo urcă singur pe Drive.
- **Un subfolder pe lot:** `meridian reclame\lot-1`, `meridian reclame\lot-2`… Planul de postări arată spre un subfolder, iar fișierele se dau cu numele lor de acolo.
- **Ordinea:** întâi copiază clipurile, abia apoi scrie `manifest.json`. Fă-l într-un fișier temporar (`manifest.json.tmp`) și redenumește-l la final, ca Drive să nu urce un manifest pe jumătate.
- **Nu suprascrie un clip** care e deja într-un plan. Dacă refaci un clip, pune-l într-un lot nou sau dă-i alt nume. Adminul recunoaște fișierul după id-ul de pe Drive și după mărime.

**Cum trebuie să fie clipurile** (verificate din fișier, înainte de aprobarea planului)
- Vertical **9:16**: 1080×1920.
- Video **H.264**, sunet **AAC**, cel mult 48 kHz, stereo.
- Între 23 și 60 de cadre pe secundă; 30 e bine.
- **`-movflags +faststart`** (indexul `moov` la început). Instagram îl cere, iar `assemble.mjs` îl pune deja.
- **Debitul video:** cel mult 25 Mbps (limita Instagram). La CRF 14, un clip cu multă mișcare poate trece de ea.
- **Mărimea, pentru Instagram:** cel mult **50 MB** pe clip. Instagram ia clipul printr-o copie temporară în Supabase, iar planul gratuit Supabase primește cel mult 50 MB pe fișier. Pentru un clip de până la 30 de secunde, `-maxrate 12M -bufsize 24M` îl ține sub limită fără pierdere vizibilă.
- **Durata:** între 3 secunde (minimul Instagram) și 10 minute (maximul TikTok prin API).

**`manifest.json`** (în același subfolder cu clipurile)

```json
{
  "versiune": 1,
  "lot": "lot-1",
  "produs": "Meniu digital și reclame video pentru restaurante",
  "clipuri": [
    {
      "fisier": "333f_h3-c2_9x16_larven.mp4",
      "voce": "333f",
      "hook": { "cod": "h3", "text": "Ai mese goale marțea seara?" },
      "cta": { "cod": "c2", "text": "Scrie-ne pe WhatsApp" },
      "stil": "larven",
      "format": "9x16",
      "durata": 27.4
    }
  ]
}
```

- **Obligatorii:** `clipuri` și, la fiecare clip, `fisier` (numele exact din folder).
- **Restul ajută la descrieri:** din `voce`, `hook`, `cta` și `stil`, Claude scrie descrierea și hashtag-urile fiecărui clip.
- **Câmpuri în plus:** se păstrează și ajung la Claude ca context. Pe primul nivel, de exemplu `produs`, `oferta`, `oras`; la un clip, `public` sau `nota`.
- **Citirea e iertătoare:**
  - `fișier` sau `fisier`, fără diferență de litere mari;
  - `durata` ca număr de secunde (`27.4`) sau ca text (`"27,4 s"`, `"0:27"`);
  - `hook` și `cta` ca `{ "cod", "text" }` sau ca text simplu;
  - `format` ca `"9x16"` sau `"9:16"`.
- **Ce verifică adminul:** clipurile din manifest care lipsesc din folder și clipurile din folder care lipsesc din manifest (ecranul „Clipuri”).

### În admin

1. **Rulează migrările 24, 25 și 26** (`supabase/migrations/00000000000024_postari_baza.sql`, `…25_postari_planuri.sql`, `…26_postari_coada.sql`) în Supabase → SQL Editor, în ordine. Verificarea de la finalul fiecăreia trebuie să arate `true`. Se pot rula de mai multe ori.
2. **Postări → Setări:** lipește adresa folderului „meridian reclame” de pe Drive. Contul legat la adminul firmei (OAuth) trebuie să-l vadă; dacă folderul e al aceluiași cont Google, îl vede.

### Instagram (la Meta)

Contul Meridian trebuie să fie **profesional** (Business sau Creator). Publicarea merge prin **Instagram Login**, fără pagină de Facebook. De ce: vezi „Decizii”.

1. **Produsul Instagram.** developers.facebook.com → *My Apps* → aplicația voastră (aceeași ca la reclame sau una nouă, de tip *Business*) → *Add product* → **Instagram** → *Set up* → **API setup with Instagram business login**.
2. **Rolul de tester.** *App roles → Roles → Add people* → **Instagram Tester** → numele contului Meridian. Apoi accepți invitația din contul Meridian: pe instagram.com, *Settings → Apps and websites → Tester invites* → *Accept*. Documentația Meta: „Standard Access is intended for apps that will only be used by people who have roles on them”. Pentru propriul cont nu trebuie App Review.
3. **Permisiunile:** `instagram_business_basic` și `instagram_business_content_publish`. Le vezi la pasul *Generate access tokens* din *API setup with Instagram business login*.
4. **Tokenul.** În aceeași pagină, *Add account* (te autentifici cu contul Meridian), apoi **Generate token** lângă cont. Copiază tokenul. Meta spune: „Access tokens from the App Dashboard are long-lived and are valid for 60 days.”
5. **În admin:** Postări → Setări → **Conturi** → lipește tokenul → „Conectează Instagram”. Adminul verifică la Instagram contul și permisiunea de publicare, apoi salvează tokenul criptat.
6. **De aici:** tokenul se reînnoiește singur, săptămânal (`refresh_access_token`). Dacă reînnoirea pică definitiv, coada se oprește și primești alertă pe email. Atunci repeți pașii 4–5.

### TikTok (la TikTok for Developers)

TikTok primește prin API clipul în ciornele tale, fără descriere: `inbox/video/init` are doar `source_info`. Descrierea o copiezi din „De publicat pe TikTok”.

1. **Aplicația.** developers.tiktok.com → *Manage apps* → *Connect an app*. Completezi iconița, numele, categoria, descrierea și linkurile paginilor de termeni și confidențialitate de pe meridianx.ro (TikTok le verifică). Platforma: **Web**, cu site-ul `https://www.meridianx.ro`.
2. **Login Kit** → *Redirect URI* pentru Web: **`https://www.meridianx.ro/admin/postari/conturi/tiktok/callback`**. Adresa trebuie scrisă exact așa (fără parametri), și apare și în admin, la Setări → Conturi → TikTok. Conectarea merge doar pe www.meridianx.ro, nu pe linkurile de preview.
3. **Content Posting API** → îl adaugi și pornești **Upload** (permisiunea `video.upload`). Postarea directă (*Direct Post*) nu trebuie pornită. Dacă TikTok cere verificarea domeniului (*URL properties → Verify*), verifici `www.meridianx.ro`.
4. **Permisiunile (scopes):** `user.info.basic` și `video.upload`.
5. **Sandbox, pentru proba ta:** *Sandbox* → creezi unul → *Target users* → adaugi contul TikTok Meridian (poate dura până la o oră să apară). Iei *Client key* și *Client secret* din sandbox. Documentația nu spune dacă sandbox-ul permite trimiterea în ciorne. Dacă nu merge, trimiți aplicația la review (*Submit for review*, cu un clip demo al fluxului).
6. **Vercel:** `TIKTOK_CLIENT_KEY` și `TIKTOK_CLIENT_SECRET` (din sandbox sau din aplicația aprobată), pentru Production, apoi **Redeploy**.
7. **În admin, pe www.meridianx.ro:** Postări → Setări → Conturi → **Conectează TikTok**. Intri cu contul Meridian și dai voie la urcare. Accesul (24 de ore) se reînnoiește singur. Conectarea ține un an, iar cu 14 zile înainte de expirare primești alertă să o refaci.

### Programarea (Supabase Cron)

Vercel Hobby rulează joburi programate doar o dată pe zi („Hobby accounts are limited to daily cron jobs”), așa că pe coadă o pornește Supabase Cron, la 5 minute. Nu se atinge `vercel.json`.

1. **Secretul.** Fă un șir aleator: în terminal, `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
2. **Vercel** → proiectul → *Settings → Environment Variables* → `POSTARI_CRON_SECRET` = șirul, pentru **Production**. Apoi **Redeploy**.
3. **Supabase → SQL Editor:** deschide `lib/postari/supabase-cron.sql`, înlocuiește `<SECRETUL>` cu același șir și rulează fișierul. El face trei lucruri:
   - pornește `pg_cron` și `pg_net`;
   - pune secretul în Supabase Vault (seiful bazei de date, nu vault-ul MERIDIAN);
   - programează jobul `postari-coada` la `*/5 * * * *`.
4. **Verifică după 10 minute:** în admin, la Coada, „Ultima rulare” trebuie să arate „Supabase Cron”. Dacă nu, interogările de verificare de la finalul fișierului SQL arată ce a răspuns adminul. 401 înseamnă secret diferit între Vercel și Vault.

Cum merge coada:
- **Fără dubluri.** O rulare ia postările ajunse la timp printr-o funcție din bază (`postari_claim`), cu termen de lucru de 90 de secunde. Două rulări simultane nu iau același rând.
- **Câte postări pe rulare.** Pe fiecare platformă pornește cel mult o postare nouă pe rulare. După o pauză, cele rămase în urmă pleacă la 5 minute una de alta, nu toate deodată.
- **Durata unei rulări.** Lucrează cel mult 45 de secunde, sub limita de 60 a funcției. Ce nu încape se reia la rularea următoare, de la pasul la care a rămas.
- **Reîncercările.** O eroare trecătoare se reîncearcă de încă 3 ori, la 2, 10 și 30 de minute. O eroare definitivă (de exemplu, clipul refuzat de platformă) oprește pe loc. Apoi postarea rămâne „eșuată”, cu motivul, cu „Reîncearcă” și cu alertă pe email.
- **Peste 6 ore întârziere.** O postare care n-a pornit în 6 ore de la ora ei (coada oprită, jobul nepornit) nu mai pleacă singură. Rămâne „eșuată”, cu motivul, ca să nu plece la o oră pe care n-ai ales-o.
- **Contul neconectat.** Postarea așteaptă, fără să consume încercări.
- **„Rulează acum”**, la Coada, face o rulare fără să aștepte jobul. Îți folosește la proba reală.

## De făcut de om

1. **Migrările 24, 25 și 26** în Supabase (vezi „În admin”).
2. **Folderul principal** în Postări → Setări.
3. **Instrucțiunile pentru terminalul de reclame** (secțiunea de mai sus) date terminalului care face clipurile.
4. **Programarea:** `POSTARI_CRON_SECRET` în Vercel, apoi `lib/postari/supabase-cron.sql` în Supabase (vezi „Programarea”).
5. **Migrarea 27** (`00000000000027_postari_conturi.sql`): conturile și bucket-ul `postari-temp`.
6. **`POSTARI_TOKEN_KEY` în Vercel** (Production): `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. **Nu o schimba după ce ai conectat conturile.** Dacă o schimbi, tokenurile vechi nu se mai pot decripta și conectezi conturile din nou.
7. **Instagram la Meta** (pașii de la „Instagram”), apoi tokenul în Setări → Conturi.
8. **TikTok la TikTok for Developers** (pașii de la „TikTok”), `TIKTOK_CLIENT_KEY` și `TIKTOK_CLIENT_SECRET` în Vercel, apoi „Conectează TikTok” în Setări → Conturi, pe www.meridianx.ro.
9. **Meniurile celorlalte module:** linkul „Postări” lipsește din meniul firmei (`components/firma/sidebar.tsx`, `components/firma/mobile-nav.tsx`), al reclamelor (`components/ads/sidebar.tsx`) și din bara panoului de lead-uri. Sunt zonele altor terminale. E câte un rând în fiecare, de adăugat de tine sau de terminalele lor.

## De testat cu contul real

1. **Descrierile scrise de Claude**, cu cheia reală: un lot mic (3–5 clipuri) din „Clipuri” → „Scrie planul cu Claude”. Citește descrierile: tonul, diacriticele, CTA-ul și dacă a inventat ceva (n-ar trebui). Testele au rulat pe un Claude simulat, care verifică doar forma cererii și a răspunsului.
3. **Instagram, cu un singur clip** (proba ta), după ce contul e conectat:
   - un plan cu **o** postare Instagram, la 15 minute de acum, aprobat;
   - la ora ei, „Rulează acum” la Coada (sau aștepți jobul);
   - în Coada: postarea trece prin „copiază clipul de pe Drive”, „Instagram procesează clipul” și ajunge „Publicată”, cu „Vezi postarea”;
   - în Supabase → Storage → `postari-temp` nu trebuie să rămână nimic după publicare;
   - încearcă o dată și un Trial Reel (`"tip": "trial_reel"`): trebuie să apară în aplicație ca Trial Reel. Cu `"absolvire": "automat"`, Instagram îl trece singur la urmăritori dacă merge bine.
   Toate formatele răspunsurilor sunt cele din documentația Meta, testate pe un Instagram simulat care descarcă clipul de la linkul semnat ca cel real. Neverificat pe real: forma exactă a răspunsului `GET /me`. Documentația arată `data[0]`, referința arată un obiect plat, iar codul le primește pe amândouă.
4. **Copia temporară pe Supabase-ul real:** urcarea TUS pe `<proiect>.storage.supabase.co` cu cheia de service. Testată pe o stocare simulată care cere protocolul TUS și bucăți de exact 6 MB.
5. **TikTok, cu un singur clip:**
   - conectarea pe www.meridianx.ro (redirectul înregistrat la TikTok);
   - un plan cu **o** postare TikTok, aprobat; la ora ei, „Rulează acum”;
   - pe telefon vine notificarea TikTok, iar clipul e în ciorne;
   - „De publicat pe TikTok” → „Copiază descrierea” → lipești în TikTok → „Postează” → „Publicat”;
   - verifică și că, dacă nu apeși „Publicat”, adminul o marchează singur în cel mult 30 de minute (TikTok raportează `PUBLISH_COMPLETE`).
   Neverificat pe real: dacă un sandbox sau o aplicație neauditată poate trimite în ciorne (documentația nu spune).
6. **Jobul din Supabase Cron:** `pg_cron`, `pg_net` și Vault nu există în Postgres-ul de test. Endpoint-ul a fost testat direct (secret, rulări, rulări simultane), dar SQL-ul jobului rulează prima oară la tine. După 10 minute, „Ultima rulare” trebuie să arate „Supabase Cron”.

---

## Previzualizările Vercel (ramura `feat/postari`)

| Faza | Commit | Preview |
|---|---|---|
| 0 — planul | `d7320b7` | https://meridianx-lgrv91ko2-stefanvladut661s-projects.vercel.app |
| 1 — Drive și manifest | `0c4945e` | https://meridianx-p3htf75bb-stefanvladut661s-projects.vercel.app |
| 2 — planul JSON | `546cfea` | https://meridianx-73d11136i-stefanvladut661s-projects.vercel.app |
| 3 — planul scris de Claude | `b85b594` | https://meridianx-omorz28za-stefanvladut661s-projects.vercel.app |
| 4 — coada și programarea | `ed7c814` | https://meridianx-b4uoaua12-stefanvladut661s-projects.vercel.app |
| 5 — Instagram | `03f488a` | https://meridianx-7vizaf64d-stefanvladut661s-projects.vercel.app |

## Jurnal

### Faza 0 — planul

- Am citit `CLAUDE.md`, adminul firmei, conexiunea Drive, portalul de reclame și scriptul care face clipurile.
- Am verificat în documentația oficială Meta, TikTok, Supabase și Vercel tot ce ține de formatul cererilor și al răspunsurilor. Citatele sunt în „Decizii” și în codul fiecărei faze.
- Ramura: `feat/postari`, din `feat/admin-firma`, într-un worktree separat (`../meridianx-postari`).

### Faza 1 — Drive și `manifest.json`

- **Migrarea 24** (`00000000000024_postari_baza.sql`): `postari_setari` (un rând), `postari_istoric`, `postari_clipuri` (ce s-a citit din fiecare clip). RLS doar pentru `is_lead_admin()`.
- **Drive** (`lib/postari/drive.ts`), doar cu funcțiile exportate de `lib/firma/drive/google.ts`:
  - **Folderul principal** se alege în Setări, prin adresă sau id. La salvare se citește la Google, ca să se vadă că există și ca să i se țină numele.
  - **Calea din plan** se parcurge segment cu segment. Merge și cu numele folderului principal în față (`meridian reclame/lot-1`), și fără (`lot-1`). Numele se compară fără litere mari și fără diacritice. Un segment greșit spune ce subfoldere există de fapt acolo.
  - **Lista** desparte subfolderele, clipurile (MP4/MOV) și `manifest.json`.
- **`manifest.json`** (`lib/postari/manifest.ts`): formatul e scris mai sus, pentru terminalul de reclame. Citirea e iertătoare (chei cu sau fără diacritice, durata ca număr sau text, hookul și CTA-ul ca obiect sau text). Câmpurile necunoscute se păstrează pentru Claude.
- **Cititorul de MP4** (`lib/postari/mp4.ts`, fără pachete), după standardul ISO BMFF. Scoate dimensiunile (cu rotația), durata, cadrele pe secundă, codecurile, frecvența și canalele audio, debitul video și ordinea `moov` / `mdat`.
  - **Comparat cu `ffprobe`** pe 6 clipuri generate cu ffmpeg (1080×1920 și 720×1280, 16:9, 2 s, fără `faststart`, 25 și 30 fps, mono și stereo): aceleași valori la toate.
- **Limitele** (`lib/postari/limite.ts`) sunt luate din documentația Instagram și TikTok, cu citatele în cod:
  - **9:16:** cu 1% toleranță;
  - **Instagram:** MP4/MOV, `moov` la început, H.264/HEVC, AAC de cel mult 48 kHz, 23–60 de cadre pe secundă, lățime de cel mult 1920, cel mult 25 Mbps, între 3 s și 15 min, cel mult 300 MB, plus limita stocării temporare;
  - **TikTok:** H.264/H.265/VP8/VP9, 23–60 de cadre pe secundă, între 360 și 4096 px, cel mult 10 min.
- **Ecranul „Clipuri”** (`/admin/postari/clipuri`):
  - subfolderele, cu calea navigabilă;
  - `manifest.json` ca tabel, cu clipurile care lipsesc din folder și cele din folder care lipsesc din manifest;
  - clipurile, cu ce s-a citit și cu „Instagram: da/nu”, „TikTok: da/nu” și motivul;
  - „Citește clipurile” le ia pe rând, cu progres anunțat. Fiecare se descarcă o singură dată, iar rezultatul rămâne în `postari_clipuri`;
  - „Vezi clipul” deschide playerul Drive-ului doar la cerere.
- **Setări** (`/admin/postari/setari`): legătura Drive, folderul principal (citit la Google), sloturile implicite, distanța minimă, plafoanele (Instagram 50, TikTok 5), limita stocării temporare și emailul pentru alerte.
- **Verificat** pe Postgres real (migrarea rulată), cu PostgREST, Drive și autentificarea simulate, în Chrome headless:
  - folderul inexistent e refuzat, apoi folderul bun salvat, cu numele citit;
  - orele sunt sortate și completate („9:30” → „09:30”);
  - calea scrisă cu numele rădăcinii și cu litere mari („meridian reclame/LOT-1”) e găsită;
  - manifestul: fișierul lipsă e marcat, clipurile din afara manifestului sunt numite, cheia `fișier` e citită;
  - cele 5 clipuri sunt citite; 16:9 e refuzat, 2 s și fără `faststart` sunt refuzate pe Instagram;
  - citirile se țin minte; subfolderul inexistent e explicat; istoricul e scris;
  - la 360 px, fără scroll lateral; consola e curată.

### Faza 2 — planul JSON

- **Migrarea 25** (`00000000000025_postari_planuri.sql`):
  - `postari_planuri`: planurile aprobate, cu amprenta unică (același plan nu se aprobă de două ori);
  - `postari`: câte un rând pe postare și platformă, cu ora rezolvată, starea și coloanele de care au nevoie fazele 4–6 ca să reia o postare întreruptă;
  - RLS doar pentru `is_lead_admin()`.
- **Formatul** (`lib/postari/plan-schema.ts`), descris mai sus la „Planul JSON”. Câmpurile necunoscute sunt erori, cu numele lor.
- **Verificarea** (`lib/postari/plan-verify.ts`):
  - folderul și fișierele, după nume;
  - clipurile citite din MP4 (cele necitite se citesc pe loc, cu buget de timp, iar editorul repetă verificarea până le citește pe toate);
  - limitele Instagram și TikTok, descrierile, orele fixe, sloturile, distanța minimă, plafoanele pe ferestre de 24 de ore (cu ce e deja în coadă) și dublurile.
- **Previzualizarea** (`components/postari/plan-preview.tsx`): pe zile, fiecare postare cu ora (fixă sau slot), clipul (ce s-a citit, plus „Vezi clipul” și „Deschide în Drive”), descrierea exact cum pleacă, cu numărul de caractere, platformele cu tipul (Reel, Trial Reel manual sau automat, TikTok în ciorne) și problemele.
- **Aprobarea** (`lib/postari/planuri.ts`): planul se verifică din nou pe server. Se aprobă doar dacă orele ies exact ca în previzualizarea văzută. Toate rândurile intră într-o singură instrucțiune: ori toate, ori niciunul.
- **Editorul** ține ciorna în browser. Orice schimbare de text după verificare stinge „Aprobă planul” până la verificarea nouă.
- **Verificat** pe Postgres real, cu Drive și autentificarea simulate, în Chrome headless (26 de verificări, toate trecute):
  - sintaxa: ghilimelele tipografice explicate; blocul ```json, comentariile și virgulele de la final iertate; câmpul greșit („descrire”) numit;
  - planul cu erori: 16:9, fișier lipsă (cu folderul în care s-a căutat), hashtag cu spațiu, două ore la 5 minute una de alta pe Instagram, același clip de două ori. „Aprobă planul” rămâne stins;
  - planul bun: numele scris cu alte litere găsit, cu atenționare; slotul de 12:30 sărit fiindcă e luat de ora fixă; postarea pusă la 19:00;
  - aprobarea: 3 rânduri în coadă (2 Instagram, 1 TikTok), cu orele și opțiunile corecte;
  - al doilea plan vede coada: dublura e semnalată, iar ora fixă suprapusă cu coada e refuzată;
  - un slot luat de alt plan între verificare și aprobare duce la refuz, fără nimic scris;
  - istoricul are aprobarea și refuzul; la 360 px, fără scroll lateral; Tab trece din plan la „Verifică planul”; consola e curată.
- **Observație pentru celelalte module:** în admin, clasa `font-md-mono` nu are efect (`--md-font-mono` e gol în `data-scope="gate"`), deci textul „mono” apare în Satoshi. Postările folosesc direct `var(--font-jbmono)`. Adminul firmei (`components/firma/sidebar.tsx`, `drive-status.tsx`) are aceeași problemă: e zona altui terminal, așa că doar o notez.

### Faza 3 — planul scris de Claude

- **`lib/postari/claude-plan.ts`**, după tiparul citirii bonurilor din adminul firmei:
  - SDK-ul oficial, `claude-opus-5-5`, răspuns structurat validat cu zod (`output_config.format`);
  - `fallbacks: "default"`: dacă filtrele de siguranță refuză cererea, serverul încearcă alt model;
  - efort `low`: sunt texte scurte, iar un apel trebuie să încapă în cele 60 de secunde ale funcției Vercel.
- **Ce primește Claude:** contextul lotului din manifest (`produs`, `oferta`, `lot`…), apoi pentru fiecare clip hookul, CTA-ul, vocea, stilul, durata și câmpurile în plus, plus indicațiile tale.
- **Regulile din prompt:** română cu diacritice, vocea diviziei video (direct, sigur pe el, puțin obraznic), cel mult 300 de caractere, deschidere din hook, încheiere cu CTA-ul. Fără nimic inventat (prețuri, cifre, clienți, orașe), fără formule de agenție, fără repetiții între clipuri, 3–6 hashtag-uri.
- **Loturi de câte 5 clipuri.** Fiecare lot primește descrierile deja scrise, ca să nu se repete. Hashtag-urile se curăță pe server (fără `#`, cu litere mici; cele cu spații sau semne se scot). Descrierile peste 300 de caractere se taie la ultimul cuvânt întreg.
- **Ecranul „Clipuri” → „Scrie planul cu Claude”**, sub `manifest.json`:
  - alegi platformele, Reel sau Trial Reel (cu trecerea manuală sau automată la urmăritori), ziua de început și orele sloturilor (implicit din Setări), plus indicații opționale;
  - intră doar clipurile din manifest găsite pe Drive, în ordinea din manifest;
  - progresul e anunțat, iar „Oprește după lotul ăsta” oprește la finalul lotului;
  - la o eroare (limita de cereri, rețea) rămâne ce s-a scris, cu „Continuă” de unde s-a oprit și „Deschide în editor ce s-a scris”;
  - un clip sărit de Claude primește descriere goală, iar verificarea o semnalează.
- **Planul ajunge în editorul de la „Plan nou”**, cu anunțul „Planul scris de Claude e mai jos”. Acolo îl corectezi, îl verifici și îl aprobi ca pe orice plan. Clipurile se iau din manifestul citit pe server: din browser vin doar numele lor.
- **Verificat** pe Anthropic simulat (20 de verificări, toate trecute):
  - limita de cereri explicată, fără nimic pierdut;
  - 7 clipuri scrise în două loturi (5 + 2), iar al doilea lot a primit cele 5 descrieri deja scrise;
  - modelul, efortul, schema, `fallbacks` și antetul beta, verificate pe fiecare cerere;
  - planul: folderul, numele lotului, orele sortate („19:00, 9:00” → `09:00`, `19:00`), Trial Reel automat și TikTok în ciorne;
  - hashtag-urile curățate; planul a trecut de verificare;
  - clipul absent de pe Drive a rămas pe dinafară, iar clipul sărit de Claude a primit descriere goală;
  - istoricul are planurile scrise și eșecul; la 360 px, fără scroll lateral; consola e curată.

### Faza 4 — coada și programarea

- **Migrarea 26** (`00000000000026_postari_coada.sql`):
  - `postari_claim`: luarea din coadă, cu `for update skip locked` și condiția verificată din nou pe rândul blocat; executabilă doar cu cheia de service;
  - `postari_rulari`: fiecare rulare;
  - `postari_alerte`: o alertă pe cheie și zi;
  - coloanele pentru „Reîncearcă” și pentru verificarea ciornelor TikTok;
  - RLS doar pentru `is_lead_admin()`.
- **Rularea** (`lib/postari/coada.ts`), în ordine:
  - întreținerea conturilor, care se face și cu coada oprită, ca tokenurile să nu expire;
  - curățenia copiilor temporare;
  - postările rămase în urmă peste 6 ore;
  - luarea din coadă și pașii, cu buget de 45 de secunde.
- **Scrierea în rânduri:** orice scriere într-un rând luat e condiționată de `lucrata_de` = rularea. Un rând scos între timp nu se suprascrie.
- **Contractul cu platformele** (`lib/postari/platforme.ts`): fiecare pas întoarce ce s-a întâmplat (progres, așteptare, publicată, în ciorne, eroare trecătoare sau definitivă, blocată de cont). Coada decide starea, reîncercarea, alerta și istoricul. Instagram și TikTok se leagă în fazele 5 și 6; până atunci, postările lor așteaptă cu „Contul … nu e conectat”.
- **Endpoint-ul** `POST /admin/postari/cron`, cu `Authorization: Bearer <POSTARI_CRON_SECRET>`: fără secret, 401 în producție; un GET primește 405. SQL-ul jobului e în `lib/postari/supabase-cron.sql`.
- **Ecranul „Coada”** (`/admin/postari`):
  - „Oprește coada”, cu motivul opțional, care apare în bara de sus pe orice ecran; „Pornește coada”; „Rulează acum”;
  - ultima rulare, cu avertisment dacă jobul n-a mai rulat de 15 minute, și alertele din ultimele două zile;
  - lista pe zile, cu „De văzut” (eșuatele) sus;
  - pe fiecare postare: ora (fixă sau slot), platforma și tipul, starea, pasul sau motivul așteptării, eroarea, linkul;
  - „Reîncearcă” pe eșuate. „Scoate din coadă” doar înainte de pasul fără întoarcere; o postare publicată nu se poate scoate.
- **Alertele** (`lib/postari/alerte.ts`) pleacă prin Resend, la adresa din Setări sau la ADMIN_EMAILS, o dată pe zi pe cheie. Le folosesc fazele 5–7: o postare eșuată definitiv, coada oprită de un token.
- **Găsit și ocolit:** la un UPDATE cu filtru `or`, PostgREST v12 aplică filtrul și pe rândurile întoarse. Dacă `select`-ul nu are coloanele din filtru, cererea pică cu „column does not exist”. Selecturile acelor cereri le includ acum.
- **Verificat** pe Postgres real și PostgREST, cu Drive simulat (34 de verificări, toate trecute):
  - endpoint-ul: 401 fără secret și cu secret greșit, 405 la GET;
  - o rulare ia cel mult una nouă pe platformă, iar a doua o ia pe următoarea;
  - postarea de acum 7 ore devine eșuată, cu motivul;
  - contul neconectat: postarea se întoarce la „planificată”, așteaptă 15 minute, fără încercare consumată;
  - două rulări simultane nu iau același rând; un rând în lucrul altei rulări nu se ia, iar unul cu termenul expirat se reia de la pasul lui;
  - ecranul:
    - avertismentul „n-a rulat niciodată” și „Rulează acum” cu rezumatul;
    - eșuata la „De văzut” și „Reîncearcă”: repusa nu mai e prinsă de regula celor 6 ore;
    - „Scoate din coadă”, cu scoasele ascunse;
    - publicata are „Vezi postarea” și n-are „Scoate”;
    - oprirea, cu motivul în bara de sus, și rularea care nu ia nimic cu coada oprită; pornirea;
    - istoricul are toate acțiunile;
  - la 360 px, fără scroll lateral; primul Tab duce la „Sari la conținut”.

### Faza 5 — Instagram

- **Migrarea 27** (`00000000000027_postari_conturi.sql`):
  - `postari_conturi`, cu tokenurile criptate. Adminii pot citi prin REST doar coloanele de stare; tokenurile le citește doar cheia de service. Verificarea de la final o confirmă;
  - bucket-ul privat `postari-temp`, de 50 MB, doar MP4/MOV.
- **Criptarea** (`lib/postari/cripto.ts`): AES-256-GCM cu `POSTARI_TOKEN_KEY`, iar platforma intră în datele autentificate.
- **Clientul Instagram** (`lib/postari/instagram.ts`), după documentația oficială (v26.0, `graph.instagram.com`):
  - `/me?fields=user_id,username`, plus `refresh_access_token`;
  - containerul `REELS` cu `video_url`, `caption`, `share_to_feed` sau, la Trial Reel, `trial_params.graduation_strategy`: `MANUAL` = „can be manually graduated in the native app”, `SS_PERFORMANCE` = „will be automatically graduated if the trial reel performs well”; plus `thumb_offset`;
  - starea containerului, `media_publish`, `permalink`, ultimele Reels, `content_publishing_limit`;
  - **nicio funcție de ștergere sau de editare.**
  - Erorile sunt clasificate după codurile și subcodurile din documentație (2207026 format, 2207042 plafon, 2207050 cont restricționat, 2207051 spam, 190 token…): trecătoare (cu container nou sau nu), definitive, de cont (opresc coada), de limită (așteaptă).
- **Pașii postării** (`lib/postari/instagram-handler.ts`):
  - **copiere:** descărcarea de pe Drive, cu verificarea mărimii față de cea de la aprobare (un clip schimbat după aprobare nu se publică), apoi TUS pe bucăți de 6 MB, cu progresul scris după fiecare bucată;
  - **container:** plafonul pe 24 de ore (cel mai mic dintre Setări și `quota_total`), linkul semnat de 2 ore, containerul;
  - **procesare:** încă două verificări în aceeași rulare, apoi o dată pe minut, cum cere documentația. Containerul expirat sau în eroare se reface, iar procesarea de peste 30 de minute se reîncearcă;
  - **publicare:** `ig_publicare_la` se scrie înainte de `media_publish`. Fără răspuns, rularea următoare citește containerul: `PUBLISHED` înseamnă publicată, iar postarea se caută printre ultimele Reels (fără să ia una deja atribuită). Republicarea n-are loc;
  - copia temporară se șterge după publicare, după eșecul definitiv și, ca plasă de siguranță, la fiecare rulare.
- **Tokenul:**
  - se reînnoiește săptămânal sau când mai are sub 14 zile, dar abia după 24 de ore de la ultima reînnoire, cum cere documentația;
  - dacă reînnoirea pică definitiv, contul trece la „expirat”, coada se oprește, iar alerta pleacă pe email;
  - dacă reînnoirea pică trecător, se reîncearcă; cu sub 7 zile rămase, primești alertă.
- **Setări → Conturi:** lipești tokenul din panoul Meta. Se verifică la Instagram contul și permisiunea de publicare. Tokenul nu se mai arată, nu intră în istoric și nu ajunge în browser. „Lipește alt token”, „Deconectează”.
- **Verificat** pe Instagram, Storage și Resend simulate (38 de verificări, toate trecute):
  - conectarea: tokenul greșit e refuzat; cel bun e conectat cu numele contului, criptat în bază, absent din pagină și din istoric;
  - Trial Reel automat, clip de 25 MB:
    - copiat în 5 bucăți (4 × 6 MB plus restul), procesat și publicat într-o singură rulare (24 s);
    - `trial_params: SS_PERFORMANCE`, fără `share_to_feed`, iar descrierea e cea din plan;
    - Instagram simulat a descărcat clipul de la linkul semnat;
    - copia ștearsă, iar istoricul are linkul;
  - Reel fără feed, cu copertă: `share_to_feed: false`, `thumb_offset: 1500`;
  - copia întreruptă la bucata 2: încercare ratată (nu eșuată), reîncercare la 2 minute; reluarea a citit offsetul (6 MB) și a urcat doar restul, fără urcare nouă;
  - publicarea fără răspuns: postarea a așteptat; rularea următoare a găsit-o publicată, cu o singură cerere de publicare;
  - formatul refuzat (2207026): eșuată după o încercare, cu motivul în română, alertă pe email la adresa din Setări, o singură dată pe zi; copia ștearsă;
  - plafonul atins: postarea a așteptat 30 de minute, fără încercare consumată și fără container;
  - tokenul: reînnoit singur după 7 zile; apoi refuzat la reînnoire, cu contul „expirat”, coada oprită și alerta trimisă. Ecranul arată motivul, iar Setările arată „Token expirat” și formularul;
  - nicio cerere neașteptată către Instagram sau stocare.

### Faza 6 — TikTok

- **Clientul TikTok** (`lib/postari/tiktok.ts`), după documentația oficială: Login Kit for Web (`v2/auth/authorize`, `v2/oauth/token`, `v2/oauth/revoke`), `v2/user/info`, `inbox/video/init`, urcarea pe bucăți și `status/fetch`. **Nicio postare directă, ștergere sau editare.**
  - **Bucățile**, după ghidul de transfer: sub 10 MB, clipul pleacă întreg (sub 5 MB așa cere documentația); peste 10 MB, bucăți de 10 MB, iar ultima ia restul. Numărul de bucăți e mărimea împărțită la bucată, rotunjită în jos.
  - **Erorile** sunt clasificate după codurile din documentație: `access_token_invalid`, `scope_not_authorized`, `spam_risk_too_many_pending_share`, `rate_limit_exceeded`, `invalid_param(s)`, plus motivele `fail_reason` (`file_format_check_failed`, `internal`, `auth_removed`…).
- **Pașii** (`lib/postari/tiktok-handler.ts`):
  - **plafonul:** cel mult 5 ciorne în 24 de ore, sau cât e în Setări, dacă e mai puțin;
  - **descărcarea:** de pe Drive, cu verificarea mărimii față de cea de la aprobare;
  - **init:** `publish_id` și adresa de urcare se scriu în rând înainte de prima bucată;
  - **urcarea:** bucățile în ordine, cu progresul scris după fiecare;
  - **verificarea:** `SEND_TO_USER_INBOX` înseamnă trimisă în ciorne;
  - **după trimitere:** o verificare la 30 de minute, timp de 7 zile. `PUBLISH_COMPLETE` înseamnă că ai publicat-o din aplicație, iar postarea se marchează singură.
- **Fără dubluri:** o trimitere întreruptă continuă de la bucata la care a rămas. Una veche (adresa de urcare are o oră) se verifică întâi la TikTok: dacă TikTok are deja clipul, nu se trimite din nou.
- **Tokenurile:**
  - accesul (24 de ore) se reînnoiește cu 10 minute înainte să expire, iar tokenul de reînnoire nou se salvează, fiindcă TikTok îl poate schimba;
  - dacă reînnoirea e refuzată, contul trece la „expirat”, coada se oprește și primești alertă;
  - conectarea ține 365 de zile, iar cu 14 zile înainte primești alertă.
- **Conectarea:**
  - `/admin/postari/conturi/tiktok` pornește OAuth, cu `state` aleator într-un cookie httpOnly de 10 minute. Doar un admin autentificat o poate porni;
  - `/admin/postari/conturi/tiktok/callback` verifică `state`, cere `video.upload`, salvează tokenurile criptate și te întoarce la Setări, cu rezultatul spus;
  - „Deconectează” revocă accesul și la TikTok.
- **„De publicat pe TikTok”** (`/admin/postari/tiktok`), făcută pentru telefon:
  - cei patru pași, apoi fiecare ciornă cu descrierea mare (16 px), „Copiază descrierea” (cu selectare, dacă browserul nu lasă clipboard-ul) și „Publicat”, butoane de 48–52 px;
  - plus „Urmează”, eșuatele cu link spre coadă și publicatele din ultimele 7 zile;
  - în bara de jos a telefonului, a doua după Coada.
- **`lib/postari/verify-api.mjs`** (`node lib/postari/verify-api.mjs`) verifică în cod că Instagram și TikTok folosesc doar endpoint-urile și metodele permise. Pică la orice apel nou nelistat. L-am verificat: un apel DELETE adăugat într-o copie e prins în patru feluri.
- **Verificat** pe TikTok simulat, care cere regulile de bucăți, ordinea, `Content-Range` și doar `source_info` la init (32 de verificări, toate trecute):
  - conectarea:
    - anulată în TikTok, fără `video.upload` și cu `state` greșit: toate refuzate, explicate, nimic salvat;
    - cea bună: tokenurile criptate, refresh-ul de 365 de zile; adresa finală nu mai are codul în ea;
  - trimiterea: 25 MB în 2 bucăți (10 MB și 15,2 MB), un clip de 2,8 MB într-una singură; init cu doar `source_info`, apoi `SEND_TO_USER_INBOX` și „în ciorne”;
  - la 360 px:
    - descrierea întreagă, cu diacritice și emoji, iar „Copiază descrierea” pune exact textul în clipboard;
    - „Publicat” marchează postarea, cu numele tău;
    - fără scroll lateral, butoane de cel puțin 44 px;
  - `PUBLISH_COMPLETE` raportat de TikTok: marcată singură, iar istoricul o are;
  - urcarea întreruptă la bucata 2: încercare ratată; reluarea a continuat aceeași trimitere de la bucata 2, fără init nou;
  - plafonul din Setări și refuzul TikTok pentru prea multe ciorne: postarea așteaptă, fără încercare consumată;
  - `file_format_check_failed`: eșuată pe loc, cu motivul în română;
  - tokenul reînnoit înainte să expire; refresh-ul refuzat oprește coada, cu alertă;
  - „Deconectează” revocă accesul la TikTok; nicio cerere neașteptată.
