-- Testele migrării 39 (distribuirea manuală, listele de construcție, lacătul de publicare), pe Postgres local
-- (nu pe producție). Rulează după sesiuni.sql și concurenta-sesiuni.sh, peste baza lor, cu 39 aplicată (de două ori).
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
create or replace function pg_temp.ids(p_nr integer[]) returns uuid[] language sql as $$ select array_agg(id order by nr) from public.prospectare_firme where nr = any(p_nr) $$;
create or replace function pg_temp.r() returns uuid language sql as $$ select id from public.prospectare_dispozitive where nume = 'PC Sesiuni' $$;
create or replace function pg_temp.alt() returns uuid language sql as $$ select id from public.prospectare_dispozitive where nume = 'robot-1' $$;
-- Distribuie (proba, implicit), cu firmele după nr.
create or replace function pg_temp.d(p_canal text, p_nr integer[], p_conturi text[], p_numere integer[] default null, p_ordine text default 'scor',
  p_alocari jsonb default '{}'::jsonb, p_proba boolean default true, p_zi date default null)
returns jsonb language sql as $$
  select public.prospectare_distribuie(p_canal, coalesce(p_zi, public.prospectare_azi()), pg_temp.ids(p_nr), p_conturi, p_numere, p_ordine, p_alocari, p_proba, 'test') $$;
-- Firmele unui cont din plan, în ordine („9401,9402”).
create or replace function pg_temp.pe(r jsonb, p_cont text) returns text language sql as $$
  select coalesce(string_agg(e ->> 'nr', ',' order by i), '') from jsonb_array_elements(r -> 'firme') with ordinality t(e, i) where e ->> 'cont' = p_cont $$;
create or replace function pg_temp.motiv(r jsonb, p_nr integer) returns text language sql as $$
  select e ->> 'motiv' from jsonb_array_elements(r -> 'sarite') e where (e ->> 'nr')::integer = p_nr $$;
create or replace function pg_temp.la(r jsonb, p_terminal text) returns text language sql as $$
  select coalesce(string_agg(e ->> 'nr', ',' order by (e ->> 'nr')::integer), '') from jsonb_array_elements(r -> 'firme') e where e ->> 'terminal' = p_terminal $$;
create or replace function pg_temp.lista(p_s text) returns text language sql as $$
  select coalesce(string_agg(e ->> 'nr', ',' order by (e ->> 'nr')::integer), '') from jsonb_array_elements(public.prospectare_lista_mea(pg_temp.r(), p_s) -> 'firme') e $$;
create or replace function pg_temp.lacat(p_r uuid, p_a text, p_s text default '1') returns jsonb language sql as $$ select public.prospectare_lacat_publicare(p_r, p_a, p_s) $$;

drop table if exists pg_temp.numere_inainte;
create temp table numere_inainte as select id, nr, nr_site from public.prospectare_firme;

select set_config('prospectare.autor', 'test', false);
update public.prospectare_conturi_whatsapp set activ = true, limita_zi = 40 where id in (1, 2);
update public.prospectare_conturi_whatsapp set activ = true, limita_zi = 2 where id = 3;
update public.prospectare_casute set activa = true where adresa = 'stefan@alfa.test';

-- Firme cu site publicat (D1–D8): scorurile 90…20, site-urile de la cel mai vechi (D1) la cel mai nou (D8).
insert into public.prospectare_firme (nr, nume, domeniu, telefon, email, etapa, scor, evaluare, link_demo, demo_verificat, site_gata_la)
select 9400 + g, 'Dist ' || g, 'dm-' || g || '.ro', '0722 000 ' || lpad(g::text, 3, '0'), 'o@dm-' || g || '.ro', 'site_gata', 100 - g * 10, 'eligibila',
  'https://demo.alfa.test/dm-' || g || '/', true, now() - interval '30 days' + g * interval '1 hour'
from generate_series(1, 8) g;
-- Firmele care se sar, fiecare cu motivul ei.
insert into public.prospectare_firme (nr, nume, domeniu, telefon, email, etapa, scor, evaluare, link_demo, demo_verificat, site_gata_la, date_extra, whatsapp_la, whatsapp_cont) values
  (9411, 'Sar nu contacta', 'dm-s1.ro', '0722 100 001', 'o@dm-s1.ro', 'nu_contacta', 99, 'eligibila', 'https://demo.alfa.test/s1/', true, now() - interval '20 days', '{}', null, null),
  (9412, 'Sar respinsă', 'dm-s2.ro', '0722 100 002', 'o@dm-s2.ro', 'respins', 99, 'eligibila', 'https://demo.alfa.test/s2/', true, now() - interval '20 days', '{}', null, null),
  (9413, 'Sar duplicat', 'dm-s3.ro', '0722 100 003', 'o@dm-s3.ro', 'site_gata', 99, 'eligibila', 'https://demo.alfa.test/s3/', true, now() - interval '20 days', '{"duplicat_de": 9401}', null, null),
  (9414, 'Sar WhatsApp trimis', 'dm-s4.ro', '0722 100 004', 'o@dm-s4.ro', 'whatsapp_trimis', 99, 'eligibila', 'https://demo.alfa.test/s4/', true, now() - interval '20 days', '{}', now() - interval '3 days', 1),
  (9415, 'Sar link neverificat', 'dm-s5.ro', '0722 100 005', 'o@dm-s5.ro', 'site_gata', 99, 'eligibila', 'https://demo.alfa.test/s5/', false, now() - interval '20 days', '{}', null, null),
  (9416, 'Sar telefon fix', 'dm-s6.ro', '021 300 0006', 'o@dm-s6.ro', 'site_gata', 99, 'eligibila', 'https://demo.alfa.test/s6/', true, now() - interval '20 days', '{}', null, null),
  (9417, 'Sar programată', 'dm-s7.ro', '0722 100 007', 'o@dm-s7.ro', 'site_gata', 99, 'eligibila', 'https://demo.alfa.test/s7/', true, now() - interval '20 days', '{}', null, null),
  (9421, 'Email alt domeniu', 'dm-e1.ro', '0722 200 001', 'o@dm-e1.ro', 'site_gata', 50, 'eligibila', 'https://demo.beta.test/e1/', true, now() - interval '19 days', '{}', null, null),
  (9422, 'Email restanță', 'dm-e2.ro', '0722 200 002', 'o@dm-e2.ro', 'site_gata', 50, 'eligibila', 'https://demo.alfa.test/e2/', true, now() - interval '19 days', '{}', null, null),
  (9431, 'Apel azi', 'dm-t1.ro', '0722 300 001', 'o@dm-t1.ro', 'site_gata', 50, 'eligibila', 'https://demo.alfa.test/t1/', true, now() - interval '19 days', '{}', null, null);
