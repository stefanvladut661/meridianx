-- Testele regulilor din migrările 28–33, pe Postgres local (nu pe producție).
\set ON_ERROR_STOP 1
set client_min_messages = warning;

create or replace function pg_temp.asteapta_eroare(p_sql text, p_cod text, p_nume text)
returns text language plpgsql as $$
begin
  execute p_sql;
  raise exception 'PICAT: % (nu a dat eroare, aștepta %)', p_nume, p_cod;
exception when others then
  if sqlstate = p_cod then
    return 'ok   ' || p_nume || ' → ' || sqlstate || ': ' || sqlerrm;
  end if;
  if sqlerrm like 'PICAT:%' then raise; end if;
  raise exception 'PICAT: % (cod %, aștepta %): %', p_nume, sqlstate, p_cod, sqlerrm;
end;
$$;

create or replace function pg_temp.verifica(p_ok boolean, p_nume text)
returns text language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'PICAT: %', p_nume; end if;
  return 'ok   ' || p_nume;
end;
$$;

-- Lista de WhatsApp: numerele firmelor din ea, în ordine.
create or replace function pg_temp.coada() returns integer[] language sql as $$
  select coalesce(array_agg(nr order by nr), '{}') from public.prospectare_whatsapp_coada(1000, 0)
$$;

-- Date de test ---------------------------------------------------------------------
select set_config('prospectare.autor', 'test', false);
insert into public.prospectare_firme (nr, nume, domeniu, nisa, oras, scor, telefon, email, etapa, link_demo) values
  (1, 'Firma Unu', 'https://WWW.Unu.ro/', 'tâmplărie', 'Cluj', 90, '0745 111 111', 'office@unu.ro', 'site_gata', 'https://demo.test/unu/'),
  (2, 'Firma Doi', 'doi.ro', 'tâmplărie', 'Cluj', 80, '0745 222 222', 'office@doi.ro', 'site_gata', 'https://demo.test/doi/'),
  (3, 'Firma Trei', 'trei.ro', 'construcții', 'Iași', 70, '0232 333 333', 'office@trei.ro', 'site_gata', 'https://demo.test/trei/'),
  (4, 'Firma Patru', 'patru.ro', 'construcții', 'Iași', 60, '0745 444 444', 'office@patru.ro', 'site_gata', null),
  (5, 'Firma Cinci', 'cinci.ro', 'construcții', 'Iași', 50, '0745 555 555', 'office@cinci.ro', 'nu_contacta', 'https://demo.test/cinci/');
insert into public.prospectare_firme (nr, nume, domeniu, scor, etapa, de_refacut)
select 100 + g, 'Lucru ' || g, 'lucru' || g || '.ro', g, 'site_in_lucru', g % 5 = 0 from generate_series(1, 30) g;

select pg_temp.verifica((select domeniu from public.prospectare_firme where nr = 1) = 'unu.ro', 'domeniul se normalizează la scriere');
select pg_temp.verifica((select este_mobil from public.prospectare_firme where nr = 1) and not (select este_mobil from public.prospectare_firme where nr = 3), 'este_mobil vine din telefon');
select pg_temp.verifica((select count(*) from public.prospectare_activitate where tip = 'creata') = 35, 'fiecare firmă nouă intră în activitate');
select pg_temp.asteapta_eroare($$insert into public.prospectare_firme (nume, domeniu) values ('Dublură', 'unu.ro')$$, '23505', 'domeniul e unic');

-- Canalele: mai multe pe firmă, fiecare o singură dată -------------------------------
update public.prospectare_firme set email_la = now() where nr = 2;
update public.prospectare_firme set whatsapp_la = now(), whatsapp_cont = 3 where nr = 2;
select pg_temp.verifica((select email_la is not null and whatsapp_la is not null and whatsapp_cont = 3 from public.prospectare_firme where nr = 2), 'email și WhatsApp pe aceeași firmă: permis, câte o dată');
select pg_temp.asteapta_eroare($$update public.prospectare_firme set email_la = now() + interval '1 minute' where nr = 2$$, 'PR409', 'al doilea email aceleiași firme e refuzat');
select pg_temp.asteapta_eroare($$update public.prospectare_firme set whatsapp_la = null where nr = 2$$, 'PR409', 'data unui canal nu se golește');
select pg_temp.asteapta_eroare($$update public.prospectare_firme set whatsapp_cont = 2 where nr = 2$$, 'PR409', 'contul WhatsApp nu se schimbă după trimitere');
select pg_temp.asteapta_eroare($$update public.prospectare_firme set whatsapp_cont = 2 where nr = 3$$, 'PR422', 'contul WhatsApp doar odată cu data mesajului');
select pg_temp.asteapta_eroare($$update public.prospectare_firme set telefon_la = now() where nr = 5$$, 'PR410', '„Nu contacta” nu primește niciun canal');
select pg_temp.asteapta_eroare($$update public.prospectare_firme set canal = 'email' where nr = 1$$, '23514', 'coloana veche `canal` rămâne goală');
select pg_temp.verifica((select count(*) from public.prospectare_activitate a join public.prospectare_firme f on f.id = a.firma_id where f.nr = 2 and a.tip = 'canal') = 2, 'fiecare canal nou intră în activitate');

