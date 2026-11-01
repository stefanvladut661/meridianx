-- ============================================================
-- Prospectare, migrarea 2 din 3: roboții, rezervările și listele zilei.
--
-- Până la 10 calculatoare cu roboți, pornite și oprite oricând: o firmă de
-- construit e luată de un singur robot. `prospectare_rezerva_urmatoarea`
-- blochează rândul firmei cu `for update skip locked`, deci două cereri
-- simultane nu pot lua aceeași firmă; rezervarea ține 3 ore (din setări) și
-- se prelungește cu `prospectare_heartbeat`. Un robot oprit își pierde
-- firma când expiră rezervarea, iar următorul robot o ia de unde a rămas.
--
-- Listele zilei (apeluri și WhatsApp) se fac tot atomic: firma primește
-- canalul în aceeași tranzacție în care intră în listă.
--
-- Citirea: doar adminii. Funcțiile: doar cheia de service.
-- Se rulează după migrarea 28. Se poate rula de mai multe ori.
-- ============================================================

-- Roboții ------------------------------------------------------------------------

create table if not exists public.prospectare_dispozitive (
  id uuid primary key default gen_random_uuid(),
  nume text not null check (char_length(nume) between 1 and 80),
  proprietar text not null check (char_length(proprietar) between 1 and 80),
  -- Doar hash-ul SHA-256 (hex) al tokenului. Tokenul în clar se arată o singură dată, la creare.
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  activ boolean not null default true,
  ultima_activitate timestamptz,
  -- Limita de cereri: fereastra curentă (minutul) și câte cereri a făcut în ea.
  cereri_fereastra timestamptz,
  cereri_numar integer not null default 0 check (cereri_numar >= 0),
  creat_la timestamptz not null default now(),
  creat_de text check (creat_de is null or char_length(creat_de) <= 200),
  schimbat_la timestamptz,
  schimbat_de text check (schimbat_de is null or char_length(schimbat_de) <= 200)
);
create unique index if not exists prospectare_dispozitive_nume_uidx on public.prospectare_dispozitive (lower(nume));
create unique index if not exists prospectare_dispozitive_token_uidx on public.prospectare_dispozitive (token_hash);

-- Rezervările: ce firmă construiește fiecare robot și până când.
create table if not exists public.prospectare_rezervari (
  firma_id uuid primary key references public.prospectare_firme (id) on delete cascade,
  dispozitiv_id uuid not null references public.prospectare_dispozitive (id) on delete cascade,
  tip_lucru text not null check (tip_lucru in ('construire', 'refacere')),
  luat_la timestamptz not null default now(),
  expira_la timestamptz not null
);
create index if not exists prospectare_rezervari_dispozitiv_idx on public.prospectare_rezervari (dispozitiv_id, expira_la desc);

-- Listele zilei ------------------------------------------------------------------

create table if not exists public.prospectare_liste_zi (
  id bigint generated always as identity primary key,
  data date not null default public.prospectare_azi(),
  utilizator text not null check (utilizator in ('stefan', 'vladut')),
  canal text not null check (canal in ('telefon', 'whatsapp')),
  cont_whatsapp smallint check (cont_whatsapp is null or cont_whatsapp between 1 and 9),
  firma_id uuid not null references public.prospectare_firme (id) on delete restrict,
  rezultat text check (rezultat is null or rezultat in ('nu_raspunde', 'interesat', 'nu_vrea', 'suna_inapoi', 'numar_gresit', 'trimis')),
  incercari smallint not null default 0 check (incercari >= 0),
  suna_inapoi_la timestamptz,
  nota text check (nota is null or char_length(nota) <= 2000),
  creat_la timestamptz not null default now(),
  actualizat_la timestamptz not null default now(),
  constraint prospectare_liste_zi_cont check ((canal = 'whatsapp') = (cont_whatsapp is not null)),
  constraint prospectare_liste_zi_firma_data unique (firma_id, data)
);
create index if not exists prospectare_liste_zi_zi_idx on public.prospectare_liste_zi (data, utilizator, canal);