insert into public.prospectare_programari (firma_id, canal, zi, sursa, cont_whatsapp, creat_de) values (pg_temp.id(9417), 'whatsapp', public.prospectare_azi() + 1, 'manual', 1, 'test');
-- Firme de construit (C1–C7), scorurile 95…35.
insert into public.prospectare_firme (nr, nume, domeniu, email, etapa, scor, evaluare)
select 9440 + g, 'Constr ' || g, 'dm-c' || g || '.ro', 'o@dm-c' || g || '.ro', 'cercetat', 105 - g * 10, 'eligibila' from generate_series(1, 7) g;
-- /termina și importul: un fix, un mobil, unul fără telefon.
insert into public.prospectare_firme (nr, nume, domeniu, telefon, email, etapa, scor, evaluare) values
  (9451, 'Termina fix', 'dm-m1.ro', '021 311 1111', 'o@dm-m1.ro', 'cercetat', 70, 'eligibila'),
  (9452, 'Termina mobil', 'dm-m2.ro', '0733 111 222', 'o@dm-m2.ro', 'cercetat', 70, 'eligibila'),
  (9453, 'Termina detalii', 'dm-m3.ro', null, 'o@dm-m3.ro', 'cercetat', 70, 'eligibila'),
  (9461, 'Import fix', 'dm-u1.ro', '021 222 3333', 'o@dm-u1.ro', 'cercetat', 70, 'eligibila');
select public.prospectare_numeroteaza_site() >= 15 as numerotate;

-- 1. Distribuie: împărțirea egală, manuală, după scor și după cele mai recente -------------------------------

select set_config('test.r', pg_temp.d('whatsapp', array[9401, 9402, 9403, 9404, 9405, 9406], array['1', '2', '3'])::text, false);
select pg_temp.verifica(pg_temp.pe(current_setting('test.r')::jsonb, '1') = '9401,9402' and pg_temp.pe(current_setting('test.r')::jsonb, '2') = '9403,9404'
  and pg_temp.pe(current_setting('test.r')::jsonb, '3') = '9405,9406', 'egal pe 3 conturi, după scor: Cont 1 primește primele 2, Cont 2 următoarele, Cont 3 ultimele');
select pg_temp.verifica((current_setting('test.r')::jsonb ->> 'programate')::integer = 6 and jsonb_array_length(current_setting('test.r')::jsonb -> 'sarite') = 0
  and (current_setting('test.r')::jsonb ->> 'selectate')::integer = 6, 'rezumatul: 6 vor fi programate, 0 sărite');
select set_config('test.r', pg_temp.d('whatsapp', array[9401, 9402, 9403, 9404, 9405, 9406, 9407], array['1', '2', '3'])::text, false);
select pg_temp.verifica(pg_temp.pe(current_setting('test.r')::jsonb, '1') = '9401,9402,9403' and pg_temp.pe(current_setting('test.r')::jsonb, '2') = '9404,9405'
  and pg_temp.pe(current_setting('test.r')::jsonb, '3') = '9406,9407', 'egal cu rest: 7 firme pe 3 conturi = 3 / 2 / 2 (diferența cel mult una)');
select set_config('test.r', pg_temp.d('whatsapp', array[9401, 9402, 9403, 9404, 9405, 9406], array['1', '2', '3'], array[4, 1, 1])::text, false);
select pg_temp.verifica(pg_temp.pe(current_setting('test.r')::jsonb, '1') = '9401,9402,9403,9404' and pg_temp.pe(current_setting('test.r')::jsonb, '2') = '9405'
  and pg_temp.pe(current_setting('test.r')::jsonb, '3') = '9406', 'manual 4 / 1 / 1: primul cont primește primele 4 după scor');
select pg_temp.asteapta_eroare($$select pg_temp.d('whatsapp', array[9401, 9402, 9403, 9404, 9405, 9406], array['1', '2', '3'], array[3, 1, 1])$$, 'PR422',
  'manual: suma (5) diferită de firmele alese (6) e refuzată', '%Suma pe conturi (5)%(6)%');
