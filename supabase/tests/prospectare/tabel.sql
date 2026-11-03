-- Testele migrării 37 (numărul de site, tabelul Firme, evaluările respinse, /termina pentru orice firmă),
-- pe Postgres local (nu pe producție). Rulează după multicanal.sql și concurenta-multicanal.sh, peste baza lor,
-- cu 37 aplicată (de două ori). Totul într-o tranzacție: numerotarea de la sfârșitul tranzacției se face
-- aici imediat (set constraints … immediate), ca testele să vadă numerele.
\set ON_ERROR_STOP 1
set client_min_messages = warning;

create or replace function pg_temp.asteapta_eroare(p_sql text, p_cod text, p_nume text, p_mesaj text default '%')
returns text language plpgsql as $$
begin
  execute p_sql;
  raise exception 'PICAT: % (nu a dat eroare, aștepta %)', p_nume, p_cod;
exception when others then
  if sqlstate = p_cod and sqlerrm like p_mesaj then
    return 'ok   ' || p_nume || ' → ' || sqlstate || ': ' || sqlerrm;
  end if;
  if sqlerrm like 'PICAT:%' then raise; end if;
  raise exception 'PICAT: % (cod %, aștepta % „%”): %', p_nume, sqlstate, p_cod, p_mesaj, sqlerrm;
end;
$$;

create or replace function pg_temp.verifica(p_ok boolean, p_nume text)
returns text language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'PICAT: %', p_nume; end if;
  return 'ok   ' || p_nume;
end;
$$;

create or replace function pg_temp.id(p_nr integer) returns uuid language sql as $$ select id from public.prospectare_firme where nr = p_nr $$;
create or replace function pg_temp.f(p_nr integer) returns public.prospectare_firme language sql as $$ select * from public.prospectare_firme where nr = p_nr $$;
create or replace function pg_temp.ns(p_nr integer) returns integer language sql as $$ select nr_site from public.prospectare_firme where nr = p_nr $$;
create or replace function pg_temp.contor() returns integer language sql as $$ select valoare from public.prospectare_contoare where cheie = 'nr_site' $$;
create or replace function pg_temp.maxim() returns integer language sql as $$ select coalesce(max(nr_site), 0) from public.prospectare_firme $$;
create or replace function pg_temp.robot() returns uuid language sql as $$ select id from public.prospectare_dispozitive where nume = 'robot-email' $$;
create or replace function pg_temp.robot2() returns uuid language sql as $$ select id from public.prospectare_dispozitive where nume = 'robot-1' $$;
-- Programarea activă a unei firme: „canal:zi:cheie”, sau null.
create or replace function pg_temp.prog(p_nr integer) returns text language sql as $$
  select p.canal || ':' || (p.zi - public.prospectare_azi()) || ':' || coalesce(p.casuta, p.cont_whatsapp::text, p.utilizator)
  from public.prospectare_programari p where p.firma_id = pg_temp.id(p_nr) and p.stare = 'programata'
$$;

set constraints public.prospectare_firme_nr_site_la_final immediate;
select set_config('prospectare.autor', 'test', false);
-- Fără locuri în distribuție cât testăm /termina și importul (care completează ziua).
delete from public.prospectare_programari where zi >= public.prospectare_azi();
update public.prospectare_casute set activa = false;
update public.prospectare_conturi_whatsapp set activ = false;

-- 1. Numerotarea retroactivă (făcută de migrare peste firmele testelor de dinainte) ------------------
select pg_temp.verifica((select count(nr_site) > 0 and count(nr_site) = max(nr_site) from public.prospectare_firme),
  'retroactiv: site-urile publicate și verificate au numere de la 1, fără goluri');
select pg_temp.verifica(not exists (select 1 from public.prospectare_firme where nr_site is null and link_demo is not null and demo_verificat),
  'retroactiv: niciun site publicat și verificat fără număr');
select pg_temp.verifica(not exists (
    select 1 from public.prospectare_firme a join public.prospectare_firme b on a.nr_site < b.nr_site
    where a.site_gata_la is not null and b.site_gata_la is not null and a.site_gata_la > b.site_gata_la),
  'retroactiv: ordinea numerelor = ordinea terminării (cel mai vechi = cel mai mic)');
