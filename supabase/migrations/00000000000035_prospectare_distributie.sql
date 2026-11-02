-- ============================================================
-- Prospectare, migrarea 8 (35): distribuția pe canale.
--
-- Cine intră în distribuție: firmele cu site gata, publicat (link demo verificat),
-- fără niciun contact, care nu sunt „Nu contacta”, respinse, clienți sau duplicate.
-- Ordinea: data la care s-a terminat site-ul, cele mai vechi primele (nu scorul).
--
-- În fiecare zi la 00:00 (ora României), prin pg_cron (Supabase Cron), și oricum
-- la prima cerere de după 00:00 dacă jobul n-a rulat:
--   a) se eliberează ce era programat pe email sau WhatsApp și n-a plecat, plus
--      apelurile importate și nesunate (fără rezultat);
--   b) emailul: programările manuale ale zilei, apoi cele mai vechi firme cu email
--      valid, pe căsuța domeniului din linkul demo, cât permite limita căsuței
--      (limita din Setări sau plafonul de încălzire);
--   c) WhatsApp: manualele, apoi următoarele firme cu mobil (și cele cu email care
--      n-au încăput), împărțite egal pe conturile active, cât permite limita lor;
--   d) apelurile nu se programează automat: restul stă în rezervă.
-- O firmă programată pe un canal e blocată pentru celelalte până la 00:00.
--
-- Apeluri: firma se blochează doar când e importată în „Apeluri azi”; „Nu răspunde”
-- nu e contact (se întoarce în distribuție, încercările rămân notate); „Interesat”
-- și „Sună înapoi” rămân pe telefon; „Nu vrea” → „Nu contacta”; „Număr greșit” →
-- doar email.
--
-- Programarea manuală (Email, WhatsApp, Apeluri): de mâine încolo; ce nu încape în
-- limita zilei trece în zilele următoare, pe același canal; se anulează până în ziua ei.
--
-- Robotul de email: /coada-email (prospectare_coada_email) întoarce programările zilei;
-- cererea canalului (prospectare_email_cere_canal) refuză firmele neprogramate azi.
--
-- Doar cheia de service. Se rulează după 28–34. Se poate rula de mai multe ori.
-- ============================================================

-- 1. Firmele: data site-ului gata, cine l-a construit, linkul verificat, numărul greșit --

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prospectare_firme' and column_name = 'demo_verificat') then
    alter table public.prospectare_firme add column demo_verificat boolean not null default false;
    -- Linkurile de până acum au venit doar din deploy-ul verificat (link_verificat = da): o singură dată.
    update public.prospectare_firme set demo_verificat = true where link_demo is not null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prospectare_firme' and column_name = 'site_gata_la') then
    alter table public.prospectare_firme add column site_gata_la timestamptz;
    update public.prospectare_firme set site_gata_la = (date_extra ->> 'terminat_la')::timestamptz
      where date_extra ? 'terminat_la' and (date_extra ->> 'terminat_la') ~ '^\d{4}-\d{2}-\d{2}';
  end if;
