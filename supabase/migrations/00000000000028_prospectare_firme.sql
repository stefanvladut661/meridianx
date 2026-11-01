-- ============================================================
-- Prospectare, migrarea 1 din 3: firmele, activitatea și setările.
--
-- Regula de bază: o firmă primește UN SINGUR canal (email, whatsapp sau
-- telefon). Canalul se setează o singură dată, din gol, iar baza refuză orice
-- altă schimbare, indiferent cine scrie (admin, robot, import, SQL Editor).
-- Singura excepție: `prospectare_seteaza_rezultat` (migrarea 29) golește
-- canalul telefon după ultima încercare fără răspuns, și scrie asta în
-- activitate.
--
-- Activitatea se poate doar adăuga: un trigger refuză modificarea, ștergerea
-- și golirea ei, chiar și cu cheia de service.
--
-- Citirea: doar adminii (`is_lead_admin()`, din migrarea 5). Scrierile: doar
-- pe server, cu cheia de service, prin funcțiile modulului. Roboții nu au
-- acces direct la bază: trec prin /api/prospectare/robot.
-- Se poate rula de mai multe ori.
-- ============================================================

-- Ajutoare ----------------------------------------------------------------------

-- Domeniul normalizat: litere mici, fără schemă, „www.”, port, cale sau punct final.
create or replace function public.prospectare_domeniu(p text)
returns text
language sql
immutable
parallel safe
as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(btrim(coalesce(p, ''))), '^[a-z][a-z0-9+.-]*://', ''),
        '[/?#:].*$', ''),
      '^www\.|\.$', '', 'g'),
    '')
$$;

-- Număr de mobil românesc (07xx xxx xxx, cu sau fără +40 / 0040 în față).
create or replace function public.prospectare_e_mobil(p text)
returns boolean
language sql
immutable
parallel safe
as $$
  select regexp_replace(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '^(00)?40', '0') ~ '^07[0-9]{8}$'
$$;

-- Ziua de azi la București: listele zilei și statisticile căsuțelor se numără pe ea.
create or replace function public.prospectare_azi()
returns date
language sql
stable
as $$
  select (now() at time zone 'Europe/Bucharest')::date
$$;

-- Cine face schimbarea, pentru activitate: funcțiile modulului îl pun în
-- tranzacție (`set_config('prospectare.autor', …, true)`); altfel „sistem”.
create or replace function public.prospectare_autor()
returns text
language sql
stable
as $$
  select coalesce(nullif(btrim(current_setting('prospectare.autor', true)), ''), 'sistem')
$$;

-- Firmele ------------------------------------------------------------------------

create sequence if not exists public.prospectare_firme_nr_seq;

