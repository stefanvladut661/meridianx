-- Testele distribuției pe canale (migrarea 35), pe Postgres local (nu pe producție).
-- Rulează după reguli.sql și concurenta.sh, peste baza lor: firmele vechi se scot din distribuție.
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

create or replace function pg_temp.id(p_nr integer) returns uuid language sql as $$ select id from public.prospectare_firme where nr = p_nr $$;
-- Programarea activă a unei firme: „canal:zi:cheie”, sau null.
create or replace function pg_temp.prog(p_nr integer) returns text language sql as $$
  select p.canal || ':' || (p.zi - public.prospectare_azi()) || ':' || coalesce(p.casuta, p.cont_whatsapp::text, p.utilizator)
  from public.prospectare_programari p where p.firma_id = pg_temp.id(p_nr) and p.stare = 'programata'
$$;
create or replace function pg_temp.lista(p_nr integer) returns text language sql as $$
  select coalesce(l.rezultat, 'nesunată') || ':' || (l.data - public.prospectare_azi())
  from public.prospectare_liste_zi l where l.firma_id = pg_temp.id(p_nr) order by l.data desc limit 1
$$;

-- Mediul: firmele vechi ies din distribuție; căsuțe, conturi și setări cunoscute ----------
select set_config('prospectare.autor', 'test', false);
update public.prospectare_firme set demo_verificat = false;
update public.prospectare_casute set activa = false;
insert into public.prospectare_casute (adresa, domeniu, limita_zi, activa) values
  ('stefan@alfa.test', 'alfa.test', 2, true),
  ('stefan@beta.test', 'beta.test', null, true),
  ('stefan@gama.test', 'gama.test', 5, false)
on conflict (adresa) do update set limita_zi = excluded.limita_zi, activa = excluded.activa;
update public.prospectare_conturi_whatsapp set activ = (id in (1, 2)), limita_zi = 2;
update public.prospectare_setari set email_plafon_casuta = 1, apeluri_pe_zi = 2 where id = 1;
delete from public.prospectare_cicluri;

