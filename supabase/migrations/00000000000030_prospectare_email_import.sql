-- ============================================================
-- Prospectare, migrarea 3 din 3: căsuțele de email, evenimentele roboților,
-- importul din auto-web-rebuilder și autentificarea roboților.
--
-- Emailul: robotul CERE canalul înainte să trimită
-- (`prospectare_email_cere_canal`). Dacă firma are deja alt canal, e „Nu
-- contacta” sau căsuța și-a atins limita zilei, cererea e refuzată și emailul
-- NU se trimite. După trimitere, robotul raportează `trimis`, `bounce` sau
-- `raspuns` (`prospectare_email_eveniment`); un răspuns „NU” trece firma pe
-- „Nu contacta”.
--
-- Importul (`prospectare_upsert_firme`) potrivește firmele pe domeniu și se
-- poate rula oricând din nou: avansează doar etapele robotului (cercetat →
-- site în lucru → site gata → email trimis), nu suprascrie etapele puse de om
-- și nu schimbă un canal deja setat: acolo raportează conflict. Cu
-- `p_proba = true` nu scrie nimic, doar numără.
--
-- Citirea: doar adminii. Funcțiile: doar cheia de service.
-- Se rulează după migrările 28 și 29. Se poate rula de mai multe ori.
-- ============================================================

-- Căsuțele de email ----------------------------------------------------------------

create table if not exists public.prospectare_casute (
  adresa text primary key check (adresa = lower(btrim(adresa)) and adresa like '%_@_%' and char_length(adresa) <= 320),
  domeniu text not null check (domeniu = public.prospectare_domeniu(domeniu)),
  -- Limita pe zi pusă din admin. Gol = limita zilei o dă robotul (încălzirea căsuței).
  limita_zi integer check (limita_zi is null or limita_zi between 0 and 2000),
  incalzire_activa boolean not null default true,
  activa boolean not null default true,
  creat_la timestamptz not null default now(),
  actualizat_la timestamptz not null default now()
);

create table if not exists public.prospectare_casute_zi (
  adresa text not null references public.prospectare_casute (adresa) on delete cascade,
  zi date not null,
  trimise integer not null default 0 check (trimise >= 0),
  -- Limita zilei, cum a raportat-o robotul (încălzirea crește de la o zi la alta).
  limita integer check (limita is null or limita >= 0),
  limita_atinsa_la timestamptz,
  bounce integer not null default 0 check (bounce >= 0),
  raspunsuri integer not null default 0 check (raspunsuri >= 0),
  primary key (adresa, zi)
);
create index if not exists prospectare_casute_zi_zi_idx on public.prospectare_casute_zi (zi desc);

-- Căsuța există (o creează la prima folosire) și rândul ei pe ziua de azi.
create or replace function public.prospectare_casuta_azi(p_adresa text, p_limita integer default null)
returns public.prospectare_casute_zi
language plpgsql
security definer
set search_path = public
as $$
declare
  v_adresa text := lower(btrim(coalesce(p_adresa, '')));
  v_rand public.prospectare_casute_zi%rowtype;
begin
  if v_adresa !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Căsuța de email lipsește sau nu e o adresă: %.', p_adresa using errcode = 'PR422';
  end if;
  insert into public.prospectare_casute (adresa, domeniu)
  values (v_adresa, public.prospectare_domeniu(split_part(v_adresa, '@', 2)))
  on conflict (adresa) do nothing;
  insert into public.prospectare_casute_zi (adresa, zi, limita)
  values (v_adresa, public.prospectare_azi(), p_limita)
  on conflict (adresa, zi) do update set limita = coalesce(excluded.limita, public.prospectare_casute_zi.limita)
  returning * into v_rand;
  return v_rand;
end;
$$;