select pg_temp.verifica(pg_temp.contor() = pg_temp.maxim(), 'contorul = cel mai mare număr dat');

-- 2. Paza: numărul îl dă doar baza, o singură dată ---------------------------------------------------
insert into public.prospectare_firme (nr, nume, domeniu, telefon, email, etapa, site_gata_la, scor, evaluare) values
  (9901, 'Site nou 1', 't9901.ro', '0745 990 001', 'o@t9901.ro', 'site_in_lucru', null, 60, 'eligibila'),
  (9902, 'Site nou 2', 't9902.ro', '0745 990 002', 'o@t9902.ro', 'site_in_lucru', null, 61, 'eligibila'),
  (9903, 'Site nou 3', 't9903.ro', '0745 990 003', 'o@t9903.ro', 'site_in_lucru', null, 62, 'eligibila'),
  (9904, 'Site nou 4', 't9904.ro', '0264 990 004', 'o@t9904.ro', 'site_in_lucru', null, 63, 'eligibila'),
  (9905, 'Site nou 5', 't9905.ro', '0745 990 005', 'o@t9905.ro', 'cercetat', null, 64, 'eligibila'),
  (9906, 'Rezervată de altul', 't9906.ro', '0745 990 006', 'o@t9906.ro', 'site_in_lucru', null, 65, 'eligibila'),
  (9907, 'Doar link', 't9907.ro', '0745 990 007', 'o@t9907.ro', 'site_gata', now() - interval '2 days', 66, 'eligibila');
select pg_temp.asteapta_eroare($$update public.prospectare_firme set nr_site = 99999 where nr = 9901$$, 'PR422', 'numărul de site nu se pune de mână', '%îl dă baza%');
select pg_temp.asteapta_eroare($$insert into public.prospectare_firme (nr, nume, domeniu, etapa, nr_site) values (9999, 'x', 't9999.ro', 'cercetat', 88888)$$,
  'PR422', 'nici la o firmă nouă');

-- 3. Linkul fără verificare nu primește număr; cu verificare, următorul ------------------------------
select set_config('test.inainte', pg_temp.maxim()::text, false);
update public.prospectare_firme set link_demo = 'https://demo.delta.test/t7/' where nr = 9907;
select pg_temp.verifica(pg_temp.ns(9907) is null, 'link demo neverificat: fără număr de site');
update public.prospectare_firme set demo_verificat = true where nr = 9907;
select pg_temp.verifica(pg_temp.ns(9907) = current_setting('test.inainte')::integer + 1, 'link verificat: primește următorul număr');
select pg_temp.asteapta_eroare($$update public.prospectare_firme set nr_site = nr_site + 1 where nr = 9907$$, 'PR409', 'numărul dat nu se mai schimbă', '%nu se schimbă%');
update public.prospectare_firme set demo_verificat = false where nr = 9907;
update public.prospectare_firme set demo_verificat = true, link_demo = 'https://demo.delta.test/t7-v2/' where nr = 9907;
select pg_temp.verifica(pg_temp.ns(9907) = current_setting('test.inainte')::integer + 1, 'link nou / reverificat: același număr');

-- 4. Fără goluri: o numerotare anulată își anulează și numărul ----------------------------------------
savepoint anulat;
update public.prospectare_firme set link_demo = 'https://demo.delta.test/t1/', demo_verificat = true where nr = 9901;
select pg_temp.verifica(pg_temp.ns(9901) = current_setting('test.inainte')::integer + 2, 'în tranzacție: numărul următor');
rollback to savepoint anulat;
select pg_temp.verifica(pg_temp.ns(9901) is null and pg_temp.contor() = current_setting('test.inainte')::integer + 1, 'anulată: contorul revine (fără gol)');