-- Firmele (cele mai vechi site-uri primele; scorul nu contează):
insert into public.prospectare_firme (nr, nume, domeniu, scor, telefon, email, etapa, link_demo, demo_verificat, site_gata_la, lot, construit_de, date_extra, email_la) values
  (7001, 'Alfa Unu', 'a7001.ro', 10, '0745 700 001', 'o@a7001.ro', 'site_gata', 'https://demo.alfa.test/a1/', true, now() - interval '10 days', 'lot-a', 'pc-stefan', '{}', null),
  (7002, 'Alfa Doi', 'a7002.ro', 10, '0745 700 002', 'o@a7002.ro', 'site_gata', 'https://demo.alfa.test/a2/', true, now() - interval '9 days', 'lot-a', 'pc-stefan', '{}', null),
  (7003, 'Alfa Trei', 'a7003.ro', 10, '0745 700 003', 'o@a7003.ro', 'site_gata', 'https://demo.alfa.test/a3/', true, now() - interval '8 days', 'lot-a', 'pc-stefan', '{}', null),
  (7004, 'Alfa Fix', 'a7004.ro', 10, '0264 700 004', 'o@a7004.ro', 'site_gata', 'https://demo.alfa.test/a4/', true, now() - interval '7 days', 'lot-a', 'pc-stefan', '{}', null),
  (7005, 'Beta Unu', 'b7005.ro', 10, '0745 700 005', 'o@b7005.ro', 'site_gata', 'https://demo.beta.test/b5/', true, now() - interval '6 days', 'lot-b', 'claude-siteuri', '{}', null),
  (7006, 'Beta Mobil', 'b7006.ro', 10, '0745 700 006', null, 'site_gata', 'https://demo.beta.test/b6/', true, now() - interval '5 days', 'lot-b', 'claude-siteuri', '{}', null),
  (7007, 'Gama Mobil', 'g7007.ro', 10, '0745 700 007', null, 'site_gata', 'https://demo.gama.test/g7/', true, now() - interval '4 days', 'lot-b', 'claude-siteuri', '{}', null),
  (7008, 'Doar WhatsApp', 'a7008.ro', 10, '0745 700 008', 'o@a7008.ro', 'site_gata', 'https://demo.alfa.test/a8/', true, now() - interval '3 days', 'lot-b', 'claude-siteuri', '{"doar_whatsapp": true}', null),
  (7009, 'Email risc', 'a7009.ro', 95, '0264 700 009', 'o@a7009.ro', 'site_gata', 'https://demo.alfa.test/a9/', true, now() - interval '2 days', 'lot-b', 'claude-siteuri', '{"email_verificat": "risc"}', null),
  (7010, 'Cea mai nouă', 'a7010.ro', 99, '0745 700 010', 'o@a7010.ro', 'site_gata', 'https://demo.alfa.test/a10/', true, now() - interval '1 day', 'lot-c', 'claude-siteuri', '{}', null),
  (7011, 'Duplicat', 'a7011.ro', 10, '0745 700 011', 'o@a7011.ro', 'site_gata', 'https://demo.alfa.test/a11/', true, now() - interval '50 days', 'lot-a', 'pc-stefan', '{"duplicat_de": 7001}', null),
  (7012, 'Nepublicat', 'a7012.ro', 10, '0745 700 012', 'o@a7012.ro', 'site_gata', 'https://demo.alfa.test/a12/', false, now() - interval '50 days', 'lot-a', 'pc-stefan', '{}', null),
  (7013, 'Nu contacta', 'a7013.ro', 10, '0745 700 013', 'o@a7013.ro', 'nu_contacta', 'https://demo.alfa.test/a13/', true, now() - interval '50 days', 'lot-a', 'pc-stefan', '{}', null),
  (7014, 'Contactată', 'a7014.ro', 10, '0745 700 014', 'o@a7014.ro', 'email_trimis', 'https://demo.alfa.test/a14/', true, now() - interval '50 days', 'lot-a', 'pc-stefan', '{}', now() - interval '3 days'),
  (7015, 'Manual azi', 'b7015.ro', 10, '0745 700 015', null, 'site_gata', 'https://demo.beta.test/b15/', true, now() - interval '20 days', 'lot-b', 'claude-siteuri', '{}', null),
  (7016, 'Neplecată ieri', 'a7016.ro', 10, '0745 700 016', 'o@a7016.ro', 'site_gata', 'https://demo.alfa.test/a16/', true, now() - interval '30 days', 'lot-a', 'pc-stefan', '{}', null),
  (7017, 'Nesunată ieri', 'b7017.ro', 10, '0264 700 017', null, 'site_gata', 'https://demo.beta.test/b17/', true, now() - interval '15 days', 'lot-b', 'claude-siteuri', '{}', null),
  (7018, 'Sună înapoi', 'b7018.ro', 10, '0264 700 018', null, 'site_gata', 'https://demo.beta.test/b18/', true, now() - interval '14 days', 'lot-b', 'claude-siteuri', '{}', null);

select pg_temp.verifica((select count(*) = 0 from public.prospectare_firme where nr in (7011, 7012, 7013, 7014)
  and (public.prospectare_poate_canal(prospectare_firme, 'email') or public.prospectare_poate_canal(prospectare_firme, 'whatsapp') or public.prospectare_poate_canal(prospectare_firme, 'telefon'))),
  'în distribuție nu intră: duplicatul, site-ul nepublicat, „Nu contacta”, firma contactată');
select pg_temp.verifica((select public.prospectare_motiv_canal(f, 'email') = 'duplicat al #7001' from public.prospectare_firme f where nr = 7011), 'motivul se spune: duplicat al #7001');
select pg_temp.verifica((select public.prospectare_motiv_canal(f, 'email') like 'linkul demo nu e verificat%' from public.prospectare_firme f where nr = 7012), 'motivul se spune: linkul demo neverificat');
select pg_temp.verifica((select not public.prospectare_poate_canal(f, 'email') and public.prospectare_poate_canal(f, 'whatsapp') from public.prospectare_firme f where nr = 7008), '„doar WhatsApp” (sub prag): nu pe email, da pe WhatsApp');
select pg_temp.verifica((select not public.prospectare_poate_canal(f, 'email') and public.prospectare_poate_canal(f, 'telefon') from public.prospectare_firme f where nr = 7009), 'email „risc”: nu pe email, da pe telefon');

