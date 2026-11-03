-- Testele migrării 36 (email ȘI WhatsApp pe aceeași firmă; completarea zilei), pe Postgres local (nu pe producție).
-- Rulează după distributie.sql și concurenta-distributie.sh, peste baza lor, cu 36 aplicată: firmele vechi ies din distribuție.
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
-- Programarea activă a unei firme: „canal:zi:cheie”, sau null.
create or replace function pg_temp.prog(p_nr integer) returns text language sql as $$
  select p.canal || ':' || (p.zi - public.prospectare_azi()) || ':' || coalesce(p.casuta, p.cont_whatsapp::text, p.utilizator)
  from public.prospectare_programari p where p.firma_id = pg_temp.id(p_nr) and p.stare = 'programata'
$$;
create or replace function pg_temp.robot() returns uuid language sql as $$ select id from public.prospectare_dispozitive where nume = 'robot-email' $$;

-- Mediul: firmele de până acum ies din distribuție; o căsuță și două conturi cunoscute ---------
select set_config('prospectare.autor', 'test', false);
update public.prospectare_firme set demo_verificat = false;
-- Programările testelor de dinainte (și cele folosite azi, care ocupă locuri) dispar: limitele de mai jos sunt cele reale.
delete from public.prospectare_programari;
update public.prospectare_casute set activa = false;
insert into public.prospectare_casute (adresa, domeniu, limita_zi, activa) values ('stefan@delta.test', 'delta.test', 2, true)
  on conflict (adresa) do update set limita_zi = excluded.limita_zi, activa = excluded.activa;
update public.prospectare_conturi_whatsapp set activ = (id in (1, 2)), limita_zi = 1;
update public.prospectare_setari set email_plafon_casuta = 1 where id = 1;
delete from public.prospectare_cicluri;

-- Firmele (link pe delta.test → căsuța stefan@delta.test). Ieri = înainte de 00:00 de azi.
insert into public.prospectare_firme (nr, nume, domeniu, telefon, email, etapa, link_demo, demo_verificat, site_gata_la, email_la, whatsapp_la, whatsapp_cont, telefon_la, date_extra) values
  (9601, 'Email ieri', 'd9001.ro', '0745 900 001', 'o@d9001.ro', 'email_trimis', 'https://demo.delta.test/d1/', true, now() - interval '20 days', public.prospectare_inceput_azi() - interval '3 hours', null, null, null, '{}'),
  (9602, 'Email azi', 'd9002.ro', '0745 900 002', 'o@d9002.ro', 'email_trimis', 'https://demo.delta.test/d2/', true, now() - interval '25 days', now(), null, null, null, '{}'),
  (9603, 'WhatsApp ieri', 'd9003.ro', '0745 900 003', 'o@d9003.ro', 'whatsapp_trimis', 'https://demo.delta.test/d3/', true, now() - interval '19 days', null, public.prospectare_inceput_azi() - interval '2 hours', 1, null, '{}'),
  (9604, 'A răspuns', 'd9004.ro', '0745 900 004', 'o@d9004.ro', 'email_trimis', 'https://demo.delta.test/d4/', true, now() - interval '24 days', public.prospectare_inceput_azi() - interval '5 days', null, null, null, '{}'),
  (9605, 'Răspuns automat', 'd9005.ro', '0745 900 005', 'o@d9005.ro', 'email_trimis', 'https://demo.delta.test/d5/', true, now() - interval '18 days', public.prospectare_inceput_azi() - interval '5 days', null, null, null, '{}'),
  (9606, 'Pe telefon', 'd9006.ro', '0745 900 006', 'o@d9006.ro', 'email_trimis', 'https://demo.delta.test/d6/', true, now() - interval '23 days', public.prospectare_inceput_azi() - interval '5 days', null, null, now(), '{}'),
  (9607, 'Fix', 'd9007.ro', '0264 900 007', 'o@d9007.ro', 'email_trimis', 'https://demo.delta.test/d7/', true, now() - interval '22 days', public.prospectare_inceput_azi() - interval '5 days', null, null, null, '{}'),
  (9608, 'Ambele', 'd9008.ro', '0745 900 008', 'o@d9008.ro', 'whatsapp_trimis', 'https://demo.delta.test/d8/', true, now() - interval '21 days', public.prospectare_inceput_azi() - interval '6 days', public.prospectare_inceput_azi() - interval '5 days', 2, null, '{}'),
  (9609, 'Nouă', 'd9009.ro', '0745 900 009', 'o@d9009.ro', 'site_gata', 'https://demo.delta.test/d9/', true, now() - interval '30 days', null, null, null, null, '{}'),
  (9610, 'Interesată', 'd9010.ro', '0745 900 010', 'o@d9010.ro', 'interesat', 'https://demo.delta.test/d10/', true, now() - interval '26 days', public.prospectare_inceput_azi() - interval '5 days', null, null, null, '{}'),
  (9611, 'Nu contacta', 'd9011.ro', '0745 900 011', 'o@d9011.ro', 'nu_contacta', 'https://demo.delta.test/d11/', true, now() - interval '27 days', public.prospectare_inceput_azi() - interval '5 days', null, null, null, '{}'),
  (9612, 'Email ieri, site nou', 'd9012.ro', '0745 900 012', 'o@d9012.ro', 'email_trimis', 'https://demo.delta.test/d12/', true, now() - interval '5 days', public.prospectare_inceput_azi() - interval '3 hours', null, null, null, '{}'),
  (9613, 'Istoric', 'd9013.ro', '0745 900 013', 'o@d9013.ro', 'site_gata', 'https://demo.delta.test/d13/', true, now() - interval '2 days', null, null, null, null, '{}'),
  (9614, 'WhatsApp azi', 'd9014.ro', '0745 900 014', 'o@d9014.ro', 'whatsapp_trimis', 'https://demo.delta.test/d14/', true, now() - interval '28 days', null, now(), 1, null, '{}'),
  (9615, 'Site la robot', 'd9015.ro', '0745 900 015', null, 'site_in_lucru', null, false, null, null, null, null, null, '{}');