-- 5. /termina: orice firmă, una sau mai multe, întoarce nr_site -----------------------------------------
insert into public.prospectare_rezervari (firma_id, dispozitiv_id, tip_lucru, expira_la) values (pg_temp.id(9906), pg_temp.robot2(), 'construire', now() + interval '1 hour');
select pg_temp.verifica((public.prospectare_termina(pg_temp.robot(), pg_temp.id(9901), 'https://demo.delta.test/t1/') ->> 'nr_site')::integer
    = current_setting('test.inainte')::integer + 2, '/termina, o firmă nerezervată: site gata, întoarce nr_site');
select pg_temp.verifica((pg_temp.f(9901)).etapa = 'site_gata' and (pg_temp.f(9901)).demo_verificat, '/termina: etapa site gata, link verificat');
select set_config('test.lot', public.prospectare_termina_lot(pg_temp.robot(), ($$[
  {"domeniu": "https://www.t9902.ro/", "link_demo": "https://demo.delta.test/t2/"},
  {"nr": 9903, "link_demo": "https://demo.delta.test/t3/", "detalii": {"calculator": "pc-test"}},
  {"domeniu": "nu-exista-9.ro", "link_demo": "https://demo.delta.test/x/"},
  {"nr": 9905, "link_demo": "http://fara-https.ro/"},
  {"firma_id": "$$ || pg_temp.id(9906) || $$", "link_demo": "https://demo.delta.test/t6/"}
]$$)::jsonb)::text, false);
select pg_temp.verifica((current_setting('test.lot')::jsonb ->> 'terminate')::integer = 3 and (current_setting('test.lot')::jsonb ->> 'erori')::integer = 2,
  'lotul: 3 terminate, 2 erori (firmă inexistentă, link fără https)');
select pg_temp.verifica((select bool_and((x ->> 'nr_site') is not null) from jsonb_array_elements(current_setting('test.lot')::jsonb -> 'firme') x where not x ? 'eroare'),
  'lotul: fiecare firmă terminată are nr_site în răspuns');
select pg_temp.verifica((select string_agg(x -> 'eroare' ->> 'cod', ',' order by (x ->> 'index')::integer) from jsonb_array_elements(current_setting('test.lot')::jsonb -> 'firme') x where x ? 'eroare') = 'PR404,PR422',
  'lotul: erorile au codul lor (404, 422), pe poziția din cerere');
select pg_temp.verifica(pg_temp.ns(9902) = current_setting('test.inainte')::integer + 3 and pg_temp.ns(9903) = current_setting('test.inainte')::integer + 4
    and pg_temp.ns(9906) = current_setting('test.inainte')::integer + 5, 'lotul: numere consecutive, în ordinea terminării');
select pg_temp.verifica(not exists (select 1 from public.prospectare_rezervari where firma_id = pg_temp.id(9906)), '/termina închide și rezervarea altui robot');
select pg_temp.verifica(pg_temp.ns(9905) is null and (pg_temp.f(9905)).link_demo is null, 'firma cu link greșit rămâne neschimbată');
select pg_temp.verifica((public.prospectare_termina_lot(pg_temp.robot(), '[{"nr": 9903, "link_demo": "https://demo.delta.test/t3/"}]') -> 'firme' -> 0 ->> 'nr_site')::integer
    = current_setting('test.inainte')::integer + 4, 'aceeași firmă raportată din nou: același număr, fără număr nou');
select pg_temp.verifica(pg_temp.contor() = current_setting('test.inainte')::integer + 5, 'contorul: doar numerele date');
select pg_temp.asteapta_eroare($$select public.prospectare_termina(pg_temp.robot(), gen_random_uuid(), 'https://demo.delta.test/x/')$$, 'PR404', '/termina pe o firmă care nu există');
select pg_temp.asteapta_eroare($$select public.prospectare_termina(pg_temp.robot(), pg_temp.id(9904), 'ftp://x')$$, 'PR422', '/termina cu link care nu e https');
select pg_temp.asteapta_eroare($$select public.prospectare_termina_lot(pg_temp.robot(), (select jsonb_agg(jsonb_build_object('nr', g, 'link_demo', 'https://x.ro/')) from generate_series(1, 101) g))$$,
  'PR422', 'cel mult 100 de firme într-o cerere');

