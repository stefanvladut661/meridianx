# Prospectare

Modulul din admin (`/admin/prospectare`) pentru firmele cercetate de roboții din `auto-web-rebuilder`, site-urile lor demo și contactul lor: o firmă poate fi contactată pe **email și pe WhatsApp, dar niciodată de două ori pe același canal**. Telefonul rămâne separat.

## Regula de bază, în bază

- Fiecare canal are data lui pe firmă: `email_la`, `whatsapp_la` (+ `whatsapp_cont`), `telefon_la` (migrarea 33). Odată pusă, data unui canal nu se mai schimbă: un trigger refuză al doilea email, al doilea WhatsApp, a doua intrare pe telefon (`PR409`), oricine ar scrie: admin, robot, import sau SQL Editor. Singura excepție e `prospectare_seteaza_rezultat`: după ultima încercare „Nu răspunde” (Setări → încercări, implicit 3) firma iese din listă și își pierde telefonul (se scrie în activitate, cu motiv).
- **Emailul**: robotul cere canalul înainte de trimitere (`email_de_trimis` → `prospectare_email_cere_canal`); o firmă care a primit deja email sau e pe telefon e refuzată (409).
- **WhatsApp, lista continuă**: o firmă intră singură în lista de WhatsApp când are site gata cu link demo și număr de mobil. Dacă are și adresă de email, intră doar la **cel puțin o zi după ce a plecat emailul**. Nu intră cele de pe telefon, cele care au răspuns la email și cele „Nu contacta”. Trimiterea se cere înainte de a deschide conversația (`prospectare_whatsapp_trimis`), deci doi oameni nu pot trimite aceleiași firme. Contorul „trimise azi X / limită” pe cont (Setări) e doar avertisment.
- **Telefonul, separat**: în „Apeluri azi” intră doar firme cu site gata, link și telefon, care n-au primit nici email, nici WhatsApp (și nu sunt deja pe telefon). O firmă de pe telefon nu mai primește email sau WhatsApp. Excepția acceptată: după un apel „Interesat”, conversația poate continua pe WhatsApp (`prospectare_continua_pe_whatsapp`); firma rămâne pe telefon, iar în activitate apare „Continuare apel pe WhatsApp”, o singură dată pe apel.
- **„Nu contacta”**, venit pe orice canal (din admin, număr greșit, „NU” la email, cerut pe WhatsApp), blochează toate canalele (`PR410`): firma iese din listele neterminate, din lista de WhatsApp și din rezervări.
- Activitatea se poate doar completa: modificarea, ștergerea și golirea sunt refuzate și pentru superuser (`PR403`). Fiecare firmă nouă, fiecare schimbare de etapă și fiecare canal folosit intră acolo automat.
- RLS: citire doar pentru `is_lead_admin()` (tabela `admin_emails`). Scrierile trec doar prin server, cu cheia de service, prin funcțiile modulului. Roboții nu au acces direct: trec prin `/api/prospectare/robot` (vezi `docs/prospectare-api.md`).
- Coloanele vechi `canal`, `canal_setat_la`, `canal_setat_de` rămân în tabel, goale și blocate, ca fișierul cu migrările să se poată rula din nou.

## Fișierele

| Unde | Ce |
|---|---|
| `supabase/migrations/…28_prospectare_firme.sql` | firmele, activitatea, setările |
| `…29_prospectare_lucru.sql` | roboții, rezervările, listele de apeluri; rezervarea atomică, rezultatele apelurilor |
| `…30_prospectare_email_import.sql` | căsuțele, cererea de email, evenimentele, importul, autentificarea roboților |
| `…31_prospectare_citire.sql` | numărătorile pentru Prezentare, filtre și roboți (doar citire) |
| `…32_prospectare_whatsapp_dupa_apel.sql` | WhatsApp după un apel „Interesat”, scris în activitate |
| `…33_prospectare_mai_multe_canale.sql` | canalele pe date, lista continuă de WhatsApp, mutarea datelor din modelul vechi |
| `supabase/tests/prospectare/` | 112 teste de reguli + proba de concurență (inclusiv WhatsApp trimis deodată de 5 oameni), pe Postgres local în Docker: `bash supabase/tests/prospectare/ruleaza.sh`; `api-seed.sql` pentru proba API |
| `lib/prospectare/` | tipuri, etichete, citiri, telefon / WhatsApp / .vcf / CSV, API-ul roboților |
| `app/(admin)/admin/prospectare/` | paginile, acțiunile, exportul CSV |
| `app/api/prospectare/robot/` | `firme`, `rezerva`, `heartbeat`, `termina`, `eveniment` |
| `scripts/prospectare-import.mjs` | importul din `stare.json` + `trimise.json` + listele WhatsApp |
| `scripts/prospectare-verifica-api.mjs` | proba API-ului, doar pe un server local cu bază de test |

