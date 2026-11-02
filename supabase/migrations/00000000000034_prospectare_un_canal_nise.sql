-- ============================================================
-- Prospectare, migrarea 7: un singur canal (cu recontactare din fișă), conturile
-- de WhatsApp, tabla comună de nișe, evaluările și coada comună de construcție.
--
-- Regula canalelor (2 nov, înlocuiește regula de dimineață din migrarea 33):
-- - Implicit, o firmă e contactată pe UN SINGUR canal: email, WhatsApp sau
--   apel. Primul canal o blochează pentru celelalte (trigger, PR409).
-- - În lista de WhatsApp și în „Apeluri azi” intră doar firme cu site gata care
--   n-au primit niciun contact. Regula „WhatsApp la o zi după email” dispare.
-- - Al doilea canal se dă doar manual, de un admin, din fișa firmei
--   (`prospectare_permite_recontactare`, cu motiv obligatoriu, scris în
--   activitate). Permisiunea se consumă când canalul e folosit.
-- - „Nu contacta” blochează tot. Firmele care au deja două canale (istoric)
--   rămân cum sunt; importul de istoric poate scrie mai multe canale.
--
-- Coordonarea roboților:
-- - `prospectare_nise`: nișă + zonă, liberă / rezervată / în cercetare /
--   terminată, cine a rezervat și când, câte firme găsite / eligibile /
--   respinse. Rezervarea expiră după 24 h fără semn de viață.
-- - Evaluări: fiecare firmă evaluată se notează (și cele respinse, cu motiv și
--   scor); un domeniu deja evaluat nu se mai notează.
-- - Coada de construcție e comună: orice firmă eligibilă cu scor ≥ 45 (Setări),
--   cu email sau mobil și fără site, poate fi luată de orice robot (3 ore).
-- - Ce face fiecare robot acum: cercetare / construcție / trimitere.
--
-- Doar cheia de service. Se rulează după 28–33. Se poate rula de mai multe ori.
-- ============================================================

-- Activitatea: tipuri noi -------------------------------------------------------------

alter table public.prospectare_activitate drop constraint if exists prospectare_activitate_tip_check;
alter table public.prospectare_activitate add constraint prospectare_activitate_tip_check check (tip in (
  'creata', 'etapa', 'canal', 'apel', 'whatsapp', 'email', 'bounce', 'raspuns',
  'site', 'rezervare', 'nota', 'lista', 'import', 'cercetare', 'sistem', 'recontactare', 'evaluare'
));

-- Conturile de WhatsApp (din Setări) --------------------------------------------------

create table if not exists public.prospectare_conturi_whatsapp (
  id smallint primary key check (id between 1 and 99),
  nume text not null check (char_length(btrim(nume)) between 1 and 60),
  telefon text not null check (char_length(btrim(telefon)) between 6 and 40),
  -- Câte mesaje pe zi; peste limită e doar avertisment.
  limita_zi integer not null default 30 check (limita_zi between 0 and 1000),
  activ boolean not null default true,
  ordine smallint not null default 0,
  creat_la timestamptz not null default now(),
  actualizat_la timestamptz not null default now(),
  actualizat_de text check (actualizat_de is null or char_length(actualizat_de) <= 200)
);
insert into public.prospectare_conturi_whatsapp (id, nume, telefon, limita_zi, ordine) values
  (1, 'Cont 1', '+40 771 464 310', 30, 1),
  (2, 'Cont 2', '+40 771 738 607', 30, 2),
  (3, 'Cont 3', '+40 766 990 184', 30, 3)
on conflict (id) do nothing;

alter table public.prospectare_conturi_whatsapp enable row level security;
drop policy if exists prospectare_conturi_whatsapp_admin_read on public.prospectare_conturi_whatsapp;
create policy prospectare_conturi_whatsapp_admin_read on public.prospectare_conturi_whatsapp for select to authenticated using (public.is_lead_admin());

-- Contul de pe firmă trebuie să existe în tabel (până la 99 de conturi).
alter table public.prospectare_firme drop constraint if exists prospectare_firme_whatsapp_cont;
alter table public.prospectare_firme add constraint prospectare_firme_whatsapp_cont check (whatsapp_cont is null or whatsapp_la is not null);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prospectare_firme_whatsapp_cont_fk') then
    alter table public.prospectare_firme add constraint prospectare_firme_whatsapp_cont_fk
      foreign key (whatsapp_cont) references public.prospectare_conturi_whatsapp (id);
  end if;
end;
$$;

