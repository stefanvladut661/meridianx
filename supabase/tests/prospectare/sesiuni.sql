-- Testele migrării 38 (mai multe sesiuni pe același robot, un singur token), pe Postgres local (nu pe producție).
-- Rulează după tabel.sql și concurenta-nr-site.sh, peste baza lor, cu 38 aplicată (de două ori).
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

create or replace function pg_temp.r() returns uuid language sql as $$ select id from public.prospectare_dispozitive where nume = 'PC Sesiuni' $$;
create or replace function pg_temp.alt() returns uuid language sql as $$ select id from public.prospectare_dispozitive where nume = 'robot-1' $$;
create or replace function pg_temp.id(p_nr integer) returns uuid language sql as $$ select id from public.prospectare_firme where nr = p_nr $$;
create or replace function pg_temp.rez(p_s text) returns integer language sql as $$
  select (public.prospectare_rezerva_urmatoarea(pg_temp.r(), null, p_s) ->> 'nr')::integer $$;
create or replace function pg_temp.a_sesiunii(p_s text) returns integer language sql as $$
  select f.nr from public.prospectare_rezervari r join public.prospectare_firme f on f.id = r.firma_id
  where r.dispozitiv_id = pg_temp.r() and r.sesiune = p_s and r.expira_la > now() $$;

select set_config('prospectare.autor', 'test', false);
insert into public.prospectare_dispozitive (nume, proprietar, token_hash) values ('PC Sesiuni', 'test', encode(sha256('pc-sesiuni'::bytea), 'hex'))
  on conflict do nothing;
-- Firme de construit cu scorul cel mai mare: sesiunile le iau primele.
insert into public.prospectare_firme (nr, nume, domeniu, email, etapa, scor, evaluare) values
  (9811, 'Sesiuni 1', 'ses-1.ro', 'o@ses-1.ro', 'site_in_lucru', 1000, 'eligibila'),
  (9812, 'Sesiuni 2', 'ses-2.ro', 'o@ses-2.ro', 'site_in_lucru', 1000, 'eligibila'),
  (9813, 'Sesiuni 3', 'ses-3.ro', 'o@ses-3.ro', 'site_in_lucru', 1000, 'eligibila'),
  (9814, 'Sesiuni 4', 'ses-4.ro', 'o@ses-4.ro', 'site_in_lucru', 1000, 'eligibila');
-- Rezervările expirate din testele de dinainte ar trece primele: ies.
delete from public.prospectare_rezervari where expira_la <= now();

-- 1. Autentificarea: sesiunea din cerere (implicit „1”) -------------------------------------------------
select pg_temp.verifica(public.prospectare_autentifica(encode(sha256('pc-sesiuni'::bytea), 'hex'), '2') ->> 'sesiune' = '2', 'autentificarea cu sesiunea „2”');
select pg_temp.verifica(exists (select 1 from public.prospectare_sesiuni where dispozitiv_id = pg_temp.r() and sesiune = '2'), 'sesiunea „2” se notează (ultima activitate)');
select pg_temp.verifica(public.prospectare_autentifica(encode(sha256('pc-sesiuni'::bytea), 'hex')) ->> 'sesiune' = '1', 'fără sesiune: sesiunea „1” (robotul vechi)');
select pg_temp.verifica(public.prospectare_autentifica(encode(sha256('pc-sesiuni'::bytea), 'hex'), '  ') ->> 'sesiune' = '1', 'sesiune goală: „1”');
select pg_temp.asteapta_eroare($$select public.prospectare_autentifica(encode(sha256('pc-sesiuni'::bytea), 'hex'), 'a b')$$, 'PR422', 'sesiune cu spațiu: refuzată', '%Sesiunea%');
select pg_temp.verifica(public.prospectare_autentifica(encode(sha256('necunoscut'::bytea), 'hex'), 'a b') is null, 'token necunoscut: null (401), înainte de sesiune');
select pg_temp.verifica((select count(*) = 1 from public.prospectare_dispozitive where nume = 'PC Sesiuni'), 'un singur robot (un token) pentru toate sesiunile');

-- 2. /rezerva: fiecare sesiune are firma ei, și o reia -----------------------------------------------
select set_config('test.s1', pg_temp.rez('1')::text, false);
select set_config('test.s2', pg_temp.rez('2')::text, false);
select pg_temp.verifica(current_setting('test.s1')::integer between 9811 and 9814 and current_setting('test.s2')::integer between 9811 and 9814
    and current_setting('test.s1') <> current_setting('test.s2'), 'sesiunile 1 și 2: firme diferite');
