-- MERIDIAN Prospectare, migrarea 38: mai multe sesiuni (terminale) pe același robot, cu un singur token.
--
-- Fiecare calculator are un singur robot (un token). Pe el rulează mai multe sesiuni în paralel; robotul
-- trimite la fiecare cerere câmpul `sesiune` („1”, „2”, „3”…). Fără câmp, cererea e a sesiunii „1”
-- (robotul vechi merge ca înainte).
--   - Rezervările de firme (/rezerva, /heartbeat) și nișele (/nisa, /evaluare cu nisa_id) se țin pe
--     robot + sesiune: fiecare sesiune are firma ei în lucru și nișa ei; două sesiuni nu primesc niciodată
--     aceeași firmă sau aceeași nișă (blocările din bază, ca între roboți).
--   - /termina notează sesiunea care a publicat; „ce face acum” se ține pe fiecare sesiune.
--   - Pagina Roboți: un rând pe calculator, cu sesiunile active și ce face fiecare.
-- Funcțiile primesc `p_sesiune` ca ultim parametru, cu valoarea implicită „1”: codul de dinainte (fără
-- sesiune) merge și după migrare. Se poate rula de mai multe ori. Cere migrările 28–37.

-- 1. Sesiunile ------------------------------------------------------------------------------

-- Numele sesiunii: „1” dacă lipsește; altfel litere, cifre, . _ - (cel mult 40).
create or replace function public.prospectare_sesiune(p text)
returns text
language plpgsql
immutable
as $$
declare
  v text := nullif(btrim(coalesce(p, '')), '');
begin
  if v is null then
    return '1';
  end if;
  if v !~ '^[A-Za-z0-9._-]{1,40}$' then
    raise exception 'Sesiunea e un nume scurt: „1”, „2”, „3”… (litere, cifre, punct, liniuță; cel mult 40).' using errcode = 'PR422';
  end if;
  return v;
end;
$$;

create table if not exists public.prospectare_sesiuni (
  dispozitiv_id uuid not null references public.prospectare_dispozitive (id) on delete cascade,
  sesiune text not null check (sesiune ~ '^[A-Za-z0-9._-]{1,40}$'),
  prima_activitate timestamptz not null default now(),
  ultima_activitate timestamptz not null default now(),
  ce_face text check (ce_face is null or ce_face in ('cercetare', 'constructie', 'trimitere')),
  ce_face_detaliu text check (ce_face_detaliu is null or char_length(ce_face_detaliu) <= 300),
  ce_face_la timestamptz,
  primary key (dispozitiv_id, sesiune)
);
create index if not exists prospectare_sesiuni_activitate_idx on public.prospectare_sesiuni (dispozitiv_id, ultima_activitate desc);
alter table public.prospectare_sesiuni enable row level security;
drop policy if exists prospectare_sesiuni_admin_read on public.prospectare_sesiuni;
create policy prospectare_sesiuni_admin_read on public.prospectare_sesiuni for select to authenticated using (public.is_lead_admin());
revoke all on public.prospectare_sesiuni from anon;

-- Rezervările și nișele: a cui sesiune. Cele de dinainte sunt ale sesiunii „1”.
alter table public.prospectare_rezervari add column if not exists sesiune text not null default '1';
alter table public.prospectare_nise add column if not exists sesiune text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prospectare_rezervari_sesiune') then
    alter table public.prospectare_rezervari add constraint prospectare_rezervari_sesiune check (sesiune ~ '^[A-Za-z0-9._-]{1,40}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prospectare_nise_sesiune') then
    alter table public.prospectare_nise add constraint prospectare_nise_sesiune check (sesiune is null or sesiune ~ '^[A-Za-z0-9._-]{1,40}$');
  end if;
end;
$$;
update public.prospectare_nise set sesiune = '1' where dispozitiv_id is not null and sesiune is null;
create index if not exists prospectare_rezervari_sesiune_idx on public.prospectare_rezervari (dispozitiv_id, sesiune, expira_la desc);

-- Ce făceau roboții până acum devine sesiunea „1” a fiecăruia.
insert into public.prospectare_sesiuni (dispozitiv_id, sesiune, prima_activitate, ultima_activitate, ce_face, ce_face_detaliu, ce_face_la)
select d.id, '1', coalesce(d.ultima_activitate, d.creat_la), coalesce(d.ultima_activitate, d.creat_la), d.ce_face, d.ce_face_detaliu, d.ce_face_la
from public.prospectare_dispozitive d
where d.ultima_activitate is not null or d.ce_face_la is not null
on conflict (dispozitiv_id, sesiune) do nothing;