-- Ziua de ieri: o programare neplecată, un apel nesunat, un „Sună înapoi”; o manuală pentru azi.
insert into public.prospectare_programari (firma_id, canal, zi, sursa, casuta, creat_de) values (pg_temp.id(7016), 'email', public.prospectare_azi() - 1, 'automat', 'stefan@alfa.test', 'test');
insert into public.prospectare_programari (firma_id, canal, zi, sursa, cont_whatsapp, creat_de) values (pg_temp.id(7015), 'whatsapp', public.prospectare_azi(), 'manual', 2, 'test');
update public.prospectare_firme set telefon_la = now() - interval '1 day' where nr in (7017, 7018);
insert into public.prospectare_liste_zi (data, utilizator, canal, firma_id) values
  (public.prospectare_azi() - 1, 'stefan', 'telefon', pg_temp.id(7017)),
  (public.prospectare_azi() - 1, 'vladut', 'telefon', pg_temp.id(7018));
update public.prospectare_liste_zi set rezultat = 'suna_inapoi', suna_inapoi_la = now() + interval '1 hour' where firma_id = pg_temp.id(7018);

-- Ciclul de la 00:00 ----------------------------------------------------------------------
select pg_temp.verifica((public.prospectare_ciclu_zi(public.prospectare_azi()) -> 'eliberate') = '{"email": 1, "whatsapp": 0, "telefon": 1}'::jsonb,
  '00:00 a) se eliberează emailul neplecat de ieri și apelul nesunat');
select pg_temp.verifica((select telefon_la is null from public.prospectare_firme where nr = 7017) and pg_temp.lista(7017) is null,
  'apelul nesunat: firma își pierde telefonul și iese din listă');
select pg_temp.verifica(pg_temp.lista(7018) = 'suna_inapoi:0' and (select telefon_la is not null from public.prospectare_firme where nr = 7018),
  '„Sună înapoi” rămâne pe telefon și trece în lista de azi');
select pg_temp.verifica((select stare = 'eliberata' from public.prospectare_programari where firma_id = pg_temp.id(7016) and zi < public.prospectare_azi()),
  'programarea de ieri e „eliberată”');
select pg_temp.verifica(pg_temp.prog(7016) = 'email:0:stefan@alfa.test' and pg_temp.prog(7001) = 'email:0:stefan@alfa.test' and pg_temp.prog(7005) = 'email:0:stefan@beta.test',
  'b) email: cele mai vechi, pe căsuța domeniului (alfa: 2, beta: plafonul de 1); cea eliberată ieri e prima azi');
select pg_temp.verifica(pg_temp.prog(7004) is null and pg_temp.prog(7009) is null and pg_temp.prog(7008) is null,
  'email: fără loc (#7004), email risc (#7009) și „doar WhatsApp” (#7008) nu intră pe email');
select pg_temp.verifica(pg_temp.prog(7015) = 'whatsapp:0:2', 'manuala de azi (contul 2) are prioritate');
select pg_temp.verifica(pg_temp.prog(7002) = 'whatsapp:0:1' and pg_temp.prog(7003) = 'whatsapp:0:1' and pg_temp.prog(7006) = 'whatsapp:0:2',
  'c) WhatsApp: următoarele cu mobil (și cele cu email care n-au încăput: #7002, #7003), egal pe conturi (2 + 2)');
select pg_temp.verifica(pg_temp.prog(7004) is null, 'cu email, fără mobil, n-a încăput: rămâne pentru email în zilele următoare');
select pg_temp.verifica(pg_temp.prog(7010) is null and pg_temp.prog(7007) is null, 'd) restul (inclusiv scorul 99, cel mai nou site) rămâne în rezervă; apelurile nu se programează');
select pg_temp.verifica((select (rezultat ->> 'rezerva')::integer = 6 and rezultat -> 'programate' = '{"email": {"manual": 0, "automat": 3}, "telefon": {"manual": 0}, "whatsapp": {"manual": 1, "automat": 3}}'::jsonb
  from public.prospectare_cicluri where zi = public.prospectare_azi()), 'ciclul e notat: 3 email, 1+3 WhatsApp, 6 în rezervă');
select pg_temp.verifica((public.prospectare_asigura_ciclu() ->> 'rulat_la') = (select rezultat ->> 'rulat_la' from public.prospectare_cicluri where zi = public.prospectare_azi())
  and (select count(*) from public.prospectare_programari where zi = public.prospectare_azi()) = 7, 'a doua rulare în aceeași zi nu mai programează nimic');

