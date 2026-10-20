-- MERIDIAN — portalul de reclame v2: Materiale (migrarea 15)
-- Se aplică DUPĂ migrările 7 (bucket-ul `ads-uploads`) și 12, lipit în
-- Supabase → SQL Editor → Run.
--
-- DE CE: până acum un video urca direct în biblioteca UNUI cont (anticamera
-- se golea după). Formularul „Creează” alege reclamele din Materiale: video-urile
-- agenției, urcate o dată și folosite pe orice canal și în orice cont. Fișierul
-- stă în același bucket privat, sub `materiale/` (curățenia anticamerei nu-l
-- atinge), iar al doilea tabel ține minte în ce conturi a fost trimis fiecare,
-- ca să nu fie copiat de două ori în același cont.
--
-- Fișier NOU, aditiv. Același acces ca restul portalului: citire doar pentru
-- admini (`is_lead_admin()`), scriere doar prin service role. Se poate rula de
-- mai multe ori.

create table if not exists public.ads_materials (
  id                uuid primary key default gen_random_uuid(),
  -- Clientul pentru care e filmat; null = al agenției, pentru oricine.
  client_id         uuid references public.ads_clients (id) on delete restrict,
  name              text not null check (char_length(name) between 1 and 120),
  -- `materiale/<id>.mp4` în bucket-ul `ads-uploads`. Fără numele fișierului omului.
  storage_path      text not null unique,
  content_type      text not null check (content_type in ('video/mp4', 'video/quicktime')),
  size_bytes        bigint,
  -- Citite în browser din fișier, înainte de urcare.
  duration_seconds  numeric(8, 2),
  width             integer,
  height            integer,
  status            text not null default 'uploading' check (status in ('uploading', 'ready')),
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  created_by_email  text
);

create index if not exists ads_materials_created_idx on public.ads_materials (created_at desc);

create table if not exists public.ads_material_uploads (
  id                 uuid primary key default gen_random_uuid(),
  material_id        uuid not null references public.ads_materials (id) on delete cascade,
  platform           text not null check (platform in ('meta', 'google', 'tiktok')),
  workspace          text not null,
  ad_account         text not null,
  -- Id-ul întors la trimitere; pe Google, id-ul urcării (video-ul gata are id-ul lui de YouTube).
  upload_id          text not null,
  -- Id-ul din biblioteca contului, cel care intră în plan. Se știe când platforma a terminat.
  platform_video_id  text,
  status             text not null default 'sent' check (status in ('sent', 'ready', 'failed')),
  message            text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (material_id, platform, ad_account)
);

drop trigger if exists ads_material_uploads_updated_at on public.ads_material_uploads;
create trigger ads_material_uploads_updated_at
  before update on public.ads_material_uploads
  for each row execute function public.set_updated_at();

alter table public.ads_materials enable row level security;
alter table public.ads_material_uploads enable row level security;

drop policy if exists "ads_materials: select pentru admini" on public.ads_materials;
create policy "ads_materials: select pentru admini"
  on public.ads_materials for select to authenticated using (public.is_lead_admin());

drop policy if exists "ads_material_uploads: select pentru admini" on public.ads_material_uploads;
create policy "ads_material_uploads: select pentru admini"
  on public.ads_material_uploads for select to authenticated using (public.is_lead_admin());

-- Verificare (trebuie să dea true):
--   select to_regclass('public.ads_materials') is not null and to_regclass('public.ads_material_uploads') is not null;
