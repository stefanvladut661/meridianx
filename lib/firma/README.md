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
- **Citirea cheltuielilor cu Claude, plus o dependență nouă.** Citirea bonurilor și a facturilor primite folosește SDK-ul oficial `@anthropic-ai/sdk`. E singurul pachet nou și singura atingere în afara zonei (`package.json` și `package-lock.json`). Detaliile, la faza 4. Dacă nu-l vrei, scoate pachetul: cheltuielile merg mai departe cu completarea de mână.
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

| `ANTHROPIC_API_KEY` | Cheia API Anthropic ([console.anthropic.com](https://console.anthropic.com) → *API Keys*), pentru citirea bonurilor și a facturilor de la furnizori. Fără ea, datele cheltuielilor se completează de mână. | 4 |

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

### Jobul programat (intrarea din `vercel.json` — o adaugi tu)

Adaugă în `vercel.json`, la `crons`, lângă cele existente:

```json
{ "path": "/admin/firma/cron", "schedule": "0 5 * * *" }
```

Rulează zilnic la 05:00 UTC, adică 08:00 vara și 07:00 iarna, ora României. Folosește același `CRON_SECRET` ca celelalte joburi, deja pus în Vercel. Fără el, ruta refuză orice apel în producție.

Ce face, în ordine. Nimic fiscal, nimic către clienți:
1. folderul lunii pe Drive, dacă e legat;
2. ciornele lunii din contracte (rămân ciorne până le aprobi);
3. starea e-Factura și încasările din Oblio (doar citire);
4. în primele 15 zile ale lunii, verificarea pachetului lunii trecute;
5. alertele și, doar dacă sunt, rezumatul pe email către adresa din Setări, o singură dată pe zi.

### Exportul din BT Go (ce îmi dai)

- **Formatul:** CSV. E cel mai ușor de citit sigur. PDF-ul extrasului nu se poate citi rând cu rând fără ghicit. Un XLS/XLSX ar cere un pachet nou.
- **De unde:** în BT Go → contul firmei → Tranzacții (sau Extrase) → Export → CSV, pe perioada dorită (o săptămână sau o lună).
- **Ce fac cu el:**
  - îl urci în **Firmă → Încasări → Importă exportul din BT Go**;
  - la primul import alegi coloanele: data, suma (sau debit și credit), detaliile, plătitorul/beneficiarul, referința. Alegerea se ține minte după antet;
  - **trimite-mi un export real** (poți acoperi numele și sumele) și fixez formatul BT Go ca implicit, ca prima alegere să nu mai fie nevoie.
- Același rând din două exporturi (săptămâna, apoi luna) intră o singură dată.

### Legătura automată cu banca (pentru mai târziu — neconstruită)

Accesul direct la API-urile PSD2 ale băncii cere licență de prestator de informații despre conturi (AISP). Pentru o firmă mică, drumul realist e un agregator licențiat. Variantele găsite, cu ce e public despre costuri:

| Varianta | Ce e | Cost (public) |
|---|---|---|
| **Enable Banking** | Agregator PSD2 european, cu API pentru conturile din România. | După volum (conturi și plăți pe lună), cu un minim lunar care include o cotă. Prețul exact se cere de la vânzări. ([FAQ](https://enablebanking.com/docs/faq)) |
| **Salt Edge** | Agregator PSD2 cu acoperire largă; unele liste îl dau ca agregator pentru BT. | Personalizat, negociat cu vânzările; fără listă publică. |
| **GoCardless Bank Account Data** (fost Nordigen) | API de date de cont. | Pagina lor arată €100/lună + €0,25 pe consimțământ. O sursă spune că din iulie 2025 nu mai primesc conturi noi, de verificat. ([pagina](https://gocardless.com/bank-account-data)) |
| **Finqware** | Start-up românesc, partener BT pentru open banking. | Neafișat; se cere ofertă. |
| **BT Open Banking** (direct) | Platforma de API a băncii, cu sandbox. | Gratuită pentru prestatorii licențiați; fără licență nu se poate folosi direct. |

Concluzia de acum: importul CSV săptămânal costă zero. Legătura automată merită când volumul de facturi face importul obositor. Cea mai previzibilă ca preț e GoCardless, dacă primește conturi noi. Altfel, Enable Banking, cu ofertă cerută.

### Oblio (pas cu pas)

1. Intră în Oblio → **Setări → Date cont** și copiază **Secretul API**.
2. Vercel → proiectul → **Settings → Environment Variables** → adaugă `OBLIO_EMAIL`, `OBLIO_API_SECRET`, `OBLIO_CIF` pentru *Production* și *Preview*.
3. **Redeploy** (Deployments → ultimul → Redeploy), ca variabilele noi să fie citite.
4. În admin → **Firmă → Setări**, „Oblio” trebuie să arate „Legat”. Apoi, în **Clienți → Client nou → Caută în Oblio**, caută un client existent după CUI: dacă vin datele lui, legătura merge.

---

## De făcut de om

1. **Schimbă cheia de service din Supabase** (`SUPABASE_SERVICE_ROLE_KEY`) **înainte să intre date financiare în admin.** Supabase → Project Settings → API → generezi o cheie nouă. O pui în Vercel (Production și Preview), dai **Redeploy**, apoi o revoci pe cea veche.
2. **Rulează migrările 16–23** în Supabase → SQL Editor: tot fișierul `C:\Users\PC\Desktop\meridian-firma-migrari-16-23.sql`, apoi Run. La final, toate rândurile verificării trebuie să fie `true`.
3. **Oblio:** pune `OBLIO_EMAIL`, `OBLIO_API_SECRET`, `OBLIO_CIF` în Vercel (pașii la „Oblio”). **Secretul API se schimbă când resetezi parola contului Oblio**: după o resetare, pune-l din nou în Vercel. Apoi alege seria în Firmă → Setări.
4. **Testul emiterii cu cheile reale**, cu o proformă, nu cu o factură: `node --env-file=.env.local lib/firma/oblio/test-proforma.mjs <seria-de-proforma>`. **Apoi șterge proforma din Oblio, de mână.**
5. **Drive:** alege varianta A (OAuth, pentru „My Drive”) sau B (cont de serviciu, pentru Shared Drive) și urmează pașii de la „Drive”. Apoi pune folderul rădăcină în Setări. Când muți facturile pe Drive-ul ăsta, spune-mi structura finală a folderului.
6. **Citirea bonurilor:** `ANTHROPIC_API_KEY` în Vercel.
7. **Emailurile** folosesc `RESEND_API_KEY` și `RESEND_FROM_EMAIL`, deja puse pentru lead-uri. Domeniul expeditorului trebuie verificat în Resend.
8. **Jobul de dimineață:** adaugă intrarea în `vercel.json` (vezi „Jobul programat”) și pune adresa pentru rezumat în Setări.
9. **Un export real din BT Go** (CSV; poți acoperi numele și sumele), ca să fixez formatul implicit.
10. **Emailul contabilului** în Setări.
11. **Meniul reclamelor:** linkul „Firmă” lipsește din meniul din stânga al portalului de reclame (`components/ads/sidebar.tsx`, zona celuilalt terminal). E un rând de adăugat acolo, de tine sau de terminalul acela.

---

## De testat cu cheile reale

- **Faza 5 — exportul real BT Go:** importul e construit cu alegerea coloanelor de către om, tocmai fiindcă n-am avut un export real. De verificat cu primul export adevărat:
  - separatorul, codarea (diacriticele) și rândul antetului;
  - dacă BT Go dă o coloană de sumă cu semn sau debit și credit separat;
  - cum arată detaliile plăților primite, ca potrivirea după numărul facturii și numele clientului să prindă.
- **Faza 5 — încasarea în Oblio:** `PUT /docs/invoice/collect` (ordin de plată, cu referința din extras ca număr de document), precedat de `GET /docs/invoice` ca să nu dubleze o încasare existentă. Construit după documentație, testat pe Oblio simulat.
- **Faza 4 — citirea cu Claude:** o cerere reală cu `ANTHROPIC_API_KEY` pe câteva bonuri și facturi adevărate (o poză de pe telefon, un PDF de la un furnizor de software). De verificat cât de bine nimerește furnizorul, CUI-ul, data, totalul și categoria. Testat pe un API simulat, cu forma cererii verificată.
- **Faza 4 — urcarea din telefon:** o poză făcută din admin pe un telefon real (iPhone salvează HEIC; Safari o dă ca JPEG la urcare, dar de verificat). Plus linkul semnat de urcare în Supabase-ul real, cu bucket-ul din migrarea 19.
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

## Previzualizările Vercel (ramura `feat/admin-firma`)

| Faza | Commit | Preview |
|---|---|---|
| 0 — planul | `851abff` | https://meridianx-4rrx6xeag-stefanvladut661s-projects.vercel.app |
| 1 — clienți și contracte | `6233a48` | https://meridianx-a2825hljh-stefanvladut661s-projects.vercel.app |
| 2 — facturi | `a33ba2a` | https://meridianx-o60p1e9dg-stefanvladut661s-projects.vercel.app |
| 3 — Drive | `8c75d59` | https://meridianx-csofcsklr-stefanvladut661s-projects.vercel.app |
| 4 — cheltuieli | `86c4843` | https://meridianx-jnkwcq4nw-stefanvladut661s-projects.vercel.app |
| 5 — încasări | `4a48578` | https://meridianx-9fr8urppx-stefanvladut661s-projects.vercel.app |
| 6 — pachetul pentru contabil | `599b985` | https://meridianx-7dhx67hks-stefanvladut661s-projects.vercel.app |
| 7 — accese | `5cf68d4` | https://meridianx-5a8ag00bt-stefanvladut661s-projects.vercel.app |

Pe preview, modulul arată ce migrare lipsește până rulezi migrările 16–23 în Supabase.

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

### Faza 4 — cheltuieli

- **Migrarea 19** (`00000000000019_firma_cheltuieli.sql`):
  - `firma_cheltuieli`;
  - bucket-ul privat `firma-docs` (50 MB, doar tipurile de fișiere folosite). Ține bonurile, extrasele (faza 5) și zip-ul lunii (faza 6).
- **Urcarea din telefon** (`/admin/firma/cheltuieli`):
  - un buton mare, „Urcă un bon sau o factură”, cu poză sau PDF; merg și mai multe odată;
  - poza se micșorează în browser la 2400 px pe latura lungă (JPEG 0,88): în test, 700 KB au devenit 216 KB, iar documentul rămâne lizibil;
  - fișierul urcă direct în stocare, printr-un link semnat, fără limita de mărime a acțiunilor serverului;
  - pentru fiecare fișier se vede pasul: se pregătește, se urcă (%), se citește, gata sau eroarea.
- **Citirea** (`lib/firma/ocr.ts`):
  - SDK-ul oficial Anthropic, `client.beta.messages.parse` cu `claude-opus-5-5`, efort `low` (o extragere nu cere raționament lung);
  - răspunsul e structurat și validat cu o schemă zod (`betaZodOutputFormat`): furnizor, CUI, dată, total, monedă, număr, descriere, categorie, plus „lizibil”;
  - imaginea pleacă ca bloc `image`, PDF-ul ca bloc `document`;
  - CUI-ul firmei (`OBLIO_CIF`) e trecut în cerere, ca modelul să nu-l pună la furnizor;
  - `fallbacks: "default"` (server-side fallback): dacă filtrele de siguranță refuză cererea, serverul încearcă singur alt model. E opțiunea implicită recomandată pentru modelul ăsta. Se poate scoate dacă nu o vrei;
  - erorile au tipul lor (limită de cereri, cheie greșită, fișier refuzat, rețea), cu un mesaj pentru om și „Citește din nou”.
- **Corectura:** furnizorul, CUI-ul, numărul, data, suma, moneda, categoria (software și abonamente, echipament, transport, reclame, altele) și descrierea. „Salvează” le marchează confirmate.
- **Pe Drive:**
  - fișierul ajunge în folderul lunii documentului, cu un nume ca în folderul tău: „Furnizor - descriere AAAA-LL-ZZ.jpg”;
  - un document fără furnizor și dată (ilizibil) așteaptă completarea, ca să nu ajungă pe Drive cu un nume fără sens;
  - dacă schimbi data în altă lună, cheltuiala și fișierul se mută acolo (`files.update`, addParents/removeParents), iar panoul o urmează;
  - dacă schimbi furnizorul, fișierul se redenumește.
- **„Scoate din listă”:** o cheltuială urcată din greșeală dispare din listă. Rândul rămâne în bază, marcat, iar fișierul de pe Drive nu se atinge.
- **Lista:** totalul lunii (pe monede), totalul pe categorii (în lei), cheltuielile de verificat și starea datelor (citite, confirmate, de completat), plus starea Drive.
- **Verificat pe Supabase, Drive și Anthropic simulate:**
  - poza mare, micșorată, citită și pusă pe Drive în septembrie;
  - cererea către Claude: model, efort, format JSON cu schema, beta pentru fallback, imaginea și CUI-ul;
  - data mutată în octombrie: fișierul s-a mutat și s-a redenumit;
  - PDF-ul ilizibil: nu e pe Drive până la completare, apoi e urcat cu nume corect;
  - validarea, limita de cereri, scoaterea din listă;
  - 360 px.

### Faza 5 — încasări (BT Go)

- **Migrarea 20** (`00000000000020_firma_incasari.sql`):
  - `firma_formate_banca`: formatul ales de om, recunoscut după antet;
  - `firma_importuri_banca`: fiecare fișier importat, și unde e pe Drive;
  - `firma_tranzactii`: rândurile, cu amprentă unică (SHA-256 pe dată, sumă, monedă, detalii, contrapartidă, referință și numărul apariției), ca același rând să nu intre de două ori.
- **Citirea CSV-ului** (`lib/firma/csv.ts`, fără pachete noi):
  - UTF-8 sau Windows-1250, fără BOM;
  - separatorul găsit după consecvența rândurilor;
  - ghilimele după RFC 4180;
  - date românești („28.09.2026”, „28/09/26”, „2026-09-28 10:00”);
  - sume ca în română, cu semn sau în paranteze, ori debit și credit separat;
  - rândurile fără dată (sold, totaluri) sunt sărite și raportate.
- **Formatul nu se ghicește:** la primul import vezi primele rânduri și alegi coloanele. Antetul și coloanele sunt propuse după numele din antet, dar le confirmi tu. Alegerea se ține minte după antet; la următorul export apare „Format recunoscut” și importul merge direct.
- **Potrivirea** (`lib/firma/incasari-match.ts`, testată separat pe 11 cazuri):
  - **încasare sigură:** suma exactă (restul de încasat), plus numărul facturii („FCT 42”, „FCT42”, „factura nr 42”, cu zerouri în față; dar nu „FCT 420”) sau clientul (CUI-ul ori cuvintele importante din nume, fără „SRL” & co.) în plată, la o singură factură. Se marchează încasată în Oblio;
  - **de confirmat:** doar suma, doar clientul, mai multe facturi la fel sau o sumă parțială. Le confirmi tu, alegând factura (propusă sau oricare deschisă), apoi încasarea se marchează în Oblio. Sau „Ignoră (nu e o factură)”;
  - **plățile ieșite:** se leagă de o cheltuială urcată, cu aceeași sumă și monedă, la cel mult 10 zile de data documentului, când e una singură. Când sunt mai multe, aștepți tu.
- **Încasarea în Oblio** (`collectForLine`, singurul loc care are voie să o facă, verificat de `verify-oblio.mjs`):
  - întâi citește factura din Oblio. Dacă încasările de acolo o acoperă deja (ai marcat-o tu sau un import anterior) sau au aceeași referință, nu mai adaugă nimic („era deja în Oblio”);
  - altfel trimite un ordin de plată, cu referința din extras, data plății și suma (cel mult restul);
  - o încasare făcută în Oblio nu se scoate din admin: textul spune să o ștergi din Oblio, de mână, dacă e greșită.
- **Extrasul pe Drive:** fișierul importat, în folderul lunii ultimei tranzacții, ca „Extras BT {de la} - {până la}.csv”. Același fișier importat de două ori nu se dublează pe Drive.
- **„Potrivește din nou”:** reia rândurile nepotrivite după ce apar facturi sau cheltuieli noi.
- **Verificat pe Supabase, Oblio și Drive simulate:**
  - primul import, cu coloanele propuse și confirmate, plus rândul „Sold final” sărit;
  - încasarea sigură marcată în Oblio;
  - plata POS legată de cheltuiala de benzină;
  - încasarea doar cu suma, confirmată și marcată în Oblio;
  - o încasare deja făcută de mână în Oblio, nedublată;
  - al doilea import al aceluiași fișier: 0 noi, 5 sărite, format recunoscut;
  - extrasul o singură dată pe Drive;
  - facturile apar „Încasată”;
  - 360 px.

### Faza 6 — pachetul pentru contabil

- **Migrarea 21** (`00000000000021_firma_contabil.sql`): `firma_pachete`, câte un rând pe lună. Ține:
  - verificarea și ce lipsea;
  - zip-ul (în stocare și pe Drive);
  - emailul și starea lui.
- **Verificarea lunii** (`/admin/firma/contabil`, implicit luna trecută; bara de sus știe asta):
  - **lipsește** (oprește zip-ul):
    - o factură emisă fără PDF pe Drive;
    - o cheltuială fără sumă sau dată, ori fără document pe Drive;
    - o plată din extras fără document (o legi de o cheltuială sau o ignori în Încasări, ex. taxe și comisioane);
    - extrasul neimportat sau nepus pe Drive;
  - **de verificat** (nu oprește): ciorne de facturi neaprobate, prima sau ultima tranzacție importată departe de capetele lunii. Datele din extras sunt ale tranzacțiilor, nu ale perioadei exportate, așa că acoperirea lunii nu poate fi sigură;
  - fiecare lipsă are butonul sau linkul care o rezolvă („Urcă pe Drive PDF-urile facturilor”, Cheltuieli, Încasări). Rezultatul se salvează, pentru alertele de dimineață din faza 8.
- **Încasări:** lista „De confirmat” cuprinde acum și plățile fără document, cu cheltuielile urcate ca variante și „Ignoră (n-are document)”.
- **Zip-ul** (`lib/firma/zip.ts`, fără pachete noi):
  - formatul ZIP cu deflate și CRC-32 din `node:zlib`, nume în UTF-8; PDF-urile și pozele se pun necomprimate;
  - **conținutul:** tot ce e în folderul lunii de pe Drive, inclusiv ce ai pus acolo de mână, cu extrasul. Documentele native Google sunt sărite și numite (trebuie exportate ca PDF). Zip-urile făcute înainte nu intră;
  - fără Drive legat, se folosesc copiile adminului: bonurile și extrasele din stocare, facturile din Oblio;
  - zip-ul se pune în stocare și în folderul lunii, ca „pentru contabil - {luna an} - {data ora}.zip”. „Fă zip-ul” e activ doar când luna e completă; altfel e „Fă zip-ul oricum”.
- **Emailul către contabil:**
  - adresa din Setări, subiectul „Documentele pentru {luna an}”, textul cu numărul de fișiere, mărimea și linkul de pe Drive; toate se pot schimba;
  - pleacă doar la **„Trimite”**, cu zip-ul atașat dacă are cel mult 10 MB, altfel doar cu linkul;
  - răspunsul vine la adminul care trimite.
- **Verificat pe Supabase, Drive și Resend simulate:**
  - luna implicită (septembrie: „extrasul nu e importat”);
  - octombrie cu 6 lipsuri, rezolvate din aplicație: PDF-urile facturilor, cheltuiala, extrasul reimportat fără rânduri dublate, plata de hosting ignorată;
  - luna completă, zip-ul cu 6 fișiere, citit de Python (CRC corect, nume cu diacritice);
  - zip-ul pe Drive;
  - emailul cu arhiva atașată;
  - zip-ul refăcut, care nu se include pe el însuși;
  - 360 px.

### Faza 7 — accese

- **Migrarea 22** (`00000000000022_firma_accese.sql`): `firma_conturi`, cu numele, categoria, adresa, contul cu care se intră (de obicei un email), cine are acces, 2FA (da / nu / nu știu), **unde e parola**, abonamentul (sumă, monedă, lunar/anual), reînnoirea și notele. **Niciun câmp de parolă sau de cheie.**
- **Paza contra parolelor:** câmpurile text refuză ce arată a parolă sau a cheie: un cuvânt lung cu litere și cifre, ori prefixe de chei (`sk-`, `ghp_`, `eyJ`…). Mesajul spune că parolele stau în managerul de parole și că aici se scrie doar unde sunt. Testat pe 8 texte: cele normale trec, parolele și cheile sunt prinse. În istoric intră doar numele contului.
- **„Adaugă lista de bază”:** conturile din prompt (BT Go, Oblio, Google, Meta, TikTok, Vercel, Supabase, GitHub, domeniul), plus Resend și Anthropic, folosite de admin. Doar numele și adresa; ce există deja nu se dublează.
- **Reînnoirea:** din data trecută și ciclu se calculează următoarea reînnoire (31 ianuarie, lunar → 31 octombrie). Alertă când cade în următoarele 7 zile: sus pe pagină și pe rând („în 5 zile”). Intră și în panou și în rezumatul de dimineață (faza 8).
- **Sus:** câte conturi sunt, abonamentele aduse la o sumă lunară și câte n-au 2FA.
- **Verificat:**
  - lista de bază, apăsată de două ori (a doua oară nu adaugă nimic);
  - o parolă pusă la „Unde e parola”, refuzată;
  - contul completat;
  - alerta de reînnoire;
  - 360 px.

### Faza 8 — panou și alerte

- **Migrarea 23** (`00000000000023_firma_alerte.sql`): `firma_setari.email_rezumat` și `firma_rezumate` (un rezumat pe zi, ca să nu plece de două ori).
- **Panoul** (`/admin/firma`, acum prima pagină a modulului):
  - **facturat** în lună (facturile emise);
  - **încasat** în lună: din extras, adică plățile legate de facturi, exact, când luna are extras importat; altfel din Oblio (ultima încasare a facturii în lună), cu sursa scrisă sub cifră;
  - **de încasat** (în termen) și **întârziat** (scadența trecută);
  - **cheltuielile** lunii;
  - **banii pe reclame pe client**, din portalul de reclame, doar pentru clienții legați. Se adună doar campaniile, ca grupurile și reclamele să nu fie numărate de trei ori, separat pe monede. Citirea folosește doar funcțiile de citire ale portalului (`clientsForRequest`, `readClientView`), fără nicio schimbare acolo.
- **Nicio cifră inventată:** o cifră fără date e „—”, nu 0. Sub panou, „Ca să apară toate cifrele” spune ce lipsește (Oblio, Drive, extrasul lunii, clienții, bonurile).
- **Alertele**, fiecare cu link spre locul unde se rezolvă:
  - o factură întârziată (cu câte zile și cât);
  - un contract care se termină în 30 de zile;
  - pachetul pentru contabil pe luna trecută, netrimis (cu numărul de lipsuri);
  - un abonament care se reînnoiește în 7 zile;
  - ciorne de facturi de aprobat;
  - emailuri de facturi neplecate.
- **Jobul de dimineață** (`/admin/firma/cron`, `lib/firma/rezumat.ts`), cu același `CRON_SECRET`:
  - folderul lunii, ciornele (doar ciorne), starea din Oblio (doar citire), verificarea pachetului (zilele 1–15), alertele;
  - rezumatul pe email, doar în zilele cu alerte și o singură dată pe zi;
  - totul intră în istoric. Ce face și intrarea din `vercel.json` sunt la „Jobul programat”;
  - jobul nu citește banii pe reclame: portalul citește cu sesiunea omului (RLS), iar un cron n-o are. Alertele nu depind de ei.
- **Setări:** adresa (sau adresele) pentru rezumatul de dimineață.
- **Verificat:**
  - cifrele lunii, potrivite cu datele de test;
  - cheltuiala pe reclame: 200 lei din campanie, cu grupul neadunat; „—” pe o lună fără cheltuială;
  - toate tipurile de alerte;
  - jobul: 401 fără secret, rezumatul trimis o dată, „deja-trimis” la al doilea apel în aceeași zi. Jobul a citit din Oblio că o factură „întârziată” din datele de test era de fapt încasată și a scos alerta: Oblio e sursa;
  - ultimul rezumat afișat în panou;
  - 360 px.