-- Email: coada robotului și cererea canalului -----------------------------------------------
insert into public.prospectare_dispozitive (nume, proprietar, token_hash) values ('robot-email', 'test', encode(sha256('robot-email'::bytea), 'hex')) on conflict do nothing;
select pg_temp.verifica((select jsonb_array_length(public.prospectare_coada_email((select id from public.prospectare_dispozitive where nume = 'robot-email')) -> 'firme')) = 3,
  '/coada-email: cele 3 programate azi');
select pg_temp.verifica((select jsonb_array_length(public.prospectare_coada_email(null, 'Stefan@Alfa.test') -> 'firme')) = 2, '/coada-email pe o căsuță: doar ale ei');
select pg_temp.asteapta_eroare($$select public.prospectare_email_cere_canal((select id from public.prospectare_dispozitive where nume = 'robot-email'), 'a7001.ro', null, 'stefan@beta.test')$$, 'PR409', 'cererea de pe altă căsuță decât cea programată → 409');
select pg_temp.verifica((public.prospectare_email_cere_canal((select id from public.prospectare_dispozitive where nume = 'robot-email'), 'a7001.ro', null, 'stefan@alfa.test') ->> 'trimite')::boolean, 'cererea de pe căsuța programată: trimite');
select pg_temp.verifica((select stare = 'folosita' from public.prospectare_programari where firma_id = pg_temp.id(7001) and zi = public.prospectare_azi()) and pg_temp.prog(7001) is null, 'programarea s-a folosit');
select pg_temp.asteapta_eroare($$select public.prospectare_email_cere_canal((select id from public.prospectare_dispozitive where nume = 'robot-email'), 'a7001.ro', null, 'stefan@alfa.test')$$, 'PR409', 'a doua cerere pentru aceeași firmă → 409');
select pg_temp.asteapta_eroare($$select public.prospectare_email_cere_canal((select id from public.prospectare_dispozitive where nume = 'robot-email'), 'a7002.ro', null, 'stefan@alfa.test')$$, 'PR409', 'firma programată pe WhatsApp: emailul e refuzat (409)');
select pg_temp.asteapta_eroare($$select public.prospectare_email_cere_canal((select id from public.prospectare_dispozitive where nume = 'robot-email'), 'a7004.ro', null, 'stefan@alfa.test')$$, 'PR409', 'firma neprogramată azi: emailul e refuzat (409)');

-- WhatsApp: trimiterea și „Anulează” --------------------------------------------------------
create temp table wa_7002 as select public.prospectare_whatsapp_trimis(pg_temp.id(7002), null, 'Ștefan') as r;
select pg_temp.verifica((select (r ->> 'cont')::integer = 1 and (r ->> 'trimise_azi')::integer = (select count(*) from public.prospectare_firme where whatsapp_cont = 1 and whatsapp_la >= public.prospectare_inceput_azi())
  from wa_7002), 'WhatsApp trimis de pe contul programat (1): contorul contului îl numără');
select pg_temp.verifica((select whatsapp_la is not null and whatsapp_cont = 1 and etapa = 'whatsapp_trimis' from public.prospectare_firme where nr = 7002), 'firma: data, contul, etapa WhatsApp trimis');
select pg_temp.verifica((public.prospectare_whatsapp_anuleaza(pg_temp.id(7002), 'Ștefan') ->> 'reprogramata')::boolean, 'Anulează: în primele minute merge');
select pg_temp.verifica((select whatsapp_la is null and whatsapp_cont is null and etapa = 'site_gata' from public.prospectare_firme where nr = 7002) and pg_temp.prog(7002) = 'whatsapp:0:1',
  'după anulare: firma n-are WhatsApp, etapa înapoi, programarea e din nou în lista de azi');
select pg_temp.verifica((select count(*) = 1 from public.prospectare_activitate a where a.firma_id = pg_temp.id(7002) and a.tip = 'whatsapp' and (a.detalii ->> 'anulat')::boolean),
  'anularea e scrisă în activitate');