insert into public.prospectare_activitate (firma_id, tip, canal, autor, detalii) values
  (pg_temp.id(9604), 'raspuns', 'email', 'test', '{"tip": "altul"}'),
  (pg_temp.id(9605), 'raspuns', 'email', 'test', '{"tip": "automat"}');
insert into public.prospectare_liste_zi (data, utilizator, canal, firma_id) values (public.prospectare_azi(), 'stefan', 'telefon', pg_temp.id(9606));

-- Cine poate merge pe al doilea canal --------------------------------------------------------
select pg_temp.verifica(public.prospectare_poate_canal(pg_temp.f(9601), 'whatsapp') and public.prospectare_motiv_canal(pg_temp.f(9601), 'whatsapp') is null,
  'email ieri + mobil: poate pe WhatsApp azi');
select pg_temp.verifica(public.prospectare_poate_canal(pg_temp.f(9603), 'email'), 'WhatsApp ieri + email valid: poate pe email azi');
select pg_temp.verifica(not public.prospectare_poate_canal(pg_temp.f(9602), 'whatsapp')
  and public.prospectare_motiv_canal(pg_temp.f(9602), 'whatsapp') = 'a primit email în aceeași zi: WhatsApp-ul pleacă de a doua zi'
  and public.prospectare_poate_canal_in(pg_temp.f(9602), 'whatsapp', public.prospectare_azi() + 1),
  'email azi: WhatsApp-ul nu azi, ci de mâine (motivul se spune)');
select pg_temp.verifica(not public.prospectare_poate_canal(pg_temp.f(9614), 'email')
  and public.prospectare_motiv_canal(pg_temp.f(9614), 'email') = 'a primit WhatsApp în aceeași zi: emailul pleacă de a doua zi',
  'WhatsApp azi: emailul nu azi');
select pg_temp.verifica(not public.prospectare_poate_canal(pg_temp.f(9604), 'whatsapp') and public.prospectare_motiv_canal(pg_temp.f(9604), 'whatsapp') = 'a răspuns la email: continuă omul',
  'a răspuns la email (un om): nu mai primește WhatsApp');
