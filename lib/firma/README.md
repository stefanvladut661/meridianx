# Adminul firmei — `/admin/firma`

Unealta de zi cu zi pentru toată firma: clienți și contracte, facturi prin
Oblio, încasări din Banca Transilvania (BT Go), cheltuieli, pachetul lunar
pentru contabil, lista de accese și un panou cu tot. Stă lângă lead-uri și
portalul de reclame, în același admin, cu aceeași autentificare.

Zona modulului: `app/(admin)/admin/firma/**`, `lib/firma/**`,
`components/firma/**` și migrările `00000000000016_*` în sus.

---

## Regulile care nu se schimbă (și unde le ține codul)

| Regulă | Cum e ținută |
|---|---|
| Nimic fiscal nu pleacă fără aprobare | Factura stă ca ciornă în admin. Emiterea în Oblio, trimiterea în e-Factura și emailul pornesc doar din butoanele „Aprobă” și „Trimite”. Cron-ul doar pregătește ciorne și verifică. |
| Adminul nu anulează, nu stornează, nu șterge facturi | `lib/firma/oblio/api.ts` nu are funcții pentru `cancel`, `restore`, `delete`. `lib/firma/verify-oblio.mjs` pică dacă apare vreuna sau dacă se folosește alt endpoint decât cele permise. |
| Parolele nu stau în admin | „Accese” are doar câmpul „unde e parola” (ex. „managerul de parole → Firmă”). Niciun câmp de parolă, nicio cheie. |
| Cheile stau doar în Vercel | Oblio, Google, Anthropic și Resend se citesc din variabile de mediu. În repo nu sunt chei, CUI-uri, nume de clienți sau date financiare. Datele reale stau doar în Supabase. |
| Fiecare acțiune intră în istoric | `firma_istoric`: cine, ce, când, rezultatul. Se scrie din fiecare acțiune de server și din cron. |
| RLS pe tabelele noi | Fiecare tabel `firma_*` are RLS activ și o politică de citire doar pentru `is_lead_admin()`. Scrierile trec prin cheia de service, pe server. |
| Pe conturile reale, doar citiri cât se lucrează | Testele rulează pe Oblio, Drive și Supabase simulate. Emiterea reală se testează doar cu o proformă marcată „TEST — NU SE PLĂTEȘTE”, ștearsă după (vezi „De testat cu cheile reale”). |

---

## Planul (faza 0)

### Cadrul

- **Același aspect ca portalul de reclame** (`feat/ads-portal-v2`, ajuns pe `main`): meniu în stânga, bară sus cu perioada și clientul, tabele dense, panou lateral la click pe rând, alb cu albastrul Meridian.
- **Tema** vine din `app/(admin)/admin/ads/portal.css` (clasa `.ads-portal`). O import și o folosesc așa cum e, fără modificări.
- **Meniul și bara de sus** ale reclamelor sunt făcute doar pentru reclame: au nume, linkuri și selecția de canal fixate în ele. Așa că modulul are cadrul lui, în `components/firma/`, cu aceleași clase și aceleași măsuri. CLAUDE.md permite duplicarea temporară. Unificarea într-un cadru comun pentru tot adminul e o decizie de luat la sfârșit, cu terminalul care lucrează la reclame.
- **Meniul comun:** linkul „Firmă” apare în bara panoului de lead-uri, lângă „Reclame”. În meniul din stânga al reclamelor (`components/ads/sidebar.tsx`) nu l-am pus, pentru că e zona celuilalt terminal. E o schimbare de un rând, de făcut acolo.

### Modelul de date (migrările 16–23)