-- În listă intră doar o firmă care are deja canalul listei și nu e „Nu contacta”.
create or replace function public.prospectare_liste_reguli()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
begin
  select etapa, canal, nr into f from public.prospectare_firme where id = new.firma_id;
  if f.etapa = 'nu_contacta' then
    raise exception 'Firma #% e „Nu contacta”: nu intră în liste.', f.nr using errcode = 'PR410';
  end if;
  if f.canal is distinct from new.canal then
    raise exception 'Firma #% are canalul %, nu %.', f.nr, coalesce(f.canal, 'gol'), new.canal using errcode = 'PR409';
  end if;
  new.actualizat_la := now();
  return new;
end;
$$;

drop trigger if exists prospectare_liste_reguli on public.prospectare_liste_zi;
create trigger prospectare_liste_reguli
  before insert or update of firma_id, canal on public.prospectare_liste_zi
  for each row execute function public.prospectare_liste_reguli();

-- O firmă trecută pe „Nu contacta” iese din listele neterminate și din rezervări.
create or replace function public.prospectare_firme_nu_contacta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.etapa = 'nu_contacta' and old.etapa is distinct from 'nu_contacta' then
    delete from public.prospectare_liste_zi
      where firma_id = new.id and (rezultat is null or rezultat in ('nu_raspunde', 'suna_inapoi'));
    delete from public.prospectare_rezervari where firma_id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists prospectare_firme_nu_contacta on public.prospectare_firme;
create trigger prospectare_firme_nu_contacta
  after update of etapa on public.prospectare_firme
  for each row execute function public.prospectare_firme_nu_contacta();

-- Listele neterminate de ieri (sau mai vechi) trec pe azi --------------------------

create or replace function public.prospectare_reporteaza_liste()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_azi date := public.prospectare_azi();
  v_mutate integer;
begin
  with vechi as (
    select l.id
    from public.prospectare_liste_zi l
    where l.data < v_azi
      and (l.rezultat is null or l.rezultat in ('nu_raspunde', 'suna_inapoi'))
      and not exists (select 1 from public.prospectare_liste_zi t where t.firma_id = l.firma_id and t.data = v_azi)
    for update skip locked
  )
  update public.prospectare_liste_zi l
  set data = v_azi, actualizat_la = now()
  from vechi
  where l.id = vechi.id;
  get diagnostics v_mutate = row_count;
  return v_mutate;
end;
$$;