-- Activitatea: doar adăugare (și ca superuser) ------------------------------------
select pg_temp.asteapta_eroare($$update public.prospectare_activitate set autor = 'altul'$$, 'PR403', 'activitatea nu se modifică');
select pg_temp.asteapta_eroare($$delete from public.prospectare_activitate$$, 'PR403', 'activitatea nu se șterge');
select pg_temp.asteapta_eroare($$truncate public.prospectare_activitate cascade$$, 'PR403', 'activitatea nu se golește');

-- RLS: anonim, cont fără drept, admin ---------------------------------------------
set role anon;
select pg_temp.verifica((select count(*) from public.prospectare_firme) = 0, 'anon nu vede nicio firmă (RLS)');
select pg_temp.asteapta_eroare($$select public.prospectare_rezerva_urmatoarea(gen_random_uuid(), null)$$, '42501', 'anon nu poate chema funcțiile');
select pg_temp.asteapta_eroare($$insert into public.prospectare_firme (nume, domeniu) values ('x', 'x.ro')$$, '42501', 'anon nu poate scrie');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"email":"altcineva@test.local"}', false);
select pg_temp.verifica((select count(*) from public.prospectare_firme) = 0, 'cont autentificat, dar nu admin: nu vede nimic');
select set_config('request.jwt.claims', '{"email":"vladut@test.local"}', false);
select pg_temp.verifica((select count(*) from public.prospectare_firme) = 35, 'Vlăduț (în admin_emails) vede firmele');
select pg_temp.asteapta_eroare($$select token_hash from public.prospectare_dispozitive$$, '42501', 'hash-ul tokenului nu se citește nici de admin');
select pg_temp.asteapta_eroare($$select public.prospectare_whatsapp_trimis(gen_random_uuid(), 1::smallint, 'x')$$, '42501', 'adminul prin REST nu trimite WhatsApp (doar serverul)');
update public.prospectare_firme set nota = 'scris prin REST' where nr = 1;
reset role;
select pg_temp.verifica((select nota is null from public.prospectare_firme where nr = 1), 'adminul nu scrie direct prin REST (0 rânduri; scrie doar serverul)');
select set_config('request.jwt.claims', '', false);

-- Lista de apeluri: doar firme fără email și fără WhatsApp ---------------------------
select public.prospectare_importa_lista_zi('stefan', 'telefon', 10, '{}'::jsonb, null, 'Ștefan');
select pg_temp.verifica((select count(*) from public.prospectare_liste_zi where utilizator = 'stefan' and canal = 'telefon') = 2,
  'apeluri: intră doar site gata + link + telefon, fără email și fără WhatsApp (#1 și #3; #2 avea email + WhatsApp, #4 fără link, #5 nu contacta)');
select pg_temp.verifica((select count(*) from public.prospectare_firme where nr in (1, 3) and telefon_la is not null) = 2, 'firmele din listă primesc telefonul');
select pg_temp.asteapta_eroare($$insert into public.prospectare_liste_zi (utilizator, canal, firma_id) select 'stefan', 'telefon', id from public.prospectare_firme where nr = 5$$, 'PR410', '„Nu contacta” nu intră în liste');
select pg_temp.asteapta_eroare($$insert into public.prospectare_liste_zi (utilizator, canal, firma_id) select 'stefan', 'telefon', id from public.prospectare_firme where nr = 2$$, 'PR409', 'în listă intră doar prin import (firma nu e pe telefon)');
select pg_temp.asteapta_eroare($$select public.prospectare_importa_lista_zi('ion', 'telefon', 1, '{}'::jsonb, null, 'x')$$, 'PR422', 'utilizator necunoscut refuzat');
select pg_temp.asteapta_eroare($$select public.prospectare_importa_lista_zi('vladut', 'whatsapp', 5, '{}'::jsonb, 1::smallint, 'Vlăduț')$$, 'PR422', 'lista de WhatsApp nu se mai importă pe zi');

