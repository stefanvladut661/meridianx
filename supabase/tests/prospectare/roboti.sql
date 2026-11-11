-- Testele migrării 40 (pagina Roboți: arhivarea, tokenul nou, calculatorul, proprietarii), pe Postgres local (nu pe producție).
-- Rulează după distribuire.sql și concurenta-distribuire.sh, peste baza lor, cu 40 aplicată (de două ori).
-- ruleaza.sh pune înainte de 40 roboții „vladut 2” (la Ștefan) și „sincron” (la Vlăduț), ca să se vadă corectura.
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
create or replace function pg_temp.a() returns uuid language sql as $$ select id from public.prospectare_dispozitive where nume = 'PC Arhivă' $$;
create or replace function pg_temp.h(p text) returns text language sql as $$ select encode(sha256(convert_to(p, 'UTF8')), 'hex') $$;
create or replace function pg_temp.auth(p_token text, p_sesiune text default '1') returns jsonb language sql as $$
  select public.prospectare_autentifica(pg_temp.h(p_token), p_sesiune) $$;

select set_config('prospectare.autor', 'test', false);

-- Robotul de arhivat: două terminale, două firme în lucru, o nișă, lacătul de publicare.
insert into public.prospectare_dispozitive (nume, proprietar, token_hash) values
  ('PC Arhivă', 'Ștefan', pg_temp.h('tok-arhiva')),
  ('PC Preluare', 'Vlăduț', pg_temp.h('tok-preluare'))
on conflict do nothing;
insert into public.prospectare_firme (nr, nume, domeniu, email, etapa, scor, evaluare)
select 9650 + g, 'Arhivă ' || g, 'ar-' || g || '.ro', 'o@ar-' || g || '.ro', 'site_in_lucru', 500, 'eligibila' from generate_series(1, 3) g
on conflict do nothing;
update public.prospectare_firme set alocat_lui = 'preluare' where nr = 9651;
insert into public.prospectare_rezervari (firma_id, dispozitiv_id, sesiune, tip_lucru, expira_la) values
  (pg_temp.id(9651), pg_temp.a(), 't1', 'construire', now() + interval '3 hours'),
  (pg_temp.id(9652), pg_temp.a(), 't2', 'construire', now() + interval '3 hours'),
  (pg_temp.id(9653), (select id from public.prospectare_dispozitive where nume = 'robot-1'), '1', 'construire', now() + interval '3 hours')
on conflict (firma_id) do update set dispozitiv_id = excluded.dispozitiv_id, sesiune = excluded.sesiune, expira_la = excluded.expira_la;
insert into public.prospectare_nise (nisa, zona, status, dispozitiv_id, sesiune, rezervata_la, semn_la)
values ('test arhivă', 'Zona în lucru', 'in_cercetare', pg_temp.a(), 't1', now(), now())
on conflict do nothing;
insert into public.prospectare_nise (nisa, zona, status, dispozitiv_id, sesiune, rezervata_la, terminata_la)
values ('test arhivă', 'Zona terminată', 'terminata', pg_temp.a(), 't2', now() - interval '1 day', now())
on conflict do nothing;
update public.prospectare_lacate set dispozitiv_id = null, sesiune = null, luat_la = null, batut_la = null where cheie = 'publicare';
select pg_temp.verifica((public.prospectare_lacat_publicare(pg_temp.a(), 'ia', 't1') ->> 'ok')::boolean, 'pregătire: PC Arhivă ține lacătul de publicare');

-- 1. Înainte de arhivare
select pg_temp.verifica((pg_temp.auth('tok-arhiva', 't1') ->> 'activ')::boolean and (pg_temp.auth('tok-arhiva', 't2') ->> 'sesiune') = 't2',
  'înainte: tokenul merge, pe ambele terminale');
select pg_temp.verifica((select calculator is null and arhivat_la is null and token_schimbat_la is null from public.prospectare_dispozitive where id = pg_temp.a()),
  'robot nou: fără calculator, nearhivat');

