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
| `POSTARI_TOKEN_KEY` | Cheia care criptează tokenurile Instagram și TikTok: 32 de octeți în base64. | 5 |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | Aplicația de dezvoltator TikTok (Login Kit + Content Posting API). | 6 |
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

1. **Rulează migrările 24 și 25** (`supabase/migrations/00000000000024_postari_baza.sql`, apoi `00000000000025_postari_planuri.sql`) în Supabase → SQL Editor, în ordine. Verificarea de la finalul fiecăreia trebuie să arate `true`. Se pot rula de mai multe ori.
2. **Postări → Setări:** lipește adresa folderului „meridian reclame” de pe Drive. Contul legat la adminul firmei (OAuth) trebuie să-l vadă; dacă folderul e al aceluiași cont Google, îl vede.

## De făcut de om

1. **Migrările 24 și 25** în Supabase (vezi „În admin”).
2. **Folderul principal** în Postări → Setări.
3. **Instrucțiunile pentru terminalul de reclame** (secțiunea de mai sus) date terminalului care face clipurile.
4. **Meniurile celorlalte module:** linkul „Postări” lipsește din meniul firmei (`components/firma/sidebar.tsx`, `components/firma/mobile-nav.tsx`), al reclamelor (`components/ads/sidebar.tsx`) și din bara panoului de lead-uri. Sunt zonele altor terminale. E câte un rând în fiecare, de adăugat de tine sau de terminalele lor.

## De testat cu contul real

*Se completează pe faze.*

---

## Previzualizările Vercel (ramura `feat/postari`)

| Faza | Commit | Preview |
|---|---|---|
| 0 — planul | `d7320b7` | https://meridianx-lgrv91ko2-stefanvladut661s-projects.vercel.app |
| 1 — Drive și manifest | `0c4945e` | https://meridianx-p3htf75bb-stefanvladut661s-projects.vercel.app |

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