-- Rezultatele apelurilor: 3 × nu răspunde → iese din listă, își pierde telefonul
select public.prospectare_seteaza_rezultat((select l.id from public.prospectare_liste_zi l join public.prospectare_firme f on f.id = l.firma_id where f.nr = 1), 'nu_raspunde');
select pg_temp.verifica((select etapa from public.prospectare_firme where nr = 1) = 'sunat', 'prima încercare: etapa Sunat');
select public.prospectare_seteaza_rezultat((select l.id from public.prospectare_liste_zi l join public.prospectare_firme f on f.id = l.firma_id where f.nr = 1), 'nu_raspunde');
select pg_temp.verifica((public.prospectare_seteaza_rezultat((select l.id from public.prospectare_liste_zi l join public.prospectare_firme f on f.id = l.firma_id where f.nr = 1), 'nu_raspunde') ->> 'revenit')::boolean, 'a treia încercare: revine în rezervă');
select pg_temp.verifica((select telefon_la is null and etapa = 'site_gata' from public.prospectare_firme where nr = 1), 'telefonul s-a golit (singura excepție)');
select pg_temp.verifica(not exists (select 1 from public.prospectare_liste_zi l join public.prospectare_firme f on f.id = l.firma_id where f.nr = 1), 'firma a ieșit din listă');
select pg_temp.verifica((select count(*) from public.prospectare_activitate a join public.prospectare_firme f on f.id = a.firma_id where f.nr = 1 and a.tip = 'canal' and a.detalii ->> 'din' = 'telefon' and a.detalii ->> 'motiv' like 'Nu a răspuns la 3%') = 1, 'golirea telefonului e scrisă în activitate, cu motiv');
select pg_temp.asteapta_eroare($$select public.prospectare_seteaza_rezultat((select l.id from public.prospectare_liste_zi l join public.prospectare_firme f on f.id = l.firma_id where f.nr = 3), 'suna_inapoi')$$, 'PR422', 'Sună înapoi cere ora');
select public.prospectare_seteaza_rezultat((select l.id from public.prospectare_liste_zi l join public.prospectare_firme f on f.id = l.firma_id where f.nr = 3), 'interesat', 'Vrea ofertă');
select pg_temp.verifica((select etapa from public.prospectare_firme where nr = 3) = 'interesat', 'Interesat → etapa Interesat');

-- Listele neterminate se mută pe azi
update public.prospectare_liste_zi set data = public.prospectare_azi() - 1;
select pg_temp.verifica(public.prospectare_reporteaza_liste() = 0, 'listele terminate (interesat) rămân pe ziua lor');
select public.prospectare_importa_lista_zi('stefan', 'telefon', 10, '{}'::jsonb, null, 'Ștefan');
update public.prospectare_liste_zi set data = public.prospectare_azi() - 2 where rezultat is null;
select pg_temp.verifica(public.prospectare_reporteaza_liste() = 1, 'lista neterminată de alaltăieri trece pe azi');

-- „Nu contacta” scoate firma din liste
select public.prospectare_schimba_etapa((select id from public.prospectare_firme where nr = 1), 'nu_contacta', 'Ștefan', 'A cerut');
select pg_temp.verifica(not exists (select 1 from public.prospectare_liste_zi l join public.prospectare_firme f on f.id = l.firma_id where f.nr = 1), '„Nu contacta” iese din listele neterminate');
select pg_temp.asteapta_eroare($$select public.prospectare_schimba_etapa((select id from public.prospectare_firme where nr = 1), 'interesat', 'Ștefan')$$, 'PR410', 'din „Nu contacta” nu se mai iese');

-- Lista de WhatsApp, continuă -------------------------------------------------------
-- #7 mobil fără email · #8 email trimis acum 2 ore · #9 email trimis acum 25 de ore · #10 mobil fără email
-- #11 mobil fără email (apoi „Nu contacta”) · #12 email de acum 25 de ore, dar a răspuns · #13 fix, fără email
insert into public.prospectare_firme (nr, nume, domeniu, scor, telefon, email, etapa, link_demo, email_la) values
  (7, 'Firma Șapte', 'sapte.ro', 97, '0745 777 777', null, 'site_gata', 'https://demo.test/sapte/', null),
  (8, 'Firma Opt', 'opt.ro', 96, '0745 888 888', 'office@opt.ro', 'email_trimis', 'https://demo.test/opt/', now() - interval '2 hours'),
  (9, 'Firma Nouă', 'noua.ro', 95, '0745 999 999', 'office@noua.ro', 'email_trimis', 'https://demo.test/noua/', now() - interval '25 hours'),
  (10, 'Firma Zece', 'zece.ro', 94, '0746 101 010', null, 'site_gata', 'https://demo.test/zece/', null),
  (11, 'Firma Unsprezece', 'unsprezece.ro', 93, '0746 111 111', null, 'site_gata', 'https://demo.test/11/', null),
  (12, 'Firma Doisprezece', 'doisprezece.ro', 92, '0746 121 212', 'office@12.ro', 'email_trimis', 'https://demo.test/12/', now() - interval '25 hours'),
  (13, 'Firma Treisprezece', 'treisprezece.ro', 91, '0231 131 313', null, 'site_gata', 'https://demo.test/13/', null);