select pg_temp.asteapta_eroare($$select pg_temp.d('whatsapp', array[9401, 9402], array['1', '2'], array[2])$$, 'PR422', 'manual: un număr pentru fiecare cont ales', '%fiecare cont%');
select set_config('test.r', pg_temp.d('whatsapp', array[9401, 9402, 9403, 9404, 9405, 9406], array['1', '2', '3'], null, 'recente')::text, false);
select pg_temp.verifica(pg_temp.pe(current_setting('test.r')::jsonb, '1') = '9406,9405' and pg_temp.pe(current_setting('test.r')::jsonb, '3') = '9402,9401',
  'cele mai recente (nr_site descrescător): Cont 1 primește cele mai noi site-uri');
select pg_temp.verifica((select (current_setting('test.r')::jsonb -> 'firme' -> 0 ->> 'nr_site')::integer = max(nr_site) from public.prospectare_firme where nr between 9401 and 9406),
  'cele mai recente: prima firmă are cel mai mare nr_site');
select pg_temp.asteapta_eroare($$select pg_temp.d('whatsapp', array[9401], array['1'], null, 'alfabetic')$$, 'PR422', 'ordinea: doar „scor” sau „recente”');

-- 2. Firmele sărite, fiecare cu motivul ei -----------------------------------------------------------------

select set_config('test.r', pg_temp.d('whatsapp', array[9401, 9402, 9411, 9412, 9413, 9414, 9415, 9416, 9417], array['1', '2'])::text, false);
select pg_temp.verifica((current_setting('test.r')::jsonb ->> 'programate')::integer = 2 and jsonb_array_length(current_setting('test.r')::jsonb -> 'sarite') = 7,
  'din 9 alese: 2 programate, 7 sărite');
select pg_temp.verifica(pg_temp.motiv(current_setting('test.r')::jsonb, 9411) = '„Nu contacta”', 'sărită: „Nu contacta”');
select pg_temp.verifica(pg_temp.motiv(current_setting('test.r')::jsonb, 9412) like '%respins%', 'sărită: respinsă');
select pg_temp.verifica(pg_temp.motiv(current_setting('test.r')::jsonb, 9413) = 'duplicat al #9401', 'sărită: duplicat (cu firma originală)');
select pg_temp.verifica(pg_temp.motiv(current_setting('test.r')::jsonb, 9414) = 'a primit deja WhatsApp', 'sărită: același canal nu se folosește de două ori');
select pg_temp.verifica(pg_temp.motiv(current_setting('test.r')::jsonb, 9415) like '%nu e verificat%', 'sărită: link demo neverificat (WhatsApp)');
select pg_temp.verifica(pg_temp.motiv(current_setting('test.r')::jsonb, 9416) = 'fără număr de mobil', 'sărită: fără mobil 07xx (WhatsApp)');
select pg_temp.verifica(pg_temp.motiv(current_setting('test.r')::jsonb, 9417) like 'e deja programată pe WhatsApp pentru%', 'sărită: deja programată (cu canalul și ziua)');
select set_config('test.r', pg_temp.d('telefon', array[9416], array['stefan'])::text, false);
select pg_temp.verifica((current_setting('test.r')::jsonb ->> 'programate')::integer = 1, 'apelul merge și pe fix (doar WhatsApp-ul cere mobil)');

-- 3. Proba nu scrie; distribuirea scrie programările, pe conturi, pentru azi ---------------------------------

select set_config('test.n', (select count(*) from public.prospectare_programari)::text, false);
select pg_temp.d('whatsapp', array[9401, 9402, 9403], array['1']) is not null;
select pg_temp.verifica((select count(*) from public.prospectare_programari)::text = current_setting('test.n'), 'proba (rezumatul) nu scrie nimic');
select set_config('test.r', pg_temp.d('whatsapp', array[9401, 9402, 9403, 9404, 9405, 9406], array['1', '2', '3'], null, 'scor', '{}', false)::text, false);
select pg_temp.verifica((current_setting('test.r')::jsonb ->> 'programate')::integer = 6 and not (current_setting('test.r')::jsonb ->> 'proba')::boolean, 'distribuirea: 6 programate');
select pg_temp.verifica((select count(*) = 6 and bool_and(zi = public.prospectare_azi() and sursa = 'manual' and stare = 'programata')
    from public.prospectare_programari where firma_id = any(pg_temp.ids(array[9401, 9402, 9403, 9404, 9405, 9406])) and stare = 'programata'),
  'programările sunt pentru azi, manuale, active');
select pg_temp.verifica((select cont_whatsapp = 1 from public.prospectare_programari where firma_id = pg_temp.id(9401) and stare = 'programata')
  and (select cont_whatsapp = 3 from public.prospectare_programari where firma_id = pg_temp.id(9406) and stare = 'programata'), 'fiecare firmă pe contul ei (blocurile din rezumat)');
select pg_temp.verifica(exists (select 1 from public.prospectare_activitate where firma_id = pg_temp.id(9401) and tip = 'programare' and detalii ->> 'sursa' = 'distribuire'),
  'distribuirea se scrie în activitatea firmei');
select set_config('test.r', pg_temp.d('whatsapp', array[9401, 9402], array['1'])::text, false);
select pg_temp.verifica((current_setting('test.r')::jsonb ->> 'programate')::integer = 0 and pg_temp.motiv(current_setting('test.r')::jsonb, 9401) like 'e deja programată%',
  'a doua oară, aceleași firme sunt sărite (deja programate)');