end;
$$;
alter table public.prospectare_firme add column if not exists construit_de text;
alter table public.prospectare_firme add column if not exists telefon_gresit boolean not null default false;
alter table public.prospectare_firme add column if not exists apel_incercari smallint not null default 0;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prospectare_firme_construit_de') then
    alter table public.prospectare_firme add constraint prospectare_firme_construit_de check (construit_de is null or char_length(construit_de) <= 200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prospectare_firme_apel_incercari') then
    alter table public.prospectare_firme add constraint prospectare_firme_apel_incercari check (apel_incercari between 0 and 1000);
  end if;
end;
$$;
create index if not exists prospectare_firme_distributie_idx on public.prospectare_firme (site_gata_la nulls last, nr)
  where etapa = 'site_gata' and email_la is null and whatsapp_la is null and telefon_la is null;

-- 2. Setări: plafonul de încălzire al căsuțelor și câte apeluri pe zi --------------------

alter table public.prospectare_setari add column if not exists email_plafon_casuta smallint not null default 2;
alter table public.prospectare_setari add column if not exists apeluri_pe_zi smallint not null default 20;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prospectare_setari_email_plafon') then
    alter table public.prospectare_setari add constraint prospectare_setari_email_plafon check (email_plafon_casuta between 0 and 500);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prospectare_setari_apeluri_pe_zi') then
    alter table public.prospectare_setari add constraint prospectare_setari_apeluri_pe_zi check (apeluri_pe_zi between 1 and 500);
  end if;
end;
$$;

-- 3. Programările și ciclurile zilnice ----------------------------------------------------

create table if not exists public.prospectare_programari (
  id bigint generated always as identity primary key,
  firma_id uuid not null references public.prospectare_firme (id) on delete cascade,
  canal text not null check (canal in ('email', 'whatsapp', 'telefon')),
  zi date not null,
  sursa text not null check (sursa in ('automat', 'manual')),
  -- Email: căsuța (a domeniului din linkul demo). WhatsApp: contul. Apeluri: cine sună.
  casuta text check (casuta is null or char_length(casuta) <= 320),
  cont_whatsapp smallint references public.prospectare_conturi_whatsapp (id),
  utilizator text check (utilizator is null or utilizator in ('stefan', 'vladut')),
  -- programata → folosita (emailul cerut, WhatsApp-ul trimis, firma pusă în lista de apeluri)
  --            → eliberata (00:00, nefolosită) / anulata (de om, sau firma nu mai e eligibilă).
  stare text not null default 'programata' check (stare in ('programata', 'folosita', 'eliberata', 'anulata')),
  -- Ziua aleasă de om, dacă programarea a fost mutată mai încolo (limita zilei).
  zi_ceruta date,
  creat_la timestamptz not null default now(),
  creat_de text not null default 'sistem' check (char_length(creat_de) between 1 and 200),
  inchis_la timestamptz,
  motiv text check (motiv is null or char_length(motiv) <= 500),
  constraint prospectare_programari_cheie check (
    (canal = 'email' and casuta is not null and cont_whatsapp is null and utilizator is null)
    or (canal = 'whatsapp' and cont_whatsapp is not null and casuta is null and utilizator is null)
    or (canal = 'telefon' and utilizator is not null and casuta is null and cont_whatsapp is null)),
  constraint prospectare_programari_inchis check ((stare = 'programata') = (inchis_la is null))
);
-- O firmă are cel mult o programare activă: niciodată pe două canale (sau de două ori).
create unique index if not exists prospectare_programari_activa_uidx on public.prospectare_programari (firma_id) where stare = 'programata';
create index if not exists prospectare_programari_zi_idx on public.prospectare_programari (zi, canal, stare);
create index if not exists prospectare_programari_firma_idx on public.prospectare_programari (firma_id, creat_la desc);

create table if not exists public.prospectare_cicluri (
  zi date primary key,
  rulat_la timestamptz not null default now(),
  rezultat jsonb not null default '{}'::jsonb check (jsonb_typeof(rezultat) = 'object')
);

alter table public.prospectare_programari enable row level security;
alter table public.prospectare_cicluri enable row level security;
drop policy if exists prospectare_programari_admin_read on public.prospectare_programari;
create policy prospectare_programari_admin_read on public.prospectare_programari for select to authenticated using (public.is_lead_admin());
drop policy if exists prospectare_cicluri_admin_read on public.prospectare_cicluri;
create policy prospectare_cicluri_admin_read on public.prospectare_cicluri for select to authenticated using (public.is_lead_admin());

alter table public.prospectare_activitate drop constraint if exists prospectare_activitate_tip_check;
alter table public.prospectare_activitate add constraint prospectare_activitate_tip_check check (tip in (
  'creata', 'etapa', 'canal', 'apel', 'whatsapp', 'email', 'bounce', 'raspuns',
  'site', 'rezervare', 'nota', 'lista', 'import', 'cercetare', 'sistem', 'recontactare', 'evaluare', 'programare'
));

-- 4. Regulile firmei: anularea WhatsApp-ului, eliberarea telefonului, programarea ---------

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

create or replace function public.prospectare_firme_jurnal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_motiv text := nullif(current_setting('prospectare.motiv', true), '');
begin
  if tg_op = 'INSERT' then
    perform public.prospectare_noteaza(new.id, 'creata', null,
      jsonb_strip_nulls(jsonb_build_object('etapa', new.etapa, 'domeniu', new.domeniu,
        'email_la', new.email_la, 'whatsapp_la', new.whatsapp_la, 'telefon_la', new.telefon_la)));
    return null;
  end if;

  if new.etapa is distinct from old.etapa then
    perform public.prospectare_noteaza(new.id, 'etapa', null,
      jsonb_strip_nulls(jsonb_build_object('din', old.etapa, 'in', new.etapa, 'motiv', v_motiv)));
  end if;
  if new.email_la is distinct from old.email_la then
    perform public.prospectare_noteaza(new.id, 'canal', 'email',
      jsonb_strip_nulls(jsonb_build_object('in', 'email', 'la', new.email_la, 'motiv', v_motiv)));
  end if;
  if new.whatsapp_la is distinct from old.whatsapp_la then
    perform public.prospectare_noteaza(new.id, 'canal', 'whatsapp',
      jsonb_strip_nulls(case when new.whatsapp_la is null
        then jsonb_build_object('din', 'whatsapp', 'cont', old.whatsapp_cont, 'motiv', v_motiv)
        else jsonb_build_object('in', 'whatsapp', 'la', new.whatsapp_la, 'cont', new.whatsapp_cont, 'motiv', v_motiv) end));
  end if;
  if new.telefon_la is distinct from old.telefon_la then
    perform public.prospectare_noteaza(new.id, 'canal', 'telefon',
      jsonb_strip_nulls(case when new.telefon_la is null
        then jsonb_build_object('din', 'telefon', 'motiv', v_motiv)
        else jsonb_build_object('in', 'telefon', 'la', new.telefon_la, 'motiv', v_motiv) end));
  end if;
  return null;
end;
$$;

-- Ieșită din prospectare (Nu contacta, client, respinsă, interesată): listele neterminate,
-- rezervarea de construcție și programările active dispar.
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
  if new.etapa in ('nu_contacta', 'client', 'respins', 'interesat') and old.etapa is distinct from new.etapa then
    update public.prospectare_programari
      set stare = 'anulata', inchis_la = now(), motiv = format('firma a trecut la „%s”', new.etapa)
      where firma_id = new.id and stare = 'programata';
  end if;
  return null;
end;
$$;

-- 5. Cine poate merge pe un canal ----------------------------------------------------------

-- Email valid: verificat „bun” de robot (sau neverificat, când vine din API), nu doar pentru
-- WhatsApp (sub pragul de scor) și fără trimiterea oprită de robot.
create or replace function public.prospectare_email_valid(f public.prospectare_firme)
returns boolean
language sql
stable
set search_path = public
as $$
  select f.email is not null
    and coalesce(f.date_extra ->> 'email_verificat', 'bun') = 'bun'
    and coalesce(f.date_extra ->> 'doar_whatsapp', 'false') <> 'true'
    and coalesce(nullif(f.date_extra ->> 'trimitere_oprita', ''), 'false') = 'false'
$$;

-- Firma poate fi programată (sau contactată) pe canal. Programarea activă se verifică separat.
create or replace function public.prospectare_poate_canal(f public.prospectare_firme, p_canal text)
returns boolean
language sql
stable
set search_path = public
as $$
  select f.etapa not in ('nu_contacta', 'client', 'respins')
    and f.link_demo is not null and f.demo_verificat
    and not (f.date_extra ? 'duplicat_de')
    and case p_canal
      when 'email' then f.email_la is null and public.prospectare_email_valid(f)
      when 'whatsapp' then f.whatsapp_la is null and f.este_mobil and not f.telefon_gresit
      when 'telefon' then f.telefon_la is null and f.telefon is not null and not f.telefon_gresit
      else false
    end
    and ((f.etapa = 'site_gata' and f.email_la is null and f.whatsapp_la is null and f.telefon_la is null)
         or f.canal_permis = p_canal)
$$;

-- De ce nu poate (pentru mesajele din admin). Null = poate.
create or replace function public.prospectare_motiv_canal(f public.prospectare_firme, p_canal text)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when public.prospectare_poate_canal(f, p_canal) then null
    when f.etapa = 'nu_contacta' then '„Nu contacta”'
    when f.date_extra ? 'duplicat_de' then format('duplicat al #%s', f.date_extra ->> 'duplicat_de')
    when f.etapa in ('client', 'respins') then format('etapa „%s”', f.etapa)
    when f.link_demo is null then 'site-ul demo nu are link'
    when not f.demo_verificat then 'linkul demo nu e verificat (site nepublicat)'
    when p_canal = 'email' and f.email_la is not null then 'a primit deja email'
    when p_canal = 'whatsapp' and f.whatsapp_la is not null then 'a primit deja WhatsApp'
    when p_canal = 'telefon' and f.telefon_la is not null then 'e deja în lista de apeluri'
    when f.canal_permis is distinct from p_canal and (f.email_la is not null or f.whatsapp_la is not null) then 'contactată deja pe ' ||
      concat_ws(', ', case when f.email_la is not null then 'email' end, case when f.whatsapp_la is not null then 'WhatsApp' end)
    when f.canal_permis is distinct from p_canal and f.telefon_la is not null then 'e în lista de apeluri (până la 00:00)'
    when f.etapa <> 'site_gata' and f.canal_permis is distinct from p_canal then format('etapa „%s”: site-ul nu e gata', f.etapa)
    when p_canal = 'email' and f.email is null then 'fără adresă de email'
    when p_canal = 'email' then 'emailul nu e verificat ca bun (sau firma e doar pentru WhatsApp)'
    when f.telefon_gresit then 'număr greșit: merge doar pe email'
    when p_canal = 'whatsapp' then 'fără număr de mobil'
    else 'fără telefon'
  end
$$;

-- Limita zilei a unei căsuțe: cea pusă în Setări pe căsuță, altfel plafonul de încălzire.
create or replace function public.prospectare_limita_casuta(c public.prospectare_casute)
returns integer
language sql
stable
set search_path = public
as $$
  select case when c.activa
    then coalesce(c.limita_zi, (select email_plafon_casuta::integer from public.prospectare_setari where id = 1), 0)
    else 0 end
$$;

-- Câte locuri sunt ocupate într-o zi, pe o căsuță / un cont / un om.
create or replace function public.prospectare_ocupate(p_canal text, p_zi date, p_cheie text)
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::integer from public.prospectare_programari p
  where p.zi = p_zi and p.canal = p_canal and p.stare in ('programata', 'folosita')
    and case p_canal when 'email' then p.casuta = p_cheie when 'whatsapp' then p.cont_whatsapp::text = p_cheie else p.utilizator = p_cheie end
$$;

-- Căsuța firmei: cea a domeniului din linkul demo (demo.meridianxweb.com → …@meridianxweb.com).
create or replace function public.prospectare_casuta_potrivita(p_link text, c public.prospectare_casute)
returns boolean
language sql
immutable
set search_path = public
as $$
  select public.prospectare_domeniu(p_link) = c.domeniu or public.prospectare_domeniu(p_link) like '%.' || c.domeniu
$$;

-- Un loc liber într-o zi: căsuța / contul / omul, sau null dacă ziua e plină.
create or replace function public.prospectare_loc_liber(p_canal text, p_zi date, p_link text, p_cont smallint, p_utilizator text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v text;
begin
  if p_canal = 'email' then
    select c.adresa into v from public.prospectare_casute c
      where c.activa and public.prospectare_casuta_potrivita(p_link, c)
        and public.prospectare_limita_casuta(c) - public.prospectare_ocupate('email', p_zi, c.adresa) > 0
      order by public.prospectare_limita_casuta(c) - public.prospectare_ocupate('email', p_zi, c.adresa) desc, c.adresa
      limit 1;
  elsif p_canal = 'whatsapp' then
    -- „Împarte egal”: contul cu cele mai multe locuri libere.
    select k.id::text into v from public.prospectare_conturi_whatsapp k
      where k.activ and (p_cont is null or k.id = p_cont)
        and k.limita_zi - public.prospectare_ocupate('whatsapp', p_zi, k.id::text) > 0
      order by k.limita_zi - public.prospectare_ocupate('whatsapp', p_zi, k.id::text) desc, k.ordine, k.id
      limit 1;
  elsif p_canal = 'telefon' then
    if p_utilizator in ('stefan', 'vladut')
       and (select apeluri_pe_zi from public.prospectare_setari where id = 1) - public.prospectare_ocupate('telefon', p_zi, p_utilizator) > 0 then
      v := p_utilizator;
    end if;
  end if;
  return v;
end;
$$;

-- 6. Ciclul zilei (00:00) -------------------------------------------------------------------

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
    if not public.prospectare_poate_canal(r.firma, r.canal) then
      update public.prospectare_programari set stare = 'anulata', inchis_la = now(),
        motiv = 'nu mai poate merge pe acest canal: ' || coalesce(public.prospectare_motiv_canal(r.firma, r.canal), '—')
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

  -- b) Email: cele mai vechi site-uri, pe căsuța domeniului lor, cât permite limita.
  for f in
    select x.* from public.prospectare_firme x
    where public.prospectare_poate_canal(x, 'email')
      and not exists (select 1 from public.prospectare_programari p where p.firma_id = x.id and p.stare = 'programata')
    order by (x.canal_permis = 'email') desc nulls last, x.site_gata_la nulls last, x.nr
    for update of x skip locked
  loop
    exit when not exists (select 1 from public.prospectare_casute c where c.activa
      and public.prospectare_limita_casuta(c) - public.prospectare_ocupate('email', v_zi, c.adresa) > 0);
    v_loc := public.prospectare_loc_liber('email', v_zi, f.link_demo, null, null);
    continue when v_loc is null;
    insert into public.prospectare_programari (firma_id, canal, zi, sursa, casuta, creat_de)
      values (f.id, 'email', v_zi, 'automat', v_loc, 'distribuție 00:00');
    v_aut_email := v_aut_email + 1;
  end loop;

  -- c) WhatsApp: următoarele, cu mobil (și cele cu email care n-au încăput), egal pe conturi.
  for f in
    select x.* from public.prospectare_firme x
    where public.prospectare_poate_canal(x, 'whatsapp')
      and not exists (select 1 from public.prospectare_programari p where p.firma_id = x.id and p.stare = 'programata')
    order by (x.canal_permis = 'whatsapp') desc nulls last, x.site_gata_la nulls last, x.nr
    for update of x skip locked
  loop
    v_loc := public.prospectare_loc_liber('whatsapp', v_zi, null, null, null);
    exit when v_loc is null;
    insert into public.prospectare_programari (firma_id, canal, zi, sursa, cont_whatsapp, creat_de)
      values (f.id, 'whatsapp', v_zi, 'automat', v_loc::smallint, 'distribuție 00:00');
    v_aut_wa := v_aut_wa + 1;
  end loop;

  -- d) Apelurile nu se programează automat: restul stă în rezervă.
  select count(*) into v_rezerva from public.prospectare_firme x
    where (public.prospectare_poate_canal(x, 'email') or public.prospectare_poate_canal(x, 'whatsapp') or public.prospectare_poate_canal(x, 'telefon'))
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
    on conflict (zi) do update set rulat_la = excluded.rulat_la, rezultat = excluded.rezultat;
  return v_rez;
