-- MERIDIAN — portalul de reclame v2: crearea pe pași, reluabilă (migrarea 13)
-- Se aplică DUPĂ migrarea 12, lipit în Supabase → SQL Editor → Run.
--
-- DE CE: o campanie Meta se creează din mai multe cereri (copertă, campanie,
-- set, câte un creativ și o reclamă pentru fiecare text). La accesul de bază,
-- Meta limitează cererile contului: după câteva zeci, răspunde „așteaptă”.
-- Până acum crearea se oprea acolo, „parțial”. De acum fiecare creare e o
-- lucrare pe pași, ținută aici: pasul se notează „trimis” înainte de cerere și
-- „gata”, cu id-ul obiectului, după ea. La limită, lucrarea așteaptă cât spune
-- Meta și se reia de unde a rămas; un pas „trimis” fără răspuns se caută întâi
-- după nume, ca să nu se creeze de două ori.
--
-- Un plan nu poate avea două lucrări deschise odată (indexul unic de mai jos):
-- un plan trimis de două ori nu creează nimic de două ori.
--
-- Fișier NOU, aditiv. Același acces ca restul portalului: citire doar pentru
-- admini (`is_lead_admin()`), scriere doar prin service role. Se poate rula de
-- mai multe ori.

create table if not exists public.ads_jobs (
  id                uuid primary key default gen_random_uuid(),
  platform          text not null check (platform in ('meta', 'tiktok', 'google')),
  workspace         text not null,
  ad_account        text not null,
  -- Amprenta planului verificat: aceeași ca în `ads_campaigns.fingerprint`.
  fingerprint       text not null,
  plan_name         text not null,
  status            text not null default 'running' check (status in ('running', 'waiting', 'done', 'failed')),
  -- Pașii, ce s-a creat deja și ce trebuie ca lucrarea să se poată relua fără o nouă verificare.
  state             jsonb not null default '{}'::jsonb,
  steps_total       integer not null default 0,
  steps_done        integer not null default 0,
  -- Până când așteaptă lucrarea (limita de cereri a platformei).
  wait_until        timestamptz,
  -- Cine o rulează acum: o a doua fereastră nu rulează aceeași lucrare în paralel.
  lease_until       timestamptz,
  message           text,
  -- Rândul campaniei din `ads_campaigns`, la final (sau la oprirea după campanie).
  record_id         uuid references public.ads_campaigns (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  created_by_email  text
);

create index if not exists ads_jobs_created_idx on public.ads_jobs (created_at desc);
create unique index if not exists ads_jobs_open_fingerprint_idx
  on public.ads_jobs (fingerprint)
  where status in ('running', 'waiting');

drop trigger if exists ads_jobs_updated_at on public.ads_jobs;
create trigger ads_jobs_updated_at
  before update on public.ads_jobs
  for each row execute function public.set_updated_at();

alter table public.ads_jobs enable row level security;

drop policy if exists "ads_jobs: select pentru admini" on public.ads_jobs;
create policy "ads_jobs: select pentru admini"
  on public.ads_jobs for select to authenticated using (public.is_lead_admin());