-- 2. Arhivează
create temp table r40 as select public.prospectare_robot_arhiveaza(pg_temp.a(), true, 'Ștefan (test)') as r;
select pg_temp.verifica((select (r ->> 'arhivat')::boolean and not (r ->> 'deja')::boolean and (r ->> 'firme')::integer = 2
    and (r ->> 'nise')::integer = 1 and (r ->> 'lacat')::boolean from r40),
  'arhivat: 2 firme eliberate, 1 nișă eliberată, lacătul eliberat');
select pg_temp.verifica(pg_temp.auth('tok-arhiva', 't1') is null and pg_temp.auth('tok-arhiva', 't2') is null,
  'tokenul vechi nu mai merge (401 „token greșit” pe orice terminal)');
select pg_temp.verifica((select not activ and arhivat_la is not null and arhivat_de = 'Ștefan (test)' and token_schimbat_la is not null
    and token_hash <> pg_temp.h('tok-arhiva') and token_hash ~ '^[0-9a-f]{64}$' from public.prospectare_dispozitive where id = pg_temp.a()),
  'în bază: oprit, arhivat de cine a apăsat, hash nou (pe care nu-l știe nimeni)');
select pg_temp.verifica((select count(*) = 0 from public.prospectare_rezervari where dispozitiv_id = pg_temp.a() and expira_la > now()),
  'nicio firmă nu mai e rezervată de robotul arhivat');
select pg_temp.verifica((select expira_la > now() + interval '2 hours' from public.prospectare_rezervari where firma_id = pg_temp.id(9653)),
  'firma altui robot rămâne a lui');
select pg_temp.verifica((select count(*) = 2 from public.prospectare_activitate
    where firma_id in (pg_temp.id(9651), pg_temp.id(9652)) and tip = 'rezervare' and detalii ->> 'eliberata' = 'robot arhivat'
      and detalii ->> 'robot' = 'PC Arhivă' and detalii ->> 'autor' = 'Ștefan (test)'),
  'fișa fiecărei firme eliberate notează „robot arhivat”');
select pg_temp.verifica((select status = 'libera' and dispozitiv_id is null and sesiune is null and nota like '%robotul PC Arhivă a fost arhivat de Ștefan (test)%'
    from public.prospectare_nise where nisa = 'test arhivă' and zona = 'Zona în lucru'),
  'nișa în cercetare se eliberează, cu notă');
select pg_temp.verifica((select status = 'terminata' and dispozitiv_id = pg_temp.a() from public.prospectare_nise where nisa = 'test arhivă' and zona = 'Zona terminată'),
  'nișa terminată rămâne a lui (istoric)');
select pg_temp.verifica((select dispozitiv_id is null and batut_la is null from public.prospectare_lacate where cheie = 'publicare'),
  'lacătul de publicare e liber');
select pg_temp.verifica((public.prospectare_rezerva_urmatoarea((select id from public.prospectare_dispozitive where nume = 'PC Preluare'), null, 'preluare') ->> 'nr')::integer = 9651,
  'firma eliberată o ia imediat alt robot');
select pg_temp.verifica((select count(*) = 1 from public.prospectare_dispozitive where nume = 'PC Arhivă')
    and (select count(*) = 2 from public.prospectare_sesiuni where dispozitiv_id = pg_temp.a()),
  'robotul și sesiunile lui rămân în bază (istoric)');
select pg_temp.verifica(((public.prospectare_robot_arhiveaza(pg_temp.a(), true, 'test') ->> 'deja')::boolean),
  'a doua arhivare nu schimbă nimic');
select pg_temp.asteapta_eroare($$update public.prospectare_dispozitive set activ = true where nume = 'PC Arhivă'$$, '23514',
  'un robot arhivat nu poate fi activat direct în bază', '%prospectare_dispozitive_arhivat_oprit%');

-- 3. Scoate din arhivă: înapoi în listă, oprit până la un token nou
select pg_temp.verifica((select not (r ->> 'arhivat')::boolean and not (r ->> 'deja')::boolean
    from (select public.prospectare_robot_arhiveaza(pg_temp.a(), false, 'Vlăduț (test)') as r) x),
  'scos din arhivă');