select set_config('test.r', pg_temp.d('whatsapp', array[9407, 9408], array['3'])::text, false);
select pg_temp.verifica((current_setting('test.r')::jsonb ->> 'programate')::integer = 2 and jsonb_array_length(current_setting('test.r')::jsonb -> 'avertismente') = 1
  and (current_setting('test.r')::jsonb -> 'pe_conturi' -> 0 ->> 'peste_limita')::boolean, 'peste limita zilnică a contului: avertisment, nu blocare');
select pg_temp.verifica(current_setting('test.r')::jsonb ->> 'avertismente' like '%Cont 3: 4 pe%(2 deja + 2 acum), peste limita de 2%', 'avertismentul spune contul, câte și limita');

-- 4. Opțiunile avansate, ziua, conturile ---------------------------------------------------------------------

select set_config('test.r', pg_temp.d('whatsapp', array[9407, 9408], array['1', '2'], null, 'scor', jsonb_build_object(pg_temp.id(9408)::text, '2'))::text, false);
select pg_temp.verifica(pg_temp.pe(current_setting('test.r')::jsonb, '2') = '9408' and pg_temp.pe(current_setting('test.r')::jsonb, '1') = '9407',
  'opțiuni avansate: firma aleasă merge pe contul ales, restul se împart');
select pg_temp.asteapta_eroare(format($$select pg_temp.d('whatsapp', array[9407], array['1'], null, 'scor', '{"%s": "3"}')$$, pg_temp.id(9407)), 'PR422',
  'opțiuni avansate: doar conturile alese', '%nu e printre cele alese%');
select pg_temp.asteapta_eroare($$select pg_temp.d('whatsapp', array[9407], array['1'], null, 'scor', '{}', true, public.prospectare_azi() - 1)$$, 'PR422', 'ziua: nu în trecut', '%azi%');
select pg_temp.asteapta_eroare($$select pg_temp.d('whatsapp', array[9407], array['1'], null, 'scor', '{}', true, public.prospectare_azi() + 61)$$, 'PR422', 'ziua: cel mult 60 de zile înainte');
select pg_temp.verifica((pg_temp.d('whatsapp', array[9407], array['1'], null, 'scor', '{}', true, public.prospectare_azi() + 3) ->> 'zi')::date = public.prospectare_azi() + 3, 'altă zi decât azi');
select pg_temp.asteapta_eroare($$select pg_temp.d('whatsapp', array[9407], array['4'])$$, 'PR422', 'contul dezactivat nu se poate alege', '%dezactivat%');
select pg_temp.asteapta_eroare($$select pg_temp.d('whatsapp', array[9407], array[]::text[])$$, 'PR422', 'fără cont ales: refuzat', '%cel puțin un cont%');

-- 5. Canalele suspendate --------------------------------------------------------------------------------------

select pg_temp.verifica(not public.prospectare_canal_activ('email'), 'emailul e suspendat (din migrare)');
select pg_temp.asteapta_eroare($$select pg_temp.d('email', array[9407], array['stefan@alfa.test'])$$, 'PR409', 'email suspendat: nu se distribuie', '%Emailul e suspendat%livrabilitate, reparăm%');
select pg_temp.verifica(public.prospectare_seteaza_canal('whatsapp', false, 'test', 'test') ->> 'activ' = 'false', 'WhatsApp suspendat din Setări');
select pg_temp.asteapta_eroare($$select pg_temp.d('whatsapp', array[9407], array['1'])$$, 'PR409', 'WhatsApp suspendat: nu se distribuie', '%WhatsApp-ul e suspendat%(test)%');
select pg_temp.asteapta_eroare($$select public.prospectare_whatsapp_trimis(pg_temp.id(9401), null, 'test')$$, 'PR409', 'WhatsApp suspendat: nu se trimite', '%suspendat%');
select pg_temp.verifica((select count(*) = 6 from public.prospectare_programari where firma_id = any(pg_temp.ids(array[9401, 9402, 9403, 9404, 9405, 9406])) and stare = 'programata'),
  'canal suspendat: firmele programate așteaptă (nu se pierd)');
select pg_temp.verifica((public.prospectare_seteaza_canal('whatsapp', true, 'ignorat', 'test') ->> 'motiv') is null, 'WhatsApp activ din nou (motivul se șterge)');
select public.prospectare_seteaza_canal('email', true, null, 'test') is not null;
select set_config('test.r', pg_temp.d('email', array[9407, 9421], array['stefan@alfa.test'])::text, false);
select pg_temp.verifica(pg_temp.pe(current_setting('test.r')::jsonb, 'stefan@alfa.test') = '9407'
  and pg_temp.motiv(current_setting('test.r')::jsonb, 9421) = 'nicio căsuță aleasă pe domeniul linkului demo (demo.beta.test)', 'emailul: căsuța domeniului din linkul demo');
select pg_temp.asteapta_eroare($$select public.prospectare_seteaza_canal('fax', true, null, 'test')$$, 'PR422', 'canal necunoscut');

-- 6. Apelul de azi intră direct în lista omului ales ----------------------------------------------------------