create table if not exists public.prospectare_firme (
  id uuid primary key default gen_random_uuid(),
  -- Numărul din starea roboților (#123); firmele noi îl primesc din secvență.
  nr integer not null default nextval('public.prospectare_firme_nr_seq') check (nr > 0),
  nume text not null check (char_length(nume) between 1 and 300),
  domeniu text not null check (char_length(domeniu) <= 253 and domeniu = public.prospectare_domeniu(domeniu)),
  site_vechi text check (site_vechi is null or char_length(site_vechi) <= 500),
  nisa text check (nisa is null or char_length(nisa) <= 200),
  oras text check (oras is null or char_length(oras) <= 120),
  judet text check (judet is null or char_length(judet) <= 60),
  scor smallint check (scor is null or scor between 0 and 1000),
  telefon text check (telefon is null or char_length(telefon) <= 40),
  -- Din telefon, nu din ce declară cineva: WhatsApp-ul cere mobil.
  este_mobil boolean generated always as (public.prospectare_e_mobil(telefon)) stored,
  email text check (email is null or (char_length(email) <= 320 and email like '%_@_%')),
  persoana_contact text check (persoana_contact is null or char_length(persoana_contact) <= 200),
  etapa text not null default 'cercetat' check (etapa in (
    'cercetat', 'site_in_lucru', 'site_gata', 'email_trimis', 'whatsapp_trimis',
    'sunat', 'interesat', 'client', 'nu_contacta', 'respins'
  )),
  canal text check (canal is null or canal in ('email', 'whatsapp', 'telefon')),
  canal_setat_la timestamptz,
  canal_setat_de text check (canal_setat_de is null or char_length(canal_setat_de) <= 200),
  link_demo text check (link_demo is null or char_length(link_demo) <= 500),
  -- Captura stă pe Drive; aici doar linkul (planul gratuit Supabase: fără fișiere mari în Storage).
  captura_url text check (captura_url is null or char_length(captura_url) <= 1000),
  lot text check (lot is null or char_length(lot) <= 200),
  slug text check (slug is null or char_length(slug) <= 200),
  -- Site-ul trebuie refăcut (ex. „conversie pe v3”): robotul îl ia înaintea celor noi.
  de_refacut boolean not null default false,
  nota text check (nota is null or char_length(nota) <= 2000),
  -- Tot ce știe robotul și nu are coloană: statusul lui, motive, date de firmă, sursa importului.
  date_extra jsonb not null default '{}'::jsonb check (jsonb_typeof(date_extra) = 'object'),
  creat_la timestamptz not null default now(),
  actualizat_la timestamptz not null default now(),
  constraint prospectare_firme_canal_setat check ((canal is null) = (canal_setat_la is null))
);

create unique index if not exists prospectare_firme_nr_uidx on public.prospectare_firme (nr);
create unique index if not exists prospectare_firme_domeniu_uidx on public.prospectare_firme (domeniu);
create index if not exists prospectare_firme_etapa_idx on public.prospectare_firme (etapa, scor desc nulls last);
-- Rezerva pentru liste: site gata, fără canal.
create index if not exists prospectare_firme_rezerva_idx on public.prospectare_firme (scor desc nulls last, nr) where etapa = 'site_gata' and canal is null;
create index if not exists prospectare_firme_lot_idx on public.prospectare_firme (lot);
create index if not exists prospectare_firme_actualizat_idx on public.prospectare_firme (actualizat_la desc);

-- Activitatea --------------------------------------------------------------------

create table if not exists public.prospectare_activitate (
  id bigint generated always as identity primary key,
  firma_id uuid not null references public.prospectare_firme (id) on delete restrict,
  tip text not null check (tip in (
    'creata', 'etapa', 'canal', 'apel', 'whatsapp', 'email', 'bounce', 'raspuns',
    'site', 'rezervare', 'nota', 'lista', 'import', 'cercetare', 'sistem'
  )),
  canal text check (canal is null or canal in ('email', 'whatsapp', 'telefon')),
  autor text not null check (char_length(autor) between 1 and 200),
  detalii jsonb not null default '{}'::jsonb check (jsonb_typeof(detalii) = 'object'),
  -- Cheia unei întâmplări care poate veni de două ori (importul rulat din nou,
  -- robotul care repetă cererea): a doua oară nu se mai scrie.
  cheie text check (cheie is null or char_length(cheie) <= 300),
  la timestamptz not null default now()
);
create unique index if not exists prospectare_activitate_cheie_uidx on public.prospectare_activitate (cheie);
create index if not exists prospectare_activitate_firma_idx on public.prospectare_activitate (firma_id, la desc);
create index if not exists prospectare_activitate_la_idx on public.prospectare_activitate (la desc);
create index if not exists prospectare_activitate_tip_idx on public.prospectare_activitate (tip, la desc);

create or replace function public.prospectare_activitate_doar_adaugare()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Activitatea prospectării se poate doar completa: nu se modifică, nu se șterge.'
    using errcode = 'PR403';
end;
$$;

drop trigger if exists prospectare_activitate_fara_schimbari on public.prospectare_activitate;
create trigger prospectare_activitate_fara_schimbari
  before update or delete on public.prospectare_activitate
  for each row execute function public.prospectare_activitate_doar_adaugare();

drop trigger if exists prospectare_activitate_fara_golire on public.prospectare_activitate;
create trigger prospectare_activitate_fara_golire
  before truncate on public.prospectare_activitate
  for each statement execute function public.prospectare_activitate_doar_adaugare();

-- Scrie o întâmplare. Autorul vine din tranzacție (`prospectare.autor`).
create or replace function public.prospectare_noteaza(
  p_firma uuid,
  p_tip text,
  p_canal text default null,
  p_detalii jsonb default '{}'::jsonb,
  p_cheie text default null,
  p_la timestamptz default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.prospectare_activitate (firma_id, tip, canal, autor, detalii, cheie, la)
  values (p_firma, p_tip, p_canal, public.prospectare_autor(), coalesce(p_detalii, '{}'::jsonb), p_cheie, coalesce(p_la, now()))
  on conflict (cheie) do nothing;
$$;

-- Regulile firmei ----------------------------------------------------------------

create or replace function public.prospectare_firme_reguli()
returns trigger
language plpgsql
as $$
begin
  new.domeniu := public.prospectare_domeniu(new.domeniu);

  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.nr <> old.nr then
      raise exception 'Numărul și id-ul unei firme nu se schimbă (#%).', old.nr using errcode = 'PR400';
    end if;
    new.creat_la := old.creat_la;

    -- Canalul: o singură dată, din gol.
    if old.canal is not null and new.canal is distinct from old.canal then
      -- `coalesce`: fără setare, `current_setting` dă NULL, iar `not (… and NULL)` ar lăsa schimbarea să treacă.
      if not (new.canal is null and old.canal = 'telefon' and coalesce(current_setting('prospectare.reseteaza_canal', true), '') = 'da') then
        raise exception 'Firma #% are deja canalul %: canalul se setează o singură dată.', old.nr, old.canal
          using errcode = 'PR409';
      end if;
    end if;

    -- Canal neschimbat: data și autorul setării rămân cele de atunci.
    if old.canal is not null and new.canal is not distinct from old.canal then
      new.canal_setat_la := old.canal_setat_la;
      new.canal_setat_de := old.canal_setat_de;
    end if;
  end if;

  -- Canal nou (din gol).
  if new.canal is not null and (tg_op = 'INSERT' or old.canal is null) then
    if new.etapa = 'nu_contacta' then
      raise exception 'Firma #% e „Nu contacta”: nu primește canal.', new.nr using errcode = 'PR410';
    end if;
    new.canal_setat_la := coalesce(new.canal_setat_la, now());
    new.canal_setat_de := coalesce(new.canal_setat_de, public.prospectare_autor());
  end if;

  if new.canal is null then
    new.canal_setat_la := null;
    new.canal_setat_de := null;
  end if;

  new.actualizat_la := now();
  return new;
end;
$$;

drop trigger if exists prospectare_firme_reguli on public.prospectare_firme;
create trigger prospectare_firme_reguli
  before insert or update on public.prospectare_firme
  for each row execute function public.prospectare_firme_reguli();

-- Fiecare firmă nouă și fiecare schimbare de etapă sau de canal intră în activitate.
create or replace function public.prospectare_firme_jurnal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.prospectare_noteaza(new.id, 'creata', new.canal,
      jsonb_build_object('etapa', new.etapa, 'canal', new.canal, 'domeniu', new.domeniu));
    return null;
  end if;

  if new.etapa is distinct from old.etapa then
    perform public.prospectare_noteaza(new.id, 'etapa', new.canal,
      jsonb_strip_nulls(jsonb_build_object('din', old.etapa, 'in', new.etapa, 'motiv', nullif(current_setting('prospectare.motiv', true), ''))));
  end if;

  if new.canal is distinct from old.canal then
    perform public.prospectare_noteaza(new.id, 'canal', coalesce(new.canal, old.canal),
      jsonb_strip_nulls(jsonb_build_object('din', old.canal, 'in', new.canal, 'motiv', nullif(current_setting('prospectare.motiv', true), ''))));
  end if;

  return null;
end;
$$;

drop trigger if exists prospectare_firme_jurnal on public.prospectare_firme;
create trigger prospectare_firme_jurnal
  after insert or update on public.prospectare_firme
  for each row execute function public.prospectare_firme_jurnal();

-- Setările -----------------------------------------------------------------------

create table if not exists public.prospectare_setari (
  id smallint primary key default 1 check (id = 1),
  -- „Nu răspunde” de atâtea ori: firma iese din listă și își pierde canalul telefon.
  incercari_max smallint not null default 3 check (incercari_max between 1 and 10),
  -- Câte mesaje WhatsApp pe zi, pe fiecare cont (cheia = numărul contului).
  whatsapp_pe_cont jsonb not null default '{"1": 30, "2": 30, "3": 30}'::jsonb check (jsonb_typeof(whatsapp_pe_cont) = 'object'),
  -- Cât ține rezervarea unei firme de construit, fără semn de viață de la robot.
  rezervare_ore smallint not null default 3 check (rezervare_ore between 1 and 24),
  -- Câte cereri pe minut poate face un robot.
  cereri_pe_minut integer not null default 120 check (cereri_pe_minut between 10 and 6000),
  sablon_whatsapp_primul text not null default 'Bună ziua, {persoana_contact}! Am făcut un site demo pentru {nume_firma} din {oras} — îl puteți deschide aici: {link_demo}. Dacă vă place, îl publicăm pe domeniul firmei în câteva zile.'
    check (char_length(sablon_whatsapp_primul) <= 2000),
  sablon_whatsapp_dupa_apel text not null default 'Bună ziua, {persoana_contact}! Mulțumesc pentru discuție. Aici aveți site-ul demo pentru {nume_firma}: {link_demo}. Se deschide și pe telefon, fără instalare.'
    check (char_length(sablon_whatsapp_dupa_apel) <= 2000),
  sablon_script_apel text not null default 'Bună ziua, {persoana_contact}? Sunt {utilizator} de la Meridian. Am făcut un site demo pentru {nume_firma} din {oras} — durează 40 de secunde să vi-l arăt. Îl deschid chiar acum: {link_demo}.'
    check (char_length(sablon_script_apel) <= 2000),
  actualizat_la timestamptz not null default now(),
  actualizat_de text check (actualizat_de is null or char_length(actualizat_de) <= 200)
);
insert into public.prospectare_setari (id) values (1) on conflict (id) do nothing;

-- RLS: citire doar pentru admini; scrierile doar prin cheia de service. ------------

alter table public.prospectare_firme enable row level security;
alter table public.prospectare_activitate enable row level security;
alter table public.prospectare_setari enable row level security;

drop policy if exists prospectare_firme_admin_read on public.prospectare_firme;
create policy prospectare_firme_admin_read on public.prospectare_firme for select to authenticated using (public.is_lead_admin());
drop policy if exists prospectare_activitate_admin_read on public.prospectare_activitate;
create policy prospectare_activitate_admin_read on public.prospectare_activitate for select to authenticated using (public.is_lead_admin());
drop policy if exists prospectare_setari_admin_read on public.prospectare_setari;
create policy prospectare_setari_admin_read on public.prospectare_setari for select to authenticated using (public.is_lead_admin());

-- Funcțiile de scriere nu se pot chema prin REST decât cu cheia de service.
revoke all on function public.prospectare_noteaza(uuid, text, text, jsonb, text, timestamptz) from public;
revoke all on function public.prospectare_noteaza(uuid, text, text, jsonb, text, timestamptz) from anon, authenticated;
grant execute on function public.prospectare_noteaza(uuid, text, text, jsonb, text, timestamptz) to service_role;

-- Verificarea (toate rândurile trebuie să fie `true`).
select 'prospectare_setari are un rând' as verificare, (select count(*) = 1 from public.prospectare_setari) as ok
union all
select 'RLS activ pe prospectare_firme, prospectare_activitate, prospectare_setari',
  (select bool_and(relrowsecurity) from pg_class where relname in ('prospectare_firme', 'prospectare_activitate', 'prospectare_setari') and relnamespace = 'public'::regnamespace)
union all
select 'activitatea nu se poate modifica (trigger)',
  exists (select 1 from pg_trigger where tgname = 'prospectare_activitate_fara_schimbari')
union all
select 'domeniul se normalizează (https://WWW.Firma.ro/contact → firma.ro)',
  public.prospectare_domeniu('https://WWW.Firma.ro/contact') = 'firma.ro'
union all
select 'admin_emails are cel puțin două adrese (Ștefan și Vlăduț)',
  (select count(*) >= 2 from public.admin_emails);
