-- ============================================================
-- Prospectare, migrarea 9 (36): email ȘI WhatsApp pe aceeași firmă.
--
-- Firmele cu email valid și mobil primesc și email, și WhatsApp: câte o singură dată
-- pe fiecare canal (niciodată de două ori pe același), cele mai vechi site-uri primele,
-- pe fiecare canal, după limitele zilei.
--   - Niciodată două canale în aceeași zi: al doilea pleacă cel mai devreme a doua zi
--     după primul (email azi → WhatsApp de mâine încolo, și invers).
--   - Al doilea canal nu mai pleacă dacă firma a răspuns la email (un om, nu răspunsul
--     automat), e interesată, client, respinsă, „Nu contacta”, duplicat sau e pe telefon
--     („Apeluri azi”, „Sună înapoi”).
--   - Telefonul rămâne separat: în „Apeluri azi” intră doar firmele necontactate; alt
--     canal lângă telefon (și telefonul lângă alt canal) se permite tot din fișa firmei.
--   - O firmă are în continuare cel mult o programare activă (un canal pe zi).
--
-- Ziua de azi se completează singură, fără să aștepte 00:00, când apar locuri sau firme
-- noi: la rularea acestui fișier, la import, la /termina (site gata și publicat) și când
-- se schimbă o limită în Setări (conturile WhatsApp, căsuțele, plafonul de încălzire).
--
-- Doar cheia de service. Se rulează după 35. Se poate rula de mai multe ori. Adminul de
-- pe main merge și cu ea (aceleași funcții, aceleași răspunsuri).
-- ============================================================

-- 1. Cine poate merge pe un canal, într-o zi -------------------------------------------------

-- Începutul unei zile, ora României.
create or replace function public.prospectare_inceput_zi(p_zi date)
returns timestamptz
language sql
stable
as $$
  select (p_zi::timestamp at time zone 'Europe/Bucharest')
$$;

-- A răspuns la email un om (nu un răspuns automat): de aici continuă omul, nu distribuția.
create or replace function public.prospectare_a_raspuns(f public.prospectare_firme)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.prospectare_activitate a
    where a.firma_id = f.id and a.tip = 'raspuns' and coalesce(a.detalii ->> 'tip', '') <> 'automat')
$$;

-- Firma poate fi programată (sau contactată) pe canal în ziua p_zi. Programarea activă se verifică separat.
create or replace function public.prospectare_poate_canal_in(f public.prospectare_firme, p_canal text, p_zi date)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    f.etapa not in ('nu_contacta', 'client', 'respins')
    and f.link_demo is not null and f.demo_verificat
    and not (f.date_extra ? 'duplicat_de')
    and case p_canal
      when 'email' then f.email_la is null and public.prospectare_email_valid(f)
      when 'whatsapp' then f.whatsapp_la is null and f.este_mobil and not f.telefon_gresit
      when 'telefon' then f.telefon_la is null and f.telefon is not null and not f.telefon_gresit
      else false
    end
    and (
      -- Primul contact.
      (f.etapa = 'site_gata' and f.email_la is null and f.whatsapp_la is null and f.telefon_la is null)
      -- Permis de un admin, din fișa firmei.
      or coalesce(f.canal_permis = p_canal, false)
      -- Al doilea canal: WhatsApp după email sau email după WhatsApp, din ziua de după primul,
      -- cât firma nu e pe telefon și n-a răspuns.
      or (p_canal in ('email', 'whatsapp')
          and f.etapa in ('site_gata', 'email_trimis', 'whatsapp_trimis')
          and f.telefon_la is null
          and coalesce((case p_canal when 'email' then f.whatsapp_la else f.email_la end) < public.prospectare_inceput_zi(p_zi), false)
          and not public.prospectare_a_raspuns(f))
    ), false)
$$;

-- Azi (cum o folosesc funcțiile din 35 și adminul).
create or replace function public.prospectare_poate_canal(f public.prospectare_firme, p_canal text)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.prospectare_poate_canal_in(f, p_canal, public.prospectare_azi())
$$;

-- De ce nu poate, în ziua p_zi (pentru mesajele din admin). Null = poate.
create or replace function public.prospectare_motiv_canal_in(f public.prospectare_firme, p_canal text, p_zi date)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when public.prospectare_poate_canal_in(f, p_canal, p_zi) then null
    when f.etapa = 'nu_contacta' then '„Nu contacta”'
    when f.date_extra ? 'duplicat_de' then format('duplicat al #%s', f.date_extra ->> 'duplicat_de')
    when f.etapa in ('client', 'respins') then format('etapa „%s”', f.etapa)
    when f.link_demo is null then 'site-ul demo nu are link'
    when not f.demo_verificat then 'linkul demo nu e verificat (site nepublicat)'
    when p_canal = 'email' and f.email_la is not null then 'a primit deja email'
    when p_canal = 'whatsapp' and f.whatsapp_la is not null then 'a primit deja WhatsApp'
    when p_canal = 'telefon' and f.telefon_la is not null then 'e deja în lista de apeluri'
    when p_canal = 'email' and f.email is null then 'fără adresă de email'
    when p_canal = 'email' and not public.prospectare_email_valid(f) then 'emailul nu e verificat ca bun (sau firma e doar pentru WhatsApp)'
    when p_canal <> 'email' and f.telefon_gresit then 'număr greșit: merge doar pe email'
    when p_canal = 'whatsapp' and not f.este_mobil then 'fără număr de mobil'
    when p_canal = 'telefon' and f.telefon is null then 'fără telefon'
    when f.canal_permis is distinct from p_canal and f.telefon_la is not null then 'e pe telefon (în lista de apeluri sau „Sună înapoi”)'
    when p_canal = 'telefon' and (f.email_la is not null or f.whatsapp_la is not null) then 'contactată deja pe ' ||
      concat_ws(', ', case when f.email_la is not null then 'email' end, case when f.whatsapp_la is not null then 'WhatsApp' end) ||
      ': telefonul se permite din fișa firmei'
    when f.etapa in ('cercetat', 'site_in_lucru') then format('etapa „%s”: site-ul nu e gata', f.etapa)
    when f.etapa not in ('site_gata', 'email_trimis', 'whatsapp_trimis') then format('etapa „%s”: continuă omul', f.etapa)
    when public.prospectare_a_raspuns(f) then 'a răspuns la email: continuă omul'
    when (case p_canal when 'email' then f.whatsapp_la else f.email_la end) >= public.prospectare_inceput_zi(p_zi) then
      format('a primit %s în aceeași zi: %s pleacă de a doua zi', case p_canal when 'email' then 'WhatsApp' else 'email' end,
        case p_canal when 'email' then 'emailul' else 'WhatsApp-ul' end)
    else 'nu poate merge pe acest canal'
  end