insert into public.prospectare_activitate (firma_id, tip, canal, autor, detalii) select id, 'raspuns', 'email', 'test', '{"tip":"altul"}' from public.prospectare_firme where nr = 12;
update public.prospectare_firme set link_demo = 'https://demo.test/patru/' where nr = 4;
select pg_temp.verifica(pg_temp.coada() = array[7, 9, 10, 11], 'lista de WhatsApp: mobil + site gata; cu email doar la o zi după email; fără cei care au răspuns, fără fix (' || pg_temp.coada()::text || ')');
select pg_temp.verifica(not (4 = any(pg_temp.coada())), 'firmă cu email și mobil: nu intră înainte să plece emailul (#4)');
select pg_temp.verifica(not (1 = any(pg_temp.coada())) and not (3 = any(pg_temp.coada())), 'firmele de pe telefon nu intră în lista de WhatsApp');
select pg_temp.verifica((public.prospectare_whatsapp_trimis((select id from public.prospectare_firme where nr = 7), 1::smallint, 'Vlăduț') ->> 'trimise_azi')::integer = 1, 'WhatsApp trimis: contorul contului 1 = 1');
select pg_temp.verifica((select whatsapp_la is not null and whatsapp_cont = 1 and etapa = 'whatsapp_trimis' from public.prospectare_firme where nr = 7), 'WhatsApp trimis: data, contul, etapa WhatsApp trimis');
select pg_temp.verifica((select count(*) from public.prospectare_activitate a join public.prospectare_firme f on f.id = a.firma_id where f.nr = 7 and a.tip = 'whatsapp' and a.autor = 'Vlăduț' and a.detalii ->> 'cont' = '1') = 1, 'WhatsApp trimis: în activitate, cu autorul și contul');
select pg_temp.asteapta_eroare($$select public.prospectare_whatsapp_trimis((select id from public.prospectare_firme where nr = 7), 2::smallint, 'Ștefan')$$, 'PR409', 'al doilea WhatsApp aceleiași firme e refuzat');
select pg_temp.asteapta_eroare($$select public.prospectare_whatsapp_trimis((select id from public.prospectare_firme where nr = 8), 1::smallint, 'Ștefan')$$, 'PR422', 'WhatsApp la mai puțin de o zi după email: refuzat');
select pg_temp.asteapta_eroare($$select public.prospectare_whatsapp_trimis((select id from public.prospectare_firme where nr = 1), 1::smallint, 'Ștefan')$$, 'PR410', 'WhatsApp pentru „Nu contacta”: refuzat');
select pg_temp.asteapta_eroare($$select public.prospectare_whatsapp_trimis((select id from public.prospectare_firme where nr = 3), 1::smallint, 'Ștefan')$$, 'PR409', 'WhatsApp pentru o firmă de pe telefon: refuzat');
select pg_temp.asteapta_eroare($$select public.prospectare_whatsapp_trimis((select id from public.prospectare_firme where nr = 9), 7::smallint, 'Ștefan')$$, 'PR422', 'cont WhatsApp care nu e în Setări: refuzat');
select public.prospectare_whatsapp_trimis((select id from public.prospectare_firme where nr = 9), 2::smallint, 'Ștefan');
select pg_temp.verifica((select email_la is not null and whatsapp_la is not null and etapa = 'whatsapp_trimis' from public.prospectare_firme where nr = 9), 'după email, WhatsApp: firma are ambele canale');
update public.prospectare_setari set whatsapp_pe_cont = '{"1": 1, "2": 30, "3": 30}' where id = 1;
select pg_temp.verifica((public.prospectare_whatsapp_trimis((select id from public.prospectare_firme where nr = 10), 1::smallint, 'Ștefan') ->> 'peste_limita')::boolean, 'peste limita contului: mesajul pleacă, contorul doar avertizează');
update public.prospectare_setari set whatsapp_pe_cont = '{"1": 30, "2": 30, "3": 30}' where id = 1;
select pg_temp.verifica((public.prospectare_rezumat() -> 'azi' -> 'whatsapp_pe_cont' ->> '1')::integer = 2, 'rezumat: trimise azi pe contul 1 = 2');
select public.prospectare_schimba_etapa((select id from public.prospectare_firme where nr = 11), 'nu_contacta', 'Vlăduț', 'A cerut pe WhatsApp');
select pg_temp.verifica(pg_temp.coada() = '{}'::integer[], '„Nu contacta” iese și din lista de WhatsApp (' || pg_temp.coada()::text || ')');
select pg_temp.verifica((select whatsapp_la is null from public.prospectare_firme where nr = 8), 'refuzul nu consumă canalul');