-- 6. Grupele tabelului ---------------------------------------------------------------------------------
select pg_temp.verifica((pg_temp.f(9901)).grupa_tabel = 1, 'cu site, necontactată: grupa 1 (sus)');
update public.prospectare_firme set email_la = now() - interval '2 days', etapa = 'email_trimis' where nr = 9902;
select pg_temp.verifica((pg_temp.f(9902)).grupa_tabel = 2, 'cu site, contactată pe email: grupa 2');
select pg_temp.verifica((pg_temp.f(9904)).grupa_tabel = 3, 'fără site: grupa 3 (doar prin căutare sau etapă)');

-- 7. Evaluările: respinsele cu evidența minimă ------------------------------------------------------------
select set_config('test.ev', public.prospectare_evaluare_noteaza(pg_temp.robot(), null, $$[
  {"domeniu": "ev-resp-1.ro", "nume": "Respinsă Unu", "nisa": "Instalații", "oras": "Cluj", "telefon": "0745 111 222", "email": "a@ev-resp-1.ro",
   "scor": 21, "evaluare": "respinsa", "motiv": "scor 21 sub pragul 45", "date_extra": {"calculator": "pc-test", "blocuri": {"site": 5}}},
  {"domeniu": "ev-elig-1.ro", "nume": "Eligibilă Unu", "nisa": "Instalații", "oras": "Orașul-Test-37", "telefon": "0745 111 333", "email": "a@ev-elig-1.ro",
   "scor": 70, "evaluare": "eligibila", "date_extra": {"calculator": "pc-test"}}
]$$::jsonb)::text, false);
select pg_temp.verifica((current_setting('test.ev')::jsonb ->> 'respinse')::integer = 1 and (current_setting('test.ev')::jsonb ->> 'eligibile')::integer = 1, '/evaluare noteaza: 1 eligibilă, 1 respinsă');
select pg_temp.verifica((select telefon is null and email is null and oras is null and date_extra = '{}'::jsonb and nisa = 'Instalații' and scor = 21
    and evaluare_motiv = 'scor 21 sub pragul 45' and evaluat_de = 'pc-test' and evaluat_la is not null and grupa_tabel = 0
    from public.prospectare_firme where domeniu = 'ev-resp-1.ro'), 'respinsă: doar domeniu, nume, nișă, scor, motiv, data, calculator; nu apare în tabel');
select pg_temp.verifica((select telefon is not null and email is not null and evaluat_de = 'pc-test' and grupa_tabel = 3
    from public.prospectare_firme where domeniu = 'ev-elig-1.ro'), 'eligibilă: datele complete, calculatorul notat');
select set_config('test.ver', public.prospectare_evaluare_verifica('["ev-resp-1.ro", "https://www.ev-elig-1.ro/", "ev-noua-1.ro"]')::text, false);
select pg_temp.verifica((select string_agg((x ->> 'domeniu') || '=' || (x ->> 'evaluare'), ',' order by x ->> 'domeniu') from jsonb_array_elements(current_setting('test.ver')::jsonb -> 'deja_evaluate') x)
    = 'ev-elig-1.ro=eligibila,ev-resp-1.ro=respinsa'
  and current_setting('test.ver')::jsonb -> 'noi' = '["ev-noua-1.ro"]'::jsonb, '/evaluare verifica: întoarce evaluatele (eligibile și respinse) și ce e nou');
select pg_temp.verifica((select bool_and(x ? 'calculator' and x ? 'nisa' and x ? 'motiv') from jsonb_array_elements(current_setting('test.ver')::jsonb -> 'deja_evaluate') x),
  '/evaluare verifica: cu nișa, motivul și calculatorul');
select pg_temp.verifica((public.prospectare_evaluare_noteaza(pg_temp.robot(), null, '[{"domeniu": "ev-resp-1.ro", "scor": 22, "evaluare": "respinsa", "motiv": "din nou"}]') -> 'deja_evaluate') = '["ev-resp-1.ro"]'::jsonb,
  'a doua evaluare a aceluiași domeniu se sare');