select pg_temp.verifica(public.prospectare_poate_canal(pg_temp.f(9605), 'whatsapp'), 'răspunsul automat nu contează: primește WhatsApp');
select pg_temp.verifica(not public.prospectare_poate_canal(pg_temp.f(9606), 'whatsapp') and public.prospectare_motiv_canal(pg_temp.f(9606), 'whatsapp') like 'e pe telefon%',
  'pe telefon („Apeluri azi”): nu primește WhatsApp');
select pg_temp.verifica(not public.prospectare_poate_canal(pg_temp.f(9607), 'whatsapp') and public.prospectare_motiv_canal(pg_temp.f(9607), 'whatsapp') = 'fără număr de mobil',
  'email + număr fix: nu pe WhatsApp');
select pg_temp.verifica(not public.prospectare_poate_canal(pg_temp.f(9608), 'email') and not public.prospectare_poate_canal(pg_temp.f(9608), 'whatsapp')
  and public.prospectare_motiv_canal(pg_temp.f(9608), 'email') = 'a primit deja email', 'email și WhatsApp primite: niciodată de două ori pe același canal');
select pg_temp.verifica(not public.prospectare_poate_canal(pg_temp.f(9610), 'whatsapp') and not public.prospectare_poate_canal(pg_temp.f(9611), 'whatsapp')
  and public.prospectare_motiv_canal(pg_temp.f(9610), 'whatsapp') = 'etapa „interesat”: continuă omul', 'interesată și „Nu contacta”: nimic mai departe');
select pg_temp.verifica(not public.prospectare_poate_canal(pg_temp.f(9601), 'telefon') and public.prospectare_motiv_canal(pg_temp.f(9601), 'telefon') like 'contactată deja pe email: telefonul se permite din fișa firmei',
  'telefonul rămâne separat: firma contactată nu intră în „Apeluri azi”');

-- Ciclul de la 00:00: emailul întâi, apoi WhatsApp-ul, cele mai vechi primele ------------------
select pg_temp.verifica((public.prospectare_ciclu_zi(public.prospectare_azi()) -> 'programate') = '{"email": {"manual": 0, "automat": 2}, "telefon": {"manual": 0}, "whatsapp": {"manual": 0, "automat": 2}}'::jsonb,
  '00:00: 2 email (limita căsuței), 2 WhatsApp (1 + 1 pe conturi)');
select pg_temp.verifica(pg_temp.prog(9609) = 'email:0:stefan@delta.test' and pg_temp.prog(9603) = 'email:0:stefan@delta.test',
  'email: firma nouă (cel mai vechi site) și cea cu WhatsApp ieri');
select pg_temp.verifica(pg_temp.prog(9601) = 'whatsapp:0:1' and pg_temp.prog(9605) = 'whatsapp:0:2',
  'WhatsApp: cele cu email de dinainte, cele mai vechi site-uri, egal pe conturi');
select pg_temp.verifica(pg_temp.prog(9602) is null and pg_temp.prog(9612) is null and pg_temp.prog(9604) is null and pg_temp.prog(9606) is null,
  'nu azi: emailul de azi (#9602), fără loc (#9612), a răspuns (#9604), pe telefon (#9606)');

-- Completarea zilei: limita mărită în Setări umple pe loc ------------------------------------
update public.prospectare_conturi_whatsapp set limita_zi = 2 where id = 1;
select pg_temp.verifica(pg_temp.prog(9612) = 'whatsapp:0:1', 'limita contului 1 mărită: #9612 intră azi, fără să aștepte 00:00');
select pg_temp.verifica((select rezultat -> 'completari' ->> 'whatsapp' = '1' and rezultat -> 'completari' ->> 'ultimul_motiv' = 'contul WhatsApp schimbat în Setări'
  and rezultat -> 'programate' -> 'whatsapp' ->> 'automat' = '2' from public.prospectare_cicluri where zi = public.prospectare_azi()),
  'completarea e notată separat în ciclul zilei (cifrele de la 00:00 rămân)');
