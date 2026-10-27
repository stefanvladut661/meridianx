-- ============================================================
-- Postări, faza 2: planurile aprobate și postările din coadă.
--
-- Un plan intră aici doar la „Aprobă planul”. Fiecare postare a planului
-- devine câte un rând pe platformă în `postari`, cu ora rezolvată (fixă sau
-- slot) și tot ce trebuie ca o rulare întreruptă să reia de unde a rămas.
-- Citirea: doar adminii (`is_lead_admin()`); scrierile prin cheia de service.
-- Se poate rula de mai multe ori.
-- ============================================================

create table if not exists public.postari_planuri (
  id uuid primary key default gen_random_uuid(),
  nume text check (nume is null or char_length(nume) <= 120),
  folder_id text not null check (char_length(folder_id) <= 200),
  folder_cale text not null check (char_length(folder_cale) <= 600),
  -- Planul cum a fost aprobat: textul citit, plus orele rezolvate ale fiecărei postări.
  plan jsonb not null,
  -- Același plan (același text) nu se aprobă de două ori.
  amprenta text not null check (char_length(amprenta) = 64),
  nr_postari integer not null check (nr_postari > 0),
  aprobat_la timestamptz not null default now(),
  aprobat_de text not null check (char_length(aprobat_de) <= 200)
);
create unique index if not exists postari_planuri_amprenta_uidx on public.postari_planuri (amprenta);

create table if not exists public.postari (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.postari_planuri (id) on delete restrict,
  -- Poziția în plan (de la 0) și platforma: o postare a planului pe două platforme = două rânduri.
  element smallint not null check (element >= 0),
  platforma text not null check (platforma in ('instagram', 'tiktok')),
  drive_file_id text not null check (char_length(drive_file_id) <= 200),
  fisier text not null check (char_length(fisier) <= 300),
  folder_id text not null check (char_length(folder_id) <= 200),
  marime bigint check (marime is null or marime >= 0),
  durata_ms integer,
  descriere text not null default '' check (char_length(descriere) <= 4000),
  hashtaguri text[] not null default '{}',
  -- Descrierea cu hashtag-urile, cum pleacă (Instagram) sau cum se copiază (TikTok).
  caption text not null default '' check (char_length(caption) <= 5000),
  -- Instagram: tip (reel / trial_reel), absolvire (manual / automat), in_feed, coperta_ms.
  optiuni jsonb not null default '{}'::jsonb,
  programata_la timestamptz not null,
  sursa_ora text not null check (sursa_ora in ('fixa', 'slot')),

  -- Starea: planificată → în lucru → publicată (Instagram) / în ciorne (TikTok) → publicată;
  -- sau eșuată (cu motivul), sau scoasă din coadă înainte să ruleze.
  stare text not null default 'planificata' check (stare in ('planificata', 'in_lucru', 'publicata', 'in_ciorne', 'esuata', 'scoasa')),
  -- Pasul din „în lucru” (copiere, container, procesare, publicare, init, urcare, verificare…).
  pas text check (pas is null or char_length(pas) <= 40),
  incercari smallint not null default 0,
  urmatoarea_incercare timestamptz,
  -- Rularea care lucrează acum la postare și până când (termenul expiră = altă rulare o poate relua).
  lucrata_de uuid,
  termen_lucru timestamptz,
  eroare text check (eroare is null or char_length(eroare) <= 1000),
  eroare_cod text check (eroare_cod is null or char_length(eroare_cod) <= 120),
  eroare_la timestamptz,

  -- Instagram: copia temporară (bucket `postari-temp`, urcată prin TUS) și containerul.
  stocare_cale text check (stocare_cale is null or char_length(stocare_cale) <= 300),
  stocare_tus_url text check (stocare_tus_url is null or char_length(stocare_tus_url) <= 1000),
  stocare_octeti bigint,
  ig_container_id text check (ig_container_id is null or char_length(ig_container_id) <= 100),
  ig_container_la timestamptz,
  -- Momentul în care a pornit cererea de publicare: o rulare întreruptă după el verifică, nu republică.
  ig_publicare_la timestamptz,

  -- TikTok: trimiterea în ciorne, pe bucăți.
  tt_publish_id text check (tt_publish_id is null or char_length(tt_publish_id) <= 100),
  tt_upload_url text check (tt_upload_url is null or char_length(tt_upload_url) <= 1000),
  tt_upload_la timestamptz,
  tt_chunk_size bigint,
  tt_chunks_total integer,
  tt_chunks_trimise integer,
  tt_status text check (tt_status is null or char_length(tt_status) <= 60),

  -- Rezultatul.
  media_id text check (media_id is null or char_length(media_id) <= 100),
  link text check (link is null or char_length(link) <= 500),
  avertisment text check (avertisment is null or char_length(avertisment) <= 500),
  trimisa_la timestamptz,
  publicata_la timestamptz,
  publicata_de text check (publicata_de is null or char_length(publicata_de) <= 200),
  scoasa_la timestamptz,
  scoasa_de text check (scoasa_de is null or char_length(scoasa_de) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists postari_element_uidx on public.postari (plan_id, element, platforma);
create index if not exists postari_coada_idx on public.postari (stare, programata_la);
create index if not exists postari_platforma_idx on public.postari (platforma, programata_la);
create index if not exists postari_clip_idx on public.postari (drive_file_id, platforma);

alter table public.postari_planuri enable row level security;
alter table public.postari enable row level security;

drop policy if exists postari_planuri_admin_read on public.postari_planuri;
create policy postari_planuri_admin_read on public.postari_planuri for select to authenticated using (public.is_lead_admin());
drop policy if exists postari_admin_read on public.postari;
create policy postari_admin_read on public.postari for select to authenticated using (public.is_lead_admin());

select 'RLS activ pe postari_planuri și postari' as verificare,
  (select bool_and(relrowsecurity) from pg_class where relname in ('postari_planuri', 'postari') and relnamespace = 'public'::regnamespace) as ok;