-- Roboții ---------------------------------------------------------------------------
insert into public.prospectare_dispozitive (nume, proprietar, token_hash)
select 'robot-' || g, 'Ștefan', encode(sha256(('token-' || g)::bytea), 'hex') from generate_series(1, 10) g;
select pg_temp.verifica(public.prospectare_autentifica(encode(sha256('gresit'::bytea), 'hex')) is null, 'token greșit: necunoscut');
select pg_temp.verifica(public.prospectare_autentifica('nu-e-hash') is null, 'hash malformat: necunoscut');
update public.prospectare_dispozitive set activ = false where nume = 'robot-10';
select pg_temp.verifica(not (public.prospectare_autentifica(encode(sha256('token-10'::bytea), 'hex')) ->> 'activ')::boolean, 'robot dezactivat: activ = false (→ 401)');
update public.prospectare_setari set cereri_pe_minut = 10 where id = 1;
select public.prospectare_autentifica(encode(sha256('token-9'::bytea), 'hex')) from generate_series(1, 10);
select pg_temp.verifica((public.prospectare_autentifica(encode(sha256('token-9'::bytea), 'hex')) ->> 'depasit')::boolean, 'a 11-a cerere în minut: depășit (→ 429)');
update public.prospectare_setari set cereri_pe_minut = 120 where id = 1;

select pg_temp.verifica((public.prospectare_rezerva_urmatoarea((select id from public.prospectare_dispozitive where nume = 'robot-1'), 'refacere') ->> 'de_refacut')::boolean, 'refacere: ia o firmă de refăcut');
select pg_temp.verifica((select r.tip_lucru = 'refacere' and f.nr = 130 from public.prospectare_rezervari r join public.prospectare_firme f on f.id = r.firma_id), 'refacerea cu scorul cel mai mare (#130)');
select pg_temp.verifica((public.prospectare_rezerva_urmatoarea((select id from public.prospectare_dispozitive where nume = 'robot-1'), 'refacere') -> 'rezervare' ->> 'reluata')::boolean, 'același robot își reia firma, nu ia alta');
select pg_temp.asteapta_eroare($$select public.prospectare_heartbeat((select id from public.prospectare_dispozitive where nume = 'robot-2'), (select firma_id from public.prospectare_rezervari limit 1))$$, 'PR409', 'alt robot nu prelungește rezervarea');
select pg_temp.asteapta_eroare($$select public.prospectare_termina((select id from public.prospectare_dispozitive where nume = 'robot-2'), (select firma_id from public.prospectare_rezervari limit 1), 'https://demo.test/x/')$$, 'PR409', 'alt robot nu termină firma');
select pg_temp.asteapta_eroare($$select public.prospectare_rezerva_urmatoarea((select id from public.prospectare_dispozitive where nume = 'robot-10'), null)$$, 'PR401', 'robotul dezactivat nu rezervă');
-- Rezervare expirată: următorul robot o ia, cu întâietate.
update public.prospectare_rezervari set expira_la = now() - interval '1 minute';
select pg_temp.verifica((public.prospectare_rezerva_urmatoarea((select id from public.prospectare_dispozitive where nume = 'robot-2'), null) ->> 'nr')::integer = 130, 'rezervarea expirată trece la următorul robot');
select pg_temp.verifica((select count(*) from public.prospectare_activitate a where a.tip = 'rezervare' and a.detalii ? 'preluata_de_la') = 1, 'preluarea e scrisă în activitate');
select pg_temp.asteapta_eroare($$select public.prospectare_heartbeat((select id from public.prospectare_dispozitive where nume = 'robot-1'), (select firma_id from public.prospectare_rezervari limit 1))$$, 'PR409', 'robotul vechi nu mai poate prelungi');
select pg_temp.asteapta_eroare($$select public.prospectare_termina((select id from public.prospectare_dispozitive where nume = 'robot-2'), (select firma_id from public.prospectare_rezervari limit 1), 'http://nesigur/')$$, 'PR422', 'linkul demo trebuie https');
select public.prospectare_termina((select id from public.prospectare_dispozitive where nume = 'robot-2'), (select firma_id from public.prospectare_rezervari limit 1), 'https://demo.test/lucru30/', 'https://drive.google.com/file/d/x/view');
select pg_temp.verifica((select etapa = 'site_gata' and not de_refacut and link_demo is not null from public.prospectare_firme where nr = 130), 'termina: site gata, link, nu mai e de refăcut');
select pg_temp.verifica(not exists (select 1 from public.prospectare_rezervari), 'termina: rezervarea se șterge');
-- Site publicat pentru o firmă cu mobil și fără email: intră singură în lista de WhatsApp.
update public.prospectare_firme set telefon = '0747 128 128', de_refacut = true where nr = 128;
select pg_temp.verifica(not (128 = any(pg_temp.coada())), 'site încă în lucru: nu e în lista de WhatsApp');
select public.prospectare_rezerva_urmatoarea((select id from public.prospectare_dispozitive where nume = 'robot-4'), null);
select public.prospectare_termina((select id from public.prospectare_dispozitive where nume = 'robot-4'), (select firma_id from public.prospectare_rezervari limit 1), 'https://demo.test/lucru28/');
select pg_temp.verifica(128 = any(pg_temp.coada()), 'robotul raportează site-ul publicat: firma intră singură în lista de WhatsApp');
select pg_temp.verifica((public.prospectare_rezumat() ->> 'whatsapp_lista')::integer = cardinality(pg_temp.coada()), 'rezumatul numără lista de WhatsApp');