select pg_temp.verifica((public.prospectare_completeaza_azi('test') ->> 'whatsapp') = '0', 'fără loc sau fără firme noi, completarea nu face nimic');
select pg_temp.verifica((select count(*) = 2 from public.prospectare_programari where zi = public.prospectare_azi() and canal = 'whatsapp' and cont_whatsapp = 1 and stare = 'programata'),
  'contul 1: exact limita (2)');

-- Trimiterea: WhatsApp după email, email după WhatsApp ---------------------------------------
create temp table wa_9001 as select public.prospectare_whatsapp_trimis(pg_temp.id(9601), null, 'Ștefan') as r;
select pg_temp.verifica((select whatsapp_la is not null and email_la is not null and etapa = 'whatsapp_trimis' and canal_permis is null from public.prospectare_firme where nr = 9601),
  'WhatsApp trimis după emailul de ieri: firma are acum ambele canale');
create temp table anul_9001 as select public.prospectare_whatsapp_anuleaza(pg_temp.id(9601), 'Ștefan') as r;
select pg_temp.verifica((select whatsapp_la is null and canal_permis is null and etapa = 'email_trimis' from public.prospectare_firme where nr = 9601) and pg_temp.prog(9601) = 'whatsapp:0:1',
  'anularea: înapoi la „email trimis”, fără permisiune de recontactare (nu mai e nevoie), programarea revine');
select pg_temp.verifica((public.prospectare_whatsapp_trimis(pg_temp.id(9601), null, 'Ștefan') ->> 'nr')::integer = 9601, 'după anulare, WhatsApp-ul se trimite din nou');
create temp table em_9003 as select public.prospectare_email_cere_canal(pg_temp.robot(), 'd9003.ro', null, 'stefan@delta.test') as r;
select pg_temp.verifica((select (r ->> 'trimite')::boolean from em_9003)
  and (select email_la is not null and whatsapp_la is not null and etapa = 'whatsapp_trimis' from public.prospectare_firme where nr = 9603),
  'emailul cerut de robot după WhatsApp-ul de ieri: trimite; etapa rămâne „WhatsApp trimis”');
select pg_temp.asteapta_eroare($$select public.prospectare_email_cere_canal(pg_temp.robot(), 'd9014.ro', null, 'stefan@delta.test')$$, 'PR409',
  'email cerut pentru o firmă cu WhatsApp azi → 409', '%a primit WhatsApp azi%');

-- Regula din bază (trigger): niciodată două canale în aceeași zi; telefonul separat -----------
select pg_temp.asteapta_eroare($$update public.prospectare_firme set whatsapp_la = now(), whatsapp_cont = 2 where nr = 9602$$, 'PR409',
  'WhatsApp scris direct pe o firmă cu email azi → 409', '%a primit email azi%');
select pg_temp.asteapta_eroare($$update public.prospectare_firme set telefon_la = now() where nr = 9607$$, 'PR409',
  'telefon lângă email, fără permisiune din fișă → 409', '%telefonul rămâne separat%');
update public.prospectare_firme set canal_permis = 'telefon', canal_permis_motiv = 'test 36', canal_permis_la = now(), canal_permis_de = 'test' where nr = 9607;
select pg_temp.verifica(public.prospectare_poate_canal(pg_temp.f(9607), 'telefon'), 'cu permisiune din fișă, telefonul merge și după email');
select set_config('prospectare.import_istoric', 'da', false);
update public.prospectare_firme set email_la = now(), whatsapp_la = now(), whatsapp_cont = 1, etapa = 'whatsapp_trimis' where nr = 9613;
select set_config('prospectare.import_istoric', '', false);
select pg_temp.verifica((select email_la is not null and whatsapp_la is not null from public.prospectare_firme where nr = 9613), 'importul de istoric scrie ce s-a întâmplat (ambele în aceeași zi)');