end;
$$;

-- Ciclul de azi, dacă n-a rulat (cronul sau prima cerere de după 00:00).
create or replace function public.prospectare_asigura_ciclu()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rez jsonb;
begin
  select rezultat into v_rez from public.prospectare_cicluri where zi = public.prospectare_azi();
  if found then
    return v_rez;
  end if;
  return public.prospectare_ciclu_zi(public.prospectare_azi(), false);
end;
$$;

-- 7. Programarea manuală și anularea -------------------------------------------------------

-- Firmele care pot fi programate pe un canal, cu filtrele din admin, cele mai vechi primele.
-- Filtre (jsonb): lot, construit_de, nisa, oras, gata_de, gata_pana (AAAA-LL-ZZ), cauta (nume sau domeniu).
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
    where public.prospectare_poate_canal(x, p_canal)
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
    v_motiv := public.prospectare_motiv_canal(f, p_canal);
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

-- Anularea: doar programările care n-au ajuns în ziua lor.
create or replace function public.prospectare_anuleaza_programari(p_ids bigint[], p_autor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_autor text := coalesce(nullif(btrim(p_autor), ''), 'admin');
  v_anulate integer := 0;
  r record;
begin
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 500 then
    raise exception 'Alege între 1 și 500 de programări.' using errcode = 'PR422';
  end if;
  perform set_config('prospectare.autor', v_autor, true);
  for r in
    update public.prospectare_programari
      set stare = 'anulata', inchis_la = now(), motiv = 'anulată de ' || v_autor
      where id = any(p_ids) and stare = 'programata' and zi > public.prospectare_azi()
      returning firma_id, canal, zi
  loop
    perform public.prospectare_noteaza(r.firma_id, 'programare', r.canal, jsonb_build_object('canal', r.canal, 'zi', r.zi, 'anulata', true));
    v_anulate := v_anulate + 1;
  end loop;
  return jsonb_build_object('anulate', v_anulate, 'refuzate', cardinality(p_ids) - v_anulate);
end;
$$;

-- 8. Email: coada zilei și cererea canalului -------------------------------------------------

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
      select jsonb_agg(jsonb_build_object('programare_id', p.id, 'firma_id', x.id, 'nr', x.nr, 'nume', x.nume, 'domeniu', x.domeniu,
          'email', x.email, 'persoana_contact', x.persoana_contact, 'link_demo', x.link_demo, 'oras', x.oras, 'nisa', x.nisa,
          'casuta', p.casuta, 'sursa', p.sursa) order by p.casuta, (p.sursa = 'manual') desc, p.id)
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
  v_canale := concat_ws(', ', case when f.whatsapp_la is not null then 'WhatsApp' end, case when f.telefon_la is not null then 'telefon' end);
  if v_canale <> '' and f.canal_permis is distinct from 'email' then
    raise exception 'Firma #% are deja canalul %: emailul nu se trimite.', f.nr, v_canale using errcode = 'PR409';
  end if;
  if f.email is null then
    raise exception 'Firma #% nu are adresă de email.', f.nr using errcode = 'PR422';
  end if;
  if f.link_demo is null or (f.etapa <> 'site_gata' and f.canal_permis is distinct from 'email') then
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

-- 9. WhatsApp: lista zilei, trimiterea, anularea ---------------------------------------------

create or replace function public.prospectare_whatsapp_eligibila(f public.prospectare_firme)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.prospectare_poate_canal(f, 'whatsapp')
$$;

-- Firmele programate azi pe WhatsApp, încă netrimise (compatibilitate cu lista veche).
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
  order by p.cont_whatsapp, (p.sursa = 'manual') desc, p.id
  limit least(greatest(coalesce(p_limit, 200), 1), 1000)
  offset greatest(coalesce(p_offset, 0), 0)
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
  v_canale := concat_ws(', ', case when f.email_la is not null then 'email' end, case when f.telefon_la is not null then 'telefon' end);
  if v_canale <> '' and f.canal_permis is distinct from 'whatsapp' then
    raise exception 'Firma #% a fost contactată deja pe %: WhatsApp-ul se permite doar din fișa firmei.', f.nr, v_canale using errcode = 'PR409';
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

-- „Anulează” după „Trimite pe WhatsApp”: în primele 2 minute, de oricine din admin.
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
        canal_permis = case when email_la is not null or telefon_la is not null then 'whatsapp' else canal_permis end,
        canal_permis_motiv = case when email_la is not null or telefon_la is not null then 'restabilită după anularea WhatsApp-ului' else canal_permis_motiv end,
        canal_permis_la = case when email_la is not null or telefon_la is not null then now() else canal_permis_la end,
        canal_permis_de = case when email_la is not null or telefon_la is not null then coalesce(nullif(btrim(p_autor), ''), 'admin') else canal_permis_de end
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

-- 10. Apeluri: importul, rezultatele, „Sună înapoi” -------------------------------------------

-- Regula listelor: firma intră în listă doar dacă e pe telefon; rezultatele se scriu și după
-- ce firma s-a întors în distribuție („Nu răspunde”, „Număr greșit”).
create or replace function public.prospectare_liste_reguli()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
begin
  select etapa, telefon_la, nr into f from public.prospectare_firme where id = new.firma_id;
  if f.etapa = 'nu_contacta' then
    raise exception 'Firma #% e „Nu contacta”: nu intră în liste.', f.nr using errcode = 'PR410';
  end if;
  if new.canal <> 'telefon' then
    raise exception 'Lista zilei e doar de telefon; WhatsApp-ul și emailul se programează.' using errcode = 'PR422';
  end if;
  if (tg_op = 'INSERT' or new.firma_id <> old.firma_id) and f.telefon_la is null then
    raise exception 'Firma #% nu e pe telefon: intră în listă doar prin import.', f.nr using errcode = 'PR409';
  end if;
  new.actualizat_la := now();
  return new;
end;
$$;

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
  v_lot text := nullif(btrim(p_filtre ->> 'lot'), '');
  v_constr text := nullif(btrim(p_filtre ->> 'construit_de'), '');
  v_de date := nullif(p_filtre ->> 'gata_de', '')::date;
  v_pana date := nullif(p_filtre ->> 'gata_pana', '')::date;
  r record;
begin
  if p_utilizator not in ('stefan', 'vladut') then
    raise exception 'Utilizator necunoscut: %.', p_utilizator using errcode = 'PR422';
  end if;
  if p_canal is distinct from 'telefon' then
    raise exception 'Doar lista de apeluri se importă. WhatsApp-ul și emailul se programează.' using errcode = 'PR422';
  end if;
  if p_numar is null or p_numar < 1 or p_numar > 500 then
    raise exception 'Câte firme: între 1 și 500.' using errcode = 'PR422';
  end if;
  perform public.prospectare_asigura_ciclu();

  perform set_config('prospectare.autor', coalesce(nullif(btrim(p_autor), ''), v_nume), true);
  perform set_config('prospectare.motiv', format('Adăugată în lista de apeluri a lui %s (până la 00:00)', v_nume), true);

  -- Din rezervă: firmele care pot merge pe telefon, neprogramate, cele mai vechi site-uri primele.
  for r in
    select f.id
    from public.prospectare_firme f
    where public.prospectare_poate_canal(f, 'telefon')
      and not exists (select 1 from public.prospectare_programari p where p.firma_id = f.id and p.stare = 'programata')
      and not exists (select 1 from public.prospectare_liste_zi l where l.firma_id = f.id and l.data = v_azi)
      and (not v_mobil or f.este_mobil)
      and (v_nisa is null or f.nisa = v_nisa)
      and (v_oras is null or f.oras = v_oras)
      and (v_judet is null or f.judet = v_judet)
      and (v_scor is null or f.scor >= v_scor)
      and (v_lot is null or f.lot = v_lot)
      and (v_constr is null or f.construit_de = v_constr)
      and (v_de is null or (f.site_gata_la at time zone 'Europe/Bucharest')::date >= v_de)
      and (v_pana is null or (f.site_gata_la at time zone 'Europe/Bucharest')::date <= v_pana)
    order by (f.canal_permis = 'telefon') desc nulls last, f.site_gata_la nulls last, f.nr
    limit p_numar
    for update of f skip locked
  loop
    update public.prospectare_firme set telefon_la = now()
      where id = r.id and telefon_la is null and etapa <> 'nu_contacta';
    if found then
      insert into public.prospectare_liste_zi (data, utilizator, canal, firma_id)
      values (v_azi, p_utilizator, 'telefon', r.id);
      v_luate := v_luate + 1;
    end if;
  end loop;

  return jsonb_build_object('adaugate', v_luate, 'cerute', p_numar);
end;
$$;

-- Grupele rezervei de apeluri (pentru numărătoarea filtrelor din „Apeluri azi”): și lotul, calculatorul, ziua site-ului gata.
drop function if exists public.prospectare_rezerva_grupe();
create or replace function public.prospectare_rezerva_grupe()
returns table (nisa text, oras text, judet text, scor smallint, este_mobil boolean, lot text, construit_de text, zi_gata date, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select f.nisa, f.oras, f.judet, f.scor, f.este_mobil, f.lot, f.construit_de, (f.site_gata_la at time zone 'Europe/Bucharest')::date, count(*)
  from public.prospectare_firme f
  where public.prospectare_poate_canal(f, 'telefon')
    and not exists (select 1 from public.prospectare_programari p where p.firma_id = f.id and p.stare = 'programata')
    and not exists (select 1 from public.prospectare_liste_zi l where l.firma_id = f.id and l.data = public.prospectare_azi())
  group by 1, 2, 3, 4, 5, 6, 7, 8
$$;

-- Ce a rămas de ieri pe telefon: doar „Sună înapoi” (nesunatele se eliberează la 00:00).
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
  perform public.prospectare_asigura_ciclu();
  update public.prospectare_liste_zi l set data = v_azi, actualizat_la = now()
    where l.data < v_azi and l.rezultat = 'suna_inapoi'
      and not exists (select 1 from public.prospectare_liste_zi t where t.firma_id = l.firma_id and t.data = v_azi);
  get diagnostics v_mutate = row_count;
  return v_mutate;
end;
$$;

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
  v_incercari integer;
  v_nume text;
  v_etapa text;
  v_motiv text;
begin
  select * into l from public.prospectare_liste_zi where id = p_lista for update;
  if not found then
    raise exception 'Rândul din listă nu mai există (poate a fost scos între timp).' using errcode = 'PR404';
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
  if f.etapa = 'nu_contacta' then
    raise exception 'Firma #% e „Nu contacta”: nu mai primește nimic.', f.nr using errcode = 'PR410';
  end if;

  -- Firma plecase din listă („Nu răspunde” / „Număr greșit”) și acum e sunată din nou:
  -- se întoarce pe telefon, dacă între timp n-a luat-o alt canal.
  if f.telefon_la is null then
    if p_rezultat = 'nu_raspunde' and l.rezultat = 'nu_raspunde' then
      v_incercari := l.incercari + 1;
      update public.prospectare_liste_zi set incercari = v_incercari, nota = coalesce(p_nota, nota) where id = l.id;
      update public.prospectare_firme set apel_incercari = least(apel_incercari + 1, 1000) where id = f.id;
      perform public.prospectare_noteaza(f.id, 'apel', 'telefon', jsonb_build_object('rezultat', p_rezultat, 'incercari', v_incercari, 'revenit_in_distributie', true));
      return jsonb_build_object('revenit', true, 'incercari', v_incercari);
    end if;
    v_motiv := public.prospectare_motiv_canal(f, 'telefon');
    if v_motiv is not null or exists (select 1 from public.prospectare_programari p where p.firma_id = f.id and p.stare = 'programata') then
      raise exception 'Firma #% nu mai e pe telefon: %.', f.nr,
        coalesce(v_motiv, 'a fost programată între timp pe alt canal') using errcode = 'PR409';
    end if;
    perform set_config('prospectare.motiv', 'Sunată din nou din lista zilei', true);
    update public.prospectare_firme set telefon_la = now() where id = f.id returning * into f;
  end if;

  v_incercari := case when p_rezultat = 'nu_raspunde' then l.incercari + 1 else l.incercari end;
  -- Rândul se scrie cât firma e încă pe telefon (regula listelor).
  update public.prospectare_liste_zi
    set rezultat = p_rezultat,
        incercari = v_incercari,
        nota = coalesce(p_nota, nota),
        suna_inapoi_la = case when p_rezultat = 'suna_inapoi' then p_suna_inapoi_la end
    where id = l.id;

  if p_rezultat in ('nu_raspunde', 'numar_gresit') then
    -- Nu e un contact: firma se întoarce în distribuție (la „Număr greșit”, doar pentru email).
    perform set_config('prospectare.reseteaza_canal', 'telefon', true);
    perform set_config('prospectare.motiv', case when p_rezultat = 'nu_raspunde'
      then 'Nu a răspuns: înapoi în distribuție' else 'Număr greșit: înapoi în distribuție, doar pentru email' end, true);
    update public.prospectare_firme
      set telefon_la = null,
          etapa = case when etapa = 'sunat' then 'site_gata' else etapa end,
          apel_incercari = case when p_rezultat = 'nu_raspunde' then least(apel_incercari + 1, 1000) else apel_incercari end,
          telefon_gresit = telefon_gresit or p_rezultat = 'numar_gresit',
          nota = case when p_rezultat = 'numar_gresit' then coalesce(nullif(btrim(nota), '') || E'\n', '') || 'Număr greșit la apel.' else nota end
      where id = f.id;
    perform set_config('prospectare.reseteaza_canal', '', true);
    perform set_config('prospectare.motiv', '', true);
    perform public.prospectare_noteaza(f.id, 'apel', 'telefon',
      jsonb_strip_nulls(jsonb_build_object('rezultat', p_rezultat, 'incercari', v_incercari, 'revenit_in_distributie', true,
        'doar_email', case when p_rezultat = 'numar_gresit' then true end, 'nota', nullif(btrim(p_nota), ''))));
    return jsonb_build_object('revenit', true, 'incercari', v_incercari, 'doar_email', p_rezultat = 'numar_gresit');
  end if;

  v_etapa := case p_rezultat
    when 'interesat' then case when f.etapa = 'client' then f.etapa else 'interesat' end
    when 'nu_vrea' then 'nu_contacta'
    else case when f.etapa = 'site_gata' then 'sunat' else f.etapa end
  end;
  if v_etapa is distinct from f.etapa then
    perform set_config('prospectare.motiv', case p_rezultat when 'nu_vrea' then 'Nu vrea (la apel)' else null end, true);
    update public.prospectare_firme set etapa = v_etapa where id = f.id;
    perform set_config('prospectare.motiv', '', true);
  end if;

  perform public.prospectare_noteaza(f.id, 'apel', 'telefon',
    jsonb_strip_nulls(jsonb_build_object('rezultat', p_rezultat, 'incercari', v_incercari,
      'suna_inapoi_la', p_suna_inapoi_la, 'nota', nullif(btrim(p_nota), ''))));
  return jsonb_build_object('revenit', false, 'incercari', v_incercari);
end;
$$;

-- 11. Importul și robotul: data site-ului gata, cine l-a construit, linkul verificat ----------

-- Upsert-ul din migrarea 34, cu data site-ului gata, cine l-a construit și linkul verificat.
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

drop function if exists public.prospectare_termina(uuid, uuid, text, text, jsonb);
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
  return jsonb_build_object('nr', f.nr, 'etapa', f.etapa, 'link_demo', f.link_demo, 'demo_verificat', f.demo_verificat);
end;
$$;

-- 12. Rezumatul și opțiunile ---------------------------------------------------------------

-- Rezumatul din migrarea 34: rezerva de apeluri și lista de WhatsApp după regulile distribuției.
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

create or replace function public.prospectare_rezumat_distributie()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_azi date;
  v_maine date;
  v_ciclu jsonb;
  v_plafon integer;
begin
  v_ciclu := public.prospectare_asigura_ciclu();
  v_azi := public.prospectare_azi();
  v_maine := v_azi + 1;
  select email_plafon_casuta into v_plafon from public.prospectare_setari where id = 1;
  return jsonb_build_object(
    'azi', v_azi,
    'maine', v_maine,
    'ciclu', v_ciclu,
    'programate_azi', (select jsonb_build_object(
        'email', count(*) filter (where canal = 'email'),
        'whatsapp', count(*) filter (where canal = 'whatsapp'),
        'telefon', count(*) filter (where canal = 'telefon'),
        'email_ramase', count(*) filter (where canal = 'email' and stare = 'programata'),
        'whatsapp_ramase', count(*) filter (where canal = 'whatsapp' and stare = 'programata'))
      from public.prospectare_programari where zi = v_azi and stare in ('programata', 'folosita')),
    'apeluri_azi', (select jsonb_build_object('total', count(*), 'sunate', count(*) filter (where rezultat is not null))
      from public.prospectare_liste_zi where data = v_azi and canal = 'telefon'),
    'programate_maine', (select jsonb_build_object(
        'email', count(*) filter (where canal = 'email'),
        'whatsapp', count(*) filter (where canal = 'whatsapp'),
        'telefon', count(*) filter (where canal = 'telefon'))
      from public.prospectare_programari where zi = v_maine and stare = 'programata'),
    'capacitate', jsonb_build_object(
      'email', (select coalesce(sum(public.prospectare_limita_casuta(c)), 0) from public.prospectare_casute c where c.activa),
      'whatsapp', (select coalesce(sum(limita_zi), 0) from public.prospectare_conturi_whatsapp where activ),
      'telefon', (select apeluri_pe_zi from public.prospectare_setari where id = 1),
      'plafon_casuta', v_plafon),
    'rezerva', (select jsonb_build_object(
        'total', count(*) filter (where pe_email or pe_whatsapp or pe_telefon),
        'email', count(*) filter (where pe_email),
        'whatsapp', count(*) filter (where pe_whatsapp),
        'telefon', count(*) filter (where pe_telefon))
      from (
        select public.prospectare_poate_canal(x, 'email') as pe_email, public.prospectare_poate_canal(x, 'whatsapp') as pe_whatsapp,
          public.prospectare_poate_canal(x, 'telefon') and not exists (select 1 from public.prospectare_liste_zi l where l.firma_id = x.id and l.data = v_azi) as pe_telefon
        from public.prospectare_firme x
        where not exists (select 1 from public.prospectare_programari p where p.firma_id = x.id and p.stare = 'programata')
      ) s),
    'intoarse_la_00', coalesce(v_ciclu -> 'eliberate', '{}'::jsonb)
  );
end;
$$;

-- Filtrele programării: loturile, calculatoarele, nișele, orașele firmelor din rezervă.
create or replace function public.prospectare_optiuni_distributie()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with r as (
    select x.lot, x.construit_de, x.nisa, x.oras, x.site_gata_la from public.prospectare_firme x
    where (public.prospectare_poate_canal(x, 'email') or public.prospectare_poate_canal(x, 'whatsapp') or public.prospectare_poate_canal(x, 'telefon'))
      and not exists (select 1 from public.prospectare_programari p where p.firma_id = x.id and p.stare = 'programata')
  )
  select jsonb_build_object(
    'loturi', coalesce((select jsonb_agg(jsonb_build_object('v', lot, 'n', n, 'ultima', ultima) order by ultima desc nulls last, lot)
      from (select lot, count(*) as n, max(site_gata_la) as ultima from r where lot is not null group by lot) s), '[]'::jsonb),
    'constructori', coalesce((select jsonb_agg(jsonb_build_object('v', construit_de, 'n', n) order by n desc, construit_de)
      from (select construit_de, count(*) as n from r where construit_de is not null group by construit_de) s), '[]'::jsonb),
    'nise', coalesce((select jsonb_agg(jsonb_build_object('v', nisa, 'n', n) order by n desc, nisa)
      from (select nisa, count(*) as n from r where nisa is not null group by nisa) s), '[]'::jsonb),
    'orase', coalesce((select jsonb_agg(jsonb_build_object('v', oras, 'n', n) order by n desc, oras)
      from (select oras, count(*) as n from r where oras is not null group by oras) s), '[]'::jsonb),
    'gata_de', (select min(site_gata_la) from r),
    'gata_pana', (select max(site_gata_la) from r)
  )
$$;

-- 13. Supabase Cron: în fiecare zi după 00:00 (ora României) ------------------------------
-- pg_cron merge în UTC: 00:00 la București e 22:00 UTC iarna și 21:00 UTC vara. Jobul se
-- uită la fiecare 5 minute între 21:00 și 22:55 UTC; ciclul rulează o singură dată pe zi.

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      execute 'create extension if not exists pg_cron with schema pg_catalog';
      execute $c$select cron.unschedule(jobid) from cron.job where jobname = 'prospectare-ciclu-zi'$c$;
      execute $c$select cron.schedule('prospectare-ciclu-zi', '*/5 21,22 * * *', 'select public.prospectare_asigura_ciclu()')$c$;
    exception when others then
      raise notice 'pg_cron nu s-a putut programa (%): ciclul rulează la prima cerere de după 00:00.', sqlerrm;
    end;
  else
    raise notice 'pg_cron nu e disponibil aici: ciclul rulează la prima cerere de după 00:00.';
  end if;
end;
$$;

-- Starea jobului (pentru verificarea de la final și pentru admin).
create or replace function public.prospectare_cron_stare()
returns text
language plpgsql
stable
security definer
set search_path = public
as $f$
declare
  v text;
begin
  if to_regclass($q$cron.job$q$) is null then
    return $q$pg_cron nu e activ: ciclul rulează la prima cerere de după 00:00$q$;
  end if;
  execute $q$select schedule from cron.job where jobname = $$prospectare-ciclu-zi$$$q$ into v;
  return coalesce($q$programat în pg_cron, $q$ || v || $q$ UTC$q$, $q$pg_cron e activ, dar jobul lipsește: rulează fișierul din nou$q$);
end;
$f$;

-- 14. Drepturi -------------------------------------------------------------------------------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.prospectare_email_valid(public.prospectare_firme)',
    'public.prospectare_poate_canal(public.prospectare_firme, text)',
    'public.prospectare_motiv_canal(public.prospectare_firme, text)',
    'public.prospectare_limita_casuta(public.prospectare_casute)',
    'public.prospectare_ocupate(text, date, text)',
    'public.prospectare_casuta_potrivita(text, public.prospectare_casute)',
    'public.prospectare_loc_liber(text, date, text, smallint, text)',
    'public.prospectare_ciclu_zi(date, boolean)',
    'public.prospectare_asigura_ciclu()',
    'public.prospectare_programabile(text, jsonb, integer, integer)',
    'public.prospectare_programeaza(text, date, uuid[], smallint, text, text)',
    'public.prospectare_anuleaza_programari(bigint[], text)',
    'public.prospectare_coada_email(uuid, text)',
    'public.prospectare_email_cere_canal(uuid, text, integer, text, integer)',
    'public.prospectare_whatsapp_eligibila(public.prospectare_firme)',
    'public.prospectare_whatsapp_coada(integer, integer)',
    'public.prospectare_whatsapp_trimis(uuid, smallint, text)',
    'public.prospectare_whatsapp_anuleaza(uuid, text)',
    'public.prospectare_importa_lista_zi(text, text, integer, jsonb, smallint, text)',
    'public.prospectare_rezerva_grupe()',
    'public.prospectare_reporteaza_liste()',
    'public.prospectare_seteaza_rezultat(bigint, text, text, timestamptz, text)',
    'public.prospectare_upsert_firme(jsonb, text, text, boolean)',
    'public.prospectare_termina(uuid, uuid, text, text, jsonb, boolean)',
    'public.prospectare_rezumat()',
    'public.prospectare_rezumat_distributie()',
    'public.prospectare_optiuni_distributie()',
    'public.prospectare_cron_stare()'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke all on function %s from anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;

-- Verificarea (toate rândurile trebuie să fie `true`).
select 'distribuție: coloanele noi pe firme' as verificare,
  (select count(*) = 5 from information_schema.columns where table_schema = 'public' and table_name = 'prospectare_firme'
    and column_name in ('site_gata_la', 'construit_de', 'demo_verificat', 'telefon_gresit', 'apel_incercari')) as ok
union all
select 'programările și ciclurile, cu RLS',
  (select count(*) = 2 and bool_and(relrowsecurity) from pg_class where relname in ('prospectare_programari', 'prospectare_cicluri') and relnamespace = 'public'::regnamespace)
union all
select 'o singură programare activă pe firmă (index unic)',
  exists (select 1 from pg_indexes where indexname = 'prospectare_programari_activa_uidx')
union all
select 'setările noi: plafonul căsuțelor și apelurile pe zi',
  (select count(*) = 2 from information_schema.columns where table_schema = 'public' and table_name = 'prospectare_setari'
    and column_name in ('email_plafon_casuta', 'apeluri_pe_zi'))
union all
select 'funcțiile noi doar pentru cheia de service',
  not has_function_privilege('authenticated', 'public.prospectare_programeaza(text, date, uuid[], smallint, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.prospectare_coada_email(uuid, text)', 'execute')
  and has_function_privilege('service_role', 'public.prospectare_ciclu_zi(date, boolean)', 'execute')
union all
select 'ciclul de la 00:00: ' || public.prospectare_cron_stare(), true
union all
select 'termina are o singură semnătură (cu linkul verificat)',
  (select count(*) = 1 from pg_proc where proname = 'prospectare_termina' and pronamespace = 'public'::regnamespace);