-- 2. Funcțiile vechi cu altă semnătură ies (cele noi au `p_sesiune` la final, implicit „1”) -------

drop function if exists public.prospectare_autentifica(text);
drop function if exists public.prospectare_robot_ce_face(uuid, text, text);
drop function if exists public.prospectare_rezerva_urmatoarea(uuid, text);
drop function if exists public.prospectare_heartbeat(uuid, uuid);
drop function if exists public.prospectare_nisa_rezerva(uuid, text, text);
drop function if exists public.prospectare_nisa_progres(uuid, bigint, integer, integer, integer, boolean, text);
drop function if exists public.prospectare_evaluare_noteaza(uuid, bigint, jsonb);
drop function if exists public.prospectare_coada_email(uuid, text);
drop function if exists public.prospectare_termina_lot(uuid, jsonb);

-- 3. Autentificarea: și sesiunea (ultima ei activitate) ----------------------------------------

create or replace function public.prospectare_autentifica(p_token_hash text, p_sesiune text default '1')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.prospectare_dispozitive%rowtype;
  v_limita integer;
  v_s text;
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
  v_s := public.prospectare_sesiune(p_sesiune);
  select cereri_pe_minut into v_limita from public.prospectare_setari where id = 1;
  -- Limita de cereri e pe robot (token), pentru toate sesiunile lui.
  update public.prospectare_dispozitive
    set cereri_numar = case when cereri_fereastra is null or cereri_fereastra < date_trunc('minute', now()) then 1 else cereri_numar + 1 end,
        cereri_fereastra = date_trunc('minute', now()),
        ultima_activitate = now()
    where id = d.id
    returning * into d;
  insert into public.prospectare_sesiuni (dispozitiv_id, sesiune) values (d.id, v_s)
    on conflict (dispozitiv_id, sesiune) do update set ultima_activitate = now();
  return jsonb_build_object('id', d.id, 'nume', d.nume, 'activ', true, 'sesiune', v_s,
    'depasit', d.cereri_numar > coalesce(v_limita, 120), 'cereri', d.cereri_numar, 'limita', coalesce(v_limita, 120));
end;
$$;

-- 4. Ce face acum: pe robot (cea mai recentă sarcină) și pe sesiune -------------------------------

create or replace function public.prospectare_robot_ce_face(p_dispozitiv uuid, p_tip text, p_detaliu text default null, p_sesiune text default '1')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s text := public.prospectare_sesiune(p_sesiune);
  v_tip text := case when p_tip in ('cercetare', 'constructie', 'trimitere') then p_tip end;
  v_det text := left(nullif(btrim(coalesce(p_detaliu, '')), ''), 300);
begin
  update public.prospectare_dispozitive
    set ce_face = coalesce(v_tip, ce_face), ce_face_detaliu = v_det, ce_face_la = now(), ultima_activitate = now()
    where id = p_dispozitiv;
  if found then
    insert into public.prospectare_sesiuni as s (dispozitiv_id, sesiune, ce_face, ce_face_detaliu, ce_face_la)
      values (p_dispozitiv, v_s, v_tip, v_det, now())
      on conflict (dispozitiv_id, sesiune) do update
        set ce_face = coalesce(excluded.ce_face, s.ce_face), ce_face_detaliu = excluded.ce_face_detaliu, ce_face_la = now(), ultima_activitate = now();
  end if;
end;
$$;

-- 5. Firmele de construit: fiecare sesiune își ia și își reia firma ei ------------------------------

create or replace function public.prospectare_rezerva_urmatoarea(p_dispozitiv uuid, p_tip_lucru text default null, p_sesiune text default '1')
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
  v_vechi_s text;
  v_incercare integer := 0;
  v_s text := public.prospectare_sesiune(p_sesiune);