select pg_temp.verifica(pg_temp.rez('1') = current_setting('test.s1')::integer and pg_temp.rez('2') = current_setting('test.s2')::integer,
  'fiecare sesiune își reia firma ei, nu pe a celeilalte');
select pg_temp.verifica((public.prospectare_rezerva_urmatoarea(pg_temp.r(), null, '2') -> 'rezervare' ->> 'sesiune') = '2'
    and (public.prospectare_rezerva_urmatoarea(pg_temp.r(), null, '2') -> 'rezervare' ->> 'reluata')::boolean, 'răspunsul /rezerva: sesiunea și reluata');
select pg_temp.verifica((public.prospectare_rezerva_urmatoarea(pg_temp.r(), null) ->> 'nr')::integer = current_setting('test.s1')::integer,
  'apelul vechi (fără sesiune) = sesiunea „1”: își reia firma');
select pg_temp.verifica(pg_temp.a_sesiunii('1') = current_setting('test.s1')::integer and pg_temp.a_sesiunii('2') = current_setting('test.s2')::integer,
  'rezervările se țin pe robot + sesiune');

-- 3. /heartbeat: doar sesiunea care are firma ----------------------------------------------------------
select pg_temp.asteapta_eroare(format($$select public.prospectare_heartbeat(pg_temp.r(), pg_temp.id(%s), '2')$$, current_setting('test.s1')), 'PR409',
  'altă sesiune a aceluiași robot nu prelungește rezervarea', '%acestei sesiuni (2)%');
select pg_temp.verifica(public.prospectare_heartbeat(pg_temp.r(), pg_temp.id(current_setting('test.s1')::integer), '1') > now(), 'sesiunea ei o prelungește');
select pg_temp.verifica(public.prospectare_heartbeat(pg_temp.r(), pg_temp.id(current_setting('test.s1')::integer)) > now(), 'și apelul vechi (sesiunea „1”)');

-- 4. Rezervarea expirată a unei sesiuni o poate lua alta (cu preluata_de_la_sesiune) -------------------
update public.prospectare_rezervari set expira_la = now() - interval '1 minute' where firma_id = pg_temp.id(current_setting('test.s1')::integer);
select pg_temp.verifica(pg_temp.rez('3') = current_setting('test.s1')::integer, 'sesiunea 3 preia firma expirată a sesiunii 1');
select pg_temp.verifica((select detalii ->> 'preluata_de_la_sesiune' = '1' and detalii ->> 'sesiune' = '3' from public.prospectare_activitate
    where firma_id = pg_temp.id(current_setting('test.s1')::integer) and tip = 'rezervare' order by id desc limit 1), 'activitatea: preluată de la sesiunea 1, de sesiunea 3');
select pg_temp.verifica(pg_temp.rez('1') not in (current_setting('test.s1')::integer, current_setting('test.s2')::integer), 'sesiunea 1 primește altă firmă (a ei a luat-o 3)');

-- 5. Nișele: fiecare sesiune are nișa ei ------------------------------------------------------------------
select pg_temp.verifica((public.prospectare_nisa_rezerva(pg_temp.r(), 'sesiuni', 'Zona A', '1') ->> 'sesiune') = '1', 'sesiunea 1 rezervă nișa');
select pg_temp.asteapta_eroare($$select public.prospectare_nisa_rezerva(pg_temp.r(), 'sesiuni', 'Zona A', '2')$$, 'PR409',
  'sesiunea 2 a aceluiași robot nu primește aceeași nișă', '%PC Sesiuni (sesiunea 1)%');
select pg_temp.asteapta_eroare($$select public.prospectare_nisa_rezerva(pg_temp.alt(), 'sesiuni', 'Zona A')$$, 'PR409', 'nici alt robot');
select pg_temp.verifica((public.prospectare_nisa_rezerva(pg_temp.r(), 'sesiuni', 'Zona A', '1') ->> 'reluata')::boolean, 'aceeași sesiune își reia nișa');
select pg_temp.verifica(not (public.prospectare_nisa_rezerva(pg_temp.r(), 'sesiuni', 'Zona B', '2') ->> 'reluata')::boolean, 'sesiunea 2 își ia altă nișă (nouă, nereluată)');
select pg_temp.asteapta_eroare($$select public.prospectare_nisa_progres(pg_temp.r(), (select id from public.prospectare_nise where nisa = 'sesiuni' and zona = 'Zona A'), 5, 2, 3, false, null, '2')$$,
  'PR409', 'progresul nișei altei sesiuni: refuzat', '%această sesiune (2)%');