| Migrare | Tabele |
|---|---|
| 16 `firma_baza` | `firma_setari` (un rând: emailul contabilului, seria, folderul Drive, modelul de nume al lunii), `firma_istoric`, `firma_clienti`, `firma_contacte`, `firma_contracte`, `firma_preturi` (prețul pe perioade) |
| 17 `firma_facturi` | `firma_facturi` (ciorne și emise, cu pașii aprobării: emitere → e-Factura → Drive → email) |
| 18 `firma_drive` | `firma_luni_drive` (folderul fiecărei luni), `firma_fisiere` (ce s-a urcat și unde) |
| 19 `firma_cheltuieli` | `firma_cheltuieli`, plus bucket-ul privat `firma-docs` pentru fișierele urcate |
| 20 `firma_incasari` | `firma_importuri_banca`, `firma_tranzactii`, `firma_formate_banca` (maparea coloanelor exportului) |
| 21 `firma_contabil` | `firma_pachete` (verificarea lunii, zip-ul, emailul) |
| 22 `firma_accese` | `firma_conturi` |
| 23 `firma_alerte` | `firma_rezumate` (ce rezumat de dimineață a plecat, ca să nu plece de două ori) |

### Fazele

1. **Clienți și contracte.** Clientul cu persoane de contact și email de facturare, importul datelor firmei din Oblio, contractul cu servicii, abonamentul lunar și bugetul de reclame recomandat, care nu se facturează. Prețul pe perioade, ziua emiterii, scadența și legătura cu clientul din portalul de reclame.
2. **Facturi.** Ciornele lunii, din contractele active. Corectarea lor, apoi „Aprobă”: emitere în Oblio, fără TVA, cu `idempotencyKey`, apoi e-Factura, PDF-ul pe Drive și emailul pregătit, care pleacă la „Trimite”. Factura manuală. Lista cu stările: ciornă, emisă, trimisă în e-Factura, încasată, întârziată.
3. **Drive.** Folderul lunii, creat singur, plus urcarea facturilor, a cheltuielilor și a extraselor. Autentificarea Google: cont de serviciu sau OAuth, vezi „Decizii”.
4. **Cheltuieli.** Urcare din telefon, citirea furnizorului, a datei și a sumei cu Claude (vision), corectură, categorie și fișierul în folderul lunii.
5. **Încasări.** Importul exportului BT Go. Potrivirea plăților cu facturile: cea sigură marchează factura încasată în Oblio, cea nesigură așteaptă confirmarea. Plățile ieșite se leagă de cheltuieli, iar extrasul ajunge pe Drive.
6. **Pachetul pentru contabil.** Verifică ce lipsește, face zip-ul lunii și îl pune pe Drive. Emailul către contabil pleacă la „Trimite”.
7. **Accese.** Lista conturilor firmei: cine are acces, dacă are 2FA, unde e parola, abonamentul și reînnoirea. Alertă cu 7 zile înainte de reînnoire.
8. **Panou și alerte.** Cifrele lunii, alertele, banii pe reclame pe client și rezumatul de dimineață pe email, doar în zilele cu alerte.

---

## Decizii

- **Drive și contul de serviciu.** Un cont de serviciu Google nu are spațiu de stocare propriu și nu poate deține fișiere într-un Drive personal. Dacă folderul de facturi e în „My Drive” al unui cont Gmail, crearea folderelor merge, dar urcarea fișierelor e refuzată cu `storageQuotaExceeded`. Merge cu contul de serviciu doar dacă folderul e într-un **Shared Drive**, care există numai în Google Workspace. Așa că `lib/firma/drive` acceptă două moduri și îl folosește pe cel configurat:
  - **cont de serviciu** (`GOOGLE_SERVICE_ACCOUNT_JSON`): pentru un Shared Drive;
  - **OAuth ca tine** (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`): pentru Drive-ul personal. Fișierele rămân ale tale.
- **Structura folderului de pe Drive** nu e încă hotărâtă (folderul real e pe alt Drive). Rădăcina și modelul de nume al lunii se setează în „Setări”, iar valoarea provizorie e `{luna} {an}`, de exemplu „aprilie 2026”. Nu se scrie nimic pe Drive până nu e setată rădăcina.
- **Emailurile.** `lib/email/send.ts` exportă doar emailurile lead-urilor și ale sondei, nu un trimițător general cu atașamente. Modulul trimite prin Resend direct (`lib/firma/email.ts`), cu aceleași variabile (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`). `lib/email/**` rămâne neatins.
- **Exportul BT Go.** Fără un export real nu ghicesc coloanele. Importul citește CSV-ul sau tabelul, iar la primul import îmi arăți tu care coloană e data, suma, detaliile și contrapartida. Maparea se salvează după antetul fișierului și se refolosește. Când îmi dai un export real, fixez formatul lui ca implicit.