select pg_temp.asteapta_eroare($$select public.prospectare_whatsapp_anuleaza(pg_temp.id(7002), 'Ștefan')$$, 'PR409', 'a doua anulare: nimic de anulat');
select pg_temp.verifica((public.prospectare_whatsapp_trimis(pg_temp.id(7002), 2::smallint, 'Vlăduț') ->> 'cont')::integer = 2, 'trimis din nou, de pe alt cont (2)');
insert into public.prospectare_firme (nr, nume, domeniu, telefon, etapa, link_demo, demo_verificat, whatsapp_la, whatsapp_cont) values
  (7030, 'Trimisă demult', 'v7030.ro', '0745 703 030', 'whatsapp_trimis', 'https://demo.beta.test/v30/', true, now() - interval '5 minutes', 1);
select pg_temp.asteapta_eroare($$select public.prospectare_whatsapp_anuleaza(pg_temp.id(7030), 'Ștefan')$$, 'PR409', 'Anulează după 2 minute: refuzat');
select pg_temp.asteapta_eroare($$select public.prospectare_whatsapp_trimis(pg_temp.id(7010), null, 'Ștefan')$$, 'PR409', 'WhatsApp pentru o firmă neprogramată azi → 409');
select pg_temp.asteapta_eroare($$select public.prospectare_whatsapp_trimis(pg_temp.id(7004), null, 'Ștefan')$$, 'PR422', 'WhatsApp pentru un număr fix → 422');

-- Programarea manuală: limita zilei, zilele următoare, două canale, anularea ------------------
insert into public.prospectare_firme (nr, nume, domeniu, email, etapa, link_demo, demo_verificat, site_gata_la, lot) values
  (7020, 'Manual 1', 'm7020.ro', 'o@m7020.ro', 'site_gata', 'https://demo.alfa.test/m20/', true, now() - interval '40 days', 'lot-m'),
  (7021, 'Manual 2', 'm7021.ro', 'o@m7021.ro', 'site_gata', 'https://demo.alfa.test/m21/', true, now() - interval '39 days', 'lot-m'),
  (7022, 'Manual 3', 'm7022.ro', 'o@m7022.ro', 'site_gata', 'https://demo.alfa.test/m22/', true, now() - interval '38 days', 'lot-m'),
  (7023, 'Manual 4', 'm7023.ro', 'o@m7023.ro', 'site_gata', 'https://demo.alfa.test/m23/', true, now() - interval '37 days', 'lot-m'),
  (7024, 'Manual 5', 'm7024.ro', 'o@m7024.ro', 'site_gata', 'https://demo.alfa.test/m24/', true, now() - interval '36 days', 'lot-m');
select pg_temp.verifica((public.prospectare_programabile('email', '{"lot":"lot-m"}') ->> 'total')::integer = 5
  and (public.prospectare_programabile('email', '{"lot":"lot-m"}') -> 'firme' -> 0 ->> 'nr')::integer = 7020, 'filtrul pe lot: 5 firme, cea mai veche prima');
select pg_temp.asteapta_eroare($$select public.prospectare_programeaza('email', public.prospectare_azi(), array[pg_temp.id(7020)], null, null, 'Ștefan')$$, 'PR422', 'programarea pentru azi: refuzată (cel mai devreme mâine)');
select pg_temp.asteapta_eroare($$select public.prospectare_programeaza('email', public.prospectare_azi() + 61, array[pg_temp.id(7020)], null, null, 'Ștefan')$$, 'PR422', 'programarea peste 60 de zile: refuzată');
select pg_temp.verifica((select r ->> 'mutate' = '3' and r -> 'pe_zile' = jsonb_build_object((public.prospectare_azi() + 1)::text, 2, (public.prospectare_azi() + 2)::text, 2, (public.prospectare_azi() + 3)::text, 1)
    and r ->> 'avertisment' like '3 firme nu încap în limita zilei%'
  from public.prospectare_programeaza('email', public.prospectare_azi() + 1,
    array[pg_temp.id(7020), pg_temp.id(7021), pg_temp.id(7022), pg_temp.id(7023), pg_temp.id(7024)], null, null, 'Ștefan') r),
  'peste limita căsuței (2/zi): 2 mâine, 2 poimâine, 1 a treia zi, cu avertisment');
select pg_temp.verifica((select zi_ceruta = public.prospectare_azi() + 1 from public.prospectare_programari where firma_id = pg_temp.id(7024) and stare = 'programata'), 'cea mutată ține minte ziua cerută');
select pg_temp.verifica((select count(*) = 5 from public.prospectare_activitate where tip = 'programare' and firma_id in (pg_temp.id(7020), pg_temp.id(7021), pg_temp.id(7022), pg_temp.id(7023), pg_temp.id(7024))),
  'fiecare programare manuală e în activitate');