-- Email ----------------------------------------------------------------------------
select pg_temp.asteapta_eroare($$select public.prospectare_email_cere_canal((select id from public.prospectare_dispozitive where nume = 'robot-3'), 'trei.ro', null, 'stefan@casuta.test')$$, 'PR409', 'email cerut pentru o firmă de pe telefon → 409');
select pg_temp.asteapta_eroare($$select public.prospectare_email_cere_canal((select id from public.prospectare_dispozitive where nume = 'robot-3'), 'cinci.ro', null, 'stefan@casuta.test')$$, 'PR410', 'email cerut pentru „Nu contacta” → refuzat');
select pg_temp.asteapta_eroare($$select public.prospectare_email_cere_canal((select id from public.prospectare_dispozitive where nume = 'robot-3'), 'lucru1.ro', null, 'stefan@casuta.test')$$, 'PR422', 'email fără site gata → refuzat');
select pg_temp.asteapta_eroare($$select public.prospectare_email_cere_canal((select id from public.prospectare_dispozitive where nume = 'robot-3'), 'doi.ro', null, 'stefan@casuta.test')$$, 'PR409', 'email pentru o firmă care a primit deja email → 409');
select pg_temp.asteapta_eroare($$select public.prospectare_email_eveniment((select id from public.prospectare_dispozitive where nume = 'robot-3'), 'trimis', 'lucru30.ro', null, 'stefan@casuta.test', '{}'::jsonb, 'm-0')$$, 'PR409', '„trimis” fără canal cerut înainte → 409');
update public.prospectare_firme set email = 'office@lucru30.ro' where nr = 130;
update public.prospectare_firme set email = 'office@lucru29.ro' where nr = 129;
select pg_temp.verifica((public.prospectare_email_cere_canal((select id from public.prospectare_dispozitive where nume = 'robot-3'), 'lucru30.ro', null, 'stefan@casuta.test', 1) ->> 'trimite')::boolean, 'cererea de canal email: 200 și data emailului se pune');
select pg_temp.verifica((select email_la is not null from public.prospectare_firme where nr = 130), 'firma are acum email_la');
select pg_temp.asteapta_eroare($$select public.prospectare_email_cere_canal((select id from public.prospectare_dispozitive where nume = 'robot-3'), 'lucru30.ro', null, 'stefan@casuta.test', 5)$$, 'PR409', 'a doua cerere de email pentru aceeași firmă → 409');
select public.prospectare_email_eveniment((select id from public.prospectare_dispozitive where nume = 'robot-3'), 'trimis', 'lucru30.ro', null, 'stefan@casuta.test', '{"message_id":"m-1"}'::jsonb, 'm-1');
select pg_temp.verifica(not (public.prospectare_email_eveniment((select id from public.prospectare_dispozitive where nume = 'robot-3'), 'trimis', 'lucru30.ro', null, 'stefan@casuta.test', '{}'::jsonb, 'm-1') ->> 'nou')::boolean, 'același message_id a doua oară nu se mai numără');
select pg_temp.verifica((select trimise = 1 and limita_atinsa_la is not null from public.prospectare_casute_zi where adresa = 'stefan@casuta.test'), 'căsuța: 1 trimis, limita (1) atinsă');
select pg_temp.verifica((select etapa from public.prospectare_firme where nr = 130) = 'email_trimis', 'etapa Email trimis');
update public.prospectare_firme set link_demo = 'https://demo.test/doi/' where nr = 129;
update public.prospectare_firme set etapa = 'site_gata' where nr = 129;
select pg_temp.asteapta_eroare($$select public.prospectare_email_cere_canal((select id from public.prospectare_dispozitive where nume = 'robot-3'), 'lucru29.ro', null, 'stefan@casuta.test')$$, 'PR429', 'căsuța la limită → refuzat, emailul nu se marchează');
select pg_temp.verifica((select email_la is null from public.prospectare_firme where nr = 129), 'refuzul pentru limită nu consumă canalul');
select public.prospectare_email_eveniment((select id from public.prospectare_dispozitive where nume = 'robot-3'), 'raspuns', 'lucru30.ro', null, 'stefan@casuta.test', '{"tip":"nu","extras":"Nu ne mai scrieți"}'::jsonb, 'r-1');
select pg_temp.verifica((select etapa from public.prospectare_firme where nr = 130) = 'nu_contacta', 'răspuns „NU” → Nu contacta');
select pg_temp.asteapta_eroare($$update public.prospectare_firme set whatsapp_la = now() where nr = 130$$, 'PR410', '„NU” pe email blochează și WhatsApp-ul');