## Pașii omului

1. **Migrările 28–33** în Supabase → SQL Editor: fișierul unic `C:\Users\PC\Desktop\meridian-prospectare-migrari-28-33.sql` (în afara repo-ului). Lipești tot și dai Run. Merge și peste migrări deja aplicate. Ultimul rezultat e verificarea finală: toate rândurile `true`. Dacă rândul cu `admin_emails` e `false`, adaugi adresa lui Vlăduț: `insert into public.admin_emails (email) values ('<adresa lui>');` (aceeași adresă și în `ADMIN_EMAILS` din Vercel).
2. **Importul**: fișierul `C:\Users\PC\meridian-prospectare-import.env` (în afara repo-ului) cu `PROSPECTARE_SUPABASE_URL` și `PROSPECTARE_SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API). Apoi, din repo: `git -C C:\Users\PC\MeridianX\auto-web-rebuilder pull` și `node scripts/prospectare-import.mjs --env C:\Users\PC\meridian-prospectare-import.env --proba`. Fără `--proba` scrie. Se poate rula oricând din nou.
3. **Vercel**: nicio variabilă nouă. Modulul folosește `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` și `ADMIN_EMAILS`, care există deja.
4. **Roboții**: în admin → Prospectare → Roboți → „Adaugă robot”. Tokenul se arată o dată și se pune pe calculatorul robotului în variabila de mediu `MERIDIAN_ROBOT_TOKEN`.

## Decizii

- Tema închisă, ca adminul live (exportul Base44 nou a trecut tot pe temă deschisă). Structura, textele și comportamentul sunt din prototip.
- Emailul cere canalul **înainte** de trimitere (`email_de_trimis`: 200 / 409 / 429), apoi raportează `email_trimis` cu `message_id`. Fiecare firmă primește cel mult un email; dacă SMTP-ul refuză după cerere, firma nu mai primește email (dacă are mobil, intră în lista de WhatsApp după o zi).
- WhatsApp-ul se cere tot înainte (butonul „Trimite pe WhatsApp” deschide conversația după ce baza a pus data), la fel și „Marchează și trimit manual”, pentru cine copiază numărul și mesajul (marcarea vine înainte, ca doi oameni să nu trimită aceleiași firme).
- Exportul e CSV pentru Excel (BOM UTF-8, separator `;`), fără pachete noi.
- Statusul `eroare` al robotului → `cercetat`, cu statusul păstrat în `date_extra.status_robot`.
- Importul: emailul a plecat dacă starea zice „trimis” sau dacă firma e în `trimise.json` (copia vie de pe Drive). Cele 30 de firme din `asignari-2026-11-01.json` → „trimise” primiseră email pe 30 oct și WhatsApp pe 1 nov: au acum ambele canale, cu data și contul.
- Lista de apeluri intră doar cu firme care au site gata **cu link demo** și telefon.
- Apelurile pleacă doar din „Apeluri azi”, unde firma primește canalul Telefon. În fișa firmei și în tabelul Firme, telefonul și emailul sunt text, fără `tel:` sau `mailto:`. În fișă au buton „Copiază” (decizia din 2 nov).
- WhatsApp-ul de după apel se deschide doar după „Interesat”: singur, când apeși butonul, sau din tabul Terminate. Pe cardul de apel nu mai e buton WhatsApp înainte de rezultat.
- Listele de apeluri neterminate trec pe ziua de azi la deschiderea paginii de apeluri (`prospectare_reporteaza_liste`), fără cron.