select pg_temp.verifica((public.prospectare_programeaza('whatsapp', public.prospectare_azi() + 1, array[pg_temp.id(7010)], 1::smallint, null, 'Vlăduț') ->> 'programate')::integer = 1,
  'WhatsApp mâine, pe contul 1');
select pg_temp.verifica((select r -> 'refuzate' -> 0 ->> 'motiv' like 'e deja programată pe WhatsApp%' and (r ->> 'programate')::integer = 0
  from public.prospectare_programeaza('email', public.prospectare_azi() + 1, array[pg_temp.id(7010)], null, null, 'Ștefan') r), 'aceeași firmă pe al doilea canal: refuzată');
select pg_temp.asteapta_eroare($$update public.prospectare_firme set email_la = now() where nr = 7010$$, 'PR409', 'programată pe WhatsApp: emailul nu se poate pune nici direct');
select pg_temp.verifica((select r -> 'refuzate' -> 0 ->> 'motiv' = 'fără număr de mobil'
  from public.prospectare_programeaza('whatsapp', public.prospectare_azi() + 1, array[pg_temp.id(7009)], null, null, 'Ștefan') r), 'WhatsApp pentru un număr fix: refuzat, cu motivul');
select pg_temp.asteapta_eroare($$select public.prospectare_programeaza('telefon', public.prospectare_azi() + 1, array[pg_temp.id(7009)], null, null, 'Ștefan')$$, 'PR422', 'apelurile programate cer omul care sună');
select pg_temp.verifica((select (r ->> 'programate')::integer = 1 from public.prospectare_programeaza('telefon', public.prospectare_azi() + 1, array[pg_temp.id(7009)], null, 'vladut', 'Vlăduț') r)
  and pg_temp.prog(7009) = 'telefon:1:vladut', 'apel programat mâine, pentru Vlăduț');
select pg_temp.verifica((public.prospectare_anuleaza_programari(array(select id from public.prospectare_programari where firma_id in (pg_temp.id(7020), pg_temp.id(7021)) and stare = 'programata'), 'Ștefan') ->> 'anulate')::integer = 2,
  'anularea: cele de mâine se anulează');
select pg_temp.verifica((public.prospectare_anuleaza_programari(array(select id from public.prospectare_programari where firma_id = pg_temp.id(7016) and stare = 'programata'), 'Ștefan') ->> 'refuzate')::integer = 1,
  'anularea: cele de azi nu se mai anulează');

-- Apeluri ------------------------------------------------------------------------------------
select pg_temp.verifica((public.prospectare_importa_lista_zi('stefan', 'telefon', 2, '{}'::jsonb, null, 'Ștefan') ->> 'adaugate')::integer = 2
  and pg_temp.lista(7017) = 'nesunată:0' and pg_temp.lista(7004) = 'nesunată:0', 'importul în „Apeluri azi”: cele mai vechi site-uri (#7017, #7004), nu scorul cel mai mare');
select pg_temp.verifica(pg_temp.lista(7009) is null and pg_temp.lista(7015) is null, 'firmele programate (apel mâine, WhatsApp azi) nu intră în lista de azi');
select pg_temp.verifica((select r -> 'refuzate' -> 0 ->> 'motiv' = 'e în lista de apeluri (până la 00:00)'
  from public.prospectare_programeaza('email', public.prospectare_azi() + 1, array[pg_temp.id(7004)], null, null, 'Ștefan') r), 'în „Apeluri azi”: blocată pentru celelalte canale până la 00:00');
create temp table rez_1 as select public.prospectare_seteaza_rezultat((select id from public.prospectare_liste_zi where firma_id = pg_temp.id(7017) and data = public.prospectare_azi()), 'nu_raspunde') as r;
select pg_temp.verifica((select (r ->> 'revenit')::boolean from rez_1)
  and (select telefon_la is null and apel_incercari = 1 and etapa = 'site_gata' from public.prospectare_firme where nr = 7017)
  and pg_temp.lista(7017) = 'nu_raspunde:0', '„Nu răspunde”: nu e contact; firma se întoarce în distribuție, încercarea rămâne notată');
