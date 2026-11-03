-- MERIDIAN Prospectare, migrarea 37: numărul de site, tabelul Firme, evaluările respinse cu evidență minimă
-- și /termina pentru orice firmă publicată.
--
-- 1. Numărul de site (`nr_site`): crescător, fără goluri, dat de bază o singură dată, când site-ul firmei
--    e terminat și publicat (link demo verificat). Separat de numărul de cercetare (`nr`). Contorul e un
--    rând blocat până la sfârșitul tranzacției: doi roboți care termină deodată primesc numere diferite,
--    iar o tranzacție anulată își anulează și numărul. Site-urile deja publicate se numerotează retroactiv,
--    după data terminării (cel mai vechi = 1).
-- 2. Tabelul Firme: `grupa_tabel` (1 = cu site, necontactată; 2 = cu site, contactată sau închisă;
--    3 = fără site; 0 = respinsă la evaluare, nu apare). Coada de email, lista de WhatsApp și completarea
--    zilei pleacă de la cel mai mic `nr_site`.
-- 3. Firmele cercetate și respinse (scor sub prag, oprite la cercetare): rămân doar domeniul, numele, nișa,
--    scorul, motivul, data și calculatorul. Nu apar în tabel; /evaluare „verifica” le întoarce ca evaluate.
-- 4. /termina: orice firmă publicată de robot (nu doar cea rezervată), una sau mai multe odată; întoarce `nr_site`.
--
-- Se poate rula de mai multe ori. Cere migrările 28–36.

-- 1. Coloanele și contorul -------------------------------------------------------------------

alter table public.prospectare_firme add column if not exists nr_site integer;
alter table public.prospectare_firme add column if not exists evaluat_de text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prospectare_firme_nr_site_pozitiv') then
    alter table public.prospectare_firme add constraint prospectare_firme_nr_site_pozitiv check (nr_site is null or nr_site > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prospectare_firme_evaluat_de') then
    alter table public.prospectare_firme add constraint prospectare_firme_evaluat_de check (evaluat_de is null or char_length(evaluat_de) <= 200);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prospectare_firme' and column_name = 'grupa_tabel') then
    alter table public.prospectare_firme add column grupa_tabel smallint generated always as (
      case
        when nr_site is not null then
          case when email_la is null and whatsapp_la is null and telefon_la is null and etapa not in ('nu_contacta', 'respins') then 1 else 2 end
        when evaluare = 'respinsa' then 0
        else 3
      end) stored;
  end if;
end;
$$;

create unique index if not exists prospectare_firme_nr_site_uidx on public.prospectare_firme (nr_site);
create index if not exists prospectare_firme_tabel_idx on public.prospectare_firme (grupa_tabel, nr_site desc, nr desc);
create index if not exists prospectare_firme_de_numerotat_idx on public.prospectare_firme (site_gata_la, nr)
  where nr_site is null and link_demo is not null and demo_verificat;

-- Contoarele bazei: un rând pe contor, blocat cât ține tranzacția care îl crește.
create table if not exists public.prospectare_contoare (
  cheie text primary key check (char_length(cheie) between 1 and 60),
  valoare integer not null default 0 check (valoare >= 0),
  actualizat_la timestamptz not null default now()
);
alter table public.prospectare_contoare enable row level security;
revoke all on public.prospectare_contoare from anon, authenticated;
insert into public.prospectare_contoare (cheie, valoare) values ('nr_site', 0) on conflict (cheie) do nothing;

-- 2. Numărul de site: paza, numerotarea și triggerul de la sfârșitul tranzacției ------------------

-- Numărul de site îl dă doar baza (prospectare_numeroteaza_site), o singură dată, și nu se mai schimbă.
-- Rulează după prospectare_firme_reguli (ordinea alfabetică a triggerelor).
create or replace function public.prospectare_firme_nr_site_paza()
returns trigger
language plpgsql
as $$
declare
  v_da boolean := coalesce(current_setting('prospectare.da_nr_site', true), '') = 'da';
begin
  if tg_op = 'UPDATE' and old.nr_site is not null then
    if new.nr_site is distinct from old.nr_site then
      raise exception 'Firma #% are numărul de site %: se dă o singură dată și nu se schimbă.', old.nr, old.nr_site using errcode = 'PR409';
    end if;
  elsif new.nr_site is not null and not v_da then
    raise exception 'Numărul de site îl dă baza, când site-ul e publicat și verificat (#%).', new.nr using errcode = 'PR422';
  end if;
  -- Numerotarea și completările din migrare nu schimbă „Actualizată”.
  if tg_op = 'UPDATE' and (v_da or coalesce(current_setting('prospectare.pastreaza_actualizat', true), '') = 'da') then
    new.actualizat_la := old.actualizat_la;
  end if;
  return new;
end;
$$;

drop trigger if exists prospectare_firme_zz_nr_site on public.prospectare_firme;
create trigger prospectare_firme_zz_nr_site
  before insert or update on public.prospectare_firme
  for each row execute function public.prospectare_firme_nr_site_paza();

-- Dă numere tuturor site-urilor publicate și verificate care n-au încă, în ordinea terminării
-- (cel mai vechi primul). Contorul se blochează primul: numerotările simultane așteaptă una după
-- alta; firmele blocate de altă tranzacție se sar (le numerotează aceea, la sfârșitul ei).
create or replace function public.prospectare_numeroteaza_site()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_urm integer;
  v_n integer := 0;
  r record;
begin
  insert into public.prospectare_contoare (cheie, valoare) values ('nr_site', 0) on conflict (cheie) do nothing;
  select valoare into v_urm from public.prospectare_contoare where cheie = 'nr_site' for update;
  v_urm := greatest(v_urm, coalesce((select max(nr_site) from public.prospectare_firme), 0));
  perform set_config('prospectare.da_nr_site', 'da', true);
  for r in
    select x.id from public.prospectare_firme x
    where x.nr_site is null and x.link_demo is not null and x.demo_verificat
    order by x.site_gata_la nulls last, x.nr
    for update of x skip locked
  loop
    v_urm := v_urm + 1;
    update public.prospectare_firme set nr_site = v_urm where id = r.id;
    v_n := v_n + 1;
  end loop;
  perform set_config('prospectare.da_nr_site', '', true);
  if v_n > 0 then
    update public.prospectare_contoare set valoare = v_urm, actualizat_la = now() where cheie = 'nr_site';
  end if;
  return v_n;
end;
$$;

-- La sfârșitul tranzacției care publică un site (import, /termina, fișa): numărul se dă atunci,
-- ca o tranzacție lungă să nu țină contorul blocat și ca mai multe site-uri din aceeași tranzacție
-- să se numeroteze în ordinea terminării.
create or replace function public.prospectare_firme_nr_site_dupa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.prospectare_firme where id = new.id and nr_site is null and link_demo is not null and demo_verificat) then
    perform public.prospectare_numeroteaza_site();
  end if;
  return null;
end;
$$;

drop trigger if exists prospectare_firme_nr_site_la_final on public.prospectare_firme;
create constraint trigger prospectare_firme_nr_site_la_final
  after insert or update of link_demo, demo_verificat on public.prospectare_firme
  deferrable initially deferred
  for each row
  when (new.nr_site is null and new.link_demo is not null and new.demo_verificat)
  execute function public.prospectare_firme_nr_site_dupa();

-- 3. Firmele de dinainte: evaluarea, evidența minimă a celor respinse, numerotarea retroactivă ----

do $$
declare
  v_prag integer := coalesce((select scor_minim_constructie from public.prospectare_setari where id = 1), 45);