begin
  if p_tip_lucru is not null and p_tip_lucru not in ('construire', 'refacere') then
    raise exception 'Tipul de lucru e „construire” sau „refacere”.' using errcode = 'PR422';
  end if;
  select nume into v_nume from public.prospectare_dispozitive where id = p_dispozitiv and activ;
  if not found then
    raise exception 'Robotul nu există sau e dezactivat.' using errcode = 'PR401';
  end if;
  perform set_config('prospectare.autor', v_nume, true);
  -- Cererile simultane ale aceleiași sesiuni se așteaptă una pe alta: o sesiune are o singură firmă în lucru.
  perform pg_advisory_xact_lock(hashtext('prospectare_rezerva:' || p_dispozitiv::text || ':' || v_s));
  select rezervare_ore, scor_minim_constructie into v_ore, v_prag from public.prospectare_setari where id = 1;
  v_ore := coalesce(v_ore, 3);
  v_prag := coalesce(v_prag, 45);

  -- Întâi ce lucra deja această sesiune (sesiunea repornită își reia firma; nu pe a altei sesiuni).
  select r.* into v_rez
  from public.prospectare_rezervari r
  join public.prospectare_firme ff on ff.id = r.firma_id
  where r.dispozitiv_id = p_dispozitiv and r.sesiune = v_s and ff.etapa <> 'nu_contacta'
    and (p_tip_lucru is null or r.tip_lucru = p_tip_lucru)
  order by r.luat_la
  limit 1
  for update of r;
  if found then
    update public.prospectare_rezervari set expira_la = now() + make_interval(hours => v_ore)
      where firma_id = v_rez.firma_id returning * into v_rez;
    select * into f from public.prospectare_firme where id = v_rez.firma_id;
    perform public.prospectare_robot_ce_face(p_dispozitiv, 'constructie', format('#%s %s', f.nr, f.nume), v_s);
    return to_jsonb(f) || jsonb_build_object('rezervare', jsonb_build_object('tip_lucru', v_rez.tip_lucru, 'expira_la', v_rez.expira_la, 'reluata', true, 'sesiune', v_s));
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

    select dispozitiv_id, sesiune into v_vechi, v_vechi_s from public.prospectare_rezervari where firma_id = f.id for update;
    insert into public.prospectare_rezervari (firma_id, dispozitiv_id, sesiune, tip_lucru, luat_la, expira_la)
    values (f.id, p_dispozitiv, v_s, case when f.de_refacut then 'refacere' else 'construire' end, now(), now() + make_interval(hours => v_ore))
    on conflict (firma_id) do update
      set dispozitiv_id = excluded.dispozitiv_id, sesiune = excluded.sesiune, tip_lucru = excluded.tip_lucru, luat_la = excluded.luat_la, expira_la = excluded.expira_la
      where public.prospectare_rezervari.expira_la <= now()
    returning * into v_rez;
    if found then
      if f.etapa = 'cercetat' then
        perform set_config('prospectare.motiv', format('Luată din coada comună de %s', v_nume), true);
        update public.prospectare_firme set etapa = 'site_in_lucru' where id = f.id returning * into f;
      end if;
      perform public.prospectare_noteaza(f.id, 'rezervare', null,
        jsonb_strip_nulls(jsonb_build_object('dispozitiv', p_dispozitiv, 'tip_lucru', v_rez.tip_lucru, 'expira_la', v_rez.expira_la,
          'sesiune', v_s,
          'preluata_de_la', case when v_vechi is distinct from p_dispozitiv or v_vechi_s is distinct from v_s then v_vechi end,
          'preluata_de_la_sesiune', case when v_vechi is not null and (v_vechi is distinct from p_dispozitiv or v_vechi_s is distinct from v_s) then v_vechi_s end)));
      perform public.prospectare_robot_ce_face(p_dispozitiv, 'constructie', format('#%s %s', f.nr, f.nume), v_s);
      return to_jsonb(f) || jsonb_build_object('rezervare', jsonb_build_object('tip_lucru', v_rez.tip_lucru, 'expira_la', v_rez.expira_la, 'reluata', false, 'sesiune', v_s));
    end if;
  end loop;
  return null;
end;
$$;

create or replace function public.prospectare_heartbeat(p_dispozitiv uuid, p_firma uuid, p_sesiune text default '1')
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ore integer;
  v_pana timestamptz;
  v_s text := public.prospectare_sesiune(p_sesiune);
begin
  select rezervare_ore into v_ore from public.prospectare_setari where id = 1;
  update public.prospectare_rezervari
    set expira_la = now() + make_interval(hours => coalesce(v_ore, 3))
    where firma_id = p_firma and dispozitiv_id = p_dispozitiv and sesiune = v_s
    returning expira_la into v_pana;
  if not found then
    raise exception 'Rezervarea nu mai e a acestei sesiuni (%): a expirat și a luat-o altcineva, e a altei sesiuni sau firma a ieșit din lucru.', v_s
      using errcode = 'PR409';
  end if;
  return v_pana;