-- 8. Importul: evaluarea din starea roboților ---------------------------------------------------------------
select public.prospectare_upsert_firme($$[
  {"domeniu": "im-cerc-1.ro", "nr": 9911, "nume": "Import cercetat", "nisa": "Rent a car", "oras": "Iași", "telefon": "0745 222 001", "email": "a@im-cerc-1.ro", "scor": 30, "etapa": "cercetat"},
  {"domeniu": "im-cerc-2.ro", "nr": 9912, "nume": "Import respinsă nouă", "nisa": "Rent a car", "oras": "Iași", "telefon": "0745 222 002", "scor": 12, "etapa": "cercetat",
   "evaluare": "respinsa", "evaluare_motiv": "pre-scor 3 sub pragul 7", "evaluat_de": "pc-stefan", "date_extra": {"prescor": 3}}
]$$::jsonb, 'import', 'import');
select pg_temp.verifica((pg_temp.f(9912)).telefon is null and (pg_temp.f(9912)).oras is null and (pg_temp.f(9912)).evaluare = 'respinsa'
    and (pg_temp.f(9912)).evaluat_de = 'pc-stefan' and (pg_temp.f(9912)).grupa_tabel = 0, 'import: respinsă nouă → doar evidența minimă');
select pg_temp.verifica((pg_temp.f(9911)).telefon is not null and (pg_temp.f(9911)).evaluare is null, 'import fără evaluare: cercetată cu datele complete');
select pg_temp.verifica((public.prospectare_upsert_firme($$[{"domeniu": "im-cerc-1.ro", "nr": 9911, "scor": 30, "etapa": "cercetat", "evaluare": "respinsa",
    "evaluare_motiv": "scor 30 sub pragul 45 și punctajul Site 8 sub 20", "evaluat_de": "pc-stefan"}]$$::jsonb, 'import', 'import') ->> 'respinse')::integer = 1
  and (pg_temp.f(9911)).telefon is null and (pg_temp.f(9911)).email is null and (pg_temp.f(9911)).nume = 'Import cercetat' and (pg_temp.f(9911)).nisa = 'Rent a car',
  'import: cercetată existentă, acum respinsă → rămâne doar evidența minimă');
select public.prospectare_upsert_firme($$[{"domeniu": "im-cerc-1.ro", "nr": 9911, "nume": "Import cercetat", "oras": "Iași", "telefon": "0745 222 001", "scor": 30, "etapa": "cercetat"}]$$::jsonb, 'import', 'import');
select pg_temp.verifica((pg_temp.f(9911)).telefon is null and (pg_temp.f(9911)).oras is null and (pg_temp.f(9911)).evaluare = 'respinsa',
  'un import fără evaluare (mai vechi) nu-i dă înapoi datele');
select public.prospectare_upsert_firme($$[{"domeniu": "im-cerc-1.ro", "nr": 9911, "nume": "Import cercetat", "oras": "Iași", "telefon": "0745 222 001", "scor": 50,
  "etapa": "cercetat", "evaluare": "eligibila", "evaluat_de": "pc-stefan"}]$$::jsonb, 'import', 'import');
select pg_temp.verifica((pg_temp.f(9911)).telefon = '0745 222 001' and (pg_temp.f(9911)).oras = 'Iași' and (pg_temp.f(9911)).evaluare = 'eligibila'
    and (pg_temp.f(9911)).evaluare_motiv is null and (pg_temp.f(9911)).grupa_tabel = 3, 'reevaluată eligibilă: datele se completează din nou');
select public.prospectare_upsert_firme($$[{"domeniu": "im-cerc-2.ro", "nr": 9912, "nume": "Import respinsă nouă", "telefon": "0745 222 002", "scor": 12, "etapa": "site_gata",
  "link_demo": "https://demo.delta.test/i2/", "demo_verificat": true, "site_gata_la": "2026-11-01T10:00:00+02:00"}]$$::jsonb, 'import', 'import');
select pg_temp.verifica((pg_temp.f(9912)).evaluare = 'eligibila' and (pg_temp.f(9912)).telefon = '0745 222 002' and (pg_temp.f(9912)).nr_site = pg_temp.maxim()
    and (pg_temp.f(9912)).grupa_tabel = 1, 'respinsă, apoi construită și publicată (importul): eligibilă, datele înapoi, primește număr de site');

