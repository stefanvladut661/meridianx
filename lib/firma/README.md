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

Le completez pe măsură ce fazele le cer. Lista completă și pașii sunt la „De făcut de om”.

---

## De făcut de om

1. **Schimbă cheia de service din Supabase** (`SUPABASE_SERVICE_ROLE_KEY`) înainte să intre date financiare în admin. Apoi pune-o pe cea nouă în Vercel și redeploy.
2. Rulează migrările 16 și următoarele în Supabase → SQL Editor. Fișierul cu toate apare pe Desktop la final.

---

## De testat cu cheile reale

Se completează la fiecare fază.

---

## Jurnal

### Faza 0 — planul

- Am citit `CLAUDE.md`, adminul existent (lead-uri, autentificarea, portalul de reclame) și ramura `feat/ads-portal-v2`. Componentele ei de cadru și tema sunt deja pe `main`.
- Ramura: `feat/admin-firma`, din `main`.
- Planul și deciziile de mai sus.