-- Programarea manuală: de mâine, eligibilitatea pentru ziua aleasă ----------------------------
select pg_temp.verifica((select count(*) = 1 from jsonb_array_elements(public.prospectare_programabile('whatsapp') -> 'firme') e where (e ->> 'nr')::integer = 9602)
  and (select count(*) = 0 from jsonb_array_elements(public.prospectare_programabile('whatsapp') -> 'firme') e where (e ->> 'nr')::integer in (9604, 9606, 9608)),
  '„Programează” pe WhatsApp arată firma cu email azi (merge de mâine), nu și pe cele care au răspuns, sunt pe telefon sau au ambele');
create temp table man_9002 as select public.prospectare_programeaza('whatsapp', public.prospectare_azi() + 1, array[pg_temp.id(9602)], null, null, 'Ștefan') as r;
select pg_temp.verifica((select (r ->> 'programate')::integer = 1 from man_9002) and pg_temp.prog(9602) like 'whatsapp:1:%', 'WhatsApp programat pentru mâine, după emailul de azi');
create temp table man_9014 as select public.prospectare_programeaza('email', public.prospectare_azi() + 1, array[pg_temp.id(9614)], null, null, 'Ștefan') as r;
select pg_temp.verifica((select (r ->> 'programate')::integer = 1 from man_9014) and pg_temp.prog(9614) = 'email:1:stefan@delta.test', 'email programat pentru mâine, după WhatsApp-ul de azi');

-- Importul și /termina completează ziua -----------------------------------------------------
update public.prospectare_conturi_whatsapp set limita_zi = 3 where id = 2;
insert into public.prospectare_rezervari (firma_id, dispozitiv_id, tip_lucru, expira_la) values (pg_temp.id(9615), pg_temp.robot(), 'construire', now() + interval '1 hour');
select public.prospectare_termina(pg_temp.robot(), pg_temp.id(9615), 'https://demo.delta.test/d15/');
select pg_temp.verifica(pg_temp.prog(9615) = 'whatsapp:0:2', '/termina: site gata și publicat → programat azi pe WhatsApp, cât e loc');
select public.prospectare_upsert_firme('[{"domeniu":"d9016.ro","nr":9616,"nume":"Din import","telefon":"0745 900 016","etapa":"site_gata","link_demo":"https://demo.delta.test/d16/","demo_verificat":true,"site_gata_la":"2026-10-20T10:00:00+03:00"}]', 'import', 'import', true);
select pg_temp.verifica(pg_temp.id(9616) is null, 'importul de probă nu scrie și nu programează nimic');
select public.prospectare_upsert_firme('[{"domeniu":"d9016.ro","nr":9616,"nume":"Din import","telefon":"0745 900 016","etapa":"site_gata","link_demo":"https://demo.delta.test/d16/","demo_verificat":true,"site_gata_la":"2026-10-20T10:00:00+03:00"}]', 'import', 'import');
select pg_temp.verifica(pg_temp.prog(9616) = 'whatsapp:0:2', 'importul: firma nouă, gata și publicată → programată azi pe WhatsApp, cât e loc');
select pg_temp.verifica((select count(*) = 3 from public.prospectare_programari where zi = public.prospectare_azi() and canal = 'whatsapp' and cont_whatsapp = 2 and stare in ('programata', 'folosita')),
  'contul 2: exact limita nouă (3)');

-- Ciclul forțat păstrează completările; ziua de mâine respectă regula ------------------------
select pg_temp.verifica((public.prospectare_ciclu_zi(public.prospectare_azi(), true) -> 'completari' ->> 'whatsapp')::integer = 3, 'ciclul rulat din nou păstrează completările zilei (limita, /termina, importul)');
select pg_temp.verifica((select count(*) = 0 from (select firma_id from public.prospectare_programari where stare = 'programata' group by firma_id having count(*) > 1) s),
  'nicio firmă cu două programări active');
select pg_temp.verifica((public.prospectare_ciclu_zi(public.prospectare_azi() + 1) -> 'programate' -> 'whatsapp' ->> 'manual') = '1'
  and pg_temp.prog(9602) = 'whatsapp:1:1' and pg_temp.prog(9614) = 'email:1:stefan@delta.test',
  'ciclul de mâine: WhatsApp-ul după emailul de azi și emailul după WhatsApp-ul de azi rămân programate');