create temp table rez_2 as select public.prospectare_seteaza_rezultat((select id from public.prospectare_liste_zi where firma_id = pg_temp.id(7017) and data = public.prospectare_azi()), 'nu_raspunde') as r;
select pg_temp.verifica((select (r ->> 'incercari')::integer = 2 from rez_2)
  and (select apel_incercari = 2 from public.prospectare_firme where nr = 7017), 'a doua încercare se numără');
create temp table rez_3 as select public.prospectare_seteaza_rezultat((select id from public.prospectare_liste_zi where firma_id = pg_temp.id(7004) and data = public.prospectare_azi()), 'numar_gresit') as r;
select pg_temp.verifica((select (r ->> 'doar_email')::boolean from rez_3)
  and (select telefon_gresit and telefon_la is null from public.prospectare_firme where nr = 7004)
  and (select public.prospectare_poate_canal(f, 'email') and not public.prospectare_poate_canal(f, 'whatsapp') and not public.prospectare_poate_canal(f, 'telefon') from public.prospectare_firme f where nr = 7004),
  '„Număr greșit”: doar email de acum');
select pg_temp.asteapta_eroare($$update public.prospectare_firme set telefon_la = now() where nr = 7004$$, 'PR409', 'număr greșit: telefonul nu se mai pune');
select public.prospectare_importa_lista_zi('vladut', 'telefon', 3, '{}'::jsonb, null, 'Vlăduț');
select pg_temp.verifica(pg_temp.lista(7007) = 'nesunată:0' and pg_temp.lista(7008) = 'nesunată:0' and pg_temp.lista(7024) is null, 'al doilea import: următoarele din rezervă');
select public.prospectare_seteaza_rezultat((select id from public.prospectare_liste_zi where firma_id = pg_temp.id(7007) and data = public.prospectare_azi()), 'nu_vrea');
select pg_temp.verifica((select etapa from public.prospectare_firme where nr = 7007) = 'nu_contacta', '„Nu vrea” → „Nu contacta”');
select public.prospectare_seteaza_rezultat((select id from public.prospectare_liste_zi where firma_id = pg_temp.id(7008) and data = public.prospectare_azi()), 'interesat');
select pg_temp.verifica((select etapa = 'interesat' and telefon_la is not null from public.prospectare_firme where nr = 7008), '„Interesat” rămâne pe telefon');

-- „Nu contacta” anulează programarea activă
select public.prospectare_schimba_etapa(pg_temp.id(7010), 'nu_contacta', 'Ștefan', 'A cerut');
select pg_temp.verifica(pg_temp.prog(7010) is null and (select stare = 'anulata' from public.prospectare_programari where firma_id = pg_temp.id(7010) order by id desc limit 1),
  '„Nu contacta” anulează programarea de mâine');

-- A doua zi la 00:00 (ciclul de mâine) --------------------------------------------------------
-- Nesunatele de azi (și cele lăsate de proba de concurență a apelurilor) se eliberează toate.
create temp table nesunate as select count(*)::integer as n from public.prospectare_liste_zi where data <= public.prospectare_azi() and rezultat is null and canal = 'telefon';
create temp table ciclu_maine as select public.prospectare_ciclu_zi(public.prospectare_azi() + 1) as r;
select pg_temp.verifica((select r -> 'eliberate' = jsonb_build_object('email', 2, 'whatsapp', 3, 'telefon', (select n from nesunate)) from ciclu_maine),
  'mâine la 00:00: 2 emailuri și 3 WhatsApp neplecate se întorc, plus toate apelurile nesunate');
select pg_temp.verifica(not exists (select 1 from public.prospectare_liste_zi where data <= public.prospectare_azi() and rezultat is null), 'nicio firmă nesunată nu rămâne blocată pe telefon');
select pg_temp.verifica(pg_temp.prog(7022) = 'email:2:stefan@alfa.test' and pg_temp.prog(7023) = 'email:2:stefan@alfa.test' and pg_temp.prog(7024) = 'email:3:stefan@alfa.test',
  'manualele de poimâine și răspoimâine rămân pe zilele lor');