$$;

create or replace function public.prospectare_motiv_canal(f public.prospectare_firme, p_canal text)
returns text
language sql
stable
set search_path = public
as $$
  select public.prospectare_motiv_canal_in(f, p_canal, public.prospectare_azi())
$$;

-- 2. Regulile firmei: email și WhatsApp împreună, în zile diferite; telefonul separat -------

create or replace function public.prospectare_firme_reguli()
returns trigger
language plpgsql
as $$
declare
  v_import boolean := coalesce(current_setting('prospectare.import_istoric', true), '') = 'da';
  v_reset text := coalesce(current_setting('prospectare.reseteaza_canal', true), '');
  v_noi text[] := '{}';
  v_vechi text[] := '{}';
  v_prog record;
  c text;
  v_altele text[];
begin
  new.domeniu := public.prospectare_domeniu(new.domeniu);

  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.nr <> old.nr then
      raise exception 'Numărul și id-ul unei firme nu se schimbă (#%).', old.nr using errcode = 'PR400';
    end if;
    new.creat_la := old.creat_la;

    -- Același canal nu se folosește de două ori: data lui, odată pusă, rămâne.
    if old.email_la is not null and new.email_la is distinct from old.email_la then
      raise exception 'Firma #% a primit deja email (%): același canal nu se folosește de două ori.', old.nr,
        to_char(old.email_la at time zone 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI') using errcode = 'PR409';
    end if;
    if old.whatsapp_la is not null and (new.whatsapp_la is distinct from old.whatsapp_la or new.whatsapp_cont is distinct from old.whatsapp_cont) then
      -- Excepția: „Anulează” în primele minute după trimitere (prospectare_whatsapp_anuleaza).
      if not (new.whatsapp_la is null and new.whatsapp_cont is null and v_reset = 'whatsapp') then
        raise exception 'Firma #% a primit deja WhatsApp (%): același canal nu se folosește de două ori.', old.nr,
          to_char(old.whatsapp_la at time zone 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI') using errcode = 'PR409';
      end if;
    end if;
    if old.telefon_la is not null and new.telefon_la is distinct from old.telefon_la then
      -- Excepția: firma se întoarce în distribuție („Nu răspunde”, „Număr greșit”, nesunată la 00:00).
      if not (new.telefon_la is null and v_reset in ('da', 'telefon')) then
        raise exception 'Firma #% e deja pe telefon: același canal nu se folosește de două ori.', old.nr using errcode = 'PR409';
      end if;
    end if;

    if old.email_la is not null then v_vechi := array_append(v_vechi, 'email'); end if;
    if old.whatsapp_la is not null and new.whatsapp_la is not null then v_vechi := array_append(v_vechi, 'whatsapp'); end if;
    if old.telefon_la is not null and new.telefon_la is not null then v_vechi := array_append(v_vechi, 'telefon'); end if;
    if new.email_la is not null and old.email_la is null then v_noi := array_append(v_noi, 'email'); end if;
    if new.whatsapp_la is not null and old.whatsapp_la is null then v_noi := array_append(v_noi, 'whatsapp'); end if;
    if new.telefon_la is not null and old.telefon_la is null then v_noi := array_append(v_noi, 'telefon'); end if;

    -- „Nu contacta” blochează toate canalele: nimic nou după ce a cerut asta.
    if old.etapa = 'nu_contacta' and cardinality(v_noi) > 0 then
      raise exception 'Firma #% e „Nu contacta”: nu mai primește niciun canal.', old.nr using errcode = 'PR410';
    end if;

    if not v_import and cardinality(v_noi) > 0 then
      -- Programată pe un canal: celelalte sunt blocate până la 00:00.
      select p.canal, p.zi into v_prog from public.prospectare_programari p where p.firma_id = new.id and p.stare = 'programata' limit 1;
      if found then
        foreach c in array v_noi loop
          if c <> v_prog.canal then
            raise exception 'Firma #% e programată pe % (%): alt canal nu se folosește până atunci.', old.nr,
              case v_prog.canal when 'email' then 'email' when 'whatsapp' then 'WhatsApp' else 'apeluri' end,
              to_char(v_prog.zi, 'DD.MM.YYYY') using errcode = 'PR409';
          end if;
        end loop;
      end if;
      -- Număr greșit: doar email.
      if new.telefon_gresit and ('whatsapp' = any(v_noi) or 'telefon' = any(v_noi)) then
        raise exception 'Firma #% are numărul greșit: merge doar pe email.', old.nr using errcode = 'PR409';
      end if;
    end if;

    -- Mai multe canale (36): emailul și WhatsApp-ul merg împreună, dar niciodată în aceeași zi.
    -- Telefonul rămâne separat: alt canal lângă telefon (sau telefonul lângă alt canal) doar dacă
    -- un admin l-a permis din fișă. La importul de istoric nu se verifică.
    if not v_import and cardinality(v_noi) > 0 and cardinality(v_vechi) + cardinality(v_noi) > 1 then
      foreach c in array v_noi loop
        if cardinality(v_vechi) > 0 or c <> v_noi[1] then
          v_altele := array_remove(v_vechi || v_noi, c);
          if c = 'telefon' or 'telefon' = any(v_altele) then
            if old.canal_permis is distinct from c then
              raise exception 'Firma #% are deja %: canalul % se permite doar din fișa firmei (telefonul rămâne separat).', old.nr,
                array_to_string(v_altele, ', '), c using errcode = 'PR409';
            end if;
          elsif old.canal_permis is distinct from c
             and ((c = 'whatsapp' and new.email_la >= public.prospectare_inceput_azi())
               or (c = 'email' and new.whatsapp_la >= public.prospectare_inceput_azi())) then
            raise exception 'Firma #% a primit % azi: % pleacă de mâine (niciodată două canale în aceeași zi).', old.nr,
              case c when 'email' then 'WhatsApp' else 'email' end,
              case c when 'email' then 'emailul' else 'WhatsApp-ul' end using errcode = 'PR409';
          end if;
          if old.canal_permis = c then
            -- Permisiunea s-a folosit.
            new.canal_permis := null;
            new.canal_permis_motiv := null;
            new.canal_permis_la := null;
            new.canal_permis_de := null;
          end if;
        end if;
      end loop;
    end if;

    -- Permisiunea nu se dă pentru un canal deja folosit.
    if new.canal_permis is not null and new.canal_permis is distinct from old.canal_permis then
      if (new.canal_permis = 'email' and new.email_la is not null)
         or (new.canal_permis = 'whatsapp' and new.whatsapp_la is not null)
         or (new.canal_permis = 'telefon' and new.telefon_la is not null) then
        raise exception 'Firma #% a fost contactată deja pe %.', old.nr, new.canal_permis using errcode = 'PR409';
      end if;
    end if;
  end if;

  if new.whatsapp_cont is not null and new.whatsapp_la is null then
    raise exception 'Contul WhatsApp se pune doar odată cu data mesajului (#%).', new.nr using errcode = 'PR422';
  end if;

  new.actualizat_la := now();
  return new;
end;
$$;
-- 3. Umplerea zilei: ciclul de la 00:00 și completările de peste zi -------------------------

-- Emailul (cele mai vechi site-uri, pe căsuța domeniului lor, cât permite limita), apoi
-- WhatsApp-ul (următoarele, cu mobil, egal pe conturi). Fără programările manuale.
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
    order by (x.canal_permis = 'email') desc nulls last, x.site_gata_la nulls last, x.nr
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
    order by (x.canal_permis = 'whatsapp') desc nulls last, x.site_gata_la nulls last, x.nr
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

create or replace function public.prospectare_ciclu_zi(p_zi date default null, p_fortat boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zi date := coalesce(p_zi, public.prospectare_azi());
  v_rez jsonb;
  r record;
  f public.prospectare_firme%rowtype;
  v_loc text;
  v_el_email integer := 0;
  v_el_wa integer := 0;
  v_el_tel integer := 0;
  v_man_email integer := 0;
  v_man_wa integer := 0;
  v_man_tel integer := 0;
  v_aut_email integer := 0;
  v_aut_wa integer := 0;
  v_mutate integer := 0;
  v_anulate integer := 0;
  v_suna_inapoi integer := 0;
  v_rezerva integer;
  v_umple jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('prospectare_ciclu_zi'));
  if not p_fortat then
    select rezultat into v_rez from public.prospectare_cicluri where zi = v_zi;
    if found then
      return v_rez;
    end if;
  end if;
  perform set_config('prospectare.autor', 'distribuție 00:00', true);

  -- a) Ce n-a plecat se întoarce în distribuție.
  with el as (
    update public.prospectare_programari
      set stare = 'eliberata', inchis_la = now(), motiv = 'nefolosită până la 00:00'
      where zi < v_zi and stare = 'programata'
      returning canal
  )
  select count(*) filter (where canal = 'email'), count(*) filter (where canal = 'whatsapp')
    into v_el_email, v_el_wa from el;

  for r in
    select l.id, l.firma_id from public.prospectare_liste_zi l
    where l.data < v_zi and l.rezultat is null and l.canal = 'telefon'
    for update skip locked
  loop
    perform set_config('prospectare.reseteaza_canal', 'telefon', true);
    perform set_config('prospectare.motiv', 'Nesunată până la 00:00: înapoi în distribuție', true);
    update public.prospectare_firme
      set telefon_la = null, etapa = case when etapa = 'sunat' then 'site_gata' else etapa end
      where id = r.firma_id and telefon_la is not null;
    perform set_config('prospectare.reseteaza_canal', '', true);
    perform set_config('prospectare.motiv', '', true);
    delete from public.prospectare_liste_zi where id = r.id;
    v_el_tel := v_el_tel + 1;
  end loop;

  -- „Sună înapoi” rămâne pe telefon: trece în lista zilei.
  update public.prospectare_liste_zi l set data = v_zi, actualizat_la = now()
    where l.data < v_zi and l.rezultat = 'suna_inapoi'
      and not exists (select 1 from public.prospectare_liste_zi t where t.firma_id = l.firma_id and t.data = v_zi);
  get diagnostics v_suna_inapoi = row_count;

  -- Programările manuale ale zilei: au prioritate. Ce nu mai e eligibil se anulează,
  -- ce nu încape trece pe ziua următoare, pe același canal.
  for r in
    select p.*, f2 as firma from public.prospectare_programari p join public.prospectare_firme f2 on f2.id = p.firma_id
    where p.zi = v_zi and p.stare = 'programata' and p.sursa = 'manual'
    order by p.id
    for update of p
  loop
    if not public.prospectare_poate_canal_in(r.firma, r.canal, v_zi) then
      update public.prospectare_programari set stare = 'anulata', inchis_la = now(),
        motiv = 'nu mai poate merge pe acest canal: ' || coalesce(public.prospectare_motiv_canal_in(r.firma, r.canal, v_zi), '—')
        where id = r.id;
      v_anulate := v_anulate + 1;
      continue;
    end if;
    -- Locul ales la programare, dacă mai e liber; altfel altul pe același canal.
    v_loc := null;
    if r.canal = 'email' then
      if exists (select 1 from public.prospectare_casute c where c.adresa = r.casuta and c.activa
                  and (select count(*) from public.prospectare_programari o where o.zi = v_zi and o.canal = 'email' and o.casuta = c.adresa
                         and o.stare in ('programata', 'folosita') and o.id < r.id) < public.prospectare_limita_casuta(c)) then
        v_loc := r.casuta;
      end if;
    elsif r.canal = 'whatsapp' then
      if exists (select 1 from public.prospectare_conturi_whatsapp k where k.id = r.cont_whatsapp and k.activ
                  and (select count(*) from public.prospectare_programari o where o.zi = v_zi and o.canal = 'whatsapp' and o.cont_whatsapp = k.id
                         and o.stare in ('programata', 'folosita') and o.id < r.id) < k.limita_zi) then
        v_loc := r.cont_whatsapp::text;
      end if;
    else
      if (select count(*) from public.prospectare_programari o where o.zi = v_zi and o.canal = 'telefon' and o.utilizator = r.utilizator
            and o.stare in ('programata', 'folosita') and o.id < r.id) < (select apeluri_pe_zi from public.prospectare_setari where id = 1) then
        v_loc := r.utilizator;
      end if;
    end if;

    if v_loc is null then
      update public.prospectare_programari
        set zi = v_zi + 1, zi_ceruta = coalesce(zi_ceruta, zi),
            motiv = format('mutată pe %s: limita zilei de %s era plină', to_char(v_zi + 1, 'DD.MM'), to_char(v_zi, 'DD.MM'))
        where id = r.id;
      v_mutate := v_mutate + 1;
      continue;
    end if;

    if r.canal = 'telefon' then
      -- Apelurile programate intră în „Apeluri azi” ale omului ales.
      update public.prospectare_programari set stare = 'folosita', inchis_la = now(), motiv = 'pusă în lista de apeluri' where id = r.id;
      perform set_config('prospectare.motiv', 'Programată în lista de apeluri', true);
      update public.prospectare_firme set telefon_la = now() where id = r.firma_id;
      insert into public.prospectare_liste_zi (data, utilizator, canal, firma_id) values (v_zi, r.utilizator, 'telefon', r.firma_id)
        on conflict (firma_id, data) do nothing;
      v_man_tel := v_man_tel + 1;
    elsif r.canal = 'email' then
      v_man_email := v_man_email + 1;
    else
      v_man_wa := v_man_wa + 1;
    end if;
  end loop;

  -- b) Email și c) WhatsApp: cele mai vechi site-uri, cât permit limitele (prospectare_umple_zi).
  v_umple := public.prospectare_umple_zi(v_zi, 'distribuție 00:00');
  v_aut_email := (v_umple ->> 'email')::integer;
  v_aut_wa := (v_umple ->> 'whatsapp')::integer;

  -- d) Apelurile nu se programează automat: restul stă în rezervă.
  select count(*) into v_rezerva from public.prospectare_firme x
    where (public.prospectare_poate_canal_in(x, 'email', v_zi) or public.prospectare_poate_canal_in(x, 'whatsapp', v_zi) or public.prospectare_poate_canal_in(x, 'telefon', v_zi))
      and not exists (select 1 from public.prospectare_programari p where p.firma_id = x.id and p.stare = 'programata');

  v_rez := jsonb_build_object(
    'zi', v_zi,
    'rulat_la', now(),
    'eliberate', jsonb_build_object('email', v_el_email, 'whatsapp', v_el_wa, 'telefon', v_el_tel),
    'programate', jsonb_build_object(
      'email', jsonb_build_object('manual', v_man_email, 'automat', v_aut_email),
      'whatsapp', jsonb_build_object('manual', v_man_wa, 'automat', v_aut_wa),
      'telefon', jsonb_build_object('manual', v_man_tel)),
    'mutate', v_mutate,
    'anulate', v_anulate,
    'suna_inapoi', v_suna_inapoi,
    'rezerva', v_rezerva
  );
  insert into public.prospectare_cicluri (zi, rulat_la, rezultat) values (v_zi, now(), v_rez)
    on conflict (zi) do update set rulat_la = excluded.rulat_la,
      rezultat = excluded.rezultat || jsonb_strip_nulls(jsonb_build_object('completari', public.prospectare_cicluri.rezultat -> 'completari'))
    returning rezultat into v_rez;
  return v_rez;