select pg_temp.verifica((select arhivat_la is null and arhivat_de is null and not activ and schimbat_de = 'Vlăduț (test)' from public.prospectare_dispozitive where id = pg_temp.a()),
  'scos din arhivă: rămâne oprit');
select pg_temp.verifica(pg_temp.auth('tok-arhiva', 't1') is null, 'scos din arhivă: tokenul vechi tot nu merge');
select pg_temp.verifica(((public.prospectare_robot_arhiveaza(pg_temp.a(), false, 'test') ->> 'deja')::boolean), 'scos a doua oară: nu schimbă nimic');

-- 4. Token nou (cum îl scrie adminul: hash nou + activ, doar pe un robot nearhivat)
update public.prospectare_dispozitive set token_hash = pg_temp.h('tok-nou'), activ = true, token_schimbat_la = now()
  where id = pg_temp.a() and arhivat_la is null;
select pg_temp.verifica((pg_temp.auth('tok-nou', 'stefan-1') ->> 'activ')::boolean and pg_temp.auth('tok-arhiva', 'stefan-1') is null,
  'tokenul nou merge, cel vechi nu');
select pg_temp.verifica((select count(*) = 1 from public.prospectare_sesiuni where dispozitiv_id = pg_temp.a() and sesiune = 'stefan-1'),
  'terminalul stefan-1 apare sub calculator');

-- 5. Calculatorul (numele afișat mare)
update public.prospectare_dispozitive set calculator = 'PC Ștefan' where id = pg_temp.a();
select pg_temp.verifica((select calculator = 'PC Ștefan' and nume = 'PC Arhivă' from public.prospectare_dispozitive where id = pg_temp.a()),
  'calculatorul se schimbă, numele tehnic rămâne');
select pg_temp.asteapta_eroare($$update public.prospectare_dispozitive set calculator = '   ' where nume = 'PC Arhivă'$$, '23514',
  'calculatorul nu poate fi doar spații', '%prospectare_dispozitive_calculator%');
select pg_temp.verifica((select r ->> 'calculator' = 'PC Ștefan' and (r ->> 'arhivat')::boolean from (select public.prospectare_robot_arhiveaza(pg_temp.a(), true, 'test') as r) x),
  'arhivarea întoarce numele calculatorului');
select pg_temp.verifica((select autor = 'Ștefan (test)' from public.prospectare_activitate where firma_id = pg_temp.id(9652) and tip = 'rezervare'
    and detalii ->> 'eliberata' = 'robot arhivat'), 'autorul din fișă e cine a arhivat');

-- 6. Erori și drepturi
select pg_temp.asteapta_eroare($$select public.prospectare_robot_arhiveaza(gen_random_uuid(), true, 'test')$$, 'PR404', 'robot inexistent', 'Robotul nu mai există.');
select pg_temp.asteapta_eroare($$select public.prospectare_robot_arhiveaza((select id from public.prospectare_dispozitive where nume = 'PC Preluare'), null, 'test')$$,
  'PR422', 'fără „arhivează / scoate”');
select pg_temp.verifica(not has_function_privilege('authenticated', 'public.prospectare_robot_arhiveaza(uuid, boolean, text)', 'execute')
    and has_function_privilege('service_role', 'public.prospectare_robot_arhiveaza(uuid, boolean, text)', 'execute'),
  'arhivarea doar pentru cheia de service');
select pg_temp.verifica((select count(*) >= 1 from public.prospectare_statistici_roboti()) is not null, 'statisticile roboților merg și cu roboți arhivați');

-- 7. Proprietarii corectați de migrare
select pg_temp.verifica((select proprietar = 'Vlăduț' and schimbat_de like 'migrarea 40%' from public.prospectare_dispozitive where nume = 'vladut 2'),
  '„vladut 2” e al lui Vlăduț');
select pg_temp.verifica((select proprietar = 'Ștefan' from public.prospectare_dispozitive where nume = 'sincron'), '„sincron” e al lui Ștefan');