select pg_temp.verifica(pg_temp.prog(7020) = 'email:1:stefan@alfa.test' and pg_temp.prog(7021) = 'email:1:stefan@alfa.test'
  and (select count(*) = 2 from public.prospectare_programari where zi = public.prospectare_azi() + 1 and canal = 'email' and casuta = 'stefan@alfa.test' and stare = 'programata'),
  'mâine, căsuța alfa se umple automat cu cele mai vechi (#7020, #7021: anulate din manual, s-au întors în rezervă)');
select pg_temp.verifica(pg_temp.prog(7016) = 'whatsapp:1:1', 'emailul neplecat (#7016) nu mai încape mâine pe alfa: are mobil, merge pe WhatsApp');
select pg_temp.verifica(pg_temp.lista(7009) = 'nesunată:1' and (select telefon_la is not null from public.prospectare_firme where nr = 7009),
  'apelul programat pentru Vlăduț intră în lista lui de mâine');
select pg_temp.verifica(pg_temp.lista(7008) = 'interesat:0', '„Interesat” nu se mută și nu se eliberează');

-- Importul și robotul --------------------------------------------------------------------------
select public.prospectare_upsert_firme('[{"domeniu":"import7040.ro","nr":7040,"nume":"Import","etapa":"site_gata","link_demo":"https://demo.alfa.test/i40/","demo_verificat":true,"site_gata_la":"2026-10-29T19:42:00+02:00","construit_de":"pc-stefan","lot":"lot-i"}]', 'import', 'import');
select pg_temp.verifica((select demo_verificat and construit_de = 'pc-stefan' and site_gata_la = '2026-10-29T19:42:00+02:00'::timestamptz from public.prospectare_firme where nr = 7040),
  'importul aduce data site-ului gata, cine l-a construit, linkul verificat');
select public.prospectare_upsert_firme('[{"domeniu":"import7040.ro","demo_verificat":false}]', 'import', 'import');
select pg_temp.verifica((select not demo_verificat from public.prospectare_firme where nr = 7040), 'importul poate scoate linkul din „verificat”');
select public.prospectare_upsert_firme('[{"domeniu":"a7004.ro","telefon":"0745 700 444"}]', 'import', 'import');
select pg_temp.verifica((select not telefon_gresit from public.prospectare_firme where nr = 7004), 'număr nou: „număr greșit” nu mai e valabil');
select public.prospectare_upsert_firme('[{"domeniu":"robot7041.ro","nr":7041,"nume":"De la robot","site_gata_la":"2026-10-29T19:42:00+02:00","demo_verificat":true}]', 'robot', 'robot-email');
select pg_temp.verifica((select site_gata_la is null and not demo_verificat from public.prospectare_firme where nr = 7041), 'robotul nu pune data site-ului sau linkul verificat prin „firme” (le pune „termina”)');
update public.prospectare_firme set etapa = 'site_in_lucru' where nr = 7041;
insert into public.prospectare_rezervari (firma_id, dispozitiv_id, tip_lucru, expira_la) values (pg_temp.id(7041), (select id from public.prospectare_dispozitive where nume = 'robot-email'), 'construire', now() + interval '1 hour');
select public.prospectare_termina((select id from public.prospectare_dispozitive where nume = 'robot-email'), pg_temp.id(7041), 'https://demo.beta.test/r41/');
select pg_temp.verifica((select etapa = 'site_gata' and site_gata_la is not null and construit_de = 'robot-email' and demo_verificat from public.prospectare_firme where nr = 7041),
  'termina: site gata acum, construit de robotul care l-a terminat, link verificat');

-- Rezumatul -------------------------------------------------------------------------------
select pg_temp.verifica((select (r -> 'rezerva' ->> 'total')::integer = (select count(*) from public.prospectare_firme x
    where (public.prospectare_poate_canal(x, 'email') or public.prospectare_poate_canal(x, 'whatsapp')
      or (public.prospectare_poate_canal(x, 'telefon') and not exists (select 1 from public.prospectare_liste_zi l where l.firma_id = x.id and l.data = public.prospectare_azi())))
      and not exists (select 1 from public.prospectare_programari p where p.firma_id = x.id and p.stare = 'programata'))
  and (r -> 'programate_azi' ->> 'whatsapp')::integer = 1 and (r -> 'capacitate' ->> 'email')::integer = 3 and (r -> 'capacitate' ->> 'whatsapp')::integer = 4
  from public.prospectare_rezumat_distributie() r), 'rezumatul: rezerva, programatele de azi, capacitatea');
