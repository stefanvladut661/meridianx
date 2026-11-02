# Prospectare

Modulul din admin (`/admin/prospectare`) pentru firmele cercetate de roboții din `auto-web-rebuilder`, site-urile lor demo și contactul lor: o firmă e contactată pe **un singur canal** (email, WhatsApp sau apel). Al doilea canal îl dă doar un admin, din fișa firmei, cu motiv. Roboții se coordonează pe o tablă comună de nișe și pe o coadă comună de construcție.

## Regula de bază, în bază

- **Un singur canal (migrarea 34, 2 nov):** fiecare canal are data lui pe firmă (`email_la`, `whatsapp_la` + `whatsapp_cont`, `telefon_la`). Primul canal o blochează pentru celelalte: triggerul refuză al doilea canal (`PR409`), oricine ar scrie, afară de cazul în care un admin l-a permis din fișă (`canal_permis`, cu motiv obligatoriu, prin `prospectare_permite_recontactare`; se scrie în activitate și se consumă când canalul e folosit). Același canal de două ori nu se poate niciodată. Singura golire permisă: telefonul, după ultima încercare „Nu răspunde”. Importul de istoric poate scrie mai multe canale (cele 30 de firme cu email + WhatsApp rămân așa).
- **Emailul**: robotul cere canalul înainte de trimitere (`email_de_trimis`); o firmă care a primit deja email sau are alt canal fără permisiune e refuzată (409).
- **WhatsApp, lista continuă**: intră singure firmele cu site gata, link demo, mobil și niciun contact; cele cu WhatsApp permis din fișă intră primele. Trimiterea se cere înainte de a deschide conversația (`prospectare_whatsapp_trimis`), deci doi oameni nu pot trimite aceleiași firme. Lista nu mai e împărțită pe Ștefan / Vlăduț, ci pe conturi (`prospectare_conturi_whatsapp`, din Setări: nume, număr, limită pe zi, activ). Contorul „trimise azi X / limită” e doar avertisment.
- **Apeluri azi**: intră firme cu site gata, link, telefon și niciun contact, sau cu telefonul permis din fișă. Excepția acceptată: după un apel „Interesat”, conversația poate continua pe WhatsApp (`prospectare_continua_pe_whatsapp`), doar în activitate.
- **Roboții, tabla comună** (`prospectare_nise`): o nișă + zonă se rezervă (409 dacă e a altui robot, cu cine și de când), primește progres și se termină; rezervarea expiră după 24 h fără semn de viață. Toate firmele evaluate se notează, și cele respinse, cu motiv și scor (`evaluare`, `evaluare_motiv`); un domeniu deja evaluat nu se mai notează. **Coada de construcție e comună**: orice robot ia orice firmă cercetată, eligibilă, cu scor ≥ prag (Setări, implicit 45), cu email sau mobil, fără site (3 ore). Pagina „Nișe” arată tabla; pagina „Roboți” arată ce face fiecare acum (`ce_face`).
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
| `…34_prospectare_un_canal_nise.sql` | un singur canal + recontactare din fișă, conturile de WhatsApp, nișele, evaluările, coada comună de construcție, ce face robotul |
| `supabase/tests/prospectare/` | 147 de teste de reguli + proba de concurență (inclusiv WhatsApp trimis deodată de 5 oameni), pe Postgres local în Docker: `bash supabase/tests/prospectare/ruleaza.sh`; `api-seed.sql` pentru proba API |
| `lib/prospectare/` | tipuri, etichete, citiri, telefon / WhatsApp / .vcf / CSV, API-ul roboților |
| `app/(admin)/admin/prospectare/` | paginile, acțiunile, exportul CSV |
| `app/api/prospectare/robot/` | `firme`, `rezerva`, `heartbeat`, `termina`, `eveniment` |
| `scripts/prospectare-import.mjs` | importul din `stare.json` + `trimise.json` + listele WhatsApp |
| `scripts/prospectare-verifica-api.mjs` | proba API-ului, doar pe un server local cu bază de test |

## Pașii omului

1. **Migrările** în Supabase → SQL Editor: 28–33 sunt aplicate (2 nov). Migrarea 34: fișierul `C:\Users\PC\Desktop\meridian-prospectare-migrare-34.sql` (în afara repo-ului); o bază nouă primește întâi `meridian-prospectare-migrari-28-33.sql`, apoi 34. Lipești tot și dai Run. Se pot rula de mai multe ori. Ultimul rezultat e verificarea finală: toate rândurile `true`. Dacă rândul cu `admin_emails` e `false`, adaugi adresa lui Vlăduț: `insert into public.admin_emails (email) values ('<adresa lui>');` (aceeași adresă și în `ADMIN_EMAILS` din Vercel).
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