begin
  perform set_config('prospectare.pastreaza_actualizat', 'da', true);
  perform set_config('prospectare.autor', 'migrarea 37', true);

  -- Construite, în lucru sau contactate: au trecut evaluarea. Cercetate cu scor peste prag: eligibile.
  update public.prospectare_firme set evaluare = 'eligibila', evaluat_la = coalesce(evaluat_la, creat_la)
    where evaluare is null and (etapa not in ('cercetat', 'nu_contacta', 'respins') or link_demo is not null);
  update public.prospectare_firme set evaluare = 'eligibila', evaluat_la = coalesce(evaluat_la, creat_la)
    where evaluare is null and etapa = 'cercetat' and scor >= v_prag;

  -- Cercetate și neatinse, cu scor sub prag sau oprite înainte de scor: respinse, cu evidența minimă
  -- (domeniul, numele, nișa, scorul, motivul, data, calculatorul).
  update public.prospectare_firme f set
      evaluare = 'respinsa',
      evaluare_motiv = coalesce(f.evaluare_motiv,
        case when f.scor is null
          then 'oprită înainte de scor' || coalesce(' (pre-scor ' || nullif(f.date_extra ->> 'prescor', '') || ')', '')
          else format('scor %s sub pragul de %s', f.scor, v_prag) end),
      evaluat_la = coalesce(f.evaluat_la, f.creat_la),
      evaluat_de = coalesce(f.evaluat_de, nullif(f.date_extra ->> 'calculator', ''), nullif(f.date_extra ->> 'evaluat_de', ''),
        nullif(f.date_extra ->> 'adaugat_de', '')),
      site_vechi = null, oras = null, judet = null, telefon = null, email = null, persoana_contact = null,
      lot = null, slug = null, captura_url = null, construit_de = null, date_extra = '{}'::jsonb
    where f.etapa = 'cercetat' and f.link_demo is null
      and f.email_la is null and f.whatsapp_la is null and f.telefon_la is null and f.canal_permis is null
      and not exists (select 1 from public.prospectare_rezervari r where r.firma_id = f.id)
      and not exists (select 1 from public.prospectare_programari p where p.firma_id = f.id and p.stare = 'programata')
      and not exists (select 1 from public.prospectare_liste_zi l where l.firma_id = f.id)
      and (f.evaluare = 'respinsa' or (f.evaluare is null and (f.scor is null or f.scor < v_prag)))
      and (f.evaluare is distinct from 'respinsa' or f.telefon is not null or f.email is not null or f.oras is not null
        or f.site_vechi is not null or f.date_extra <> '{}'::jsonb);

  -- Site-urile deja publicate și verificate: numerele, de la cel mai vechi.
  perform public.prospectare_numeroteaza_site();
  perform set_config('prospectare.pastreaza_actualizat', '', true);
end;
$$;

-- 4. Ordinea distribuției: de la cel mai mic număr de site ------------------------------------

create or replace function public.prospectare_umple_zi(p_zi date, p_autor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.prospectare_firme%rowtype;
  v_loc text;
  v_email integer := 0;
  v_wa integer := 0;
begin
  for f in
    select x.* from public.prospectare_firme x
    where public.prospectare_poate_canal_in(x, 'email', p_zi)
      and not exists (select 1 from public.prospectare_programari p where p.firma_id = x.id and p.stare = 'programata')
    order by (x.canal_permis = 'email') desc nulls last, x.nr_site nulls last, x.site_gata_la nulls last, x.nr
    for update of x skip locked
  loop
    exit when not exists (select 1 from public.prospectare_casute c where c.activa
      and public.prospectare_limita_casuta(c) - public.prospectare_ocupate('email', p_zi, c.adresa) > 0);
    v_loc := public.prospectare_loc_liber('email', p_zi, f.link_demo, null, null);
    continue when v_loc is null;
    insert into public.prospectare_programari (firma_id, canal, zi, sursa, casuta, creat_de)
      values (f.id, 'email', p_zi, 'automat', v_loc, p_autor);
    v_email := v_email + 1;
  end loop;

  -- WhatsApp: cu mobil, inclusiv cele care au primit email într-o zi de dinainte și cele cu email care n-au încăput azi.
  for f in
    select x.* from public.prospectare_firme x
    where public.prospectare_poate_canal_in(x, 'whatsapp', p_zi)
      and not exists (select 1 from public.prospectare_programari p where p.firma_id = x.id and p.stare = 'programata')
    order by (x.canal_permis = 'whatsapp') desc nulls last, x.nr_site nulls last, x.site_gata_la nulls last, x.nr
    for update of x skip locked
  loop
    v_loc := public.prospectare_loc_liber('whatsapp', p_zi, null, null, null);
    exit when v_loc is null;
    insert into public.prospectare_programari (firma_id, canal, zi, sursa, cont_whatsapp, creat_de)
      values (f.id, 'whatsapp', p_zi, 'automat', v_loc::smallint, p_autor);
    v_wa := v_wa + 1;
  end loop;

  return jsonb_build_object('email', v_email, 'whatsapp', v_wa);
end;
$$;

create or replace function public.prospectare_programabile(p_canal text, p_filtre jsonb default '{}'::jsonb, p_limit integer default 200, p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_lot text := nullif(btrim(p_filtre ->> 'lot'), '');
  v_constr text := nullif(btrim(p_filtre ->> 'construit_de'), '');
  v_nisa text := nullif(btrim(p_filtre ->> 'nisa'), '');
  v_oras text := nullif(btrim(p_filtre ->> 'oras'), '');
  v_de date := nullif(p_filtre ->> 'gata_de', '')::date;
  v_pana date := nullif(p_filtre ->> 'gata_pana', '')::date;
  v_cauta text := nullif(btrim(p_filtre ->> 'cauta'), '');
  v_total integer;
  v_firme jsonb;
begin
  if p_canal not in ('email', 'whatsapp', 'telefon') then
    raise exception 'Canal necunoscut: %.', p_canal using errcode = 'PR422';
  end if;
  with alese as (
    select x.* from public.prospectare_firme x
    where public.prospectare_poate_canal_in(x, p_canal, public.prospectare_azi() + 1)
      and not exists (select 1 from public.prospectare_programari p where p.firma_id = x.id and p.stare = 'programata')
      and (v_lot is null or x.lot = v_lot)
      and (v_constr is null or x.construit_de = v_constr)
      and (v_nisa is null or x.nisa = v_nisa)
      and (v_oras is null or x.oras = v_oras)
      and (v_de is null or (x.site_gata_la at time zone 'Europe/Bucharest')::date >= v_de)
      and (v_pana is null or (x.site_gata_la at time zone 'Europe/Bucharest')::date <= v_pana)
      and (v_cauta is null or x.nume ilike '%' || v_cauta || '%' or x.domeniu ilike '%' || v_cauta || '%')
  )
  select (select count(*) from alese),
    coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'nr', a.nr, 'nr_site', a.nr_site, 'nume', a.nume, 'domeniu', a.domeniu, 'oras', a.oras, 'nisa', a.nisa,
        'lot', a.lot, 'construit_de', a.construit_de, 'site_gata_la', a.site_gata_la, 'email', a.email, 'telefon', a.telefon,
        'este_mobil', a.este_mobil, 'link_demo', a.link_demo) order by a.nr_site nulls last, a.site_gata_la nulls last, a.nr)
      from (select * from alese order by nr_site nulls last, site_gata_la nulls last, nr limit least(greatest(coalesce(p_limit, 200), 1), 1000) offset greatest(coalesce(p_offset, 0), 0)) a), '[]'::jsonb)
    into v_total, v_firme;
  return jsonb_build_object('total', v_total, 'firme', v_firme);
end;
$$;