-- Importul / upsert ---------------------------------------------------------------
select pg_temp.verifica((public.prospectare_upsert_firme('[{"domeniu":"nou.ro","nr":500,"nume":"Nou","etapa":"cercetat"}]', 'import', 'import', true) ->> 'adaugate')::integer = 1
  and not exists (select 1 from public.prospectare_firme where domeniu = 'nou.ro'), 'proba numără, dar nu scrie');
select public.prospectare_upsert_firme('[{"domeniu":"https://www.nou.ro","nr":500,"nume":"Nou","etapa":"email_trimis","email_la":"2026-10-30T09:40:00+02:00","link_demo":"https://demo.test/nou/"}]', 'import', 'import');
select pg_temp.verifica((select email_la = '2026-10-30T09:40:00+02:00'::timestamptz from public.prospectare_firme where nr = 500), 'importul pune data emailului reală');
select pg_temp.verifica((public.prospectare_upsert_firme('[{"domeniu":"nou.ro","nr":500,"nume":"Nou","etapa":"email_trimis","email_la":"2026-10-30T09:40:00+02:00","link_demo":"https://demo.test/nou/"}]', 'import', 'import') ->> 'neschimbate')::integer = 1, 'a doua rulare: nimic schimbat (idempotent)');
select pg_temp.verifica((public.prospectare_upsert_firme('[{"domeniu":"nou.ro","email_la":"2026-10-31T10:00:00+02:00","whatsapp_la":"2026-11-01T12:00:00+02:00","whatsapp_cont":2}]', 'import', 'import') ->> 'canale_noi')::integer = 1, 'importul adaugă al doilea canal (WhatsApp)');
select pg_temp.verifica((select email_la = '2026-10-30T09:40:00+02:00'::timestamptz and whatsapp_la = '2026-11-01T12:00:00+02:00'::timestamptz and whatsapp_cont = 2 from public.prospectare_firme where nr = 500), 'importul nu schimbă data unui canal deja pus');
select pg_temp.verifica(jsonb_array_length(public.prospectare_upsert_firme('[{"domeniu":"cinci.ro","email_la":"2026-10-30T09:40:00+02:00"}]', 'import', 'import') -> 'conflicte') = 1, '„Nu contacta” nu primește canal nici din import (conflict)');
select pg_temp.verifica((public.prospectare_upsert_firme('[{"domeniu":"trei.ro","etapa":"site_gata"}]', 'import', 'import') ->> 'etape_pastrate')::integer = 1, 'etapa pusă de om e numărată ca păstrată');
select pg_temp.verifica((select etapa from public.prospectare_firme where nr = 3) = 'interesat', 'importul nu dă înapoi o etapă pusă de om');
select public.prospectare_upsert_firme('[{"domeniu":"robotnou.ro","nume":"Robot Nou","etapa":"email_trimis","email_la":"2026-10-30T09:40:00+02:00","link_demo":"https://x"}]', 'robot', 'robot-1');
select pg_temp.verifica((select etapa = 'cercetat' and email_la is null and link_demo is null from public.prospectare_firme where domeniu = 'robotnou.ro'), 'robotul nu poate pune etapă avansată, canal sau link prin „firme”');
select pg_temp.verifica((select nr from public.prospectare_firme where domeniu = 'robotnou.ro') = 501, 'firma nouă de la robot primește numărul următor (501)');
select public.prospectare_upsert_firme('[{"domeniu":"doi.ro","de_refacut":true}]', 'import', 'import');
select pg_temp.verifica((select de_refacut and etapa = 'site_gata' from public.prospectare_firme where nr = 2), 'de refăcut pe o firmă deja contactată: rămâne în etapa ei');
update public.prospectare_firme set link_demo = 'https://demo.test/v1/' where nr = 129;
select public.prospectare_upsert_firme('[{"domeniu":"lucru29.ro","de_refacut":true}]', 'import', 'import');
select pg_temp.verifica((select de_refacut and etapa = 'site_in_lucru' from public.prospectare_firme where nr = 129), 'de refăcut pe un site gata necontactat: se întoarce în lucru (nu pleacă pe v1)');
select pg_temp.verifica((public.prospectare_import_activitate('[{"nr":500,"tip":"email","canal":"email","detalii":{"casuta":"a@b.ro"},"cheie":"import:email:x1","la":"2026-10-30T09:40:00+02:00"}]', 'import') ->> 'noi')::integer = 1, 'activitate importată');
select pg_temp.verifica((public.prospectare_import_activitate('[{"nr":500,"tip":"email","canal":"email","detalii":{},"cheie":"import:email:x1"}]', 'import') ->> 'existente')::integer = 1, 'activitatea importată nu se dublează');