select pg_temp.verifica((public.prospectare_nisa_progres(pg_temp.r(), (select id from public.prospectare_nise where nisa = 'sesiuni' and zona = 'Zona A'), 5, 2, 3, false, null, '1') ->> 'status') = 'in_cercetare',
  'progresul sesiunii ei: în cercetare');
select pg_temp.asteapta_eroare($$select public.prospectare_evaluare_noteaza(pg_temp.r(), (select id from public.prospectare_nise where nisa = 'sesiuni' and zona = 'Zona A'),
  '[{"domeniu": "ses-ev-1.ro", "scor": 70, "evaluare": "eligibila"}]', '2')$$, 'PR409', '/evaluare cu nișa altei sesiuni: refuzat');
select pg_temp.verifica((public.prospectare_evaluare_noteaza(pg_temp.r(), (select id from public.prospectare_nise where nisa = 'sesiuni' and zona = 'Zona A'),
  '[{"domeniu": "ses-ev-1.ro", "scor": 70, "evaluare": "eligibila"}]', '1') ->> 'adaugate')::integer = 1, '/evaluare cu nișa sesiunii ei: notată');
select public.prospectare_nisa_admin('elibereaza', (select id from public.prospectare_nise where nisa = 'sesiuni' and zona = 'Zona B'), null, null, 'test');
select pg_temp.verifica((select n.sesiune is null and n.dispozitiv_id is null and n.status = 'libera' from public.prospectare_nise n where nisa = 'sesiuni' and zona = 'Zona B'),
  'eliberată din admin: fără robot și fără sesiune');

-- 6. Ce face fiecare sesiune și site-urile ei ---------------------------------------------------------------
select pg_temp.verifica((select ce_face = 'cercetare' and ce_face_detaliu like 'sesiuni · Zona A%' from public.prospectare_sesiuni where dispozitiv_id = pg_temp.r() and sesiune = '1'),
  'sesiunea 1: cercetare pe nișa ei');
select pg_temp.verifica((select ce_face = 'constructie' from public.prospectare_sesiuni where dispozitiv_id = pg_temp.r() and sesiune = '3'), 'sesiunea 3: construcție');
select pg_temp.verifica((select ce_face is not null from public.prospectare_dispozitive where id = pg_temp.r()), 'robotul: ultima sarcină (pentru paginile de dinainte)');
select pg_temp.verifica((public.prospectare_termina_lot(pg_temp.r(), $$[{"nr": 9811, "link_demo": "https://demo.delta.test/ses-1/"}, {"nr": 9812, "link_demo": "https://demo.delta.test/ses-2/"}]$$, '3')
    ->> 'terminate')::integer = 2, '/termina din sesiunea 3: 2 site-uri');
select pg_temp.verifica((select azi = 2 and total = 2 from public.prospectare_statistici_sesiuni() where dispozitiv_id = pg_temp.r() and sesiune = '3'), 'site-urile de azi ale sesiunii 3');
select pg_temp.verifica((select azi >= 2 from public.prospectare_statistici_roboti() where dispozitiv_id = pg_temp.r()), 'totalul de azi al robotului (toate sesiunile)');
select pg_temp.verifica((public.prospectare_termina(pg_temp.r(), pg_temp.id(9813), 'https://demo.delta.test/ses-3/') ->> 'nr_site') is not null, '/termina vechi (fără sesiune) merge');
select pg_temp.verifica((select detalii ->> 'sesiune' from public.prospectare_activitate where firma_id = pg_temp.id(9813) and tip = 'site' order by id desc limit 1) = '1',
  '/termina vechi: notat pe sesiunea „1”');
select pg_temp.asteapta_eroare($$select public.prospectare_robot_ce_face(pg_temp.r(), 'cercetare', 'x', 'nu e bun!')$$, 'PR422', 'ce face cu sesiune invalidă: refuzat');