create or replace function public.prospectare_salveaza_cont_whatsapp(
  p_id smallint, p_nume text, p_telefon text, p_limita integer, p_activ boolean, p_autor text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id smallint := p_id;
begin
  if nullif(btrim(p_nume), '') is null then
    raise exception 'Contul are nevoie de un nume.' using errcode = 'PR422';
  end if;
  if regexp_replace(coalesce(p_telefon, ''), '\D', '', 'g') !~ '^(40|0)?7[0-9]{8}$' then
    raise exception 'Numărul contului trebuie să fie un mobil românesc (+40 7xx xxx xxx).' using errcode = 'PR422';
  end if;
  if p_limita is null or p_limita < 0 or p_limita > 1000 then
    raise exception 'Limita pe zi: între 0 și 1000.' using errcode = 'PR422';
  end if;
  if v_id is null then
    select coalesce(max(id), 0) + 1 into v_id from public.prospectare_conturi_whatsapp;
    if v_id > 99 then
      raise exception 'Sunt deja 99 de conturi.' using errcode = 'PR422';
    end if;
    insert into public.prospectare_conturi_whatsapp (id, nume, telefon, limita_zi, activ, ordine, actualizat_de)
    values (v_id, btrim(p_nume), btrim(p_telefon), p_limita, coalesce(p_activ, true), v_id, p_autor);
  else
    update public.prospectare_conturi_whatsapp
      set nume = btrim(p_nume), telefon = btrim(p_telefon), limita_zi = p_limita, activ = coalesce(p_activ, activ),
          actualizat_la = now(), actualizat_de = p_autor
      where id = v_id;
    if not found then
      raise exception 'Contul % nu există.', v_id using errcode = 'PR404';
    end if;
  end if;
  return (select to_jsonb(c) from public.prospectare_conturi_whatsapp c where id = v_id);
end;
$$;

-- Permisiunea de recontactare pe alt canal (din fișa firmei) --------------------------

alter table public.prospectare_firme add column if not exists canal_permis text;
alter table public.prospectare_firme add column if not exists canal_permis_motiv text;
alter table public.prospectare_firme add column if not exists canal_permis_la timestamptz;
alter table public.prospectare_firme add column if not exists canal_permis_de text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prospectare_firme_canal_permis') then
    alter table public.prospectare_firme add constraint prospectare_firme_canal_permis check (
      (canal_permis is null or canal_permis in ('email', 'whatsapp', 'telefon'))
      and (canal_permis_motiv is null or char_length(canal_permis_motiv) <= 500));
  end if;
end;
$$;
comment on column public.prospectare_firme.canal_permis is 'Al doilea canal permis de un admin din fișă (cu motiv). Se consumă când canalul e folosit.';

-- Evaluarea firmei (cercetarea roboților) ---------------------------------------------

create table if not exists public.prospectare_nise (
  id bigint generated always as identity primary key,
  nisa text not null check (char_length(btrim(nisa)) between 1 and 120),
  zona text not null check (char_length(btrim(zona)) between 1 and 120),
  status text not null default 'libera' check (status in ('libera', 'rezervata', 'in_cercetare', 'terminata')),
  dispozitiv_id uuid references public.prospectare_dispozitive (id) on delete set null,
  rezervata_la timestamptz,
  semn_la timestamptz,
  terminata_la timestamptz,
  gasite integer not null default 0 check (gasite >= 0),
  eligibile integer not null default 0 check (eligibile >= 0),
  respinse integer not null default 0 check (respinse >= 0),
  nota text check (nota is null or char_length(nota) <= 1000),
  creat_la timestamptz not null default now(),
  creat_de text check (creat_de is null or char_length(creat_de) <= 200),
  actualizat_la timestamptz not null default now()
);
create unique index if not exists prospectare_nise_cheie_uidx on public.prospectare_nise (lower(btrim(nisa)), lower(btrim(zona)));
create index if not exists prospectare_nise_status_idx on public.prospectare_nise (status, actualizat_la desc);

alter table public.prospectare_nise enable row level security;
drop policy if exists prospectare_nise_admin_read on public.prospectare_nise;
create policy prospectare_nise_admin_read on public.prospectare_nise for select to authenticated using (public.is_lead_admin());

alter table public.prospectare_firme add column if not exists evaluare text;
alter table public.prospectare_firme add column if not exists evaluare_motiv text;
alter table public.prospectare_firme add column if not exists evaluat_la timestamptz;
alter table public.prospectare_firme add column if not exists nisa_id bigint;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prospectare_firme_evaluare') then
    alter table public.prospectare_firme add constraint prospectare_firme_evaluare check (
      (evaluare is null or evaluare in ('eligibila', 'respinsa'))
      and (evaluare_motiv is null or char_length(evaluare_motiv) <= 500));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prospectare_firme_nisa_fk') then
    alter table public.prospectare_firme add constraint prospectare_firme_nisa_fk
      foreign key (nisa_id) references public.prospectare_nise (id) on delete set null;
  end if;
end;
$$;
create index if not exists prospectare_firme_nisa_idx on public.prospectare_firme (nisa_id) where nisa_id is not null;
-- Coada de construcție: firme cercetate, eligibile, fără site.
create index if not exists prospectare_firme_coada_constructie_idx on public.prospectare_firme (scor desc nulls last, nr)
  where etapa = 'cercetat' and link_demo is null;

-- Pragul de scor pentru coada comună de construcție.
alter table public.prospectare_setari add column if not exists scor_minim_constructie smallint not null default 45;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prospectare_setari_scor_minim') then
    alter table public.prospectare_setari add constraint prospectare_setari_scor_minim check (scor_minim_constructie between 0 and 1000);
  end if;
end;
$$;

-- Ce face fiecare robot acum ----------------------------------------------------------

alter table public.prospectare_dispozitive add column if not exists ce_face text;
alter table public.prospectare_dispozitive add column if not exists ce_face_detaliu text;
alter table public.prospectare_dispozitive add column if not exists ce_face_la timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prospectare_dispozitive_ce_face') then
    alter table public.prospectare_dispozitive add constraint prospectare_dispozitive_ce_face check (
      (ce_face is null or ce_face in ('cercetare', 'constructie', 'trimitere'))
      and (ce_face_detaliu is null or char_length(ce_face_detaliu) <= 300));
  end if;
end;
$$;
grant select (ce_face, ce_face_detaliu, ce_face_la) on public.prospectare_dispozitive to authenticated;

create or replace function public.prospectare_robot_ce_face(p_dispozitiv uuid, p_tip text, p_detaliu text default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.prospectare_dispozitive
    set ce_face = case when p_tip in ('cercetare', 'constructie', 'trimitere') then p_tip else ce_face end,
        ce_face_detaliu = left(nullif(btrim(coalesce(p_detaliu, '')), ''), 300),
        ce_face_la = now(),
        ultima_activitate = now()
    where id = p_dispozitiv
$$;

-- Regulile firmei: un singur canal, al doilea doar cu permisiune ----------------------

create or replace function public.prospectare_firme_reguli()
returns trigger
language plpgsql
as $$
declare
  v_import boolean := coalesce(current_setting('prospectare.import_istoric', true), '') = 'da';
  v_noi text[] := '{}';
  v_vechi text[] := '{}';
  c text;
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
      raise exception 'Firma #% a primit deja WhatsApp (%): același canal nu se folosește de două ori.', old.nr,
        to_char(old.whatsapp_la at time zone 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI') using errcode = 'PR409';
    end if;
    if old.telefon_la is not null and new.telefon_la is distinct from old.telefon_la then
      -- Singura excepție: după ultima încercare „Nu răspunde”, firma iese din listă și își pierde telefonul.
      if not (new.telefon_la is null and coalesce(current_setting('prospectare.reseteaza_canal', true), '') = 'da') then
        raise exception 'Firma #% e deja pe telefon: același canal nu se folosește de două ori.', old.nr using errcode = 'PR409';
      end if;
    end if;

    if old.email_la is not null then v_vechi := array_append(v_vechi, 'email'); end if;
    if old.whatsapp_la is not null then v_vechi := array_append(v_vechi, 'whatsapp'); end if;
    if old.telefon_la is not null then v_vechi := array_append(v_vechi, 'telefon'); end if;
    if new.email_la is not null and old.email_la is null then v_noi := array_append(v_noi, 'email'); end if;
    if new.whatsapp_la is not null and old.whatsapp_la is null then v_noi := array_append(v_noi, 'whatsapp'); end if;
    if new.telefon_la is not null and old.telefon_la is null then v_noi := array_append(v_noi, 'telefon'); end if;

    -- „Nu contacta” blochează toate canalele: nimic nou după ce a cerut asta.
    if old.etapa = 'nu_contacta' and cardinality(v_noi) > 0 then
      raise exception 'Firma #% e „Nu contacta”: nu mai primește niciun canal.', old.nr using errcode = 'PR410';
    end if;

    -- Un singur canal: al doilea doar dacă un admin l-a permis din fișă (sau la importul de istoric).
    if not v_import and cardinality(v_noi) > 0 and cardinality(v_vechi) + cardinality(v_noi) > 1 then
      foreach c in array v_noi loop
        if cardinality(v_vechi) > 0 or c <> v_noi[1] then
          if old.canal_permis is distinct from c then
            raise exception 'Firma #% a fost contactată deja pe %: al doilea canal (%) se permite doar din fișa firmei.', old.nr,
              coalesce(nullif(array_to_string(v_vechi, ', '), ''), v_noi[1]), c using errcode = 'PR409';
          end if;
          -- Permisiunea s-a folosit.
          new.canal_permis := null;
          new.canal_permis_motiv := null;
          new.canal_permis_la := null;
          new.canal_permis_de := null;
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

-- Lista de WhatsApp: doar firme necontactate (sau cu WhatsApp permis din fișă) ------------

create or replace function public.prospectare_whatsapp_eligibila(f public.prospectare_firme)
returns boolean
language sql
stable
set search_path = public
as $$
  select f.etapa <> 'nu_contacta'
    and f.link_demo is not null
    and f.este_mobil
    and f.whatsapp_la is null
    and (
      (f.etapa = 'site_gata' and f.email_la is null and f.telefon_la is null)
      or f.canal_permis = 'whatsapp'
    )
$$;

create or replace function public.prospectare_whatsapp_coada(p_limit integer default 200, p_offset integer default 0)
returns setof public.prospectare_firme
language sql
stable
security definer
set search_path = public
as $$
  select f.*
  from public.prospectare_firme f
  where f.whatsapp_la is null and f.este_mobil and f.link_demo is not null and f.etapa <> 'nu_contacta'
    and public.prospectare_whatsapp_eligibila(f)
  order by (f.canal_permis = 'whatsapp') desc nulls last, f.scor desc nulls last, f.nr
  limit least(greatest(coalesce(p_limit, 200), 1), 1000)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

-- Vechea semnătură (cont smallint) dispare: contul vine din tabelul de conturi.
create or replace function public.prospectare_whatsapp_trimis(p_firma uuid, p_cont smallint, p_autor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.prospectare_firme%rowtype;
  k public.prospectare_conturi_whatsapp%rowtype;
  v_trimise integer;
  v_canale text;
begin
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
  v_canale := concat_ws(', ', case when f.email_la is not null then 'email' end, case when f.telefon_la is not null then 'telefon' end);
  if v_canale <> '' and f.canal_permis is distinct from 'whatsapp' then
    raise exception 'Firma #% a fost contactată deja pe %: WhatsApp-ul se permite doar din fișa firmei.', f.nr, v_canale using errcode = 'PR409';
  end if;
  if not public.prospectare_whatsapp_eligibila(f) then
    raise exception 'Firma #% nu e în lista de WhatsApp: %.', f.nr,
      case
        when f.link_demo is null then 'site-ul demo nu are link'
        when not f.este_mobil then 'numărul nu e de mobil'
        else format('etapa e „%s”', f.etapa)
      end using errcode = 'PR422';
  end if;
  select * into k from public.prospectare_conturi_whatsapp where id = p_cont;
  if not found then
    raise exception 'Contul WhatsApp % nu există: alege un cont din Setări.', p_cont using errcode = 'PR422';
  end if;
  if not k.activ then
    raise exception '„%” e dezactivat în Setări.', k.nume using errcode = 'PR422';
  end if;

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

-- Apeluri: doar firme necontactate (sau cu telefonul permis din fișă) -----------------

create or replace function public.prospectare_importa_lista_zi(
  p_utilizator text,
  p_canal text,
  p_numar integer,
  p_filtre jsonb default '{}'::jsonb,
  p_cont_whatsapp smallint default null,
  p_autor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_azi date := public.prospectare_azi();
  v_luate integer := 0;
  v_nume text := case p_utilizator when 'stefan' then 'Ștefan' when 'vladut' then 'Vlăduț' else p_utilizator end;
  v_nisa text := nullif(btrim(p_filtre ->> 'nisa'), '');
  v_oras text := nullif(btrim(p_filtre ->> 'oras'), '');
  v_judet text := nullif(btrim(p_filtre ->> 'judet'), '');
  v_scor integer := nullif(p_filtre ->> 'scor_min', '')::integer;
  v_mobil boolean := coalesce((p_filtre ->> 'doar_mobil')::boolean, false);
  r record;
begin
  if p_utilizator not in ('stefan', 'vladut') then
    raise exception 'Utilizator necunoscut: %.', p_utilizator using errcode = 'PR422';
  end if;
  if p_canal is distinct from 'telefon' then
    raise exception 'Doar lista de apeluri se importă. WhatsApp-ul are lista lui, continuă: firmele intră singure.' using errcode = 'PR422';
  end if;
  if p_numar is null or p_numar < 1 or p_numar > 500 then
    raise exception 'Câte firme: între 1 și 500.' using errcode = 'PR422';
  end if;

  perform set_config('prospectare.autor', coalesce(nullif(btrim(p_autor), ''), v_nume), true);
  perform set_config('prospectare.motiv', format('Adăugată în lista de apeluri a lui %s', v_nume), true);

  for r in
    select f.id
    from public.prospectare_firme f
    where f.telefon_la is null and f.link_demo is not null and f.telefon is not null and f.etapa <> 'nu_contacta'
      and ((f.etapa = 'site_gata' and f.email_la is null and f.whatsapp_la is null) or f.canal_permis = 'telefon')
      and (not v_mobil or f.este_mobil)
      and (v_nisa is null or f.nisa = v_nisa)
      and (v_oras is null or f.oras = v_oras)
      and (v_judet is null or f.judet = v_judet)
      and (v_scor is null or f.scor >= v_scor)
    order by (f.canal_permis = 'telefon') desc nulls last, f.scor desc nulls last, f.nr
    limit p_numar
    for update of f skip locked
  loop
    update public.prospectare_firme set telefon_la = now()
      where id = r.id and telefon_la is null and etapa <> 'nu_contacta'
        and ((etapa = 'site_gata' and email_la is null and whatsapp_la is null) or canal_permis = 'telefon');
    if found then
      insert into public.prospectare_liste_zi (data, utilizator, canal, firma_id)
      values (v_azi, p_utilizator, 'telefon', r.id);
      v_luate := v_luate + 1;
    end if;
  end loop;

  return jsonb_build_object('adaugate', v_luate, 'cerute', p_numar);
end;
$$;

create or replace function public.prospectare_rezerva_grupe()
returns table (nisa text, oras text, judet text, scor smallint, este_mobil boolean, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select f.nisa, f.oras, f.judet, f.scor, f.este_mobil, count(*)
  from public.prospectare_firme f
  where f.telefon_la is null and f.link_demo is not null and f.telefon is not null and f.etapa <> 'nu_contacta'
    and ((f.etapa = 'site_gata' and f.email_la is null and f.whatsapp_la is null) or f.canal_permis = 'telefon')
  group by f.nisa, f.oras, f.judet, f.scor, f.este_mobil
$$;

-- Emailul: 409 dacă firma are deja alt canal (fără permisiune) ------------------------

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
  v_canale text;
begin
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
  v_canale := concat_ws(', ', case when f.whatsapp_la is not null then 'WhatsApp' end, case when f.telefon_la is not null then 'telefon' end);
  if v_canale <> '' and f.canal_permis is distinct from 'email' then
    raise exception 'Firma #% are deja canalul %: emailul nu se trimite.', f.nr, v_canale using errcode = 'PR409';
  end if;
  if f.email is null then
    raise exception 'Firma #% nu are adresă de email.', f.nr using errcode = 'PR422';
  end if;
  -- Emailul pleacă doar cu site-ul demo gata (linkul e în mesaj).
  if f.link_demo is null or (f.etapa <> 'site_gata' and f.canal_permis is distinct from 'email') then
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

-- Recontactarea pe alt canal: doar un admin, din fișă, cu motiv ------------------------

create or replace function public.prospectare_permite_recontactare(p_firma uuid, p_canal text, p_motiv text, p_autor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.prospectare_firme%rowtype;
  v_motiv text := nullif(btrim(coalesce(p_motiv, '')), '');
begin
  if p_canal not in ('email', 'whatsapp', 'telefon') then
    raise exception 'Alege canalul: email, WhatsApp sau telefon.' using errcode = 'PR422';
  end if;
  if v_motiv is null or char_length(v_motiv) < 5 then
    raise exception 'Scrie motivul recontactării (cel puțin 5 caractere).' using errcode = 'PR422';
  end if;
  if char_length(v_motiv) > 500 then
    raise exception 'Motivul: cel mult 500 de caractere.' using errcode = 'PR422';
  end if;
  select * into f from public.prospectare_firme where id = p_firma for update;
  if not found then
    raise exception 'Firma nu există.' using errcode = 'PR404';
  end if;
  if f.etapa = 'nu_contacta' then
    raise exception 'Firma #% e „Nu contacta”: nu se mai contactează pe niciun canal.', f.nr using errcode = 'PR410';
  end if;
  if f.email_la is null and f.whatsapp_la is null and f.telefon_la is null then
    raise exception 'Firma #% n-a fost contactată încă: intră singură în listă, fără permisiune.', f.nr using errcode = 'PR422';
  end if;
  if (p_canal = 'email' and f.email_la is not null) or (p_canal = 'whatsapp' and f.whatsapp_la is not null) or (p_canal = 'telefon' and f.telefon_la is not null) then
    raise exception 'Firma #% a fost contactată deja pe %: același canal nu se folosește de două ori.', f.nr, p_canal using errcode = 'PR409';
  end if;
  if p_canal = 'email' and f.email is null then
    raise exception 'Firma #% nu are adresă de email.', f.nr using errcode = 'PR422';
  end if;
  if p_canal = 'whatsapp' and not f.este_mobil then
    raise exception 'Firma #% nu are număr de mobil: fără WhatsApp.', f.nr using errcode = 'PR422';
  end if;
  if p_canal = 'telefon' and f.telefon is null then
    raise exception 'Firma #% nu are telefon.', f.nr using errcode = 'PR422';
  end if;

  perform set_config('prospectare.autor', coalesce(nullif(btrim(p_autor), ''), 'admin'), true);
  update public.prospectare_firme
    set canal_permis = p_canal, canal_permis_motiv = v_motiv, canal_permis_la = now(), canal_permis_de = coalesce(nullif(btrim(p_autor), ''), 'admin')
    where id = f.id;
  perform public.prospectare_noteaza(f.id, 'recontactare', p_canal,
    jsonb_build_object('canal', p_canal, 'motiv', v_motiv,
      'canale_folosite', to_jsonb(array_remove(array[case when f.email_la is not null then 'email' end,
        case when f.whatsapp_la is not null then 'whatsapp' end, case when f.telefon_la is not null then 'telefon' end], null))));
  return jsonb_build_object('nr', f.nr, 'canal', p_canal);
end;
$$;

-- Nișele: tabla comună a roboților -------------------------------------------------------

-- Rezervarea unei nișe: o creează dacă nu există. Alt robot o poate prelua doar după 24 h fără semn de viață.
create or replace function public.prospectare_nisa_rezerva(p_dispozitiv uuid, p_nisa text, p_zona text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n public.prospectare_nise%rowtype;
  v_robot text;
  v_vechi uuid;
  v_alt text;
begin
  if nullif(btrim(coalesce(p_nisa, '')), '') is null or nullif(btrim(coalesce(p_zona, '')), '') is null then
    raise exception 'Nișa și zona sunt obligatorii (ex. „instalatori” · „Muntenia”).' using errcode = 'PR422';
  end if;
  select nume into v_robot from public.prospectare_dispozitive where id = p_dispozitiv and activ;
  if not found then
    raise exception 'Robotul nu există sau e dezactivat.' using errcode = 'PR401';
  end if;
  insert into public.prospectare_nise (nisa, zona, creat_de) values (btrim(p_nisa), btrim(p_zona), v_robot)
  on conflict (lower(btrim(nisa)), lower(btrim(zona))) do nothing;
  select * into n from public.prospectare_nise
    where lower(btrim(nisa)) = lower(btrim(p_nisa)) and lower(btrim(zona)) = lower(btrim(p_zona)) for update;

  if n.status = 'terminata' then
    raise exception 'Nișa „% · %” e terminată (%).', n.nisa, n.zona,
      to_char(n.terminata_la at time zone 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI') using errcode = 'PR410';
  end if;
  if n.dispozitiv_id is not null and n.dispozitiv_id <> p_dispozitiv and n.status in ('rezervata', 'in_cercetare')
     and coalesce(n.semn_la, n.rezervata_la) > now() - interval '24 hours' then
    select nume into v_alt from public.prospectare_dispozitive where id = n.dispozitiv_id;
    raise exception 'Nișa „% · %” e rezervată de % din %.', n.nisa, n.zona, coalesce(v_alt, 'alt robot'),
      to_char(n.rezervata_la at time zone 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI') using errcode = 'PR409';
  end if;
  v_vechi := case when n.dispozitiv_id is distinct from p_dispozitiv then n.dispozitiv_id end;
  update public.prospectare_nise
    set dispozitiv_id = p_dispozitiv,
        status = case when n.dispozitiv_id = p_dispozitiv and n.status = 'in_cercetare' then 'in_cercetare' else 'rezervata' end,
        rezervata_la = case when n.dispozitiv_id = p_dispozitiv then coalesce(rezervata_la, now()) else now() end,
        semn_la = now(), actualizat_la = now()
    where id = n.id
    returning * into n;
  perform public.prospectare_robot_ce_face(p_dispozitiv, 'cercetare', format('%s · %s', n.nisa, n.zona));
  return to_jsonb(n) || jsonb_build_object('preluata_de_la', v_vechi, 'reluata', v_vechi is null);
end;
$$;

create or replace function public.prospectare_nisa_progres(
  p_dispozitiv uuid, p_nisa_id bigint, p_gasite integer default null, p_eligibile integer default null, p_respinse integer default null,
  p_termina boolean default false, p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n public.prospectare_nise%rowtype;
begin
  select * into n from public.prospectare_nise where id = p_nisa_id for update;
  if not found then
    raise exception 'Nișa % nu există.', p_nisa_id using errcode = 'PR404';
  end if;
  if n.dispozitiv_id is distinct from p_dispozitiv then
    raise exception 'Nișa „% · %” nu e rezervată de acest robot.', n.nisa, n.zona using errcode = 'PR409';
  end if;
  if n.status = 'terminata' then
    raise exception 'Nișa „% · %” e deja terminată.', n.nisa, n.zona using errcode = 'PR410';
  end if;
  if coalesce(p_gasite, 0) < 0 or coalesce(p_eligibile, 0) < 0 or coalesce(p_respinse, 0) < 0 then
    raise exception 'Numerele nu pot fi negative.' using errcode = 'PR422';
  end if;
  update public.prospectare_nise
    set gasite = greatest(gasite, coalesce(p_gasite, 0)),
        eligibile = greatest(eligibile, coalesce(p_eligibile, 0)),
        respinse = greatest(respinse, coalesce(p_respinse, 0)),
        nota = coalesce(left(nullif(btrim(coalesce(p_nota, '')), ''), 1000), nota),
        status = case when p_termina then 'terminata' else 'in_cercetare' end,
        terminata_la = case when p_termina then now() else terminata_la end,
        semn_la = now(), actualizat_la = now()
    where id = n.id
    returning * into n;
  perform public.prospectare_robot_ce_face(p_dispozitiv, 'cercetare',
    format('%s · %s%s', n.nisa, n.zona, case when p_termina then ' (terminată)' else '' end));
  return to_jsonb(n);
end;
$$;

-- Din admin: adaugă o nișă liberă pe tablă sau eliberează una (fără să șteargă nimic).
create or replace function public.prospectare_nisa_admin(p_actiune text, p_id bigint, p_nisa text, p_zona text, p_autor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n public.prospectare_nise%rowtype;
begin
  if p_actiune = 'adauga' then
    if nullif(btrim(coalesce(p_nisa, '')), '') is null or nullif(btrim(coalesce(p_zona, '')), '') is null then
      raise exception 'Scrie nișa și zona.' using errcode = 'PR422';
    end if;
    insert into public.prospectare_nise (nisa, zona, creat_de) values (btrim(p_nisa), btrim(p_zona), p_autor)
    on conflict (lower(btrim(nisa)), lower(btrim(zona))) do nothing
    returning * into n;
    if n.id is null then
      raise exception 'Nișa „% · %” e deja pe tablă.', btrim(p_nisa), btrim(p_zona) using errcode = 'PR409';
    end if;
  elsif p_actiune = 'elibereaza' then
    update public.prospectare_nise
      set status = 'libera', dispozitiv_id = null, rezervata_la = null, semn_la = null, actualizat_la = now(),
          nota = left(concat_ws(E'\n', nota, format('Eliberată din admin de %s, %s', p_autor, to_char(now() at time zone 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI'))), 1000)
      where id = p_id and status <> 'terminata'
      returning * into n;
    if n.id is null then
      raise exception 'Nișa nu există sau e terminată.' using errcode = 'PR404';
    end if;
  else
    raise exception 'Acțiune necunoscută: %.', p_actiune using errcode = 'PR422';
  end if;
  return to_jsonb(n);
end;
$$;

-- Evaluări: fiecare firmă evaluată se notează (și respinsele), o singură dată ----------

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
        'motiv', f.evaluare_motiv, 'evaluat_la', coalesce(f.evaluat_la, f.creat_la)) order by f.nr)
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
    insert into public.prospectare_firme (nume, domeniu, site_vechi, nisa, oras, judet, scor, telefon, email, persoana_contact,
      etapa, evaluare, evaluare_motiv, evaluat_la, nisa_id, date_extra)
    values (
      coalesce(nullif(btrim(e ->> 'nume'), ''), v_dom), v_dom,
      nullif(left(e ->> 'site_vechi', 500), ''), coalesce(nullif(left(e ->> 'nisa', 200), ''), n.nisa),
      nullif(left(e ->> 'oras', 120), ''), nullif(left(e ->> 'judet', 60), ''),
      (e ->> 'scor')::smallint, nullif(left(btrim(e ->> 'telefon'), 40), ''), nullif(lower(btrim(e ->> 'email')), ''),
      nullif(left(btrim(e ->> 'persoana_contact'), 200), ''),
      'cercetat', v_ev, nullif(left(btrim(e ->> 'motiv'), 500), ''), now(), p_nisa_id,
      (case when jsonb_typeof(e -> 'date_extra') = 'object' then e -> 'date_extra' else '{}'::jsonb end) || jsonb_build_object('evaluat_de', v_robot)
    )
    returning id into v_id;
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

-- Coada comună de construcție ---------------------------------------------------------
-- Prioritate: rezervări expirate, apoi firmele de refăcut, apoi cele alese deja pentru
-- construit, apoi orice firmă cercetată eligibilă (scor ≥ prag, email sau mobil, fără site).

create or replace function public.prospectare_rezerva_urmatoarea(p_dispozitiv uuid, p_tip_lucru text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ore integer;
  v_prag integer;
  v_nume text;
  v_rez public.prospectare_rezervari%rowtype;
  f public.prospectare_firme%rowtype;
  v_vechi uuid;
  v_incercare integer := 0;
begin
  if p_tip_lucru is not null and p_tip_lucru not in ('construire', 'refacere') then
    raise exception 'Tipul de lucru e „construire” sau „refacere”.' using errcode = 'PR422';
  end if;
  select nume into v_nume from public.prospectare_dispozitive where id = p_dispozitiv and activ;
  if not found then
    raise exception 'Robotul nu există sau e dezactivat.' using errcode = 'PR401';
  end if;
  perform set_config('prospectare.autor', v_nume, true);
  select rezervare_ore, scor_minim_constructie into v_ore, v_prag from public.prospectare_setari where id = 1;
  v_ore := coalesce(v_ore, 3);
  v_prag := coalesce(v_prag, 45);

  -- Întâi ce lucra deja (robotul repornit își reia firma).
  select r.* into v_rez
  from public.prospectare_rezervari r
  join public.prospectare_firme ff on ff.id = r.firma_id
  where r.dispozitiv_id = p_dispozitiv and ff.etapa <> 'nu_contacta'
    and (p_tip_lucru is null or r.tip_lucru = p_tip_lucru)
  order by r.luat_la
  limit 1
  for update of r;
  if found then
    update public.prospectare_rezervari set expira_la = now() + make_interval(hours => v_ore)
      where firma_id = v_rez.firma_id returning * into v_rez;
    select * into f from public.prospectare_firme where id = v_rez.firma_id;
    perform public.prospectare_robot_ce_face(p_dispozitiv, 'constructie', format('#%s %s', f.nr, f.nume));
    return to_jsonb(f) || jsonb_build_object('rezervare', jsonb_build_object('tip_lucru', v_rez.tip_lucru, 'expira_la', v_rez.expira_la, 'reluata', true));
  end if;

  loop
    v_incercare := v_incercare + 1;
    exit when v_incercare > 5;

    select ff.* into f
    from public.prospectare_firme ff
    left join public.prospectare_rezervari r on r.firma_id = ff.id
    where (r.firma_id is null or r.expira_la <= now())
      and (
        ff.etapa = 'site_in_lucru'
        or (ff.etapa = 'cercetat' and ff.link_demo is null and coalesce(ff.evaluare, 'eligibila') <> 'respinsa'
            and ff.scor >= v_prag and (ff.email is not null or ff.este_mobil))
      )
      and (p_tip_lucru is null or ff.de_refacut = (p_tip_lucru = 'refacere'))
    order by (r.firma_id is not null) desc, ff.de_refacut desc, (ff.etapa = 'site_in_lucru') desc, ff.scor desc nulls last, ff.nr
    limit 1
    for update of ff skip locked;
    if not found then
      return null;
    end if;

    select dispozitiv_id into v_vechi from public.prospectare_rezervari where firma_id = f.id for update;
    insert into public.prospectare_rezervari (firma_id, dispozitiv_id, tip_lucru, luat_la, expira_la)
    values (f.id, p_dispozitiv, case when f.de_refacut then 'refacere' else 'construire' end, now(), now() + make_interval(hours => v_ore))
    on conflict (firma_id) do update
      set dispozitiv_id = excluded.dispozitiv_id, tip_lucru = excluded.tip_lucru, luat_la = excluded.luat_la, expira_la = excluded.expira_la
      where public.prospectare_rezervari.expira_la <= now()
    returning * into v_rez;
    if found then
      if f.etapa = 'cercetat' then
        perform set_config('prospectare.motiv', format('Luată din coada comună de %s', v_nume), true);
        update public.prospectare_firme set etapa = 'site_in_lucru' where id = f.id returning * into f;
      end if;
      perform public.prospectare_noteaza(f.id, 'rezervare', null,
        jsonb_strip_nulls(jsonb_build_object('dispozitiv', p_dispozitiv, 'tip_lucru', v_rez.tip_lucru, 'expira_la', v_rez.expira_la,
          'preluata_de_la', case when v_vechi is distinct from p_dispozitiv then v_vechi end)));
      perform public.prospectare_robot_ce_face(p_dispozitiv, 'constructie', format('#%s %s', f.nr, f.nume));
      return to_jsonb(f) || jsonb_build_object('rezervare', jsonb_build_object('tip_lucru', v_rez.tip_lucru, 'expira_la', v_rez.expira_la, 'reluata', false));
    end if;
  end loop;
  return null;
end;
$$;

-- Importul de istoric poate scrie mai multe canale (cele 30 cu email + WhatsApp). -------
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
          etapa, email_la, whatsapp_la, whatsapp_cont, telefon_la, link_demo, captura_url, lot, slug, de_refacut, date_extra
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
           n.date_extra, n.link_demo, n.captura_url, n.etapa, n.email_la, n.whatsapp_la, n.whatsapp_cont, n.telefon_la, n.de_refacut)
       is distinct from
       row(f.nume, f.site_vechi, f.nisa, f.oras, f.judet, f.scor, f.telefon, f.email, f.persoana_contact, f.lot, f.slug,
           f.date_extra, f.link_demo, f.captura_url, f.etapa, f.email_la, f.whatsapp_la, f.whatsapp_cont, f.telefon_la, f.de_refacut) then
      v_actualizate := v_actualizate + 1;
      if not p_proba then
        perform set_config('prospectare.motiv', case when v_import then 'Import din auto-web-rebuilder' else 'Actualizare de la robot' end, true);
        update public.prospectare_firme set
          nume = n.nume, site_vechi = n.site_vechi, nisa = n.nisa, oras = n.oras, judet = n.judet, scor = n.scor,
          telefon = n.telefon, email = n.email, persoana_contact = n.persoana_contact, lot = n.lot, slug = n.slug,
          date_extra = n.date_extra, link_demo = n.link_demo, captura_url = n.captura_url, etapa = n.etapa,
          email_la = n.email_la, whatsapp_la = n.whatsapp_la, whatsapp_cont = n.whatsapp_cont, telefon_la = n.telefon_la,
          de_refacut = n.de_refacut
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
    'canale_noi', v_canale_noi,
    'conflicte', v_conflicte
  );
end;
$$;

-- Rezumatul -------------------------------------------------------------------------------

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
      where f.telefon_la is null and f.link_demo is not null and f.telefon is not null and f.etapa <> 'nu_contacta'
        and ((f.etapa = 'site_gata' and f.email_la is null and f.whatsapp_la is null) or f.canal_permis = 'telefon')),
    'whatsapp_lista', (select count(*) from public.prospectare_firme f
      where f.whatsapp_la is null and f.este_mobil and f.link_demo is not null and f.etapa <> 'nu_contacta'
        and public.prospectare_whatsapp_eligibila(f)),
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

-- Drepturi ------------------------------------------------------------------------------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.prospectare_salveaza_cont_whatsapp(smallint, text, text, integer, boolean, text)',
    'public.prospectare_robot_ce_face(uuid, text, text)',
    'public.prospectare_whatsapp_eligibila(public.prospectare_firme)',
    'public.prospectare_whatsapp_coada(integer, integer)',
    'public.prospectare_whatsapp_trimis(uuid, smallint, text)',
    'public.prospectare_importa_lista_zi(text, text, integer, jsonb, smallint, text)',
    'public.prospectare_rezerva_grupe()',
    'public.prospectare_email_cere_canal(uuid, text, integer, text, integer)',
    'public.prospectare_permite_recontactare(uuid, text, text, text)',
    'public.prospectare_nisa_rezerva(uuid, text, text)',
    'public.prospectare_nisa_progres(uuid, bigint, integer, integer, integer, boolean, text)',
    'public.prospectare_nisa_admin(text, bigint, text, text, text)',
    'public.prospectare_evaluare_verifica(jsonb)',
    'public.prospectare_evaluare_noteaza(uuid, bigint, jsonb)',
    'public.prospectare_rezerva_urmatoarea(uuid, text)',
    'public.prospectare_upsert_firme(jsonb, text, text, boolean)',
    'public.prospectare_rezumat()'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke all on function %s from anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;

select 'un singur canal: permisiunea de recontactare există' as verificare,
  (select count(*) = 4 from information_schema.columns where table_schema = 'public' and table_name = 'prospectare_firme'
    and column_name in ('canal_permis', 'canal_permis_motiv', 'canal_permis_la', 'canal_permis_de')) as ok
union all
select 'conturile de WhatsApp (3 la început), cu RLS',
  (select count(*) >= 3 from public.prospectare_conturi_whatsapp)
  and (select relrowsecurity from pg_class where relname = 'prospectare_conturi_whatsapp' and relnamespace = 'public'::regnamespace)
union all
select 'tabla de nișe, cu RLS',
  (select relrowsecurity from pg_class where relname = 'prospectare_nise' and relnamespace = 'public'::regnamespace)
union all
select 'evaluările și coada comună: coloanele există',
  (select count(*) = 4 from information_schema.columns where table_schema = 'public' and table_name = 'prospectare_firme'
    and column_name in ('evaluare', 'evaluare_motiv', 'evaluat_la', 'nisa_id'))
  and exists (select 1 from information_schema.columns where table_name = 'prospectare_setari' and column_name = 'scor_minim_constructie')
union all
select 'funcțiile noi doar pentru cheia de service',
  not has_function_privilege('authenticated', 'public.prospectare_permite_recontactare(uuid, text, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.prospectare_nisa_rezerva(uuid, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.prospectare_evaluare_noteaza(uuid, bigint, jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.prospectare_salveaza_cont_whatsapp(smallint, text, text, integer, boolean, text)', 'execute');