-- WhatsApp după „Interesat” (migrarea 32): excepția acceptată pe telefon -------------
insert into public.prospectare_firme (nr, nume, domeniu, telefon, etapa, link_demo, telefon_la) values
  (600, 'Firma Șase', 'sase.ro', '0745 666 666', 'site_gata', 'https://demo.test/sase/', now());
insert into public.prospectare_liste_zi (utilizator, canal, firma_id) select 'stefan', 'telefon', id from public.prospectare_firme where nr = 600;
select pg_temp.asteapta_eroare($$select public.prospectare_continua_pe_whatsapp((select l.id from public.prospectare_liste_zi l join public.prospectare_firme f on f.id = l.firma_id where f.nr = 600))$$, 'PR409', 'WhatsApp după apel: refuzat înainte de „Interesat”');
select public.prospectare_seteaza_rezultat((select l.id from public.prospectare_liste_zi l join public.prospectare_firme f on f.id = l.firma_id where f.nr = 600), 'interesat');
select pg_temp.verifica(not (public.prospectare_continua_pe_whatsapp((select l.id from public.prospectare_liste_zi l join public.prospectare_firme f on f.id = l.firma_id where f.nr = 600), 'Ștefan') ->> 'deja')::boolean, 'după „Interesat”: continuarea pe WhatsApp se scrie');
select pg_temp.verifica((select count(*) = 1 and bool_and(a.canal = 'telefon' and a.autor = 'Ștefan' and (a.detalii ->> 'continuare_apel')::boolean and a.detalii ->> 'text' = 'Continuare apel pe WhatsApp')
  from public.prospectare_activitate a join public.prospectare_firme f on f.id = a.firma_id where f.nr = 600 and a.tip = 'whatsapp'), 'activitate: „Continuare apel pe WhatsApp”, pe telefon');
select pg_temp.verifica((public.prospectare_continua_pe_whatsapp((select l.id from public.prospectare_liste_zi l join public.prospectare_firme f on f.id = l.firma_id where f.nr = 600)) ->> 'deja')::boolean, 'a doua deschidere: „deja”');
select pg_temp.verifica((select count(*) from public.prospectare_activitate a join public.prospectare_firme f on f.id = a.firma_id where f.nr = 600 and a.tip = 'whatsapp') = 1, 'a doua deschidere nu dublează activitatea');
select pg_temp.verifica((select telefon_la is not null and whatsapp_la is null and etapa = 'interesat' from public.prospectare_firme where nr = 600), 'firma rămâne pe telefon (fără whatsapp_la), etapa Interesat');
select pg_temp.asteapta_eroare($$select public.prospectare_continua_pe_whatsapp((select l.id from public.prospectare_liste_zi l join public.prospectare_firme f on f.id = l.firma_id where f.nr = 3))$$, 'PR422', 'WhatsApp după apel: refuzat la număr fix');
set role authenticated;
select pg_temp.asteapta_eroare($$select public.prospectare_continua_pe_whatsapp(1)$$, '42501', 'adminul prin REST nu cheamă funcția (doar serverul)');
reset role;