-- Importul în lista zilei ----------------------------------------------------------
-- Ia firme cu site gata, cu link demo și fără canal, potrivite filtrelor, de la
-- scorul cel mai mare; le dă canalul listei și le pune în lista utilizatorului.
-- Filtre (jsonb): nisa, oras, judet, scor_min, doar_mobil.

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
  v_numar integer;
  v_limita integer;
  v_folosite integer := 0;
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
  if p_canal not in ('telefon', 'whatsapp') then
    raise exception 'Lista zilei e de telefon sau de WhatsApp, nu %.', p_canal using errcode = 'PR422';
  end if;
  if p_numar is null or p_numar < 1 or p_numar > 500 then
    raise exception 'Câte firme: între 1 și 500.' using errcode = 'PR422';
  end if;
  if (p_canal = 'whatsapp') <> (p_cont_whatsapp is not null) then
    raise exception 'Contul WhatsApp se alege doar pentru lista de WhatsApp.' using errcode = 'PR422';
  end if;

  perform set_config('prospectare.autor', coalesce(nullif(btrim(p_autor), ''), v_nume), true);
  perform set_config('prospectare.motiv',
    case when p_canal = 'telefon' then format('Adăugată în lista de apeluri a lui %s', v_nume)
         else format('Adăugată în lista de WhatsApp a lui %s, contul %s', v_nume, p_cont_whatsapp) end, true);

  v_numar := p_numar;
  if p_canal = 'whatsapp' then
    select nullif(whatsapp_pe_cont ->> p_cont_whatsapp::text, '')::integer into v_limita from public.prospectare_setari where id = 1;
    if coalesce(v_limita, 0) <= 0 then
      raise exception 'Contul WhatsApp % nu are limită în Setări.', p_cont_whatsapp using errcode = 'PR422';
    end if;
    select count(*) into v_folosite from public.prospectare_liste_zi
      where data = v_azi and canal = 'whatsapp' and cont_whatsapp = p_cont_whatsapp;
    v_numar := least(p_numar, v_limita - v_folosite);
    if v_numar <= 0 then
      return jsonb_build_object('adaugate', 0, 'limita', v_limita, 'folosite', v_folosite, 'motiv', 'limita_contului');
    end if;
  end if;

  for r in
    select f.id
    from public.prospectare_firme f
    where f.etapa = 'site_gata'
      and f.canal is null
      and f.link_demo is not null
      and f.telefon is not null
      and (p_canal <> 'whatsapp' or f.este_mobil)
      and (not v_mobil or f.este_mobil)
      and (v_nisa is null or f.nisa = v_nisa)
      and (v_oras is null or f.oras = v_oras)
      and (v_judet is null or f.judet = v_judet)
      and (v_scor is null or f.scor >= v_scor)
    order by f.scor desc nulls last, f.nr
    limit v_numar
    for update of f skip locked
  loop
    update public.prospectare_firme set canal = p_canal where id = r.id and canal is null and etapa = 'site_gata';
    if found then
      insert into public.prospectare_liste_zi (data, utilizator, canal, cont_whatsapp, firma_id)
      values (v_azi, p_utilizator, p_canal, case when p_canal = 'whatsapp' then p_cont_whatsapp end, r.id);
      v_luate := v_luate + 1;
    end if;
  end loop;

  return jsonb_build_object('adaugate', v_luate, 'cerute', p_numar, 'limita', v_limita, 'folosite', v_folosite + v_luate);
end;
$$;

-- Rezultatul unui apel -------------------------------------------------------------