select set_config('test.r', pg_temp.d('telefon', array[9431], array['vladut'], null, 'scor', '{}', false)::text, false);
select pg_temp.verifica(exists (select 1 from public.prospectare_liste_zi where firma_id = pg_temp.id(9431) and data = public.prospectare_azi() and utilizator = 'vladut')
  and (select telefon_la is not null from public.prospectare_firme where nr = 9431)
  and (select stare = 'folosita' from public.prospectare_programari where firma_id = pg_temp.id(9431) order by id desc limit 1), 'apel azi: în „Apeluri azi” la Vlăduț, firma pe telefon');

-- 7. Nimic automat: ciclul și completarea nu programează; restanțele rămân ------------------------------------

select set_config('test.n', (select count(*) from public.prospectare_programari where stare = 'programata')::text, false);
select public.prospectare_ciclu_zi(public.prospectare_azi(), true) ->> 'automat' = 'false';
select pg_temp.verifica((select count(*) from public.prospectare_programari where stare = 'programata')::text = current_setting('test.n'), 'ciclul de la 00:00 nu programează nicio firmă');
select pg_temp.verifica((public.prospectare_completeaza_azi('test') ->> 'whatsapp')::integer = 0
  and (select count(*) from public.prospectare_programari where stare = 'programata')::text = current_setting('test.n'), 'completarea zilei nu mai programează');
select pg_temp.verifica(not exists (select 1 from public.prospectare_programari where firma_id = pg_temp.id(9408)), 'firma eligibilă rămâne neprogramată până o distribuie omul');
insert into public.prospectare_programari (firma_id, canal, zi, sursa, cont_whatsapp, creat_de) values (pg_temp.id(9407), 'whatsapp', public.prospectare_azi() - 2, 'manual', 2, 'test');
insert into public.prospectare_programari (firma_id, canal, zi, sursa, cont_whatsapp, creat_de) values (pg_temp.id(9408), 'whatsapp', public.prospectare_azi() - 3, 'manual', 1, 'test');
select public.prospectare_ciclu_zi(public.prospectare_azi(), true) is not null;
select pg_temp.verifica((select count(*) = 2 from public.prospectare_programari where firma_id = any(pg_temp.ids(array[9407, 9408])) and stare = 'programata' and zi < public.prospectare_azi()),
  'netrimise de ieri NU se eliberează la 00:00: rămân pe contul lor (restanțe)');
select pg_temp.verifica((public.prospectare_ciclu_zi(public.prospectare_azi(), true) -> 'restante' ->> 'whatsapp')::integer >= 2, 'ciclul numără restanțele');
select pg_temp.verifica((public.prospectare_rezumat_distributie() -> 'restante' ->> 'cea_mai_veche')::date <= public.prospectare_azi() - 3, 'rezumatul: restanțele și cea mai veche zi');
select pg_temp.verifica(exists (select 1 from public.prospectare_whatsapp_coada(1000, 0) f where f.nr = 9407), 'lista de WhatsApp are și restanțele');
select pg_temp.verifica((public.prospectare_whatsapp_trimis(pg_temp.id(9407), null, 'Vlăduț') ->> 'cont')::integer = 2, 'restanța se trimite de pe contul ei');
select pg_temp.verifica(exists (select 1 from public.prospectare_activitate where firma_id = pg_temp.id(9407) and tip = 'whatsapp' and autor = 'Vlăduț'
  and detalii ->> 'trimis_de' = 'Vlăduț' and (detalii ->> 'restanta_din')::date = public.prospectare_azi() - 2), 'trimiterea notează cine a apăsat și ziua restanței');
select pg_temp.verifica((public.prospectare_whatsapp_anuleaza(pg_temp.id(9407), 'test') ->> 'reprogramata')::boolean, '„Anulează” după trimiterea unei restanțe');
select pg_temp.verifica((select zi = public.prospectare_azi() - 2 from public.prospectare_programari where firma_id = pg_temp.id(9407) and stare = 'programata'),
  '„Anulează”: restanța se întoarce în coadă, cu ziua ei');
select pg_temp.verifica((public.prospectare_scoate_din_coada(array(select id from public.prospectare_programari where firma_id = pg_temp.id(9408) and stare = 'programata'), 'Ștefan') ->> 'scoase')::integer = 1,
  '„Scoate din coadă”');
select pg_temp.verifica(not exists (select 1 from public.prospectare_programari where firma_id = pg_temp.id(9408) and stare = 'programata')
  and (select motiv = 'scoasă din coadă de Ștefan' from public.prospectare_programari where firma_id = pg_temp.id(9408) order by id desc limit 1)
  and exists (select 1 from public.prospectare_activitate where firma_id = pg_temp.id(9408) and tip = 'programare' and (detalii ->> 'scoasa_din_coada')::boolean),
  'scoasă din coadă: firma e liberă, cu motiv și activitate');
select pg_temp.asteapta_eroare($$select public.prospectare_scoate_din_coada(array[]::bigint[], 'test')$$, 'PR422', 'scoate din coadă: cel puțin o programare');

-- 8. /coada-email: azi și restanțele; goală cât emailul e suspendat ------------------------------------------

insert into public.prospectare_programari (firma_id, canal, zi, sursa, casuta, creat_de) values (pg_temp.id(9422), 'email', public.prospectare_azi() - 1, 'manual', 'stefan@alfa.test', 'test');
select pg_temp.verifica(exists (select 1 from jsonb_array_elements(public.prospectare_coada_email(null, null, '1') -> 'firme') e where (e ->> 'nr')::integer = 9422 and (e ->> 'restanta')::boolean),
  '/coada-email are restanța de ieri (cu emailul activ)');