---

## Variabilele din Vercel

| Variabilă | Ce e | Faza |
|---|---|---|
| `OBLIO_EMAIL` | Emailul cu care intri în Oblio (`client_id` la API). | 1 |
| `OBLIO_API_SECRET` | Oblio → Setări → Date cont → „Secret API” (`client_secret`). **Se schimbă când se resetează parola contului Oblio**: după o resetare, pune-l din nou în Vercel. | 1 |
| `OBLIO_CIF` | CUI-ul firmei tale, cum apare în Oblio (cu sau fără „RO”, ca acolo). | 1 |

| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN` | Drive prin OAuth, ca tine. Pentru un folder din „My Drive” (cont Gmail). | 3 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Drive prin cont de serviciu: JSON-ul cheii, ca text sau base64. **Doar** pentru un folder dintr-un Shared Drive (Google Workspace). | 3 |

### Drive (pas cu pas)

Promptul cerea un cont de serviciu cu acces de editor la folder. Un cont de serviciu nu poate însă urca fișiere într-un folder din „My Drive” (vezi „Decizii”). Alege varianta după unde stă folderul:

**A. Folderul e în „My Drive” (cont Gmail) — OAuth, ca tine**
1. [Google Cloud Console](https://console.cloud.google.com) → un proiect (sau unul nou) → **APIs & Services → Library** → activează **Google Drive API**.
2. **OAuth consent screen**: tip *External*. Adaugă-te la *Test users*, apoi apasă **Publish app** (*In production*). În modul *Testing*, Google face ca tokenul să expire după 7 zile. Google va arăta că aplicația „nu e verificată”: e normal pentru o aplicație folosită doar de tine.
3. **Credentials → Create credentials → OAuth client ID** → *Web application* → la *Authorized redirect URIs* pune `https://developers.google.com/oauthplayground`.
4. Deschide [OAuth Playground](https://developers.google.com/oauthplayground):
   - rotița din dreapta-sus → *Use your own OAuth credentials* → pune ID-ul și secretul de la pasul 3;
   - la *Step 1* scrie scope-ul `https://www.googleapis.com/auth/drive` → **Authorize APIs** → intră cu contul care are folderul;
   - *Step 2* → **Exchange authorization code for tokens** → copiază **Refresh token**.

   Scope-ul complet `drive` e necesar fiindcă folderul există deja: scope-ul îngust `drive.file` vede doar ce creează aplicația.
5. Vercel → `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN` → **Redeploy**.

**B. Folderul e într-un Shared Drive (Google Workspace) — cont de serviciu**
1. Google Cloud Console → activează **Google Drive API** (ca la A.1).
2. **IAM & Admin → Service Accounts → Create service account**, fără roluri. Apoi **Keys → Add key → JSON**: se descarcă un fișier.
3. Vercel → `GOOGLE_SERVICE_ACCOUNT_JSON` = tot conținutul fișierului → **Redeploy**.
4. În admin, **Firmă → Setări → Drive** arată adresa contului de serviciu. În Drive, partajează folderul rădăcină cu adresa aceea, ca **Editor** (*Content manager* în Shared Drive).

**Apoi, la ambele:** în **Firmă → Setări**, lipește adresa folderului rădăcină și alege modelul de nume al lunii. Salvează. Cardul „Drive” trebuie să arate „Merge”, iar „Fă acum folderul …” creează folderul lunii curente.

### Oblio (pas cu pas)

1. Intră în Oblio → **Setări → Date cont** și copiază **Secretul API**.
2. Vercel → proiectul → **Settings → Environment Variables** → adaugă `OBLIO_EMAIL`, `OBLIO_API_SECRET`, `OBLIO_CIF` pentru *Production* și *Preview*.
3. **Redeploy** (Deployments → ultimul → Redeploy), ca variabilele noi să fie citite.
4. În admin → **Firmă → Setări**, „Oblio” trebuie să arate „Legat”. Apoi, în **Clienți → Client nou → Caută în Oblio**, caută un client existent după CUI: dacă vin datele lui, legătura merge.

---

## De făcut de om

1. **Schimbă cheia de service din Supabase** (`SUPABASE_SERVICE_ROLE_KEY`) înainte să intre date financiare în admin. Apoi pune-o pe cea nouă în Vercel și redeploy.
2. Rulează migrările 16 și următoarele în Supabase → SQL Editor. Fișierul cu toate apare pe Desktop la final.

---

## De testat cu cheile reale

- **Faza 3 — Drive:**
  - tokenul real (OAuth sau cont de serviciu);
  - `files.get` pe folderul tău (cu `canAddChildren`);
  - găsirea folderului unei luni după nume (`files.list` cu `q`);
  - crearea folderului;
  - urcarea unui PDF (multipart) și a unui fișier peste 5 MB (resumable, la zip-ul din faza 6).

  Toate sunt construite după documentația Drive v3 și testate pe un Drive simulat. Când muți facturile pe Drive-ul ăsta, verifică modelul de nume al lunii (provizoriu „{luna} {an}”).
- **Faza 2 — emiterea, cu o proformă de test** (nu cu o factură): `node --env-file=.env.local lib/firma/oblio/test-proforma.mjs <seria-de-proforma>`. Scriptul face o proformă de 1 leu, marcată „TEST — NU SE PLĂTEȘTE”, pe firma ta (nu pe un client). Arată răspunsul Oblio și linkul. **După test, șterge proforma din Oblio, de mână.** Adminul nu are funcție de ștergere.
- **Faza 2 — e-Factura:** `POST /docs/einvoice` și codurile din răspuns (`-1`, `2`, `0`, `1`), mai ales textul unei respingeri reale.
- **Faza 2 — PDF-ul:** emailul ia PDF-ul din `link`-ul dat de Oblio. De verificat că linkul real se descarcă fără sesiune Oblio (testul a pornit de la presupunerea că da). Dacă nu, emailul refuză să plece și spune de ce.
- **Faza 2 — fără TVA:** rândurile pleacă fără cotă (`vatIncluded: 1`, fără `vatName`). Oblio aplică regimul firmei neplătitoare de TVA. De verificat pe prima factură reală că PDF-ul nu arată TVA.
- **Faza 1 — căutarea în Oblio:** `GET /nomenclature/clients` după `clientCif` și după `name`. Am construit-o după documentație și am testat-o pe un Oblio simulat. De verificat pe contul real: că un client existent vine cu adresa, orașul, județul și emailul completate.

---

## Jurnal

### Faza 0 — planul

- Am citit `CLAUDE.md`, adminul existent (lead-uri, autentificarea, portalul de reclame) și ramura `feat/ads-portal-v2`. Componentele ei de cadru și tema sunt deja pe `main`.
- Ramura: `feat/admin-firma`, din `main`.
- Planul și deciziile de mai sus.

### Faza 1 — clienți și contracte

- **Migrarea 16** (`00000000000016_firma_baza.sql`): setările, istoricul, clienții, persoanele de contact, contractele și prețurile pe perioade. RLS doar pentru `is_lead_admin()`.
- **Cadrul** (`components/firma/`): meniu în stânga, bara de sus cu luna (și clientul, pe ecranele care îl folosesc), panou lateral cu focusul ținut înăuntru și Escape. Pe telefon, bară jos cu „Mai mult”. Tema albă e cea a portalului (`../ads/portal.css`), neatinsă.
- **Clienți** (`/admin/firma/clienti`): tabelul cu contractul din luna aleasă, abonamentul lunii, termenii de facturare, legătura cu reclamele și emailul de facturare. Din panou:
  - datele firmei, cu „Caută în Oblio” după CUI sau nume (doar citire);
  - persoanele de contact (măcar un telefon sau un email);
  - contractele cu servicii, ziua emiterii (1–28, ca să existe în fiecare lună), scadența, moneda și bugetul de reclame recomandat, marcat „nu se facturează”;
  - prețul pe perioade, pe luni întregi. Două perioade care acoperă aceeași lună sunt refuzate;
  - legătura cu clientul din portalul de reclame (citită cu `clientsForRequest`, fără nicio schimbare în modulul de reclame);
  - arhivarea în loc de ștergere, ca facturile și istoricul să rămână legate.
- **Istoric** (`/admin/firma/istoric`): fiecare acțiune, filtrabilă pe zone. **Setări** (`/admin/firma/setari`): seria, emailul contabilului, folderul de pe Drive și modelul de nume al lunii, plus starea legăturilor din Vercel (fără să arate cheile).
- **Meniul comun:** „Firmă” e în bara panoului de lead-uri. În meniul reclamelor nu, vezi „Decizii”.
- **Sumele se citesc ca în română:** „1.500” înseamnă 1500, „1.234,50” înseamnă 1234,5. Testul a prins varianta greșită, în care „1.500” devenea 1,50.
- **Verificat pe Supabase și Oblio simulate:** client adăugat din Oblio, persoană de contact cu validare, contract cu două perioade (suprapunerea e refuzată), prețul corect pe septembrie, decembrie și august (fără contract), istoricul, setările, 360 px fără scroll lateral, Escape și focusul.

### Faza 2 — facturi (Oblio)

- **Migrarea 17** (`00000000000017_firma_facturi.sql`): `firma_facturi`. Indexuri unice pe:
  - `(contract_id, luna)`: o singură factură de contract pe lună;
  - `(serie, numar)`;
  - `cheie_idempotenta`.
- **Ciornele** („Pregătește ciornele pentru luna X”, apoi și cron-ul din faza 8):
  - din contractele active cu preț pe luna aceea;
  - rândul e „{textul prețului} — {luna an}”, iar data planificată e ziua de emitere din contract;
  - contractele fără preț pe lună sunt sărite, cu motivul;
  - nimic nu ajunge în Oblio în pasul ăsta.
- **Corectura:** rândurile, cantitatea, prețul, scadența, data planificată și mențiunile. Se poate corecta și o ciornă refuzată de Oblio la emitere (nu are număr).
- **„Aprobă și emite”**, singurul drum spre Oblio:
  1. **Verificarea:** seria e aleasă în Setări, iar clientul are CUI, adresă, oraș și județ, cerute de e-Factura. Dacă lipsesc, aprobarea e refuzată înainte de Oblio.
  2. **Emiterea:** `POST /docs/invoice`, cu data de azi, scadența după zilele din contract și `idempotencyKey` = cheia facturii. Pornește doar după o trecere condiționată în „in_lucru” (comparare-și-schimbare): un dublu-click nu emite de două ori. O reluare după o întrerupere primește de la Oblio același document. Testul a șters numărul din admin și a aprobat din nou: în Oblio a rămas un singur document.
  3. **e-Factura:** `POST /docs/einvoice`. Un refuz nu oprește restul: factura e emisă, iar pasul se reia cu „Reia pașii rămași”.
  4. **PDF-ul pe Drive:** sărit până la faza 3, cu motivul scris.
  5. **Emailul către client:** doar pregătit (către, subiect, text, toate editabile). Pleacă la **„Trimite emailul”**, cu PDF-ul luat din Oblio atașat și cu răspunsul către adminul care trimite. Dacă PDF-ul nu se poate lua, emailul nu pleacă.
- **Factura manuală:** clientul, rândurile, data, scadența, moneda și mențiunile. Se face ca ciornă, apoi trece prin aceeași aprobare.
- **„Renunță la ciornă”:** doar pentru ciorne (n-au existat niciodată în Oblio). Rândul rămâne marcat, ca ciorna lunii să nu se refacă singură. O factură emisă nu se corectează și nu se anulează aici; textul o spune.
- **Lista:** stările „ciornă”, „emisă”, „trimisă în e-Factura”, „încasată” și „întârziată” (emisă, neîncasată integral, cu scadența trecută). Sus, ce e de făcut: ciorne de aprobat, emailuri de trimis, întârzieri și suma de încasat.
- **„Actualizează din Oblio”:** citește starea e-Factura și încasările facturilor deschise (`GET /docs/invoice/list`). Doar citire. O încasare marcată de tine în Oblio apare aici ca „Încasată”.
- **Seria** se alege din seriile de factură citite din Oblio, în Setări.
- **Regula „nu anulează, nu stornează, nu șterge”** e verificată de `node lib/firma/verify-oblio.mjs`, cu 158 de verificări:
  - nicio cale `cancel`, `restore` sau `DELETE`;
  - lista de cereri e fixă;
  - doar `facturi.ts` emite, și numai după trecerea condiționată;
  - doar `incasari.ts` (faza 5) marchează încasări;
  - proforma de test e singura excepție.
  O cale de anulare adăugată de probă a fost prinsă.
- **Emailurile** pleacă prin Resend direct (`lib/firma/email.ts`), vezi „Decizii”.
- **Verificat pe Supabase, Oblio și Resend simulate:**
  - ciornele de două ori (a doua oară nu face nimic);
  - corectura;
  - emiterea refuzată, apoi reluată;
  - idempotența;
  - e-Factura refuzată, apoi reluată;
  - emailul cu adresă greșită, apoi trimis la două adrese, cu PDF-ul atașat;
  - factura manuală;
  - renunțarea la ciornă;
  - încasarea venită din Oblio;
  - nicio cerere interzisă în jurnalul Oblio;
  - 360 px.

### Faza 3 — Drive

- **Migrarea 18** (`00000000000018_firma_drive.sql`):
  - `firma_luni_drive`: folderul fiecărei luni, legat de rădăcina în care a fost făcut;
  - `firma_fisiere`: registrul celor urcate, unic pe (fel, sursă), ca nimic să nu se urce de două ori.
- **`lib/firma/drive/google.ts`** — Drive v3 după documentație:
  - token OAuth (refresh) sau JWT RS256 al contului de serviciu, semnat cu `node:crypto`, fără pachete noi;
  - `files.get`, `files.list` cu `q`, `files.create` și încărcarea multipart sau resumable, toate cu `supportsAllDrives`;
  - erorile spuse pe înțeles. Mai ales `storageQuotaExceeded`: contul de serviciu nu poate urca în „My Drive”.
- **Folderul lunii** (`lib/firma/drive/index.ts`):
  - numele vine din modelul din Setări (`{luna}`, `{Luna}`, `{an}`, `{ll}`; provizoriu „{luna} {an}”);
  - întâi se caută după nume în rădăcină (dacă l-ai făcut deja de mână), abia apoi se creează;
  - se face din Setări („Fă acum folderul …”) și din cron, la început de lună (faza 8).
- **Facturile pe Drive:**
  - pasul 3 al aprobării pune PDF-ul din Oblio în folderul lunii emiterii, cu numele în stilul celor descărcate din Oblio, ca în folderul tău: `FacturaFCT42-NUME_CLIENT.pdf`;
  - un fișier cu același nume pus de mână în folder nu se dublează: se înregistrează;
  - „Urcă pe Drive cele N PDF-uri lipsă” (în Facturi) recuperează facturile emise înainte de legarea Drive-ului sau cele cu pasul căzut.
- **Setări → Drive:** modul legăturii, adresa contului de serviciu (cu care se partajează folderul), dacă rădăcina se vede și se poate scrie în ea, și folderul lunii curente.
- **Decizia cu contul de serviciu** e explicată sus, la „Decizii”, iar pașii pentru ambele variante sunt la „Drive (pas cu pas)”.
- **Verificat pe Drive simulat:**
  - starea în Setări;
  - folderul lunii, de două ori (a doua oară nu se dublează);
  - cele două PDF-uri lipsă urcate (butonul dispare apoi);
  - o factură nouă, cu pasul Drive făcut la aprobare;
  - refuzul `storageQuotaExceeded`, cu mesajul pentru om și reluarea lui;
  - registrul fișierelor și istoricul.