create or replace function public.prospectare_seteaza_rezultat(
  p_lista bigint,
  p_rezultat text,
  p_nota text default null,
  p_suna_inapoi_la timestamptz default null,
  p_autor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.prospectare_liste_zi%rowtype;
  f public.prospectare_firme%rowtype;
  v_limita integer;
  v_incercari integer;
  v_nume text;
  v_etapa text;
begin
  select * into l from public.prospectare_liste_zi where id = p_lista for update;
  if not found then
    raise exception 'Rândul din listă nu mai există (poate a fost scos între timp).' using errcode = 'PR404';
  end if;
  if l.canal <> 'telefon' then
    raise exception 'Rezultatul de apel e doar pentru lista de telefon.' using errcode = 'PR422';
  end if;
  if p_rezultat not in ('nu_raspunde', 'interesat', 'nu_vrea', 'suna_inapoi', 'numar_gresit') then
    raise exception 'Rezultat necunoscut: %.', p_rezultat using errcode = 'PR422';
  end if;
  if p_rezultat = 'suna_inapoi' and p_suna_inapoi_la is null then
    raise exception 'Alege ora la care suni înapoi.' using errcode = 'PR422';
  end if;

  select * into f from public.prospectare_firme where id = l.firma_id for update;
  v_nume := case l.utilizator when 'stefan' then 'Ștefan' when 'vladut' then 'Vlăduț' else l.utilizator end;
  perform set_config('prospectare.autor', coalesce(nullif(btrim(p_autor), ''), v_nume), true);
  select incercari_max into v_limita from public.prospectare_setari where id = 1;
  v_limita := coalesce(v_limita, 3);
  v_incercari := case when p_rezultat = 'nu_raspunde' then l.incercari + 1 else l.incercari end;

  -- Ultima încercare fără răspuns: firma iese din listă și își pierde canalul
  -- telefon (singura resetare de canal permisă), apoi revine în rezervă.
  if p_rezultat = 'nu_raspunde' and v_incercari >= v_limita then
    perform set_config('prospectare.reseteaza_canal', 'da', true);
    perform set_config('prospectare.motiv', format('Nu a răspuns la %s încercări: iese din listă și își pierde canalul telefon', v_limita), true);
    update public.prospectare_firme
      set canal = null, etapa = case when etapa in ('site_gata', 'sunat') then 'site_gata' else etapa end
      where id = f.id;
    perform set_config('prospectare.reseteaza_canal', '', true);
    perform set_config('prospectare.motiv', '', true);
    delete from public.prospectare_liste_zi where id = l.id;
    perform public.prospectare_noteaza(f.id, 'apel', 'telefon',
      jsonb_build_object('rezultat', p_rezultat, 'incercari', v_incercari, 'limita', v_limita, 'revenit_in_rezerva', true));
    return jsonb_build_object('revenit', true, 'incercari', v_incercari, 'limita', v_limita);
  end if;

  if p_rezultat = 'numar_gresit' then
    perform set_config('prospectare.motiv', 'Număr greșit la apel', true);
    update public.prospectare_firme
      set etapa = 'nu_contacta', nota = coalesce(nullif(btrim(nota), '') || E'\n', '') || 'Număr greșit la apel.'
      where id = f.id;
    delete from public.prospectare_liste_zi where id = l.id;
    perform public.prospectare_noteaza(f.id, 'apel', 'telefon',
      jsonb_strip_nulls(jsonb_build_object('rezultat', p_rezultat, 'nota', nullif(btrim(p_nota), ''))));
    return jsonb_build_object('revenit', false, 'scoasa', true, 'incercari', v_incercari);
  end if;

  update public.prospectare_liste_zi
    set rezultat = p_rezultat,
        incercari = v_incercari,
        nota = coalesce(p_nota, nota),
        suna_inapoi_la = case when p_rezultat = 'suna_inapoi' then p_suna_inapoi_la end
    where id = l.id;

  v_etapa := case p_rezultat
    when 'interesat' then case when f.etapa = 'client' then f.etapa else 'interesat' end
    when 'nu_vrea' then 'respins'
    else case when f.etapa = 'site_gata' then 'sunat' else f.etapa end
  end;
  if v_etapa is distinct from f.etapa then
    update public.prospectare_firme set etapa = v_etapa where id = f.id;
  end if;

  perform public.prospectare_noteaza(f.id, 'apel', 'telefon',
    jsonb_strip_nulls(jsonb_build_object('rezultat', p_rezultat, 'incercari', v_incercari, 'limita', v_limita,
      'suna_inapoi_la', p_suna_inapoi_la, 'nota', nullif(btrim(p_nota), ''))));
  return jsonb_build_object('revenit', false, 'incercari', v_incercari, 'limita', v_limita);
end;
$$;

-- Mesaj WhatsApp trimis (manual, din telefon) ------------------------------------

create or replace function public.prospectare_marcheaza_whatsapp(p_lista bigint, p_autor text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.prospectare_liste_zi%rowtype;
  v_nume text;
begin
  select * into l from public.prospectare_liste_zi where id = p_lista for update;
  if not found then
    raise exception 'Rândul din listă nu mai există.' using errcode = 'PR404';
  end if;
  if l.canal <> 'whatsapp' then
    raise exception 'Rândul nu e din lista de WhatsApp.' using errcode = 'PR422';
  end if;
  if l.rezultat = 'trimis' then
    return jsonb_build_object('deja', true);
  end if;
  v_nume := case l.utilizator when 'stefan' then 'Ștefan' when 'vladut' then 'Vlăduț' else l.utilizator end;
  perform set_config('prospectare.autor', coalesce(nullif(btrim(p_autor), ''), v_nume), true);
  update public.prospectare_liste_zi set rezultat = 'trimis', incercari = greatest(incercari, 1) where id = l.id;
  update public.prospectare_firme set etapa = 'whatsapp_trimis' where id = l.firma_id and etapa = 'site_gata';
  perform public.prospectare_noteaza(l.firma_id, 'whatsapp', 'whatsapp', jsonb_build_object('cont', l.cont_whatsapp));
  return jsonb_build_object('deja', false);
end;
$$;

-- Schimbările făcute de om din admin: etapă și notă --------------------------------

create or replace function public.prospectare_schimba_etapa(p_firma uuid, p_etapa text, p_autor text, p_motiv text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.prospectare_firme%rowtype;
begin
  if p_etapa not in ('interesat', 'client', 'respins', 'nu_contacta') then
    raise exception 'Din admin, etapa se schimbă doar în Interesat, Client, Respins sau Nu contacta.' using errcode = 'PR422';
  end if;
  select * into f from public.prospectare_firme where id = p_firma for update;
  if not found then
    raise exception 'Firma nu există.' using errcode = 'PR404';
  end if;
  if f.etapa = p_etapa then
    return jsonb_build_object('schimbat', false);
  end if;
  if f.etapa = 'nu_contacta' then
    raise exception 'Firma #% e „Nu contacta”: etapa nu se mai schimbă.', f.nr using errcode = 'PR410';
  end if;
  perform set_config('prospectare.autor', p_autor, true);
  perform set_config('prospectare.motiv', coalesce(nullif(btrim(p_motiv), ''), ''), true);
  update public.prospectare_firme set etapa = p_etapa where id = f.id;
  return jsonb_build_object('schimbat', true);
end;
$$;

create or replace function public.prospectare_salveaza_nota(p_firma uuid, p_nota text, p_autor text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('prospectare.autor', p_autor, true);
  update public.prospectare_firme set nota = nullif(btrim(p_nota), '') where id = p_firma;
  if not found then
    raise exception 'Firma nu există.' using errcode = 'PR404';
  end if;
  perform public.prospectare_noteaza(p_firma, 'nota', null,
    jsonb_build_object('text', case when nullif(btrim(p_nota), '') is null then 'Notă ștearsă' else 'Notă actualizată' end));
end;
$$;

-- Roboții: rezervare, semn de viață, site gata --------------------------------------

create or replace function public.prospectare_rezerva_urmatoarea(p_dispozitiv uuid, p_tip_lucru text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ore integer;
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
  select rezervare_ore into v_ore from public.prospectare_setari where id = 1;
  v_ore := coalesce(v_ore, 3);

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
    return to_jsonb(f) || jsonb_build_object('rezervare', jsonb_build_object('tip_lucru', v_rez.tip_lucru, 'expira_la', v_rez.expira_la, 'reluata', true));
  end if;

  loop
    v_incercare := v_incercare + 1;
    exit when v_incercare > 5;

    -- Firmele rămase de la un robot oprit (rezervare expirată) au întâietate, apoi refacerile, apoi scorul.
    select ff.* into f
    from public.prospectare_firme ff
    left join public.prospectare_rezervari r on r.firma_id = ff.id
    where ff.etapa = 'site_in_lucru'
      and (r.firma_id is null or r.expira_la <= now())
      and (p_tip_lucru is null or ff.de_refacut = (p_tip_lucru = 'refacere'))
    order by (r.firma_id is not null) desc, ff.de_refacut desc, ff.scor desc nulls last, ff.nr
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
      perform public.prospectare_noteaza(f.id, 'rezervare', null,
        jsonb_strip_nulls(jsonb_build_object('dispozitiv', p_dispozitiv, 'tip_lucru', v_rez.tip_lucru, 'expira_la', v_rez.expira_la,
          'preluata_de_la', case when v_vechi is distinct from p_dispozitiv then v_vechi end)));
      return to_jsonb(f) || jsonb_build_object('rezervare', jsonb_build_object('tip_lucru', v_rez.tip_lucru, 'expira_la', v_rez.expira_la, 'reluata', false));
    end if;
  end loop;
  return null;
end;
$$;

create or replace function public.prospectare_heartbeat(p_dispozitiv uuid, p_firma uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ore integer;
  v_pana timestamptz;
begin
  select rezervare_ore into v_ore from public.prospectare_setari where id = 1;
  update public.prospectare_rezervari
    set expira_la = now() + make_interval(hours => coalesce(v_ore, 3))
    where firma_id = p_firma and dispozitiv_id = p_dispozitiv
    returning expira_la into v_pana;
  if not found then
    raise exception 'Rezervarea nu mai e a acestui robot (a expirat și a luat-o altul, sau firma a ieșit din lucru).' using errcode = 'PR409';
  end if;
  return v_pana;
end;
$$;

create or replace function public.prospectare_termina(
  p_dispozitiv uuid,
  p_firma uuid,
  p_link_demo text,
  p_captura_url text default null,
  p_detalii jsonb default '{}'::jsonb
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
        date_extra = date_extra || jsonb_build_object('status_robot', 'gata', 'terminat_la', now())
    where id = f.id
    returning * into f;
  delete from public.prospectare_rezervari where firma_id = p_firma;
  perform public.prospectare_noteaza(f.id, 'site', null,
    jsonb_strip_nulls(jsonb_build_object('dispozitiv', p_dispozitiv, 'link_demo', p_link_demo, 'captura_url', p_captura_url)) || coalesce(p_detalii, '{}'::jsonb));
  return jsonb_build_object('nr', f.nr, 'etapa', f.etapa, 'link_demo', f.link_demo);
end;
$$;

-- RLS și drepturi ----------------------------------------------------------------

alter table public.prospectare_dispozitive enable row level security;
alter table public.prospectare_rezervari enable row level security;
alter table public.prospectare_liste_zi enable row level security;

drop policy if exists prospectare_dispozitive_admin_read on public.prospectare_dispozitive;
create policy prospectare_dispozitive_admin_read on public.prospectare_dispozitive for select to authenticated using (public.is_lead_admin());
drop policy if exists prospectare_rezervari_admin_read on public.prospectare_rezervari;
create policy prospectare_rezervari_admin_read on public.prospectare_rezervari for select to authenticated using (public.is_lead_admin());
drop policy if exists prospectare_liste_zi_admin_read on public.prospectare_liste_zi;
create policy prospectare_liste_zi_admin_read on public.prospectare_liste_zi for select to authenticated using (public.is_lead_admin());

-- Hash-ul tokenului nu se citește prin REST, nici de admini.
revoke select on public.prospectare_dispozitive from anon, authenticated;
grant select (id, nume, proprietar, activ, ultima_activitate, creat_la, creat_de, schimbat_la, schimbat_de)
  on public.prospectare_dispozitive to authenticated;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.prospectare_reporteaza_liste()',
    'public.prospectare_importa_lista_zi(text, text, integer, jsonb, smallint, text)',
    'public.prospectare_seteaza_rezultat(bigint, text, text, timestamptz, text)',
    'public.prospectare_marcheaza_whatsapp(bigint, text)',
    'public.prospectare_schimba_etapa(uuid, text, text, text)',
    'public.prospectare_salveaza_nota(uuid, text, text)',
    'public.prospectare_rezerva_urmatoarea(uuid, text)',
    'public.prospectare_heartbeat(uuid, uuid)',
    'public.prospectare_termina(uuid, uuid, text, text, jsonb)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke all on function %s from anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;

select 'RLS activ pe prospectare_dispozitive, prospectare_rezervari, prospectare_liste_zi' as verificare,
  (select bool_and(relrowsecurity) from pg_class where relname in ('prospectare_dispozitive', 'prospectare_rezervari', 'prospectare_liste_zi') and relnamespace = 'public'::regnamespace) as ok
union all
select 'funcțiile de lucru doar pentru cheia de service',
  not has_function_privilege('anon', 'public.prospectare_rezerva_urmatoarea(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.prospectare_importa_lista_zi(text, text, integer, jsonb, smallint, text)', 'execute')
union all
select 'hash-ul tokenului nu se citește prin REST',
  not has_column_privilege('authenticated', 'public.prospectare_dispozitive', 'token_hash', 'select');