create or replace function public.prospectare_programeaza(
  p_canal text,
  p_zi date,
  p_firme uuid[],
  p_cont smallint default null,
  p_utilizator text default null,
  p_autor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_azi date := public.prospectare_azi();
  v_autor text := coalesce(nullif(btrim(p_autor), ''), 'admin');
  f public.prospectare_firme%rowtype;
  v_activa record;
  v_d date;
  v_loc text;
  v_programate integer := 0;
  v_mutate integer := 0;
  v_pe_zile jsonb := '{}'::jsonb;
  v_refuzate jsonb := '[]'::jsonb;
  v_motiv text;
  v_ultima date;
begin
  if p_canal not in ('email', 'whatsapp', 'telefon') then
    raise exception 'Canal necunoscut: %.', p_canal using errcode = 'PR422';
  end if;
  if p_zi is null or p_zi <= v_azi then
    raise exception 'Programarea începe cel mai devreme mâine (%).', to_char(v_azi + 1, 'DD.MM.YYYY') using errcode = 'PR422';
  end if;
  if p_zi > v_azi + 60 then
    raise exception 'Programarea merge cel mult 60 de zile înainte.' using errcode = 'PR422';
  end if;
  if p_firme is null or cardinality(p_firme) = 0 or cardinality(p_firme) > 500 then
    raise exception 'Alege între 1 și 500 de firme.' using errcode = 'PR422';
  end if;
  if p_canal = 'whatsapp' and p_cont is not null and not exists (select 1 from public.prospectare_conturi_whatsapp where id = p_cont and activ) then
    raise exception 'Contul WhatsApp % nu există sau e dezactivat în Setări.', p_cont using errcode = 'PR422';
  end if;
  if p_canal = 'telefon' and p_utilizator is distinct from 'stefan' and p_utilizator is distinct from 'vladut' then
    raise exception 'Alege cine sună: Ștefan sau Vlăduț.' using errcode = 'PR422';
  end if;
  -- Două programări simultane pe același canal nu împart aceleași locuri.
  perform pg_advisory_xact_lock(hashtext('prospectare_programeaza_' || p_canal));
  perform set_config('prospectare.autor', v_autor, true);

  for f in
    select x.* from public.prospectare_firme x where x.id = any(p_firme)
    order by x.nr_site nulls last, x.site_gata_la nulls last, x.nr
    for update of x
  loop
    select p.canal, p.zi into v_activa from public.prospectare_programari p where p.firma_id = f.id and p.stare = 'programata';
    if found then
      v_refuzate := v_refuzate || jsonb_build_object('nr', f.nr, 'nume', f.nume, 'motiv',
        format('e deja programată pe %s pentru %s', case v_activa.canal when 'email' then 'email' when 'whatsapp' then 'WhatsApp' else 'apeluri' end, to_char(v_activa.zi, 'DD.MM')));
      continue;
    end if;
    v_motiv := public.prospectare_motiv_canal_in(f, p_canal, p_zi);
    if v_motiv is not null then
      v_refuzate := v_refuzate || jsonb_build_object('nr', f.nr, 'nume', f.nume, 'motiv', v_motiv);
      continue;
    end if;
    v_d := p_zi;
    v_loc := null;
    while v_d <= p_zi + 60 loop
      v_loc := public.prospectare_loc_liber(p_canal, v_d, f.link_demo, p_cont, p_utilizator);
      exit when v_loc is not null;
      -- O căsuță fără loc deloc (inactivă sau plafon 0) nu se umple nici mai târziu.
      if p_canal = 'email' and not exists (select 1 from public.prospectare_casute c where c.activa
          and public.prospectare_casuta_potrivita(f.link_demo, c) and public.prospectare_limita_casuta(c) > 0) then
        exit;
      end if;
      v_d := v_d + 1;
    end loop;
    if v_loc is null then
      v_refuzate := v_refuzate || jsonb_build_object('nr', f.nr, 'nume', f.nume, 'motiv',
        case when p_canal = 'email' then format('nicio căsuță activă, cu loc, pentru domeniul linkului (%s)', public.prospectare_domeniu(f.link_demo))
             else 'nu e loc în următoarele 60 de zile' end);
      continue;
    end if;
    insert into public.prospectare_programari (firma_id, canal, zi, sursa, casuta, cont_whatsapp, utilizator, zi_ceruta, creat_de, motiv)
    values (f.id, p_canal, v_d, 'manual',
      case when p_canal = 'email' then v_loc end,
      case when p_canal = 'whatsapp' then v_loc::smallint end,
      case when p_canal = 'telefon' then v_loc end,
      case when v_d > p_zi then p_zi end,
      v_autor,
      case when v_d > p_zi then format('ziua de %s era plină: trecută pe %s', to_char(p_zi, 'DD.MM'), to_char(v_d, 'DD.MM')) end);
    perform public.prospectare_noteaza(f.id, 'programare', p_canal,
      jsonb_strip_nulls(jsonb_build_object('canal', p_canal, 'zi', v_d, 'zi_ceruta', case when v_d > p_zi then p_zi end, 'sursa', 'manual',
        'casuta', case when p_canal = 'email' then v_loc end, 'cont', case when p_canal = 'whatsapp' then v_loc::integer end,
        'utilizator', case when p_canal = 'telefon' then v_loc end)));
    v_programate := v_programate + 1;
    if v_d > p_zi then v_mutate := v_mutate + 1; end if;
    v_pe_zile := jsonb_set(v_pe_zile, array[v_d::text], to_jsonb(coalesce((v_pe_zile ->> v_d::text)::integer, 0) + 1));
    v_ultima := greatest(coalesce(v_ultima, v_d), v_d);
  end loop;

  return jsonb_build_object(
    'programate', v_programate,
    'pe_zile', v_pe_zile,
    'mutate', v_mutate,
    'ultima_zi', v_ultima,
    'refuzate', v_refuzate,
    'avertisment', case when v_mutate > 0 then
      format('%s %s nu încap în limita zilei de %s: %s pe zilele următoare, până pe %s.', v_mutate,
        case when v_mutate = 1 then 'firmă' else 'firme' end, to_char(p_zi, 'DD.MM'),
        case when v_mutate = 1 then 'trece' else 'trec' end, to_char(v_ultima, 'DD.MM')) end
  );
end;
$$;

create or replace function public.prospectare_coada_email(p_dispozitiv uuid, p_casuta text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zi date;
  v_cas text := nullif(lower(btrim(coalesce(p_casuta, ''))), '');
begin
  perform public.prospectare_asigura_ciclu();
  v_zi := public.prospectare_azi();
  if p_dispozitiv is not null then
    perform public.prospectare_robot_ce_face(p_dispozitiv, 'trimitere', coalesce('coada de email: ' || v_cas, 'coada de email'));
  end if;
  return jsonb_build_object(
    'zi', v_zi,
    'firme', coalesce((
      select jsonb_agg(jsonb_build_object('programare_id', p.id, 'firma_id', x.id, 'nr', x.nr, 'nr_site', x.nr_site, 'nume', x.nume, 'domeniu', x.domeniu,
          'email', x.email, 'persoana_contact', x.persoana_contact, 'link_demo', x.link_demo, 'oras', x.oras, 'nisa', x.nisa,
          'casuta', p.casuta, 'sursa', p.sursa) order by p.casuta, x.nr_site nulls last, p.id)
      from public.prospectare_programari p join public.prospectare_firme x on x.id = p.firma_id
      where p.zi = v_zi and p.canal = 'email' and p.stare = 'programata' and (v_cas is null or p.casuta = v_cas)), '[]'::jsonb),
    'casute', coalesce((
      select jsonb_agg(jsonb_build_object('adresa', c.adresa, 'activa', c.activa, 'limita', public.prospectare_limita_casuta(c),
          'programate', (select count(*) from public.prospectare_programari p where p.zi = v_zi and p.canal = 'email' and p.casuta = c.adresa and p.stare = 'programata'),
          'trimise', (select count(*) from public.prospectare_programari p where p.zi = v_zi and p.canal = 'email' and p.casuta = c.adresa and p.stare = 'folosita'))
        order by c.adresa)
      from public.prospectare_casute c where v_cas is null or c.adresa = v_cas), '[]'::jsonb)
  );
end;
$$;

create or replace function public.prospectare_whatsapp_coada(p_limit integer default 200, p_offset integer default 0)
returns setof public.prospectare_firme
language sql
stable
security definer
set search_path = public
as $$
  select f.*
  from public.prospectare_programari p join public.prospectare_firme f on f.id = p.firma_id
  where p.zi = public.prospectare_azi() and p.canal = 'whatsapp' and p.stare = 'programata'
  order by p.cont_whatsapp, f.nr_site nulls last, p.id
  limit least(greatest(coalesce(p_limit, 200), 1), 1000)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

-- 5. Evaluările, rezumatul și opțiunile tabelului ------------------------------------------------

create or replace function public.prospectare_evaluare_verifica(p_domenii jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with d as (
    select distinct public.prospectare_domeniu(x) as dom
    from jsonb_array_elements_text(case when jsonb_typeof(p_domenii) = 'array' then p_domenii else '[]'::jsonb end) x
  )
  select jsonb_build_object(
    'deja_evaluate', coalesce((select jsonb_agg(jsonb_build_object('domeniu', f.domeniu, 'nr', f.nr, 'etapa', f.etapa,
        'evaluare', coalesce(f.evaluare, case when f.etapa = 'cercetat' then null else 'eligibila' end), 'scor', f.scor,
        'motiv', f.evaluare_motiv, 'evaluat_la', coalesce(f.evaluat_la, f.creat_la),
        'nume', f.nume, 'nisa', f.nisa, 'calculator', f.evaluat_de) order by f.nr)
      from public.prospectare_firme f join d on d.dom = f.domeniu), '[]'::jsonb),
    'noi', coalesce((select jsonb_agg(d.dom order by d.dom) from d
      where d.dom is not null and not exists (select 1 from public.prospectare_firme f where f.domeniu = d.dom)), '[]'::jsonb)
  )
$$;

create or replace function public.prospectare_evaluare_noteaza(p_dispozitiv uuid, p_nisa_id bigint, p_firme jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e jsonb;
  v_dom text;
  v_ev text;
  v_robot text;
  v_id uuid;
  v_adaugate integer := 0;
  v_elig integer := 0;
  v_resp integer := 0;
  v_deja jsonb := '[]'::jsonb;
  v_invalide jsonb := '[]'::jsonb;
  n public.prospectare_nise%rowtype;
  v_calc text;
begin
  select nume into v_robot from public.prospectare_dispozitive where id = p_dispozitiv and activ;
  if not found then
    raise exception 'Robotul nu există sau e dezactivat.' using errcode = 'PR401';
  end if;
  if jsonb_typeof(p_firme) <> 'array' or jsonb_array_length(p_firme) = 0 then
    raise exception 'Trimite firmele ca listă.' using errcode = 'PR422';
  end if;
  if jsonb_array_length(p_firme) > 500 then
    raise exception 'Cel mult 500 de firme într-o cerere.' using errcode = 'PR422';
  end if;
  if p_nisa_id is not null then
    select * into n from public.prospectare_nise where id = p_nisa_id for update;
    if not found then
      raise exception 'Nișa % nu există.', p_nisa_id using errcode = 'PR404';
    end if;
    if n.dispozitiv_id is distinct from p_dispozitiv then
      raise exception 'Nișa „% · %” nu e rezervată de acest robot.', n.nisa, n.zona using errcode = 'PR409';
    end if;
  end if;
  perform set_config('prospectare.autor', v_robot, true);

  for e in select value from jsonb_array_elements(p_firme) loop
    v_dom := public.prospectare_domeniu(e ->> 'domeniu');
    v_ev := lower(coalesce(e ->> 'evaluare', ''));
    if v_dom is null or v_ev not in ('eligibila', 'respinsa') or coalesce(e ->> 'scor', '') !~ '^\d{1,4}$' or (e ->> 'scor')::integer > 1000
       or (v_ev = 'respinsa' and nullif(btrim(coalesce(e ->> 'motiv', '')), '') is null) then
      v_invalide := v_invalide || jsonb_build_object('domeniu', e ->> 'domeniu',
        'motiv', 'domeniu, evaluare (eligibila/respinsa), scor (0–1000) și, la respinse, motivul sunt obligatorii');
      continue;
    end if;
    if exists (select 1 from public.prospectare_firme where domeniu = v_dom) then
      v_deja := v_deja || to_jsonb(v_dom);
      continue;
    end if;
    perform set_config('prospectare.motiv', case when v_ev = 'respinsa' then 'Evaluată și respinsă de robot' else 'Evaluată de robot' end, true);
    v_calc := coalesce(nullif(left(btrim(e -> 'date_extra' ->> 'calculator'), 200), ''), v_robot);
    if v_ev = 'respinsa' then
      -- Respinsă (37): doar evidența minimă — domeniul, numele, nișa, scorul, motivul, data și calculatorul.
      insert into public.prospectare_firme (nume, domeniu, nisa, scor, etapa, evaluare, evaluare_motiv, evaluat_la, evaluat_de, nisa_id)
      values (coalesce(nullif(btrim(e ->> 'nume'), ''), v_dom), v_dom, coalesce(nullif(left(e ->> 'nisa', 200), ''), n.nisa),
        (e ->> 'scor')::smallint, 'cercetat', 'respinsa', nullif(left(btrim(e ->> 'motiv'), 500), ''), now(), v_calc, p_nisa_id)
      returning id into v_id;
    else
      insert into public.prospectare_firme (nume, domeniu, site_vechi, nisa, oras, judet, scor, telefon, email, persoana_contact,
        etapa, evaluare, evaluare_motiv, evaluat_la, evaluat_de, nisa_id, date_extra)
      values (
        coalesce(nullif(btrim(e ->> 'nume'), ''), v_dom), v_dom,
        nullif(left(e ->> 'site_vechi', 500), ''), coalesce(nullif(left(e ->> 'nisa', 200), ''), n.nisa),
        nullif(left(e ->> 'oras', 120), ''), nullif(left(e ->> 'judet', 60), ''),
        (e ->> 'scor')::smallint, nullif(left(btrim(e ->> 'telefon'), 40), ''), nullif(lower(btrim(e ->> 'email')), ''),
        nullif(left(btrim(e ->> 'persoana_contact'), 200), ''),
        'cercetat', v_ev, nullif(left(btrim(e ->> 'motiv'), 500), ''), now(), v_calc, p_nisa_id,
        (case when jsonb_typeof(e -> 'date_extra') = 'object' then e -> 'date_extra' else '{}'::jsonb end) || jsonb_build_object('evaluat_de', v_robot)
      )
      returning id into v_id;
    end if;
    perform public.prospectare_noteaza(v_id, 'evaluare', null,
      jsonb_strip_nulls(jsonb_build_object('evaluare', v_ev, 'scor', (e ->> 'scor')::integer, 'motiv', nullif(btrim(e ->> 'motiv'), ''),
        'nisa', case when n.id is not null then n.nisa || ' · ' || n.zona end, 'dispozitiv', p_dispozitiv)));
    v_adaugate := v_adaugate + 1;
    if v_ev = 'eligibila' then v_elig := v_elig + 1; else v_resp := v_resp + 1; end if;
  end loop;

  if n.id is not null then
    update public.prospectare_nise
      set gasite = gasite + v_adaugate, eligibile = eligibile + v_elig, respinse = respinse + v_resp,
          status = case when status = 'rezervata' then 'in_cercetare' else status end,
          semn_la = now(), actualizat_la = now()
      where id = n.id;
  end if;
  perform setval('public.prospectare_firme_nr_seq',
    greatest((select coalesce(max(nr), 0) from public.prospectare_firme), (select last_value from public.prospectare_firme_nr_seq), 1));
  perform public.prospectare_robot_ce_face(p_dispozitiv, 'cercetare',
    case when n.id is not null then format('%s · %s: %s firme evaluate', n.nisa, n.zona, v_adaugate) else format('%s firme evaluate', v_adaugate) end);
  return jsonb_build_object('adaugate', v_adaugate, 'eligibile', v_elig, 'respinse', v_resp, 'deja_evaluate', v_deja, 'invalide', v_invalide);
end;
$$;

create or replace function public.prospectare_rezumat()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total', (select count(*) from public.prospectare_firme),
    'etape', (select coalesce(jsonb_object_agg(etapa, n), '{}'::jsonb) from (select etapa, count(*) as n from public.prospectare_firme group by etapa) s),
    -- Tabelul Firme (37): etapele fără firmele respinse la evaluare, care nu apar în tabel.
    'etape_vizibile', (select coalesce(jsonb_object_agg(etapa, n), '{}'::jsonb) from (select etapa, count(*) as n from public.prospectare_firme where grupa_tabel > 0 group by etapa) s),
    'site_uri', (select jsonb_build_object('numerotate', count(nr_site), 'ultimul', coalesce(max(nr_site), 0),
        'necontactate', count(*) filter (where grupa_tabel = 1), 'contactate', count(*) filter (where grupa_tabel = 2))
      from public.prospectare_firme),
    'canale', (select jsonb_build_object(
        'email', count(*) filter (where email_la is not null),
        'whatsapp', count(*) filter (where whatsapp_la is not null),
        'telefon', count(*) filter (where telefon_la is not null),
        'email_si_whatsapp', count(*) filter (where email_la is not null and whatsapp_la is not null),
        'fara', count(*) filter (where email_la is null and whatsapp_la is null and telefon_la is null))
      from public.prospectare_firme),
    'recontactari_permise', (select count(*) from public.prospectare_firme where canal_permis is not null),
    'de_refacut', (select count(*) from public.prospectare_firme where de_refacut),
    'rezerva_telefon', (select count(*) from public.prospectare_firme f
      where public.prospectare_poate_canal(f, 'telefon')
        and not exists (select 1 from public.prospectare_programari p where p.firma_id = f.id and p.stare = 'programata')),
    'whatsapp_lista', (select count(*) from public.prospectare_programari p
      where p.zi = public.prospectare_azi() and p.canal = 'whatsapp' and p.stare = 'programata'),
    'coada_constructie', (select count(*) from public.prospectare_firme f
      where f.etapa = 'cercetat' and f.link_demo is null and coalesce(f.evaluare, 'eligibila') <> 'respinsa'
        and f.scor >= (select coalesce(scor_minim_constructie, 45) from public.prospectare_setari where id = 1)
        and (f.email is not null or f.este_mobil)
        and not exists (select 1 from public.prospectare_rezervari r where r.firma_id = f.id and r.expira_la > now())),
    'evaluate', (select jsonb_build_object('eligibile', count(*) filter (where evaluare = 'eligibila'), 'respinse', count(*) filter (where evaluare = 'respinsa'))
      from public.prospectare_firme),
    'nise', (select jsonb_build_object(
        'libere', count(*) filter (where status = 'libera' or (status in ('rezervata', 'in_cercetare') and coalesce(semn_la, rezervata_la) <= now() - interval '24 hours')),
        'rezervate', count(*) filter (where status in ('rezervata', 'in_cercetare') and coalesce(semn_la, rezervata_la) > now() - interval '24 hours'),
        'terminate', count(*) filter (where status = 'terminata'))
      from public.prospectare_nise),
    'in_lucru', (select count(*) from public.prospectare_rezervari where expira_la > now()),
    'roboti_activi', (select count(*) from public.prospectare_dispozitive where activ and ultima_activitate > now() - interval '15 minutes'),
    'roboti', (select count(*) from public.prospectare_dispozitive where activ),
    'azi', jsonb_build_object(
      'apeluri', (select count(*) from public.prospectare_liste_zi where data = public.prospectare_azi()),
      'apeluri_facute', (select count(*) from public.prospectare_liste_zi where data = public.prospectare_azi() and rezultat is not null),
      'whatsapp_trimise', (select count(*) from public.prospectare_firme where whatsapp_la >= public.prospectare_inceput_azi()),
      'whatsapp_pe_cont', (select coalesce(jsonb_object_agg(whatsapp_cont::text, n), '{}'::jsonb) from (
        select whatsapp_cont, count(*) as n from public.prospectare_firme
        where whatsapp_la >= public.prospectare_inceput_azi() and whatsapp_cont is not null group by whatsapp_cont) s),
      'emailuri', (select coalesce(sum(trimise), 0) from public.prospectare_casute_zi where zi = public.prospectare_azi()),
      'raspunsuri', (select coalesce(sum(raspunsuri), 0) from public.prospectare_casute_zi where zi = public.prospectare_azi()),
      'bounce', (select coalesce(sum(bounce), 0) from public.prospectare_casute_zi where zi = public.prospectare_azi()),
      'site_uri', (select count(*) from public.prospectare_activitate where tip = 'site' and la >= public.prospectare_inceput_azi()),
      'evaluate', (select count(*) from public.prospectare_activitate where tip = 'evaluare' and la >= public.prospectare_inceput_azi()),
      'interesati', (select count(*) from public.prospectare_activitate where tip = 'etapa' and detalii ->> 'in' = 'interesat' and la >= public.prospectare_inceput_azi())
    )
  )
$$;

create or replace function public.prospectare_optiuni()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'nise', (select coalesce(jsonb_agg(jsonb_build_object('v', nisa, 'n', n) order by n desc, nisa), '[]'::jsonb) from (select nisa, count(*) as n from public.prospectare_firme where nisa is not null and grupa_tabel in (1, 2) group by nisa) s),
    'orase', (select coalesce(jsonb_agg(jsonb_build_object('v', oras, 'n', n) order by n desc, oras), '[]'::jsonb) from (select oras, count(*) as n from public.prospectare_firme where oras is not null and grupa_tabel in (1, 2) group by oras) s),
    'judete', (select coalesce(jsonb_agg(jsonb_build_object('v', judet, 'n', n) order by n desc, judet), '[]'::jsonb) from (select judet, count(*) as n from public.prospectare_firme where judet is not null and grupa_tabel in (1, 2) group by judet) s),
    'loturi', (select coalesce(jsonb_agg(jsonb_build_object('v', lot, 'n', n) order by lot desc), '[]'::jsonb) from (select lot, count(*) as n from public.prospectare_firme where lot is not null and grupa_tabel in (1, 2) group by lot) s)
  )
$$;

-- 6. Importul: evaluarea și evidența minimă a celor respinse ---------------------------------------

create or replace function public.prospectare_upsert_firme(
  p_firme jsonb,
  p_sursa text,
  p_autor text,
  p_proba boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e jsonb;
  f public.prospectare_firme%rowtype;
  n public.prospectare_firme%rowtype;
  v_dom text;
  v_etapa text;
  v_import boolean := p_sursa = 'import';
  v_email_la timestamptz;
  v_whatsapp_la timestamptz;
  v_whatsapp_cont smallint;
  v_telefon_la timestamptz;
  v_adaugate integer := 0;
  v_actualizate integer := 0;
  v_neschimbate integer := 0;
  v_etape_pastrate integer := 0;
  v_canale_noi integer := 0;
  v_conflicte jsonb := '[]'::jsonb;
  v_nr integer;
  v_altul uuid;
  v_eval text;
  v_eval_motiv text;
  v_eval_la timestamptz;
  v_eval_de text;
  v_minim boolean;
  v_neatinsa boolean;
  v_respinse integer := 0;
begin
  if p_sursa not in ('robot', 'import') then
    raise exception 'Sursa e robot sau import.' using errcode = 'PR422';
  end if;
  if jsonb_typeof(p_firme) <> 'array' then
    raise exception 'Firmele vin ca listă.' using errcode = 'PR422';
  end if;
  if jsonb_array_length(p_firme) > 1000 then
    raise exception 'Cel mult 1000 de firme într-o cerere.' using errcode = 'PR422';
  end if;
  perform set_config('prospectare.autor', p_autor, true);
  -- Importul aduce istoric (ex. firmele cu email + WhatsApp dinainte de regula unui singur canal).
  if v_import then
    perform set_config('prospectare.import_istoric', 'da', true);
  end if;

  for e in select value from jsonb_array_elements(p_firme) loop
    v_dom := public.prospectare_domeniu(e ->> 'domeniu');
    if v_dom is null then
      v_conflicte := v_conflicte || jsonb_build_object('nr', e -> 'nr', 'motiv', 'fără domeniu');
      continue;
    end if;
    v_etapa := nullif(e ->> 'etapa', '');
    if v_etapa is not null and v_etapa not in ('cercetat', 'site_in_lucru', 'site_gata', 'email_trimis', 'whatsapp_trimis', 'sunat', 'interesat', 'client', 'nu_contacta', 'respins') then
      v_conflicte := v_conflicte || jsonb_build_object('domeniu', v_dom, 'motiv', 'etapă necunoscută: ' || v_etapa);
      continue;
    end if;
    -- Robotul trimite doar firme cercetate sau alese pentru construit; restul trece prin rutele lui.
    if not v_import and v_etapa is not null and v_etapa not in ('cercetat', 'site_in_lucru') then
      v_etapa := null;
    end if;
    -- Canalele: doar din import (robotul le obține prin rutele lui: email, termina).
    v_email_la := case when v_import then nullif(e ->> 'email_la', '')::timestamptz end;
    v_whatsapp_la := case when v_import then nullif(e ->> 'whatsapp_la', '')::timestamptz end;
    v_whatsapp_cont := case when v_import and v_whatsapp_la is not null then nullif(e ->> 'whatsapp_cont', '')::smallint end;
    v_telefon_la := case when v_import then nullif(e ->> 'telefon_la', '')::timestamptz end;
    -- Evaluarea (37): o firmă respinsă (scor sub prag, oprită la cercetare) care e doar cercetată păstrează
    -- doar evidența minimă: domeniul, numele, nișa, scorul, motivul, data și calculatorul.
    v_eval := lower(nullif(btrim(e ->> 'evaluare'), ''));
    if v_eval is not null and v_eval not in ('eligibila', 'respinsa') then
      v_eval := null;
    end if;
    v_eval_motiv := nullif(left(btrim(e ->> 'evaluare_motiv'), 500), '');
    v_eval_la := nullif(e ->> 'evaluat_la', '')::timestamptz;
    v_eval_de := nullif(left(btrim(e ->> 'evaluat_de'), 200), '');
    v_minim := coalesce(v_eval = 'respinsa', false) and coalesce(v_etapa, 'cercetat') = 'cercetat'
      and v_email_la is null and v_whatsapp_la is null and v_telefon_la is null and nullif(e ->> 'link_demo', '') is null;

    select * into f from public.prospectare_firme where domeniu = v_dom for update;

    if f.id is null then
      v_nr := nullif(e ->> 'nr', '')::integer;
      if v_nr is not null then
        select id into v_altul from public.prospectare_firme where nr = v_nr;
        if v_altul is not null then
          v_conflicte := v_conflicte || jsonb_build_object('nr', v_nr, 'domeniu', v_dom, 'motiv', 'numărul e deja al altei firme');
          continue;
        end if;
      end if;
      v_adaugate := v_adaugate + 1;
      if v_email_la is not null or v_whatsapp_la is not null or v_telefon_la is not null then
        v_canale_noi := v_canale_noi + 1;
      end if;
      if v_minim then
        v_respinse := v_respinse + 1;
      end if;
      if not p_proba and v_minim then
        insert into public.prospectare_firme (nr, nume, domeniu, nisa, scor, etapa, evaluare, evaluare_motiv, evaluat_la, evaluat_de)
        values (
          coalesce(v_nr, nextval('public.prospectare_firme_nr_seq')::integer),
          coalesce(nullif(btrim(e ->> 'nume'), ''), v_dom), v_dom, nullif(e ->> 'nisa', ''), nullif(e ->> 'scor', '')::smallint,
          'cercetat', 'respinsa', v_eval_motiv, coalesce(v_eval_la, now()), v_eval_de
        );
      elsif not p_proba then
        insert into public.prospectare_firme (
          nr, nume, domeniu, site_vechi, nisa, oras, judet, scor, telefon, email, persoana_contact,
          etapa, email_la, whatsapp_la, whatsapp_cont, telefon_la, link_demo, captura_url, lot, slug, de_refacut, date_extra,
          site_gata_la, construit_de, demo_verificat, evaluare, evaluat_la, evaluat_de
        ) values (
          coalesce(v_nr, nextval('public.prospectare_firme_nr_seq')::integer),
          coalesce(nullif(btrim(e ->> 'nume'), ''), v_dom),
          v_dom,
          nullif(e ->> 'site_vechi', ''), nullif(e ->> 'nisa', ''), nullif(e ->> 'oras', ''), nullif(e ->> 'judet', ''),
          nullif(e ->> 'scor', '')::smallint, nullif(btrim(e ->> 'telefon'), ''), nullif(lower(btrim(e ->> 'email')), ''),
          nullif(btrim(e ->> 'persoana_contact'), ''),
          coalesce(v_etapa, 'cercetat'),
          v_email_la, v_whatsapp_la, v_whatsapp_cont, v_telefon_la,
          case when v_import then nullif(e ->> 'link_demo', '') end,
          case when v_import then nullif(e ->> 'captura_url', '') end,
          nullif(e ->> 'lot', ''), nullif(e ->> 'slug', ''),
          coalesce((e ->> 'de_refacut')::boolean, false),
          coalesce(e -> 'date_extra', '{}'::jsonb),
          case when v_import then nullif(e ->> 'site_gata_la', '')::timestamptz end,
          case when v_import then nullif(btrim(e ->> 'construit_de'), '') end,
          case when v_import then coalesce(nullif(e ->> 'demo_verificat', '')::boolean, false) else false end,
          nullif(v_eval, 'respinsa'), case when nullif(v_eval, 'respinsa') is not null then coalesce(v_eval_la, now()) end, v_eval_de
        );
      end if;
      continue;
    end if;

    -- Doar cercetată, fără site, contact, programare sau rezervare: poate rămâne doar cu evidența minimă.
    v_neatinsa := f.etapa = 'cercetat' and f.link_demo is null and f.email_la is null and f.whatsapp_la is null and f.telefon_la is null
      and f.canal_permis is null and not exists (select 1 from public.prospectare_rezervari r where r.firma_id = f.id)
      and not exists (select 1 from public.prospectare_programari p where p.firma_id = f.id and p.stare = 'programata');

    -- Firma există: datele de cercetare se completează (nu se golesc).
    n := f;
    n.nume := coalesce(nullif(btrim(e ->> 'nume'), ''), f.nume);
    n.site_vechi := coalesce(nullif(e ->> 'site_vechi', ''), f.site_vechi);
    n.nisa := coalesce(nullif(e ->> 'nisa', ''), f.nisa);
    n.oras := coalesce(nullif(e ->> 'oras', ''), f.oras);
    n.judet := coalesce(nullif(e ->> 'judet', ''), f.judet);
    n.scor := coalesce(nullif(e ->> 'scor', '')::smallint, f.scor);
    n.telefon := coalesce(nullif(btrim(e ->> 'telefon'), ''), f.telefon);
    n.email := coalesce(nullif(lower(btrim(e ->> 'email')), ''), f.email);
    n.persoana_contact := coalesce(nullif(btrim(e ->> 'persoana_contact'), ''), f.persoana_contact);
    n.lot := coalesce(nullif(e ->> 'lot', ''), f.lot);
    n.slug := coalesce(nullif(e ->> 'slug', ''), f.slug);
    n.date_extra := f.date_extra || coalesce(e -> 'date_extra', '{}'::jsonb);
    if v_import then
      n.link_demo := coalesce(nullif(e ->> 'link_demo', ''), f.link_demo);
      n.captura_url := coalesce(nullif(e ->> 'captura_url', ''), f.captura_url);
      -- Data site-ului gata vine din starea roboților: un site refăcut are data nouă.
      n.site_gata_la := coalesce(nullif(e ->> 'site_gata_la', '')::timestamptz, f.site_gata_la);
      n.construit_de := coalesce(nullif(btrim(e ->> 'construit_de'), ''), f.construit_de);
      if e ? 'demo_verificat' then
        n.demo_verificat := coalesce(nullif(e ->> 'demo_verificat', '')::boolean, f.demo_verificat);
      end if;
    end if;
    -- Evaluarea (37). Respinsă și doar cercetată: rămâne evidența minimă. Reevaluată eligibilă (sau
    -- construită între timp): datele de cercetare se completează din nou, din cerere.
    if v_minim and v_neatinsa then
      if f.evaluare is distinct from 'respinsa' then
        v_respinse := v_respinse + 1;
      end if;
      n.site_vechi := null; n.oras := null; n.judet := null; n.telefon := null; n.email := null; n.persoana_contact := null;
      n.lot := null; n.slug := null; n.captura_url := null; n.construit_de := null; n.date_extra := '{}'::jsonb;
      n.evaluare := 'respinsa';
      n.evaluare_motiv := coalesce(v_eval_motiv, f.evaluare_motiv);
      n.evaluat_la := coalesce(f.evaluat_la, v_eval_la, now());
      n.evaluat_de := coalesce(v_eval_de, f.evaluat_de);
    elsif f.evaluare = 'respinsa' and (v_eval = 'eligibila' or coalesce(v_etapa, 'cercetat') <> 'cercetat'
          or nullif(e ->> 'link_demo', '') is not null or v_email_la is not null or v_whatsapp_la is not null or v_telefon_la is not null) then
      n.evaluare := 'eligibila';
      n.evaluare_motiv := null;
      n.evaluat_la := coalesce(v_eval_la, now());
      n.evaluat_de := coalesce(v_eval_de, f.evaluat_de);
    elsif f.evaluare = 'respinsa' then
      -- Rămâne respinsă: nu primește înapoi datele de cercetare (nici de la un import mai vechi, fără evaluare).
      n.site_vechi := f.site_vechi; n.oras := f.oras; n.judet := f.judet; n.telefon := f.telefon; n.email := f.email;
      n.persoana_contact := f.persoana_contact; n.lot := f.lot; n.slug := f.slug; n.date_extra := f.date_extra;
      n.evaluare_motiv := coalesce(v_eval_motiv, f.evaluare_motiv);
      n.evaluat_de := coalesce(v_eval_de, f.evaluat_de);
    elsif v_eval = 'eligibila' and f.evaluare is null then
      n.evaluare := 'eligibila';
      n.evaluat_la := coalesce(f.evaluat_la, v_eval_la, now());
      n.evaluat_de := coalesce(f.evaluat_de, v_eval_de);
    end if;

    -- Alt număr de telefon: „număr greșit” nu mai e valabil.
    if n.telefon is distinct from f.telefon then
      n.telefon_gresit := false;
    end if;

    -- Etapa: „Nu contacta” se aplică mereu; restul doar înainte, pe etapele robotului.
    if v_etapa is not null and v_etapa <> f.etapa then
      if v_etapa = 'nu_contacta' then
        n.etapa := 'nu_contacta';
      elsif f.etapa = 'nu_contacta' then
        v_etape_pastrate := v_etape_pastrate + 1;
      elsif v_etapa = 'respins' and public.prospectare_rang_etapa(f.etapa) is not null then
        n.etapa := 'respins';
      elsif public.prospectare_rang_etapa(v_etapa) is not null and public.prospectare_rang_etapa(f.etapa) is not null
            and public.prospectare_rang_etapa(v_etapa) > public.prospectare_rang_etapa(f.etapa) then
        n.etapa := v_etapa;
      else
        v_etape_pastrate := v_etape_pastrate + 1;
      end if;
    end if;

    -- De refăcut (ex. conversie pe v3): un site gata, încă necontactat, se întoarce în lucru.
    if coalesce((e ->> 'de_refacut')::boolean, false) and not f.de_refacut then
      n.de_refacut := true;
      if n.etapa = 'site_gata' and f.email_la is null and f.whatsapp_la is null and f.telefon_la is null then
        n.etapa := 'site_in_lucru';
      end if;
    elsif (e ->> 'de_refacut') is not null and not (e ->> 'de_refacut')::boolean and f.de_refacut and v_import then
      n.de_refacut := false;
    end if;

    -- Canalele: se completează doar cele goale; o dată deja în bază rămâne.
    -- O firmă deja „Nu contacta” nu primește canal nou nici din import.
    if (v_email_la is not null and f.email_la is null) or (v_whatsapp_la is not null and f.whatsapp_la is null)
       or (v_telefon_la is not null and f.telefon_la is null) then
      if f.etapa = 'nu_contacta' then
        v_conflicte := v_conflicte || jsonb_build_object('nr', f.nr, 'domeniu', v_dom, 'motiv', '„Nu contacta”: nu primește canal nou');
      else
        n.email_la := coalesce(f.email_la, v_email_la);
        if f.whatsapp_la is null and v_whatsapp_la is not null then
          n.whatsapp_la := v_whatsapp_la;
          n.whatsapp_cont := v_whatsapp_cont;
        end if;
        n.telefon_la := coalesce(f.telefon_la, v_telefon_la);
        v_canale_noi := v_canale_noi + 1;
      end if;
    end if;

    if row(n.nume, n.site_vechi, n.nisa, n.oras, n.judet, n.scor, n.telefon, n.email, n.persoana_contact, n.lot, n.slug,
           n.date_extra, n.link_demo, n.captura_url, n.etapa, n.email_la, n.whatsapp_la, n.whatsapp_cont, n.telefon_la, n.de_refacut,
           n.site_gata_la, n.construit_de, n.demo_verificat, n.telefon_gresit, n.evaluare, n.evaluare_motiv, n.evaluat_la, n.evaluat_de)
       is distinct from
       row(f.nume, f.site_vechi, f.nisa, f.oras, f.judet, f.scor, f.telefon, f.email, f.persoana_contact, f.lot, f.slug,
           f.date_extra, f.link_demo, f.captura_url, f.etapa, f.email_la, f.whatsapp_la, f.whatsapp_cont, f.telefon_la, f.de_refacut,
           f.site_gata_la, f.construit_de, f.demo_verificat, f.telefon_gresit, f.evaluare, f.evaluare_motiv, f.evaluat_la, f.evaluat_de) then
      v_actualizate := v_actualizate + 1;
      if not p_proba then
        perform set_config('prospectare.motiv', case when v_import then 'Import din auto-web-rebuilder' else 'Actualizare de la robot' end, true);
        update public.prospectare_firme set
          nume = n.nume, site_vechi = n.site_vechi, nisa = n.nisa, oras = n.oras, judet = n.judet, scor = n.scor,
          telefon = n.telefon, email = n.email, persoana_contact = n.persoana_contact, lot = n.lot, slug = n.slug,
          date_extra = n.date_extra, link_demo = n.link_demo, captura_url = n.captura_url, etapa = n.etapa,
          email_la = n.email_la, whatsapp_la = n.whatsapp_la, whatsapp_cont = n.whatsapp_cont, telefon_la = n.telefon_la,
          de_refacut = n.de_refacut, site_gata_la = n.site_gata_la, construit_de = n.construit_de,
          demo_verificat = n.demo_verificat, telefon_gresit = n.telefon_gresit,
          evaluare = n.evaluare, evaluare_motiv = n.evaluare_motiv, evaluat_la = n.evaluat_la, evaluat_de = n.evaluat_de
        where id = f.id;
      end if;
    else
      v_neschimbate := v_neschimbate + 1;
    end if;
  end loop;

  -- Numerele explicite din import nu consumă secvența: o aducem după cel mai mare număr.
  if not p_proba then
    perform setval('public.prospectare_firme_nr_seq',
      greatest((select coalesce(max(nr), 0) from public.prospectare_firme), (select last_value from public.prospectare_firme_nr_seq), 1));
  end if;

  -- Firmele noi sau schimbate intră azi în distribuție, dacă e loc (36).
  if not p_proba then
    perform public.prospectare_completeaza_azi('import');
  end if;

  return jsonb_build_object(
    'proba', p_proba,
    'adaugate', v_adaugate,
    'actualizate', v_actualizate,
    'neschimbate', v_neschimbate,
    'etape_pastrate', v_etape_pastrate,
    'canale_noi', v_canale_noi,
    'respinse', v_respinse,
    'conflicte', v_conflicte
  );
end;
$$;

-- 7. /termina: orice firmă publicată de robot, una sau mai multe odată ------------------------------

-- Firma din cerere: după id, domeniu sau numărul de cercetare.
create or replace function public.prospectare_firma_din(e jsonb)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select x.id from public.prospectare_firme x
      where coalesce(e ->> 'firma_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and x.id = (e ->> 'firma_id')::uuid),
    (select x.id from public.prospectare_firme x
      where nullif(e ->> 'domeniu', '') is not null and x.domeniu = public.prospectare_domeniu(e ->> 'domeniu')),
    (select x.id from public.prospectare_firme x
      where coalesce(e ->> 'nr', '') ~ '^\d{1,9}$' and x.nr = (e ->> 'nr')::integer))
$$;

create or replace function public.prospectare_termina_lot(p_dispozitiv uuid, p_firme jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nume text;
  e jsonb;
  v_i integer := 0;
  v_id uuid;
  v_link text;
  v_capt text;
  v_verif boolean;
  v_detalii jsonb;
  f public.prospectare_firme%rowtype;
  g public.prospectare_firme%rowtype;
  v_rez jsonb := '[]'::jsonb;
  v_ok integer := 0;
  v_gata integer := 0;
  v_cod text;
  v_mesaj text;
  v_final jsonb := '[]'::jsonb;
  r jsonb;
begin
  select nume into v_nume from public.prospectare_dispozitive where id = p_dispozitiv and activ;
  if not found then
    raise exception 'Robotul nu există sau e dezactivat.' using errcode = 'PR401';
  end if;
  if jsonb_typeof(p_firme) <> 'array' or jsonb_array_length(p_firme) = 0 then
    raise exception 'Trimite firmele ca listă.' using errcode = 'PR422';
  end if;
  if jsonb_array_length(p_firme) > 100 then
    raise exception 'Cel mult 100 de firme într-o cerere.' using errcode = 'PR422';
  end if;
  perform set_config('prospectare.autor', v_nume, true);

  -- Toate firmele cererii se blochează de la început, în aceeași ordine: două cereri simultane
  -- cu firme comune așteaptă una după alta, nu se blochează reciproc.
  perform 1 from public.prospectare_firme x
    where x.id in (select public.prospectare_firma_din(el) from jsonb_array_elements(p_firme) el)
    order by x.id
    for update;

  for e in select value from jsonb_array_elements(p_firme) loop
    v_i := v_i + 1;
    begin
      if jsonb_typeof(e) <> 'object' then
        raise exception 'Fiecare firmă e un obiect: firma_id, domeniu sau nr, plus link_demo.' using errcode = 'PR422';
      end if;
      v_link := nullif(btrim(e ->> 'link_demo'), '');
      v_capt := nullif(btrim(e ->> 'captura_url'), '');
      v_verif := coalesce(nullif(e ->> 'link_verificat', '')::boolean, true);
      v_detalii := case when jsonb_typeof(e -> 'detalii') = 'object' then e -> 'detalii' else '{}'::jsonb end;
      if v_link is null or v_link !~ '^https://[^\s]+$' or char_length(v_link) > 500 then
        raise exception 'Linkul demo trebuie să fie o adresă https://.' using errcode = 'PR422';
      end if;
      if v_capt is not null and (v_capt !~ '^https://[^\s]+$' or char_length(v_capt) > 1000) then
        raise exception 'Linkul capturii trebuie să fie o adresă https:// (Drive).' using errcode = 'PR422';
      end if;
      if char_length(v_detalii::text) > 5000 then
        raise exception 'detalii: cel mult 5000 de caractere.' using errcode = 'PR422';
      end if;
      v_id := public.prospectare_firma_din(e);
      if v_id is null then
        raise exception 'Firma nu există: %.', coalesce(e ->> 'firma_id', e ->> 'domeniu', '#' || (e ->> 'nr'), '(fără firma_id, domeniu sau nr)') using errcode = 'PR404';
      end if;
      select * into f from public.prospectare_firme where id = v_id;

      perform set_config('prospectare.motiv', 'Site demo gata', true);
      update public.prospectare_firme
        set etapa = case when etapa in ('cercetat', 'site_in_lucru') then 'site_gata' else etapa end,
            link_demo = v_link,
            captura_url = coalesce(v_capt, captura_url),
            de_refacut = false,
            -- Un site nou sau refăcut are data de acum; același link raportat din nou își păstrează data.
            site_gata_la = case when site_gata_la is null or de_refacut or link_demo is distinct from v_link then now() else site_gata_la end,
            construit_de = coalesce(v_nume, construit_de),
            demo_verificat = v_verif,
            evaluare = 'eligibila',
            evaluare_motiv = case when evaluare = 'respinsa' then null else evaluare_motiv end,
            date_extra = date_extra || jsonb_build_object('status_robot', 'gata', 'terminat_la', now())
        where id = v_id
        returning * into g;
      -- Rezervarea (a oricui) se închide: site-ul e publicat.
      delete from public.prospectare_rezervari where firma_id = v_id;
      if g.link_demo is distinct from f.link_demo or g.demo_verificat is distinct from f.demo_verificat or g.etapa is distinct from f.etapa then
        perform public.prospectare_noteaza(g.id, 'site', null,
          jsonb_strip_nulls(jsonb_build_object('dispozitiv', p_dispozitiv, 'link_demo', v_link, 'captura_url', v_capt, 'link_verificat', v_verif))
            || v_detalii);
      end if;
      if g.demo_verificat and g.etapa = 'site_gata' then
        v_gata := v_gata + 1;
      end if;
      v_ok := v_ok + 1;
      v_rez := v_rez || jsonb_build_object('index', v_i, 'firma_id', g.id, 'nr', g.nr, 'etapa', g.etapa, 'link_demo', g.link_demo,
        'demo_verificat', g.demo_verificat);
    exception when others then
      get stacked diagnostics v_cod = returned_sqlstate, v_mesaj = message_text;
      v_rez := v_rez || jsonb_build_object('index', v_i, 'firma_id', e ->> 'firma_id', 'domeniu', e ->> 'domeniu', 'nr', e -> 'nr',
        'eroare', jsonb_build_object('cod', v_cod, 'mesaj', v_mesaj));
    end;
  end loop;

  -- Site-urile gata și publicate intră azi în distribuție, dacă e loc (36); apoi numerele de site.
  if v_gata > 0 then
    perform public.prospectare_completeaza_azi(format('site gata (%s)', v_gata));
  end if;
  if v_ok > 0 then
    perform public.prospectare_numeroteaza_site();
  end if;

  for r in select value from jsonb_array_elements(v_rez) loop
    if r ? 'eroare' then
      v_final := v_final || r;
    else
      v_final := v_final || (r || jsonb_build_object('nr_site', (select x.nr_site from public.prospectare_firme x where x.id = (r ->> 'firma_id')::uuid)));
    end if;
  end loop;
  return jsonb_build_object('terminate', v_ok, 'erori', jsonb_array_length(v_rez) - v_ok, 'firme', v_final);
end;
$$;

-- Varianta veche, pentru o singură firmă (după id): orice firmă, nu doar cea rezervată; întoarce și nr_site.
create or replace function public.prospectare_termina(
  p_dispozitiv uuid,
  p_firma uuid,
  p_link_demo text,
  p_captura_url text default null,
  p_detalii jsonb default '{}'::jsonb,
  p_link_verificat boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r jsonb;
  v_f jsonb;
begin
  v_r := public.prospectare_termina_lot(p_dispozitiv, jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
    'firma_id', p_firma, 'link_demo', p_link_demo, 'captura_url', p_captura_url, 'detalii', coalesce(p_detalii, '{}'::jsonb),
    'link_verificat', coalesce(p_link_verificat, true)))));
  v_f := v_r -> 'firme' -> 0;
  if v_f ? 'eroare' then
    raise exception '%', v_f -> 'eroare' ->> 'mesaj' using errcode = coalesce(nullif(v_f -> 'eroare' ->> 'cod', ''), 'PR422');
  end if;
  return jsonb_build_object('nr', (v_f ->> 'nr')::integer, 'nr_site', (v_f ->> 'nr_site')::integer, 'etapa', v_f ->> 'etapa',
    'link_demo', v_f ->> 'link_demo', 'demo_verificat', (v_f ->> 'demo_verificat')::boolean, 'firma_id', v_f ->> 'firma_id');
end;
$$;

-- 8. Drepturi -------------------------------------------------------------------------------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.prospectare_firme_nr_site_paza()',
    'public.prospectare_firme_nr_site_dupa()',
    'public.prospectare_numeroteaza_site()',
    'public.prospectare_umple_zi(date, text)',
    'public.prospectare_programabile(text, jsonb, integer, integer)',
    'public.prospectare_programeaza(text, date, uuid[], smallint, text, text)',
    'public.prospectare_coada_email(uuid, text)',
    'public.prospectare_whatsapp_coada(integer, integer)',
    'public.prospectare_evaluare_verifica(jsonb)',
    'public.prospectare_evaluare_noteaza(uuid, bigint, jsonb)',
    'public.prospectare_rezumat()',
    'public.prospectare_optiuni()',
    'public.prospectare_upsert_firme(jsonb, text, text, boolean)',
    'public.prospectare_firma_din(jsonb)',
    'public.prospectare_termina_lot(uuid, jsonb)',
    'public.prospectare_termina(uuid, uuid, text, text, jsonb, boolean)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke all on function %s from anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;

-- Verificarea (toate rândurile trebuie să fie `true`).
select 'numărul de site: coloana, contorul, paza și triggerul de la sfârșitul tranzacției' as verificare,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prospectare_firme' and column_name = 'nr_site')
  and exists (select 1 from public.prospectare_contoare where cheie = 'nr_site')
  and exists (select 1 from pg_trigger where tgname = 'prospectare_firme_zz_nr_site' and not tgisinternal)
  and exists (select 1 from pg_trigger where tgname = 'prospectare_firme_nr_site_la_final' and tgdeferrable and tginitdeferred) as ok
union all
select format('site-uri numerotate: %s (1–%s, fără goluri), din %s publicate și verificate',
    (select count(nr_site) from public.prospectare_firme), coalesce((select max(nr_site) from public.prospectare_firme), 0),
    (select count(*) from public.prospectare_firme where link_demo is not null and demo_verificat)),
  (select count(nr_site) = coalesce(max(nr_site), 0) from public.prospectare_firme)
  and not exists (select 1 from public.prospectare_firme where nr_site is null and link_demo is not null and demo_verificat)
  and (select valoare from public.prospectare_contoare where cheie = 'nr_site') = coalesce((select max(nr_site) from public.prospectare_firme), 0)
union all
select format('evaluate: %s eligibile · %s respinse', count(*) filter (where evaluare = 'eligibila'), count(*) filter (where evaluare = 'respinsa')),
  true
from public.prospectare_firme
union all
select 'respinsele păstrează doar domeniul, numele, nișa, scorul, motivul, data și calculatorul',
  not exists (select 1 from public.prospectare_firme where evaluare = 'respinsa' and etapa = 'cercetat'
    and (telefon is not null or email is not null or oras is not null or site_vechi is not null or date_extra <> '{}'::jsonb))
union all
select format('tabelul Firme: %s cu site necontactate, %s cu site contactate, %s fără site, %s respinse (nu apar)',
    count(*) filter (where grupa_tabel = 1), count(*) filter (where grupa_tabel = 2), count(*) filter (where grupa_tabel = 3), count(*) filter (where grupa_tabel = 0)),
  true
from public.prospectare_firme
union all
select 'funcțiile noi doar pentru cheia de service',
  not has_function_privilege('authenticated', 'public.prospectare_termina_lot(uuid, jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.prospectare_numeroteaza_site()', 'execute')
  and has_function_privilege('service_role', 'public.prospectare_termina_lot(uuid, jsonb)', 'execute');