end;
$$;

-- 6. Nișele: fiecare sesiune are nișa ei ---------------------------------------------------------

create or replace function public.prospectare_nisa_rezerva(p_dispozitiv uuid, p_nisa text, p_zona text, p_sesiune text default '1')
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
  v_vechi_s text;
  v_a_mea boolean;
  v_s text := public.prospectare_sesiune(p_sesiune);
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
  -- Rezervată de alt robot sau de altă sesiune a aceluiași robot, cu semn de viață în 24 de ore: 409.
  if n.dispozitiv_id is not null and (n.dispozitiv_id <> p_dispozitiv or coalesce(n.sesiune, '1') <> v_s)
     and n.status in ('rezervata', 'in_cercetare')
     and coalesce(n.semn_la, n.rezervata_la) > now() - interval '24 hours' then
    select nume into v_alt from public.prospectare_dispozitive where id = n.dispozitiv_id;
    raise exception 'Nișa „% · %” e rezervată de % (sesiunea %) din %.', n.nisa, n.zona, coalesce(v_alt, 'alt robot'), coalesce(n.sesiune, '1'),
      to_char(n.rezervata_la at time zone 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI') using errcode = 'PR409';
  end if;
  v_a_mea := n.dispozitiv_id = p_dispozitiv and coalesce(n.sesiune, '1') = v_s;
  v_vechi := case when n.dispozitiv_id is not null and not v_a_mea then n.dispozitiv_id end;
  v_vechi_s := case when v_vechi is not null then coalesce(n.sesiune, '1') end;
  update public.prospectare_nise
    set dispozitiv_id = p_dispozitiv,
        sesiune = v_s,
        status = case when v_a_mea and n.status = 'in_cercetare' then 'in_cercetare' else 'rezervata' end,
        rezervata_la = case when v_a_mea then coalesce(rezervata_la, now()) else now() end,
        semn_la = now(), actualizat_la = now()
    where id = n.id
    returning * into n;
  perform public.prospectare_robot_ce_face(p_dispozitiv, 'cercetare', format('%s · %s', n.nisa, n.zona), v_s);
  return to_jsonb(n) || jsonb_build_object('preluata_de_la', v_vechi, 'preluata_de_la_sesiune', v_vechi_s, 'reluata', coalesce(v_a_mea, false));
end;
$$;

create or replace function public.prospectare_nisa_progres(
  p_dispozitiv uuid, p_nisa_id bigint, p_gasite integer default null, p_eligibile integer default null, p_respinse integer default null,
  p_termina boolean default false, p_nota text default null, p_sesiune text default '1'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n public.prospectare_nise%rowtype;
  v_s text := public.prospectare_sesiune(p_sesiune);
begin
  select * into n from public.prospectare_nise where id = p_nisa_id for update;
  if not found then
    raise exception 'Nișa % nu există.', p_nisa_id using errcode = 'PR404';
  end if;
  if n.dispozitiv_id is distinct from p_dispozitiv or coalesce(n.sesiune, '1') <> v_s then
    raise exception 'Nișa „% · %” nu e rezervată de această sesiune (%).', n.nisa, n.zona, v_s using errcode = 'PR409';
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
    format('%s · %s%s', n.nisa, n.zona, case when p_termina then ' (terminată)' else '' end), v_s);
  return to_jsonb(n);
end;
$$;

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
      set status = 'libera', dispozitiv_id = null, sesiune = null, rezervata_la = null, semn_la = null, actualizat_la = now(),
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

create or replace function public.prospectare_evaluare_noteaza(p_dispozitiv uuid, p_nisa_id bigint, p_firme jsonb, p_sesiune text default '1')
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
  v_s text := public.prospectare_sesiune(p_sesiune);
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
    if n.dispozitiv_id is distinct from p_dispozitiv or coalesce(n.sesiune, '1') <> v_s then
      raise exception 'Nișa „% · %” nu e rezervată de această sesiune (%).', n.nisa, n.zona, v_s using errcode = 'PR409';
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
        'nisa', case when n.id is not null then n.nisa || ' · ' || n.zona end, 'dispozitiv', p_dispozitiv, 'sesiune', v_s)));
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
    case when n.id is not null then format('%s · %s: %s firme evaluate', n.nisa, n.zona, v_adaugate) else format('%s firme evaluate', v_adaugate) end, v_s);
  return jsonb_build_object('adaugate', v_adaugate, 'eligibile', v_elig, 'respinse', v_resp, 'deja_evaluate', v_deja, 'invalide', v_invalide);