select public.prospectare_seteaza_canal('email', false, 'livrabilitate, reparăm', 'test') is not null;
select pg_temp.verifica(jsonb_array_length(public.prospectare_coada_email(null, null, '1') -> 'firme') = 0 and (public.prospectare_coada_email(null, null, '1') ->> 'suspendat')::boolean
  and public.prospectare_coada_email(null, null, '1') ->> 'motiv' = 'livrabilitate, reparăm', '/coada-email: listă goală cât emailul e suspendat, cu motivul');
select pg_temp.asteapta_eroare($$select public.prospectare_email_cere_canal(pg_temp.r(), 'dm-e2.ro', null, 'stefan@alfa.test')$$, 'PR409', 'email suspendat: robotul nu primește canalul', '%Emailul e suspendat%');
select pg_temp.verifica(exists (select 1 from public.prospectare_programari where firma_id = pg_temp.id(9422) and stare = 'programata'), 'email suspendat: programarea așteaptă');

-- 9. Listele de construcție: alocarea pe terminale ------------------------------------------------------------

-- C7 e rezervată acum de o sesiune: începută, nu se mută.
insert into public.prospectare_rezervari (firma_id, dispozitiv_id, sesiune, tip_lucru, luat_la, expira_la)
  values (pg_temp.id(9447), pg_temp.r(), '1', 'construire', now(), now() + interval '3 hours');
select set_config('test.r', public.prospectare_aloca_constructie(pg_temp.ids(array[9441, 9442, 9443, 9444, 9445, 9446]), array['stefan-1', 'stefan-2'], null, true, 'test')::text, false);
select pg_temp.verifica(pg_temp.la(current_setting('test.r')::jsonb, 'stefan-1') = '9441,9443,9445' and pg_temp.la(current_setting('test.r')::jsonb, 'stefan-2') = '9442,9444,9446',
  'alocare egală: alternativ după scor (1 la primul terminal, 2 la al doilea, 3 la primul…)');
select set_config('test.r', public.prospectare_aloca_constructie(pg_temp.ids(array[9441, 9442, 9443, 9444, 9445, 9446]), array['stefan-1', 'stefan-2'], array[4, 2], true, 'test')::text, false);
select pg_temp.verifica(pg_temp.la(current_setting('test.r')::jsonb, 'stefan-1') = '9441,9443,9445,9446' and pg_temp.la(current_setting('test.r')::jsonb, 'stefan-2') = '9442,9444',
  'alocare manuală 4 / 2: tot alternativ, cât are fiecare loc');
select pg_temp.asteapta_eroare($$select public.prospectare_aloca_constructie(pg_temp.ids(array[9441, 9442]), array['stefan-1', 'stefan-2'], array[1, 2], true, 'test')$$, 'PR422',
  'alocare: suma pe terminale = firmele alese', '%Suma pe terminale%');
select pg_temp.asteapta_eroare($$select public.prospectare_aloca_constructie(pg_temp.ids(array[9441]), array['stefan 1'], null, true, 'test')$$, 'PR422', 'alocare: numele terminalului fără spații', '%stefan 1%');
select set_config('test.r', public.prospectare_aloca_constructie(pg_temp.ids(array[9441, 9401, 9411, 9447]), array['stefan-1'], null, true, 'test')::text, false);
select pg_temp.verifica(pg_temp.motiv(current_setting('test.r')::jsonb, 9401) like 'are deja site publicat (site %)' and pg_temp.motiv(current_setting('test.r')::jsonb, 9411) = '„Nu contacta”'
  and pg_temp.motiv(current_setting('test.r')::jsonb, 9447) = 'începută: în lucru la PC Sesiuni (sesiunea 1)' and pg_temp.la(current_setting('test.r')::jsonb, 'stefan-1') = '9441',
  'alocare: sărite cu motiv (are site, „Nu contacta”, începută)');
select pg_temp.verifica((public.prospectare_aloca_constructie(pg_temp.ids(array[9441, 9442, 9443, 9444, 9445, 9446]), array['stefan-1', 'stefan-2'], null, false, 'Ștefan') ->> 'alocate')::integer = 6,
  'alocarea scrie');
select pg_temp.verifica((select alocat_lui = 'stefan-1' and alocat_de = 'Ștefan' and alocat_la is not null from public.prospectare_firme where nr = 9441)
  and exists (select 1 from public.prospectare_activitate where firma_id = pg_temp.id(9442) and tip = 'alocare' and detalii ->> 'terminal' = 'stefan-2'), 'alocat_lui, cine și când, în activitate');

-- 10. /lista-mea: două sesiuni pe același token primesc liste diferite ------------------------------------------

select pg_temp.verifica(pg_temp.lista('stefan-1') = '9441,9443,9445' and pg_temp.lista('stefan-2') = '9442,9444,9446', '/lista-mea: fiecare sesiune își primește lista ei');
select pg_temp.verifica((select count(*) = 0 from jsonb_array_elements(public.prospectare_lista_mea(pg_temp.r(), 'stefan-1') -> 'firme') a
    join jsonb_array_elements(public.prospectare_lista_mea(pg_temp.r(), 'stefan-2') -> 'firme') b on a ->> 'id' = b ->> 'id'), '/lista-mea: nicio firmă în ambele liste');