-- Firma după domeniu sau număr, blocată pentru tranzacție.
create or replace function public.prospectare_gaseste_firma(p_domeniu text, p_nr integer)
returns public.prospectare_firme
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.prospectare_firme%rowtype;
begin
  if p_domeniu is not null and btrim(p_domeniu) <> '' then
    select * into f from public.prospectare_firme where domeniu = public.prospectare_domeniu(p_domeniu) for update;
  elsif p_nr is not null then
    select * into f from public.prospectare_firme where nr = p_nr for update;
  end if;
  if f.id is null then
    raise exception 'Nu găsesc firma (domeniu %, nr %).', coalesce(p_domeniu, '—'), coalesce(p_nr::text, '—') using errcode = 'PR404';
  end if;
  return f;
end;
$$;

-- Înainte de trimitere: robotul cere canalul email ------------------------------------

create or replace function public.prospectare_email_cere_canal(
  p_dispozitiv uuid,
  p_domeniu text,
  p_nr integer,
  p_casuta text,
  p_limita integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.prospectare_firme%rowtype;
  c public.prospectare_casute%rowtype;
  z public.prospectare_casute_zi%rowtype;
  v_limita integer;
  v_nume text;
begin
  select nume into v_nume from public.prospectare_dispozitive where id = p_dispozitiv;
  perform set_config('prospectare.autor', coalesce(v_nume, 'robot'), true);
  f := public.prospectare_gaseste_firma(p_domeniu, p_nr);

  if f.etapa in ('nu_contacta', 'respins', 'client') then
    raise exception 'Firma #% e „%”: nu se trimite email.', f.nr, f.etapa using errcode = 'PR410';
  end if;
  if f.canal is not null and f.canal <> 'email' then
    raise exception 'Firma #% are deja canalul %: emailul nu se trimite.', f.nr, f.canal using errcode = 'PR409';
  end if;
  if f.email is null then
    raise exception 'Firma #% nu are adresă de email.', f.nr using errcode = 'PR422';
  end if;
  -- Primul email pleacă doar cu site-ul demo gata (linkul e în mesaj).
  if f.canal is null and (f.etapa <> 'site_gata' or f.link_demo is null) then
    raise exception 'Firma #% nu are încă site demo gata, cu link: emailul nu se trimite.', f.nr using errcode = 'PR422';
  end if;

  z := public.prospectare_casuta_azi(p_casuta, p_limita);
  select * into c from public.prospectare_casute where adresa = z.adresa;
  if not c.activa then
    raise exception 'Căsuța % e oprită din admin.', c.adresa using errcode = 'PR429';
  end if;
  v_limita := coalesce(c.limita_zi, z.limita);
  if v_limita is not null and z.trimise >= v_limita then
    raise exception 'Căsuța % și-a atins limita de azi (%/%).', c.adresa, z.trimise, v_limita using errcode = 'PR429';
  end if;

  if f.canal is null then
    perform set_config('prospectare.motiv', format('Robotul a cerut canalul email (căsuța %s)', c.adresa), true);
    update public.prospectare_firme set canal = 'email' where id = f.id returning * into f;
  end if;

  return jsonb_build_object(
    'trimite', true,
    'firma', jsonb_build_object('id', f.id, 'nr', f.nr, 'nume', f.nume, 'domeniu', f.domeniu, 'email', f.email,
      'persoana_contact', f.persoana_contact, 'link_demo', f.link_demo, 'etapa', f.etapa),
    'casuta', jsonb_build_object('adresa', c.adresa, 'trimise_azi', z.trimise, 'limita_azi', v_limita)
  );
end;
$$;

-- După trimitere: trimis, bounce, răspuns -------------------------------------------

create or replace function public.prospectare_email_eveniment(
  p_dispozitiv uuid,
  p_tip text,
  p_domeniu text,
  p_nr integer,
  p_casuta text,
  p_detalii jsonb default '{}'::jsonb,
  p_cheie text default null,
  p_limita integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.prospectare_firme%rowtype;
  z public.prospectare_casute_zi%rowtype;
  c public.prospectare_casute%rowtype;
  v_nume text;
  v_tip_raspuns text := lower(coalesce(p_detalii ->> 'tip', ''));
  v_nou bigint;
  v_cheie text := nullif(btrim(coalesce(p_cheie, '')), '');
  v_limita integer;
begin
  if p_tip not in ('trimis', 'bounce', 'raspuns') then
    raise exception 'Evenimentul de email e trimis, bounce sau raspuns, nu %.', p_tip using errcode = 'PR422';
  end if;
  if p_tip = 'raspuns' and v_tip_raspuns not in ('pozitiv', 'nu', 'automat', 'altul') then
    raise exception 'La răspuns, detalii.tip e pozitiv, nu, automat sau altul.' using errcode = 'PR422';
  end if;
  select nume into v_nume from public.prospectare_dispozitive where id = p_dispozitiv;
  perform set_config('prospectare.autor', coalesce(v_nume, 'robot'), true);
  f := public.prospectare_gaseste_firma(p_domeniu, p_nr);

  if p_tip = 'trimis' and f.canal is distinct from 'email' then
    raise exception 'Firma #% nu are canalul email (are %): cere canalul înainte de trimitere.', f.nr, coalesce(f.canal, 'gol')
      using errcode = 'PR409';
  end if;

  insert into public.prospectare_activitate (firma_id, tip, canal, autor, detalii, cheie)
  values (f.id, case p_tip when 'trimis' then 'email' else p_tip end, 'email', public.prospectare_autor(),
    coalesce(p_detalii, '{}'::jsonb) || jsonb_build_object('casuta', lower(btrim(coalesce(p_casuta, '')))),
    case when v_cheie is null then null else 'email:' || p_tip || ':' || v_cheie end)
  on conflict (cheie) do nothing
  returning id into v_nou;

  -- Același eveniment a doua oară (cererea repetată): nu se mai numără.
  if v_nou is null then
    return jsonb_build_object('nou', false, 'nr', f.nr, 'etapa', f.etapa);
  end if;

  z := public.prospectare_casuta_azi(p_casuta, p_limita);
  select * into c from public.prospectare_casute where adresa = z.adresa;
  v_limita := coalesce(c.limita_zi, z.limita);

  if p_tip = 'trimis' then
    update public.prospectare_casute_zi
      set trimise = trimise + 1,
          limita_atinsa_la = case when v_limita is not null and trimise + 1 >= v_limita then coalesce(limita_atinsa_la, now()) else limita_atinsa_la end
      where adresa = z.adresa and zi = z.zi;
    if f.etapa = 'site_gata' then
      perform set_config('prospectare.motiv', 'Email trimis', true);
      update public.prospectare_firme set etapa = 'email_trimis' where id = f.id returning * into f;
    end if;
  elsif p_tip = 'bounce' then
    update public.prospectare_casute_zi set bounce = bounce + 1 where adresa = z.adresa and zi = z.zi;
  else
    update public.prospectare_casute_zi set raspunsuri = raspunsuri + 1 where adresa = z.adresa and zi = z.zi;
    if v_tip_raspuns = 'nu' and f.etapa <> 'nu_contacta' then
      perform set_config('prospectare.motiv', 'A răspuns „NU” la email', true);
      update public.prospectare_firme set etapa = 'nu_contacta' where id = f.id returning * into f;
    end if;
  end if;

  return jsonb_build_object('nou', true, 'nr', f.nr, 'etapa', f.etapa);
end;
$$;

-- Firmele de la roboți și din import ----------------------------------------------
-- Element (jsonb): domeniu (obligatoriu), nr, nume, site_vechi, nisa, oras,
-- judet, scor, telefon, email, persoana_contact, lot, slug, de_refacut,
-- date_extra, etapa; doar din import: canal, canal_setat_la, link_demo,
-- captura_url.

create or replace function public.prospectare_rang_etapa(p text)
returns integer
language sql
immutable
as $$
  select case p
    when 'cercetat' then 0
    when 'site_in_lucru' then 1
    when 'site_gata' then 2
    when 'email_trimis' then 3
    when 'whatsapp_trimis' then 3
    else null
  end
$$;

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
  v_canal text;
  v_import boolean := p_sursa = 'import';
  v_adaugate integer := 0;
  v_actualizate integer := 0;
  v_neschimbate integer := 0;
  v_etape_pastrate integer := 0;
  v_conflicte jsonb := '[]'::jsonb;
  v_nr integer;
  v_altul uuid;
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

  for e in select value from jsonb_array_elements(p_firme) loop
    v_dom := public.prospectare_domeniu(e ->> 'domeniu');
    if v_dom is null then
      v_conflicte := v_conflicte || jsonb_build_object('nr', e -> 'nr', 'motiv', 'fără domeniu');
      continue;
    end if;
    v_etapa := nullif(e ->> 'etapa', '');
    v_canal := case when v_import then nullif(e ->> 'canal', '') end;
    if v_etapa is not null and v_etapa not in ('cercetat', 'site_in_lucru', 'site_gata', 'email_trimis', 'whatsapp_trimis', 'sunat', 'interesat', 'client', 'nu_contacta', 'respins') then
      v_conflicte := v_conflicte || jsonb_build_object('domeniu', v_dom, 'motiv', 'etapă necunoscută: ' || v_etapa);
      continue;
    end if;
    -- Robotul trimite doar firme cercetate sau alese pentru construit; restul trece prin rutele lui.
    if not v_import and v_etapa is not null and v_etapa not in ('cercetat', 'site_in_lucru') then
      v_etapa := null;
    end if;

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
      if v_canal is not null and v_etapa = 'nu_contacta' then
        v_canal := null;
      end if;
      v_adaugate := v_adaugate + 1;
      if not p_proba then
        insert into public.prospectare_firme (
          nr, nume, domeniu, site_vechi, nisa, oras, judet, scor, telefon, email, persoana_contact,
          etapa, canal, canal_setat_la, link_demo, captura_url, lot, slug, de_refacut, date_extra
        ) values (
          coalesce(v_nr, nextval('public.prospectare_firme_nr_seq')::integer),
          coalesce(nullif(btrim(e ->> 'nume'), ''), v_dom),
          v_dom,
          nullif(e ->> 'site_vechi', ''), nullif(e ->> 'nisa', ''), nullif(e ->> 'oras', ''), nullif(e ->> 'judet', ''),
          nullif(e ->> 'scor', '')::smallint, nullif(btrim(e ->> 'telefon'), ''), nullif(lower(btrim(e ->> 'email')), ''),
          nullif(btrim(e ->> 'persoana_contact'), ''),
          coalesce(v_etapa, 'cercetat'),
          v_canal,
          case when v_canal is not null then nullif(e ->> 'canal_setat_la', '')::timestamptz end,
          case when v_import then nullif(e ->> 'link_demo', '') end,
          case when v_import then nullif(e ->> 'captura_url', '') end,
          nullif(e ->> 'lot', ''), nullif(e ->> 'slug', ''),
          coalesce((e ->> 'de_refacut')::boolean, false),
          coalesce(e -> 'date_extra', '{}'::jsonb)
        );
      end if;
      continue;
    end if;

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
      if n.etapa = 'site_gata' and f.canal is null then
        n.etapa := 'site_in_lucru';
      end if;
    elsif (e ->> 'de_refacut') is not null and not (e ->> 'de_refacut')::boolean and f.de_refacut and v_import then
      n.de_refacut := false;
    end if;

    -- Canalul: o singură dată. Alt canal decât cel din bază = conflict, nu suprascriere.
    if v_canal is not null then
      if f.canal is null then
        if n.etapa = 'nu_contacta' then
          v_conflicte := v_conflicte || jsonb_build_object('nr', f.nr, 'domeniu', v_dom, 'motiv', '„Nu contacta”: nu primește canalul ' || v_canal);
        else
          n.canal := v_canal;
          n.canal_setat_la := coalesce(nullif(e ->> 'canal_setat_la', '')::timestamptz, now());
          n.canal_setat_de := p_autor;
        end if;
      elsif f.canal <> v_canal then
        v_conflicte := v_conflicte || jsonb_build_object('nr', f.nr, 'domeniu', v_dom, 'motiv', 'alt canal',
          'canal_baza', f.canal, 'canal_import', v_canal);
      end if;
    end if;

    if row(n.nume, n.site_vechi, n.nisa, n.oras, n.judet, n.scor, n.telefon, n.email, n.persoana_contact, n.lot, n.slug,
           n.date_extra, n.link_demo, n.captura_url, n.etapa, n.canal, n.de_refacut)
       is distinct from
       row(f.nume, f.site_vechi, f.nisa, f.oras, f.judet, f.scor, f.telefon, f.email, f.persoana_contact, f.lot, f.slug,
           f.date_extra, f.link_demo, f.captura_url, f.etapa, f.canal, f.de_refacut) then
      v_actualizate := v_actualizate + 1;
      if not p_proba then
        perform set_config('prospectare.motiv', case when v_import then 'Import din auto-web-rebuilder' else 'Actualizare de la robot' end, true);
        update public.prospectare_firme set
          nume = n.nume, site_vechi = n.site_vechi, nisa = n.nisa, oras = n.oras, judet = n.judet, scor = n.scor,
          telefon = n.telefon, email = n.email, persoana_contact = n.persoana_contact, lot = n.lot, slug = n.slug,
          date_extra = n.date_extra, link_demo = n.link_demo, captura_url = n.captura_url, etapa = n.etapa,
          canal = n.canal, canal_setat_la = n.canal_setat_la, canal_setat_de = n.canal_setat_de, de_refacut = n.de_refacut
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

  return jsonb_build_object(
    'proba', p_proba,
    'adaugate', v_adaugate,
    'actualizate', v_actualizate,
    'neschimbate', v_neschimbate,
    'etape_pastrate', v_etape_pastrate,
    'conflicte', v_conflicte
  );
end;
$$;

-- Activitate din import (emailuri trimise, WhatsApp-uri dinainte de modul) -------------
-- Element: nr sau domeniu, tip, canal, detalii, cheie (obligatorie), la.

create or replace function public.prospectare_import_activitate(p_randuri jsonb, p_autor text, p_proba boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e jsonb;
  v_firma uuid;
  v_noi integer := 0;
  v_existente integer := 0;
  v_lipsa jsonb := '[]'::jsonb;
  v_id bigint;
begin
  perform set_config('prospectare.autor', p_autor, true);
  for e in select value from jsonb_array_elements(p_randuri) loop
    if nullif(e ->> 'cheie', '') is null then
      raise exception 'Fiecare rând de activitate importat are nevoie de cheie (ca importul să se poată rula din nou).' using errcode = 'PR422';
    end if;
    select id into v_firma from public.prospectare_firme
      where (nullif(e ->> 'domeniu', '') is not null and domeniu = public.prospectare_domeniu(e ->> 'domeniu'))
         or (nullif(e ->> 'domeniu', '') is null and nr = nullif(e ->> 'nr', '')::integer);
    if v_firma is null then
      v_lipsa := v_lipsa || jsonb_build_object('nr', e -> 'nr', 'domeniu', e -> 'domeniu', 'cheie', e ->> 'cheie');
      continue;
    end if;
    if exists (select 1 from public.prospectare_activitate where cheie = e ->> 'cheie') then
      v_existente := v_existente + 1;
      continue;
    end if;
    v_noi := v_noi + 1;
    if not p_proba then
      insert into public.prospectare_activitate (firma_id, tip, canal, autor, detalii, cheie, la)
      values (v_firma, e ->> 'tip', nullif(e ->> 'canal', ''), p_autor, coalesce(e -> 'detalii', '{}'::jsonb), e ->> 'cheie',
        coalesce(nullif(e ->> 'la', '')::timestamptz, now()))
      on conflict (cheie) do nothing
      returning id into v_id;
    end if;
  end loop;
  return jsonb_build_object('noi', v_noi, 'existente', v_existente, 'fara_firma', v_lipsa);
end;
$$;

-- Statisticile căsuțelor din import: se păstrează valoarea mai mare (importul rulat din nou nu dublează).
create or replace function public.prospectare_import_casute(p_randuri jsonb, p_proba boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e jsonb;
  v_adresa text;
  v_randuri integer := 0;
begin
  for e in select value from jsonb_array_elements(p_randuri) loop
    v_adresa := lower(btrim(e ->> 'adresa'));
    v_randuri := v_randuri + 1;
    if p_proba then
      continue;
    end if;
    insert into public.prospectare_casute (adresa, domeniu)
    values (v_adresa, public.prospectare_domeniu(split_part(v_adresa, '@', 2)))
    on conflict (adresa) do nothing;
    insert into public.prospectare_casute_zi (adresa, zi, trimise)
    values (v_adresa, (e ->> 'zi')::date, coalesce((e ->> 'trimise')::integer, 0))
    on conflict (adresa, zi) do update set trimise = greatest(public.prospectare_casute_zi.trimise, excluded.trimise);
  end loop;
  return jsonb_build_object('randuri', v_randuri);
end;
$$;

-- Autentificarea roboților și limita de cereri --------------------------------------
-- Primește hash-ul SHA-256 (hex) al tokenului din `Authorization: Bearer`. Fereastră
-- fixă de un minut; peste `cereri_pe_minut` cererea e refuzată (429).

create or replace function public.prospectare_autentifica(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.prospectare_dispozitive%rowtype;
  v_limita integer;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select * into d from public.prospectare_dispozitive where token_hash = p_token_hash;
  if not found then
    return null;
  end if;
  if not d.activ then
    return jsonb_build_object('id', d.id, 'nume', d.nume, 'activ', false);
  end if;
  select cereri_pe_minut into v_limita from public.prospectare_setari where id = 1;
  update public.prospectare_dispozitive
    set cereri_numar = case when cereri_fereastra is null or cereri_fereastra < date_trunc('minute', now()) then 1 else cereri_numar + 1 end,
        cereri_fereastra = date_trunc('minute', now()),
        ultima_activitate = now()
    where id = d.id
    returning * into d;
  return jsonb_build_object('id', d.id, 'nume', d.nume, 'activ', true,
    'depasit', d.cereri_numar > coalesce(v_limita, 120), 'cereri', d.cereri_numar, 'limita', coalesce(v_limita, 120));
end;
$$;

-- RLS și drepturi ----------------------------------------------------------------

alter table public.prospectare_casute enable row level security;
alter table public.prospectare_casute_zi enable row level security;

drop policy if exists prospectare_casute_admin_read on public.prospectare_casute;
create policy prospectare_casute_admin_read on public.prospectare_casute for select to authenticated using (public.is_lead_admin());
drop policy if exists prospectare_casute_zi_admin_read on public.prospectare_casute_zi;
create policy prospectare_casute_zi_admin_read on public.prospectare_casute_zi for select to authenticated using (public.is_lead_admin());

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.prospectare_casuta_azi(text, integer)',
    'public.prospectare_gaseste_firma(text, integer)',
    'public.prospectare_email_cere_canal(uuid, text, integer, text, integer)',
    'public.prospectare_email_eveniment(uuid, text, text, integer, text, jsonb, text, integer)',
    'public.prospectare_upsert_firme(jsonb, text, text, boolean)',
    'public.prospectare_import_activitate(jsonb, text, boolean)',
    'public.prospectare_import_casute(jsonb, boolean)',
    'public.prospectare_autentifica(text)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke all on function %s from anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;

select 'RLS activ pe prospectare_casute și prospectare_casute_zi' as verificare,
  (select bool_and(relrowsecurity) from pg_class where relname in ('prospectare_casute', 'prospectare_casute_zi') and relnamespace = 'public'::regnamespace) as ok
union all
select 'importul și autentificarea doar pentru cheia de service',
  not has_function_privilege('anon', 'public.prospectare_autentifica(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.prospectare_upsert_firme(jsonb, text, text, boolean)', 'execute')
union all
select 'toate cele 8 tabele ale prospectării au RLS',
  (select count(*) = 8 from pg_class where relname like 'prospectare\_%' and relkind = 'r' and relrowsecurity and relnamespace = 'public'::regnamespace);
