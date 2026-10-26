-- ============================================================
-- Postări, faza 1: setările, istoricul și ce s-a citit din clipuri.
--
-- În repo nu stau nume de conturi, tokenuri sau id-uri de foldere: datele
-- reale stau doar aici. Citirea: doar adminii (`is_lead_admin()`, din
-- migrarea 5). Scrierile trec prin cheia de service, pe server, din
-- acțiunile modulului și din coadă.
-- Se poate rula de mai multe ori.
-- ============================================================

-- Setările modulului: un singur rând.
create table if not exists public.postari_setari (
  id smallint primary key default 1 check (id = 1),
  -- Folderul principal de pe Drive („meridian reclame”): id-ul din adresa lui și numele citit la salvare.
  drive_folder_id text check (drive_folder_id is null or char_length(drive_folder_id) <= 200),
  drive_folder_nume text check (drive_folder_nume is null or char_length(drive_folder_nume) <= 300),
  -- Sloturile implicite: orele zilei și fusul în care se citesc.
  sloturi_ore text[] not null default array['12:30', '19:00'] check (cardinality(sloturi_ore) between 1 and 24),
  sloturi_fus text not null default 'Europe/Bucharest' check (char_length(sloturi_fus) between 1 and 64),
  -- Plafoanele pe 24 de ore. Instagram: documentația dă și 100, și 50; pornim de la 50.
  -- TikTok: „at most 5 pending shares within any 24-hour period”.
  plafon_instagram smallint not null default 50 check (plafon_instagram between 1 and 100),
  plafon_tiktok smallint not null default 5 check (plafon_tiktok between 1 and 5),
  -- Două postări pe aceeași platformă nu pot fi mai aproape de atât.
  distanta_minima_min smallint not null default 15 check (distanta_minima_min between 0 and 720),
  -- Cât primește bucket-ul temporar pe fișier (planul gratuit Supabase: 50 MB).
  stocare_limita_mb integer not null default 50 check (stocare_limita_mb between 1 and 5000),
  -- Unde pleacă alertele (token expirat, postare eșuată). Gol = adresele din ADMIN_EMAILS.
  email_alerte text check (email_alerte is null or char_length(email_alerte) <= 500),
  -- Coada: pornită sau oprită, de cine, când și de ce.
  coada_pornita boolean not null default true,
  coada_motiv text check (coada_motiv is null or char_length(coada_motiv) <= 500),
  coada_schimbata_la timestamptz,
  coada_schimbata_de text,
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.postari_setari (id) values (1) on conflict (id) do nothing;

-- Istoricul: fiecare acțiune a modulului — cine, ce, când, rezultatul.
create table if not exists public.postari_istoric (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor text not null check (char_length(actor) <= 200),
  zona text not null check (zona in ('drive', 'plan', 'coada', 'instagram', 'tiktok', 'conturi', 'setari', 'sistem')),
  actiune text not null check (char_length(actiune) <= 120),
  tinta text check (tinta is null or char_length(tinta) <= 200),
  rezultat text not null check (rezultat in ('ok', 'eroare', 'sarit')),
  mesaj text check (mesaj is null or char_length(mesaj) <= 2000),
  detalii jsonb not null default '{}'::jsonb
);
create index if not exists postari_istoric_created_idx on public.postari_istoric (created_at desc);
create index if not exists postari_istoric_zona_idx on public.postari_istoric (zona, created_at desc);
create index if not exists postari_istoric_tinta_idx on public.postari_istoric (tinta, created_at desc) where tinta is not null;

-- Ce s-a citit din fiecare clip (din fișierul MP4, nu din nume), ca același
-- fișier să nu se descarce de două ori. Valabil cât timp mărimea e aceeași.
create table if not exists public.postari_clipuri (
  drive_file_id text primary key check (char_length(drive_file_id) <= 200),
  nume text not null check (char_length(nume) <= 300),
  folder_id text check (folder_id is null or char_length(folder_id) <= 200),
  marime bigint not null check (marime >= 0),
  mime text check (mime is null or char_length(mime) <= 100),
  latime integer,
  inaltime integer,
  rotatie smallint,
  durata_ms integer,
  fps numeric(7, 3),
  codec_video text check (codec_video is null or char_length(codec_video) <= 20),
  codec_audio text check (codec_audio is null or char_length(codec_audio) <= 20),
  audio_hz integer,
  audio_canale smallint,
  debit_kbps integer,
  moov_la_inceput boolean,
  liste_editare boolean,
  -- Fișierul nu e un MP4/MOV citibil: motivul, pentru om.
  eroare text check (eroare is null or char_length(eroare) <= 500),
  citit_la timestamptz not null default now()
);

-- RLS: citire doar pentru admini; scrierea doar prin cheia de service.
alter table public.postari_setari enable row level security;
alter table public.postari_istoric enable row level security;
alter table public.postari_clipuri enable row level security;

drop policy if exists postari_setari_admin_read on public.postari_setari;
create policy postari_setari_admin_read on public.postari_setari for select to authenticated using (public.is_lead_admin());
drop policy if exists postari_istoric_admin_read on public.postari_istoric;
create policy postari_istoric_admin_read on public.postari_istoric for select to authenticated using (public.is_lead_admin());
drop policy if exists postari_clipuri_admin_read on public.postari_clipuri;
create policy postari_clipuri_admin_read on public.postari_clipuri for select to authenticated using (public.is_lead_admin());

-- Verificarea (toate rândurile trebuie să fie `true`).
select 'postari_setari are un rând' as verificare, (select count(*) = 1 from public.postari_setari) as ok
union all
select 'RLS activ pe postari_setari, postari_istoric, postari_clipuri',
  (select bool_and(relrowsecurity) from pg_class where relname in ('postari_setari', 'postari_istoric', 'postari_clipuri') and relnamespace = 'public'::regnamespace);