end;
$$;
-- Completarea zilei de azi, fără să aștepte 00:00: locurile libere (o limită mărită, o căsuță
-- nouă) și firmele noi (importul, un site gata) se umplu pe loc, cu regulile ciclului.
create or replace function public.prospectare_completeaza_azi(p_motiv text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zi date;
  v jsonb;
  v_motiv text := coalesce(nullif(btrim(p_motiv), ''), 'admin');
begin
  perform public.prospectare_asigura_ciclu();
  perform pg_advisory_xact_lock(hashtext('prospectare_ciclu_zi'));
  v_zi := public.prospectare_azi();
  v := public.prospectare_umple_zi(v_zi, left('completare: ' || v_motiv, 200));
  if (v ->> 'email')::integer + (v ->> 'whatsapp')::integer > 0 then
    update public.prospectare_cicluri
      set rezultat = jsonb_set(rezultat, '{completari}', jsonb_build_object(
        'email', coalesce((rezultat #>> '{completari,email}')::integer, 0) + (v ->> 'email')::integer,
        'whatsapp', coalesce((rezultat #>> '{completari,whatsapp}')::integer, 0) + (v ->> 'whatsapp')::integer,
        'ultima_la', now(),
        'ultimul_motiv', left(v_motiv, 200)))
      where zi = v_zi;
  end if;
  return v || jsonb_build_object('zi', v_zi);
end;
$$;

-- O limită schimbată în Setări (contul WhatsApp, căsuța, plafonul de încălzire): azi se completează.
create or replace function public.prospectare_limite_completeaza()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.prospectare_completeaza_azi(case tg_table_name
    when 'prospectare_conturi_whatsapp' then 'contul WhatsApp schimbat în Setări'
    when 'prospectare_casute' then 'căsuța schimbată'
    else 'plafonul căsuțelor schimbat în Setări' end);
  return null;
end;
$$;

drop trigger if exists prospectare_conturi_whatsapp_completeaza on public.prospectare_conturi_whatsapp;
create trigger prospectare_conturi_whatsapp_completeaza
  after update of limita_zi, activ on public.prospectare_conturi_whatsapp
  for each row when (old.limita_zi is distinct from new.limita_zi or old.activ is distinct from new.activ)
  execute function public.prospectare_limite_completeaza();
drop trigger if exists prospectare_conturi_whatsapp_completeaza_nou on public.prospectare_conturi_whatsapp;
create trigger prospectare_conturi_whatsapp_completeaza_nou
  after insert on public.prospectare_conturi_whatsapp
  for each row execute function public.prospectare_limite_completeaza();
drop trigger if exists prospectare_casute_completeaza on public.prospectare_casute;
create trigger prospectare_casute_completeaza
  after update of limita_zi, activa on public.prospectare_casute
  for each row when (old.limita_zi is distinct from new.limita_zi or old.activa is distinct from new.activa)
  execute function public.prospectare_limite_completeaza();
drop trigger if exists prospectare_casute_completeaza_nou on public.prospectare_casute;
create trigger prospectare_casute_completeaza_nou
  after insert on public.prospectare_casute
  for each row execute function public.prospectare_limite_completeaza();
drop trigger if exists prospectare_setari_completeaza on public.prospectare_setari;
create trigger prospectare_setari_completeaza
  after update of email_plafon_casuta on public.prospectare_setari
  for each row when (old.email_plafon_casuta is distinct from new.email_plafon_casuta)
  execute function public.prospectare_limite_completeaza();

-- 4. Programarea manuală: eligibilitatea se judecă pentru ziua aleasă ----------------------

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
    coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'nr', a.nr, 'nume', a.nume, 'domeniu', a.domeniu, 'oras', a.oras, 'nisa', a.nisa,
        'lot', a.lot, 'construit_de', a.construit_de, 'site_gata_la', a.site_gata_la, 'email', a.email, 'telefon', a.telefon,
        'este_mobil', a.este_mobil, 'link_demo', a.link_demo) order by a.site_gata_la nulls last, a.nr)
      from (select * from alese order by site_gata_la nulls last, nr limit least(greatest(coalesce(p_limit, 200), 1), 1000) offset greatest(coalesce(p_offset, 0), 0)) a), '[]'::jsonb)
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
    order by x.site_gata_la nulls last, x.nr
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
-- 5. Email și WhatsApp: al doilea canal, din ziua următoare ---------------------------------

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
  p public.prospectare_programari%rowtype;
  v_limita integer;
  v_nume text;
  v_canale text;
  v_alta record;
begin
  perform public.prospectare_asigura_ciclu();
  select nume into v_nume from public.prospectare_dispozitive where id = p_dispozitiv;
  perform set_config('prospectare.autor', coalesce(v_nume, 'robot'), true);
  f := public.prospectare_gaseste_firma(p_domeniu, p_nr);

  if f.etapa in ('nu_contacta', 'client') or (f.etapa = 'respins' and f.canal_permis is distinct from 'email') then
    raise exception 'Firma #% e „%”: nu se trimite email.', f.nr, f.etapa using errcode = 'PR410';
  end if;
  if f.email_la is not null then
    raise exception 'Firma #% a primit deja email (%): același canal nu se folosește de două ori.', f.nr,
      to_char(f.email_la at time zone 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI') using errcode = 'PR409';
  end if;
  -- Mai multe canale (36): emailul merge și după WhatsApp, din ziua următoare; nu lângă telefon.
  if f.telefon_la is not null and f.canal_permis is distinct from 'email' then
    raise exception 'Firma #% e pe telefon: emailul nu se trimite.', f.nr using errcode = 'PR409';
  end if;
  if f.whatsapp_la >= public.prospectare_inceput_azi() and f.canal_permis is distinct from 'email' then
    raise exception 'Firma #% a primit WhatsApp azi: emailul pleacă de mâine.', f.nr using errcode = 'PR409';
  end if;
  if f.email is null then
    raise exception 'Firma #% nu are adresă de email.', f.nr using errcode = 'PR422';
  end if;
  if f.link_demo is null or (f.etapa not in ('site_gata', 'whatsapp_trimis') and f.canal_permis is distinct from 'email') then
    raise exception 'Firma #% nu are încă site demo gata, cu link: emailul nu se trimite.', f.nr using errcode = 'PR422';
  end if;

  -- Doar ce e programat azi pe email (din /coada-email), de pe căsuța programată.
  select * into p from public.prospectare_programari
    where firma_id = f.id and stare = 'programata' and canal = 'email' and zi = public.prospectare_azi()
    for update;
  if not found then
    select canal, zi into v_alta from public.prospectare_programari where firma_id = f.id and stare = 'programata';
    if found then
      raise exception 'Firma #% e programată pe % (%), nu pe email azi: nu trimiți.', f.nr,
        case v_alta.canal when 'email' then 'email' when 'whatsapp' then 'WhatsApp' else 'apeluri' end, to_char(v_alta.zi, 'DD.MM') using errcode = 'PR409';
    end if;
    raise exception 'Firma #% nu e programată azi pe email: robotul trimite doar ce primește din /coada-email.', f.nr using errcode = 'PR409';
  end if;
  if lower(btrim(coalesce(p_casuta, ''))) <> p.casuta then
    raise exception 'Firma #% e programată azi pe căsuța %, nu pe %.', f.nr, p.casuta, lower(btrim(coalesce(p_casuta, ''))) using errcode = 'PR409';
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

  update public.prospectare_programari set stare = 'folosita', inchis_la = now(), motiv = 'emailul cerut de ' || coalesce(v_nume, 'robot') where id = p.id;
  perform set_config('prospectare.motiv', format('Robotul a cerut canalul email (căsuța %s)', c.adresa), true);
  update public.prospectare_firme set email_la = now() where id = f.id returning * into f;

  return jsonb_build_object(
    'trimite', true,
    'firma', jsonb_build_object('id', f.id, 'nr', f.nr, 'nume', f.nume, 'domeniu', f.domeniu, 'email', f.email,
      'persoana_contact', f.persoana_contact, 'link_demo', f.link_demo, 'etapa', f.etapa),
    'casuta', jsonb_build_object('adresa', c.adresa, 'trimise_azi', z.trimise, 'limita_azi', v_limita)
  );
end;
$$;
create or replace function public.prospectare_whatsapp_trimis(p_firma uuid, p_cont smallint, p_autor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.prospectare_firme%rowtype;
  k public.prospectare_conturi_whatsapp%rowtype;
  p public.prospectare_programari%rowtype;
  v_alta record;
  v_trimise integer;
  v_canale text;
begin
  perform public.prospectare_asigura_ciclu();
  select * into f from public.prospectare_firme where id = p_firma for update;
  if not found then
    raise exception 'Firma nu există.' using errcode = 'PR404';
  end if;
  if f.etapa = 'nu_contacta' then
    raise exception 'Firma #% e „Nu contacta”: nu mai primește niciun mesaj.', f.nr using errcode = 'PR410';
  end if;
  if f.whatsapp_la is not null then
    raise exception 'Firma #% a primit deja WhatsApp (%, contul %): nu-i trimite încă o dată.', f.nr,
      to_char(f.whatsapp_la at time zone 'Europe/Bucharest', 'DD.MM HH24:MI'), coalesce(f.whatsapp_cont::text, '—') using errcode = 'PR409';
  end if;
  -- Mai multe canale (36): WhatsApp-ul merge și după email, din ziua următoare; nu lângă telefon.
  if f.telefon_la is not null and f.canal_permis is distinct from 'whatsapp' then
    raise exception 'Firma #% e pe telefon: WhatsApp-ul se permite doar din fișa firmei.', f.nr using errcode = 'PR409';
  end if;
  if f.email_la >= public.prospectare_inceput_azi() and f.canal_permis is distinct from 'whatsapp' then
    raise exception 'Firma #% a primit email azi: WhatsApp-ul pleacă de mâine.', f.nr using errcode = 'PR409';
  end if;
  if not public.prospectare_poate_canal(f, 'whatsapp') then
    raise exception 'Firma #% nu poate primi WhatsApp: %.', f.nr, public.prospectare_motiv_canal(f, 'whatsapp') using errcode = 'PR422';
  end if;
  select * into p from public.prospectare_programari
    where firma_id = f.id and stare = 'programata' and canal = 'whatsapp' and zi = public.prospectare_azi()
    for update;
  if not found then
    select canal, zi into v_alta from public.prospectare_programari where firma_id = f.id and stare = 'programata';
    if found then
      raise exception 'Firma #% e programată pe % (%), nu pe WhatsApp azi.', f.nr,
        case v_alta.canal when 'email' then 'email' when 'whatsapp' then 'WhatsApp' else 'apeluri' end, to_char(v_alta.zi, 'DD.MM') using errcode = 'PR409';
    end if;
    raise exception 'Firma #% nu e programată azi pe WhatsApp.', f.nr using errcode = 'PR409';
  end if;
  select * into k from public.prospectare_conturi_whatsapp where id = coalesce(p_cont, p.cont_whatsapp);
  if not found then
    raise exception 'Contul WhatsApp % nu există: alege un cont din Setări.', coalesce(p_cont, p.cont_whatsapp) using errcode = 'PR422';
  end if;
  if not k.activ then
    raise exception '„%” e dezactivat în Setări.', k.nume using errcode = 'PR422';
  end if;

  update public.prospectare_programari set stare = 'folosita', inchis_la = now(), cont_whatsapp = k.id, motiv = 'trimis de ' || coalesce(nullif(btrim(p_autor), ''), k.nume)
    where id = p.id;
  perform set_config('prospectare.autor', coalesce(nullif(btrim(p_autor), ''), k.nume), true);
  perform set_config('prospectare.motiv', format('WhatsApp de pe %s (%s)', k.nume, k.telefon), true);
  update public.prospectare_firme
    set whatsapp_la = now(), whatsapp_cont = k.id,
        etapa = case when etapa in ('site_gata', 'email_trimis') then 'whatsapp_trimis' else etapa end
    where id = f.id;
  perform public.prospectare_noteaza(f.id, 'whatsapp', 'whatsapp', jsonb_build_object('cont', k.id, 'cont_nume', k.nume));

  select count(*) into v_trimise from public.prospectare_firme
    where whatsapp_cont = k.id and whatsapp_la >= public.prospectare_inceput_azi();
  -- Limita contului e doar avertisment: mesajul a plecat oricum.
  return jsonb_build_object('nr', f.nr, 'cont', k.id, 'cont_nume', k.nume, 'trimise_azi', v_trimise, 'limita', k.limita_zi, 'peste_limita', v_trimise > k.limita_zi);
end;
$$;
create or replace function public.prospectare_whatsapp_anuleaza(p_firma uuid, p_autor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.prospectare_firme%rowtype;
  p public.prospectare_programari%rowtype;
  v_cont smallint;
  v_trimise integer;
begin
  select * into f from public.prospectare_firme where id = p_firma for update;
  if not found then
    raise exception 'Firma nu există.' using errcode = 'PR404';
  end if;
  if f.whatsapp_la is null then
    raise exception 'Firma #% n-are WhatsApp trimis: nu e nimic de anulat.', f.nr using errcode = 'PR409';
  end if;
  if f.whatsapp_la < now() - interval '2 minutes' then
    raise exception 'WhatsApp-ul către #% a plecat la %: anularea merge doar în primele 2 minute.', f.nr,
      to_char(f.whatsapp_la at time zone 'Europe/Bucharest', 'HH24:MI') using errcode = 'PR409';
  end if;
  v_cont := f.whatsapp_cont;
  select * into p from public.prospectare_programari
    where firma_id = f.id and canal = 'whatsapp' and stare = 'folosita' and zi = public.prospectare_azi()
    order by inchis_la desc limit 1 for update;

  perform set_config('prospectare.autor', coalesce(nullif(btrim(p_autor), ''), 'admin'), true);
  perform set_config('prospectare.motiv', 'WhatsApp anulat imediat după trimitere', true);
  perform set_config('prospectare.reseteaza_canal', 'whatsapp', true);
  update public.prospectare_firme
    set whatsapp_la = null, whatsapp_cont = null,
        etapa = case when etapa = 'whatsapp_trimis' then case when email_la is not null then 'email_trimis' else 'site_gata' end else etapa end,
        canal_permis = case when telefon_la is not null or email_la >= public.prospectare_inceput_azi() then 'whatsapp' else canal_permis end,
        canal_permis_motiv = case when telefon_la is not null or email_la >= public.prospectare_inceput_azi() then 'restabilită după anularea WhatsApp-ului' else canal_permis_motiv end,
        canal_permis_la = case when telefon_la is not null or email_la >= public.prospectare_inceput_azi() then now() else canal_permis_la end,
        canal_permis_de = case when telefon_la is not null or email_la >= public.prospectare_inceput_azi() then coalesce(nullif(btrim(p_autor), ''), 'admin') else canal_permis_de end
    where id = f.id;
  perform set_config('prospectare.reseteaza_canal', '', true);
  if p.id is not null then
    update public.prospectare_programari set stare = 'programata', inchis_la = null, motiv = 'trimiterea a fost anulată' where id = p.id;
  end if;
  perform public.prospectare_noteaza(f.id, 'whatsapp', 'whatsapp', jsonb_build_object('anulat', true, 'cont', v_cont));
  select count(*) into v_trimise from public.prospectare_firme where whatsapp_cont = v_cont and whatsapp_la >= public.prospectare_inceput_azi();
  return jsonb_build_object('nr', f.nr, 'cont', v_cont, 'trimise_azi', v_trimise, 'reprogramata', p.id is not null);
end;
$$;
-- 6. Importul și /termina completează ziua -------------------------------------------------

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
      if not p_proba then
        insert into public.prospectare_firme (
          nr, nume, domeniu, site_vechi, nisa, oras, judet, scor, telefon, email, persoana_contact,
          etapa, email_la, whatsapp_la, whatsapp_cont, telefon_la, link_demo, captura_url, lot, slug, de_refacut, date_extra,
          site_gata_la, construit_de, demo_verificat
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
          case when v_import then coalesce(nullif(e ->> 'demo_verificat', '')::boolean, false) else false end
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
      -- Data site-ului gata vine din starea roboților: un site refăcut are data nouă.
      n.site_gata_la := coalesce(nullif(e ->> 'site_gata_la', '')::timestamptz, f.site_gata_la);
      n.construit_de := coalesce(nullif(btrim(e ->> 'construit_de'), ''), f.construit_de);
      if e ? 'demo_verificat' then
        n.demo_verificat := coalesce(nullif(e ->> 'demo_verificat', '')::boolean, f.demo_verificat);
      end if;
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
           n.site_gata_la, n.construit_de, n.demo_verificat, n.telefon_gresit)
       is distinct from
       row(f.nume, f.site_vechi, f.nisa, f.oras, f.judet, f.scor, f.telefon, f.email, f.persoana_contact, f.lot, f.slug,
           f.date_extra, f.link_demo, f.captura_url, f.etapa, f.email_la, f.whatsapp_la, f.whatsapp_cont, f.telefon_la, f.de_refacut,
           f.site_gata_la, f.construit_de, f.demo_verificat, f.telefon_gresit) then
      v_actualizate := v_actualizate + 1;
      if not p_proba then
        perform set_config('prospectare.motiv', case when v_import then 'Import din auto-web-rebuilder' else 'Actualizare de la robot' end, true);
        update public.prospectare_firme set
          nume = n.nume, site_vechi = n.site_vechi, nisa = n.nisa, oras = n.oras, judet = n.judet, scor = n.scor,
          telefon = n.telefon, email = n.email, persoana_contact = n.persoana_contact, lot = n.lot, slug = n.slug,
          date_extra = n.date_extra, link_demo = n.link_demo, captura_url = n.captura_url, etapa = n.etapa,
          email_la = n.email_la, whatsapp_la = n.whatsapp_la, whatsapp_cont = n.whatsapp_cont, telefon_la = n.telefon_la,
          de_refacut = n.de_refacut, site_gata_la = n.site_gata_la, construit_de = n.construit_de,
          demo_verificat = n.demo_verificat, telefon_gresit = n.telefon_gresit
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
    'conflicte', v_conflicte
  );
end;
$$;
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
  f public.prospectare_firme%rowtype;
  v_nume text;
begin
  if p_link_demo is null or p_link_demo !~ '^https://[^\s]+$' or char_length(p_link_demo) > 500 then
    raise exception 'Linkul demo trebuie să fie o adresă https://.' using errcode = 'PR422';
  end if;
  if p_captura_url is not null and (p_captura_url !~ '^https://[^\s]+$' or char_length(p_captura_url) > 1000) then
    raise exception 'Linkul capturii trebuie să fie o adresă https:// (Drive).' using errcode = 'PR422';
  end if;
  select nume into v_nume from public.prospectare_dispozitive where id = p_dispozitiv;
  perform set_config('prospectare.autor', coalesce(v_nume, 'robot'), true);

  select * into f from public.prospectare_firme where id = p_firma for update;
  if not found then
    raise exception 'Firma nu există.' using errcode = 'PR404';
  end if;
  if not exists (select 1 from public.prospectare_rezervari where firma_id = p_firma and dispozitiv_id = p_dispozitiv for update) then
    raise exception 'Firma #% nu e rezervată de acest robot.', f.nr using errcode = 'PR409';
  end if;

  perform set_config('prospectare.motiv', 'Site demo gata', true);
  update public.prospectare_firme
    set etapa = case when etapa = 'site_in_lucru' then 'site_gata' else etapa end,
        link_demo = p_link_demo,
        captura_url = coalesce(p_captura_url, captura_url),
        de_refacut = false,
        site_gata_la = now(),
        construit_de = coalesce(v_nume, construit_de),
        demo_verificat = coalesce(p_link_verificat, true),
        date_extra = date_extra || jsonb_build_object('status_robot', 'gata', 'terminat_la', now())
    where id = f.id
    returning * into f;
  delete from public.prospectare_rezervari where firma_id = p_firma;
  perform public.prospectare_noteaza(f.id, 'site', null,
    jsonb_strip_nulls(jsonb_build_object('dispozitiv', p_dispozitiv, 'link_demo', p_link_demo, 'captura_url', p_captura_url,
      'link_verificat', coalesce(p_link_verificat, true))) || coalesce(p_detalii, '{}'::jsonb));
  -- Site gata și publicat: intră azi în distribuție, dacă e loc (36).
  if f.demo_verificat and f.etapa = 'site_gata' then
    perform public.prospectare_completeaza_azi(format('site gata #%s', f.nr));
  end if;
  return jsonb_build_object('nr', f.nr, 'etapa', f.etapa, 'link_demo', f.link_demo, 'demo_verificat', f.demo_verificat);
end;
$$;
-- 7. Drepturi -------------------------------------------------------------------------------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.prospectare_inceput_zi(date)',
    'public.prospectare_a_raspuns(public.prospectare_firme)',
    'public.prospectare_poate_canal_in(public.prospectare_firme, text, date)',
    'public.prospectare_poate_canal(public.prospectare_firme, text)',
    'public.prospectare_motiv_canal_in(public.prospectare_firme, text, date)',
    'public.prospectare_motiv_canal(public.prospectare_firme, text)',
    'public.prospectare_umple_zi(date, text)',
    'public.prospectare_ciclu_zi(date, boolean)',
    'public.prospectare_completeaza_azi(text)',
    'public.prospectare_limite_completeaza()',
    'public.prospectare_programabile(text, jsonb, integer, integer)',
    'public.prospectare_programeaza(text, date, uuid[], smallint, text, text)',
    'public.prospectare_email_cere_canal(uuid, text, integer, text, integer)',
    'public.prospectare_whatsapp_trimis(uuid, smallint, text)',
    'public.prospectare_whatsapp_anuleaza(uuid, text)',
    'public.prospectare_upsert_firme(jsonb, text, text, boolean)',
    'public.prospectare_termina(uuid, uuid, text, text, jsonb, boolean)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke all on function %s from anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;

-- 8. Azi: firmele care au primit email înainte de azi și au mobil intră pe WhatsApp (și invers), cât e loc.
select public.prospectare_completeaza_azi('migrarea 36');

-- Verificarea (toate rândurile trebuie să fie `true`).
select 'mai multe canale: email și WhatsApp pe aceeași firmă, în zile diferite' as verificare,
  exists (select 1 from pg_proc where proname = 'prospectare_poate_canal_in' and pronamespace = 'public'::regnamespace) as ok
union all
select 'ziua de azi se completează la schimbarea limitelor (5 triggere)',
  (select count(*) = 5 from pg_trigger where tgname in ('prospectare_conturi_whatsapp_completeaza', 'prospectare_conturi_whatsapp_completeaza_nou',
    'prospectare_casute_completeaza', 'prospectare_casute_completeaza_nou', 'prospectare_setari_completeaza') and not tgisinternal)
union all
select 'funcțiile noi doar pentru cheia de service',
  not has_function_privilege('authenticated', 'public.prospectare_completeaza_azi(text)', 'execute')
  and not has_function_privilege('anon', 'public.prospectare_poate_canal_in(public.prospectare_firme, text, date)', 'execute')
  and has_function_privilege('service_role', 'public.prospectare_umple_zi(date, text)', 'execute')
union all
select 'ciclul de la 00:00: ' || public.prospectare_cron_stare(), true
union all
select format('azi (%s): programate pe email %s, pe WhatsApp %s (%s)', to_char(public.prospectare_azi(), 'DD.MM'),
    (select count(*) from public.prospectare_programari where zi = public.prospectare_azi() and canal = 'email' and stare in ('programata', 'folosita')),
    (select count(*) from public.prospectare_programari where zi = public.prospectare_azi() and canal = 'whatsapp' and stare in ('programata', 'folosita')),
    coalesce((select string_agg(k.nume || ': ' || (select count(*) from public.prospectare_programari p where p.zi = public.prospectare_azi()
        and p.canal = 'whatsapp' and p.cont_whatsapp = k.id and p.stare in ('programata', 'folosita')) || ' / ' || k.limita_zi, ', ' order by k.ordine, k.id)
      from public.prospectare_conturi_whatsapp k where k.activ), 'niciun cont activ')),
  true;