end;
$$;

-- 7. Coada de email și /termina: sesiunea care lucrează ------------------------------------------

create or replace function public.prospectare_coada_email(p_dispozitiv uuid, p_casuta text default null, p_sesiune text default '1')
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
    perform public.prospectare_robot_ce_face(p_dispozitiv, 'trimitere', coalesce('coada de email: ' || v_cas, 'coada de email'), p_sesiune);
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

create or replace function public.prospectare_termina_lot(p_dispozitiv uuid, p_firme jsonb, p_sesiune text default '1')
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
  v_s text := public.prospectare_sesiune(p_sesiune);
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
          jsonb_strip_nulls(jsonb_build_object('dispozitiv', p_dispozitiv, 'sesiune', v_s, 'link_demo', v_link, 'captura_url', v_capt, 'link_verificat', v_verif))
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

-- Site-urile publicate de fiecare sesiune: azi și în total (pagina Roboți).
create or replace function public.prospectare_statistici_sesiuni()
returns table (dispozitiv_id uuid, sesiune text, azi bigint, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select (a.detalii ->> 'dispozitiv')::uuid,
         coalesce(nullif(a.detalii ->> 'sesiune', ''), '1'),
         count(*) filter (where a.la >= public.prospectare_inceput_azi()),
         count(*)
  from public.prospectare_activitate a
  where a.tip = 'site' and a.detalii ? 'dispozitiv' and (a.detalii ->> 'dispozitiv') ~ '^[0-9a-f-]{36}$'
  group by 1, 2
$$;

-- 8. Drepturi -------------------------------------------------------------------------------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.prospectare_sesiune(text)',
    'public.prospectare_autentifica(text, text)',
    'public.prospectare_robot_ce_face(uuid, text, text, text)',
    'public.prospectare_rezerva_urmatoarea(uuid, text, text)',
    'public.prospectare_heartbeat(uuid, uuid, text)',
    'public.prospectare_nisa_rezerva(uuid, text, text, text)',
    'public.prospectare_nisa_progres(uuid, bigint, integer, integer, integer, boolean, text, text)',
    'public.prospectare_nisa_admin(text, bigint, text, text, text)',
    'public.prospectare_evaluare_noteaza(uuid, bigint, jsonb, text)',
    'public.prospectare_coada_email(uuid, text, text)',
    'public.prospectare_termina_lot(uuid, jsonb, text)',
    'public.prospectare_statistici_sesiuni()'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke all on function %s from anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;

-- Verificarea (toate rândurile trebuie să fie `true`).
select 'sesiunile: tabelul, coloana pe rezervări și pe nișe' as verificare,
  to_regclass('public.prospectare_sesiuni') is not null
  and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prospectare_rezervari' and column_name = 'sesiune')
  and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prospectare_nise' and column_name = 'sesiune') as ok
union all
select 'funcțiile primesc sesiunea (implicit „1”: robotul vechi merge ca înainte)',
  (select count(*) = 9 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('prospectare_autentifica', 'prospectare_robot_ce_face',
     'prospectare_rezerva_urmatoarea', 'prospectare_heartbeat', 'prospectare_nisa_rezerva', 'prospectare_nisa_progres', 'prospectare_evaluare_noteaza',
     'prospectare_coada_email', 'prospectare_termina_lot') and pg_get_function_arguments(p.oid) like '%p_sesiune text DEFAULT ''1''%')
  and (select count(*) = 9 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('prospectare_autentifica', 'prospectare_robot_ce_face',
     'prospectare_rezerva_urmatoarea', 'prospectare_heartbeat', 'prospectare_nisa_rezerva', 'prospectare_nisa_progres', 'prospectare_evaluare_noteaza',
     'prospectare_coada_email', 'prospectare_termina_lot'))
union all
select format('roboți: %s, cu %s sesiuni cunoscute (%s active în ultima jumătate de oră)',
    (select count(*) from public.prospectare_dispozitive), count(*), count(*) filter (where ultima_activitate > now() - interval '30 minutes')),
  true
from public.prospectare_sesiuni
union all
select 'funcțiile noi doar pentru cheia de service',
  not has_function_privilege('authenticated', 'public.prospectare_rezerva_urmatoarea(uuid, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.prospectare_autentifica(text, text)', 'execute')
  and has_function_privilege('service_role', 'public.prospectare_nisa_rezerva(uuid, text, text, text)', 'execute');