select pg_temp.verifica((select (e -> 'date_extra') is not null and e ->> 'email' = 'o@dm-c1.ro' and e ? 'rezervare' from jsonb_array_elements(public.prospectare_lista_mea(pg_temp.r(), 'stefan-1') -> 'firme') e
  where (e ->> 'nr')::integer = 9441), '/lista-mea: toate datele firmei');
select pg_temp.verifica((public.prospectare_aloca_constructie(pg_temp.ids(array[9443]), array['stefan-2'], null, false, 'test') ->> 'alocate')::integer = 1
  and pg_temp.lista('stefan-1') = '9441,9445' and pg_temp.lista('stefan-2') = '9442,9443,9444,9446', 'o firmă neîncepută se mută la alt terminal');
select pg_temp.verifica((public.prospectare_rezerva_urmatoarea(pg_temp.r(), null, 'stefan-2') ->> 'nr')::integer = 9442, '/rezerva: terminalul își ia întâi firmele lui (cea mai bună)');
select pg_temp.verifica(coalesce((public.prospectare_rezerva_urmatoarea(pg_temp.r(), null, 'liber-1') ->> 'alocat_lui'), '') = '', '/rezerva: o sesiune fără listă nu ia firmele alocate altora');
select pg_temp.verifica((public.prospectare_termina_lot(pg_temp.r(), '[{"domeniu":"dm-c1.ro","link_demo":"https://demo.alfa.test/c1/"}]', 'stefan-1') ->> 'terminate')::integer = 1
  and pg_temp.lista('stefan-1') = '9445', 'push (/termina): firma construită iese din listă');
select pg_temp.asteapta_eroare($$select public.prospectare_lista_mea(pg_temp.r(), 'a b')$$, 'PR422', '/lista-mea: sesiune invalidă');

-- 11. Lacătul de publicare -----------------------------------------------------------------------------------

select pg_temp.verifica((pg_temp.lacat(pg_temp.r(), 'ia', '2') ->> 'ok')::boolean and (pg_temp.lacat(pg_temp.r(), 'stare') -> 'lacat' ->> 'al_meu')::boolean, 'lacătul: primul calculator îl ia');
select pg_temp.verifica(not (pg_temp.lacat(pg_temp.alt(), 'ia') ->> 'ok')::boolean
  and pg_temp.lacat(pg_temp.alt(), 'ia') ->> 'mesaj' like 'Lacătul de publicare e la PC Sesiuni (sesiunea 2) din %; expiră la %',
  'lacătul: al doilea calculator e refuzat; răspunsul spune cine îl ține și de când');
select pg_temp.verifica(pg_temp.lacat(pg_temp.alt(), 'stare') -> 'lacat' ->> 'robot' = 'PC Sesiuni' and (pg_temp.lacat(pg_temp.alt(), 'stare') -> 'lacat' ->> 'din') is not null,
  'lacătul: „stare” spune cine și de când');
select pg_temp.verifica(not (pg_temp.lacat(pg_temp.alt(), 'bate') ->> 'ok')::boolean and not (pg_temp.lacat(pg_temp.alt(), 'elibereaza') ->> 'ok')::boolean,
  'lacătul: celălalt calculator nu-l poate bate sau elibera');
select pg_temp.verifica((pg_temp.lacat(pg_temp.r(), 'ia', '3') ->> 'ok')::boolean and (pg_temp.lacat(pg_temp.r(), 'bate', '1') ->> 'ok')::boolean,
  'lacătul e al calculatorului: orice sesiune a lui îl ia din nou sau îl bate');
update public.prospectare_lacate set batut_la = now() - interval '31 minutes' where cheie = 'publicare';
select pg_temp.verifica((pg_temp.lacat(pg_temp.alt(), 'stare') -> 'lacat' ->> 'liber')::boolean and (pg_temp.lacat(pg_temp.alt(), 'ia') ->> 'ok')::boolean,
  'lacătul expiră singur după 30 de minute fără „bate”');
select pg_temp.verifica(not (pg_temp.lacat(pg_temp.r(), 'bate') ->> 'ok')::boolean and pg_temp.lacat(pg_temp.r(), 'bate') ->> 'mesaj' like '%e la robot-1%',
  'lacătul pierdut: „bate” e refuzat');
select pg_temp.verifica((pg_temp.lacat(pg_temp.alt(), 'elibereaza') ->> 'ok')::boolean and (pg_temp.lacat(pg_temp.r(), 'stare') -> 'lacat' ->> 'liber')::boolean
  and pg_temp.lacat(pg_temp.alt(), 'elibereaza') ->> 'mesaj' = 'Lacătul era deja liber.', '„elibereaza”, de două ori');
select pg_temp.asteapta_eroare($$select pg_temp.lacat(pg_temp.r(), 'fura')$$, 'PR422', 'lacătul: acțiune necunoscută');

-- 12. /termina copiază mobilul, „doar WhatsApp”, problema și punctele ------------------------------------------

select public.prospectare_termina_lot(pg_temp.r(), $j$[{"domeniu":"dm-m1.ro","link_demo":"https://demo.alfa.test/m1/","telefon_mobil":"0744 555 666","doar_whatsapp":true,
  "problema":"numărul de telefon nu se poate apăsa de pe mobil","puncte":["* clienții vă sună dintr-o atingere","cererea de ofertă e pe prima pagină","lucrările se văd din prima"]}]$j$, 'stefan-1') is not null;
