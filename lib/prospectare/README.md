# Prospectare

Modulul din admin (`/admin/prospectare`) pentru firmele cercetate de roboții din `auto-web-rebuilder`, site-urile lor demo și contactul pe **un singur canal**: email, WhatsApp sau telefon.

## Regula de bază, în bază

- Canalul se setează **o singură dată**, din gol. Orice altă schimbare e refuzată de un trigger (`PR409`), oricine ar scrie: admin, robot, import sau SQL Editor. Singura excepție e `prospectare_seteaza_rezultat`: după ultima încercare „Nu răspunde” (Setări → încercări, implicit 3) firma iese din listă și își pierde canalul telefon. Asta se scrie în activitate, cu motiv.
- „Nu contacta” nu primește canal și nu intră în liste (`PR410`). Când o firmă devine „Nu contacta” (din admin, număr greșit, răspuns „NU” la email) iese din listele neterminate și din rezervări.
- Activitatea se poate doar completa: modificarea, ștergerea și golirea sunt refuzate și pentru superuser (`PR403`). Fiecare firmă nouă și fiecare schimbare de etapă sau canal intră acolo automat.
- RLS: citire doar pentru `is_lead_admin()` (tabela `admin_emails`). Scrierile trec doar prin server, cu cheia de service, prin funcțiile modulului. Roboții nu au acces direct: trec prin `/api/prospectare/robot` (vezi `docs/prospectare-api.md`).

## Fișierele

| Unde | Ce |
|---|---|
| `supabase/migrations/…28_prospectare_firme.sql` | firmele, activitatea, setările, regulile de canal |
| `…29_prospectare_lucru.sql` | roboții, rezervările, listele zilei; rezervarea atomică, rezultatele apelurilor |
| `…30_prospectare_email_import.sql` | căsuțele, cererea de canal email, evenimentele, importul, autentificarea roboților |
| `…31_prospectare_citire.sql` | numărătorile pentru Prezentare, filtre și roboți (doar citire) |
| `supabase/tests/prospectare/` | 78 de teste de reguli + proba de concurență, pe Postgres local în Docker: `bash supabase/tests/prospectare/ruleaza.sh` |
| `lib/prospectare/` | tipuri, etichete, citiri, telefon / WhatsApp / .vcf / CSV, API-ul roboților |
| `app/(admin)/admin/prospectare/` | paginile, acțiunile, exportul CSV |
| `app/api/prospectare/robot/` | `firme`, `rezerva`, `heartbeat`, `termina`, `eveniment` |
| `scripts/prospectare-import.mjs` | importul din `stare.json` + `trimise.json` + listele WhatsApp |
| `scripts/prospectare-verifica-api.mjs` | proba API-ului, doar pe un server local cu bază de test |

## Pașii omului

1. **Migrările 28–31** în Supabase → SQL Editor: fișierul unic `C:\Users\PC\Desktop\meridian-prospectare-migrari-28-31.sql` (în afara repo-ului). Lipești tot și dai Run. Ultimul rezultat e verificarea finală: toate rândurile `true`. Dacă rândul cu `admin_emails` e `false`, adaugi adresa lui Vlăduț: `insert into public.admin_emails (email) values ('<adresa lui>');` (aceeași adresă și în `ADMIN_EMAILS` din Vercel).
2. **Importul**: fișierul `C:\Users\PC\meridian-prospectare-import.env` (în afara repo-ului) cu `PROSPECTARE_SUPABASE_URL` și `PROSPECTARE_SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API). Apoi, din repo: `git -C C:\Users\PC\MeridianX\auto-web-rebuilder pull` și `node scripts/prospectare-import.mjs --env C:\Users\PC\meridian-prospectare-import.env --proba`. Fără `--proba` scrie. Se poate rula oricând din nou.
3. **Vercel**: nicio variabilă nouă. Modulul folosește `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` și `ADMIN_EMAILS`, care există deja.
4. **Roboții**: în admin → Prospectare → Roboți → „Adaugă robot”. Tokenul se arată o dată și se pune pe calculatorul robotului în variabila de mediu `MERIDIAN_ROBOT_TOKEN`.

## Decizii

- Tema închisă, ca adminul live (exportul Base44 nou a trecut tot pe temă deschisă). Structura, textele și comportamentul sunt din prototip.
- Emailul cere canalul **înainte** de trimitere (`email_de_trimis`: 200 / 409 / 429), apoi raportează `email_trimis` cu `message_id`.
- Exportul e CSV pentru Excel (BOM UTF-8, separator `;`), fără pachete noi.
- Statusul `eroare` al robotului → `cercetat`, cu statusul păstrat în `date_extra.status_robot`.
- Cele 30 de firme din `asignari-2026-11-01.json` → „trimise”, care primiseră deja email pe 30 oct, își păstrează canalul email. WhatsApp-ul de pe 1 nov e în activitate.
- Listele zilei intră doar cu firme care au site gata **cu link demo** și telefon. WhatsApp-ul doar cu mobil.
- Listele neterminate trec pe ziua de azi la deschiderea paginilor de apeluri și WhatsApp (`prospectare_reporteaza_liste`), fără cron.