-- 9. Rezumatul și opțiunile ----------------------------------------------------------------------------------
select pg_temp.verifica((public.prospectare_rezumat() -> 'evaluate' ->> 'respinse')::integer = (select count(*) from public.prospectare_firme where evaluare = 'respinsa')
  and (public.prospectare_rezumat() -> 'evaluate' ->> 'eligibile')::integer = (select count(*) from public.prospectare_firme where evaluare = 'eligibila'),
  'contorul „Evaluate”: cifrele reale (eligibile, respinse)');
select pg_temp.verifica(coalesce((public.prospectare_rezumat() -> 'etape_vizibile' ->> 'cercetat')::integer, 0)
    = (select count(*) from public.prospectare_firme where etapa = 'cercetat' and grupa_tabel > 0), 'etapele din filtru: fără respinse');
select pg_temp.verifica((public.prospectare_rezumat() -> 'site_uri' ->> 'numerotate')::integer = pg_temp.maxim(), 'rezumat: câte site-uri au număr');
select pg_temp.verifica(not exists (select 1 from jsonb_array_elements(public.prospectare_optiuni() -> 'orase') o where o ->> 'v' = 'Orașul-Test-37'),
  'opțiunile filtrelor: doar din firmele cu site');

-- 10. Ordinea distribuției: de la cel mai mic număr de site -------------------------------------------------
delete from public.prospectare_programari where zi = public.prospectare_azi();
update public.prospectare_casute set activa = false;
update public.prospectare_firme set demo_verificat = false where nr_site is not null and nr not in (9901, 9903, 9906);
-- 9901, 9903, 9906: site gata, publicate, cu mobil, necontactate; 9901 are cel mai mic număr.
-- Contul cu un singur loc: limita nouă completează ziua (36).
update public.prospectare_conturi_whatsapp set activ = (id = 1), limita_zi = 1;
select pg_temp.verifica(pg_temp.prog(9901) = 'whatsapp:0:1' and pg_temp.prog(9903) is null and pg_temp.prog(9906) is null,
  'completarea zilei: WhatsApp-ul pleacă de la cel mai mic nr_site necontactat');
update public.prospectare_conturi_whatsapp set limita_zi = 3 where id = 1;
select pg_temp.verifica((select array_agg(x.nr_site) from public.prospectare_whatsapp_coada(200, 0) x)
    = (select array_agg(nr_site order by nr_site) from public.prospectare_firme where nr in (9901, 9903, 9906)),
  'lista de WhatsApp: în ordinea numărului de site');
-- Email: două firme noi, publicate deodată; cea terminată mai demult primește numărul mai mic și pleacă prima.
insert into public.prospectare_firme (nr, nume, domeniu, email, etapa, link_demo, demo_verificat, site_gata_la, scor, evaluare) values
  (9921, 'Email nou', 't9921.ro', 'o@t9921.ro', 'site_gata', 'https://demo.delta.test/t21/', true, now() - interval '1 day', 70, 'eligibila'),
  (9922, 'Email vechi', 't9922.ro', 'o@t9922.ro', 'site_gata', 'https://demo.delta.test/t22/', true, now() - interval '3 days', 70, 'eligibila');
select pg_temp.verifica(pg_temp.ns(9922) + 1 = pg_temp.ns(9921), 'publicate în aceeași tranzacție: numerele în ordinea terminării');
insert into public.prospectare_casute (adresa, domeniu, limita_zi, activa) values ('stefan@delta.test', 'delta.test', 5, true)
  on conflict (adresa) do update set limita_zi = 5, activa = true;
select pg_temp.verifica((select array_agg(x ->> 'nr' order by o) from jsonb_array_elements(public.prospectare_coada_email(null, null) -> 'firme') with ordinality a(x, o))
    = array['9922', '9921'], 'coada de email: de la cel mai mic nr_site, cu nr_site în răspuns');
select pg_temp.verifica((select bool_and((x ->> 'nr_site') is not null) from jsonb_array_elements(public.prospectare_coada_email(null, null) -> 'firme') x),
  'coada de email: fiecare firmă cu numărul ei de site');