select pg_temp.verifica((select telefon = '0744 555 666' and este_mobil and (date_extra ->> 'doar_whatsapp')::boolean and date_extra ->> 'telefon_fix' = '021 311 1111'
  and date_extra ->> 'problema' = 'numărul de telefon nu se poate apăsa de pe mobil'
  and date_extra -> 'puncte' = '["clienții vă sună dintr-o atingere", "cererea de ofertă e pe prima pagină", "lucrările se văd din prima"]'::jsonb
  from public.prospectare_firme where nr = 9451), '/termina: mobilul înlocuiește fixul; „doar WhatsApp”, problema și cele 3 schimbări în firmă');
select public.prospectare_termina_lot(pg_temp.r(), '[{"domeniu":"dm-m2.ro","link_demo":"https://demo.alfa.test/m2/","telefon_mobil":"0744 999 888"}]', 'stefan-1') is not null;
select pg_temp.verifica((select telefon = '0733 111 222' from public.prospectare_firme where nr = 9452), '/termina: un mobil existent nu se înlocuiește');
select public.prospectare_termina_lot(pg_temp.r(), $j$[{"domeniu":"dm-m3.ro","link_demo":"https://demo.alfa.test/m3/","detalii":{"doar_whatsapp":true,"telefon_mobil":"+40 755 000 111","puncte":"- unu\n- doi"}}]$j$, 'stefan-1') is not null;
select pg_temp.verifica((select telefon = '+40 755 000 111' and este_mobil and (date_extra ->> 'doar_whatsapp')::boolean and date_extra -> 'puncte' = '["unu", "doi"]'::jsonb
  from public.prospectare_firme where nr = 9453), '/termina: aceleași câmpuri și din „detalii” (robotul de acum), punctele ca text pe rânduri');

-- 13. Importul: telefonul nu se strică, numărul unei firme noi nu se suprapune ---------------------------------

select set_config('test.r', public.prospectare_upsert_firme($j$[
  {"domeniu":"dm-m2.ro","telefon":"021 000 0000"},
  {"domeniu":"dm-u1.ro","telefon":"021 222 3333","date_extra":{"telefon_mobil":"0755 123 456"}},
  {"domeniu":"dm-nou.ro","nr":9401,"nume":"Firmă nouă","telefon":"0766 000 111"}]$j$, 'import', 'test', false)::text, false);
select pg_temp.verifica((select telefon = '0733 111 222' from public.prospectare_firme where nr = 9452), 'importul nu înlocuiește un mobil cu un fix');
select pg_temp.verifica((select telefon = '0755 123 456' from public.prospectare_firme where nr = 9461), 'importul înlocuiește un fix cu mobilul din date_extra.telefon_mobil');
select pg_temp.verifica((select nr <> 9401 and (date_extra ->> 'nr_robot')::integer = 9401 from public.prospectare_firme where domeniu = 'dm-nou.ro')
  and (select domeniu = 'dm-1.ro' from public.prospectare_firme where nr = 9401)
  and jsonb_array_length(current_setting('test.r')::jsonb -> 'nr_ocupat') = 1 and jsonb_array_length(current_setting('test.r')::jsonb -> 'conflicte') = 0,
  'importul: firma nouă cu numărul altei firme primește un număr nou (nu se suprapune, nu se sare)');

-- 14. Titularii conturilor, „A răspuns” -----------------------------------------------------------------------

select pg_temp.verifica((select titular from public.prospectare_conturi_whatsapp where id = 1) = 'Ștefan' and (select titular from public.prospectare_conturi_whatsapp where id = 3) = 'Vlad',
  'titularii: Cont 1 = Ștefan, Cont 3 = Vlad');
select pg_temp.verifica(public.prospectare_salveaza_cont_whatsapp(4::smallint, 'Cont 4', '0711 000 004', 10, true, 'test', 'Ana') ->> 'titular' = 'Ana', 'titularul se editează');
select pg_temp.verifica(public.prospectare_salveaza_cont_whatsapp(p_id => 4::smallint, p_nume => 'Cont 4', p_telefon => '0711 000 004', p_limita => 10, p_activ => false, p_autor => 'test') ->> 'titular' = 'Ana',
  'salvarea fără titular (adminul vechi) îl păstrează');
select pg_temp.verifica((select position('{nume_titular}' in sablon_whatsapp_primul) > 0 and position('{puncte}' in sablon_whatsapp_primul) > 0 from public.prospectare_setari where id = 1),
  'șablonul implicit are {nume_titular}, {problema}, {puncte}');
select public.prospectare_marcheaza_raspuns(pg_temp.id(9422), 'whatsapp', 'a sunat înapoi', 'Ștefan') is not null;
select pg_temp.verifica((select public.prospectare_a_raspuns(f) from public.prospectare_firme f where nr = 9422)
  and exists (select 1 from public.prospectare_activitate where firma_id = pg_temp.id(9422) and tip = 'raspuns' and autor = 'Ștefan' and detalii ->> 'nota' = 'a sunat înapoi'),
  '„A răspuns” din fișă: în activitate, cu nota; al doilea canal nu mai pleacă singur');

-- 15. Numerele firmelor și ale site-urilor nu s-au schimbat ----------------------------------------------------

select pg_temp.verifica(not exists (select 1 from pg_temp.numere_inainte s join public.prospectare_firme f on f.id = s.id
  where f.nr <> s.nr or (s.nr_site is not null and f.nr_site is distinct from s.nr_site)), 'nr și nr_site neschimbate (doar firmele noi au primit numere)');
