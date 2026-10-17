-- MERIDIAN — portalul de reclame, TOT ce îi trebuie în bază, dintr-o lipire.
--
-- CUM: Supabase → SQL Editor → un tab nou → lipește TOT fișierul → Run.
-- Se poate rula oricât de des: fiecare pas verifică întâi ce există deja
-- (de aceea nu contează ce migrări ai aplicat înainte).
--
-- E suma migrărilor 5, 6, 7 și 8 din supabase/migrations, scrisă să nu
-- pice a doua oară. Sursa de adevăr rămân migrările; fișierul ăsta e drumul
-- scurt pentru om.
--
-- ⚠️ La final, în ALT tab, adaugă adresele de admin (aceleași ca în
-- ADMIN_EMAILS din Vercel) — altfel panoul de lead-uri arată zero lead-uri
-- și portalul de reclame nu vede nicio campanie:
--
--   insert into public.admin_emails (email) values ('adresa-ta@exemplu.ro')
--   on conflict do nothing;
--
-- Adresele NU stau în fișierul ăsta — repo-ul e public.

-- ============================================================================
-- 5 · Cine e admin, verificat în bază
-- ============================================================================

create table if not exists public.admin_emails (
  email      text primary key check (email = lower(btrim(email)) and email like '%_@_%'),
  added_at   timestamptz not null default now()
);
alter table public.admin_emails enable row level security;

create or replace function public.is_lead_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_emails a
    where a.email = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

revoke all on function public.is_lead_admin() from public;
grant execute on function public.is_lead_admin() to authenticated;

drop policy if exists "leads: select pentru autentificați" on public.leads;
drop policy if exists "leads: update pentru autentificați" on public.leads;
drop policy if exists "lead_events: select pentru autentificați" on public.lead_events;
drop policy if exists "lead_events: insert pentru autentificați" on public.lead_events;
drop policy if exists "leads: select pentru admini" on public.leads;
drop policy if exists "leads: update pentru admini" on public.leads;
drop policy if exists "lead_events: select pentru admini" on public.lead_events;
drop policy if exists "lead_events: insert pentru admini" on public.lead_events;

create policy "leads: select pentru admini"
  on public.leads for select to authenticated
  using (public.is_lead_admin());
create policy "leads: update pentru admini"
  on public.leads for update to authenticated
  using (public.is_lead_admin()) with check (public.is_lead_admin());
create policy "lead_events: select pentru admini"
  on public.lead_events for select to authenticated
  using (public.is_lead_admin());
create policy "lead_events: insert pentru admini"
  on public.lead_events for insert to authenticated
  with check (public.is_lead_admin());

-- ============================================================================
-- 6 · Tabelele portalului
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.ads_campaigns (
  id                    uuid primary key default gen_random_uuid(),
  workspace             text not null,
  platform              text not null,
  ad_account            text not null,
  platform_campaign_id  text not null,
  name                  text not null,
  objective             text not null,
  daily_budget          numeric(12, 2) not null check (daily_budget > 0),
  currency              text not null check (currency in ('RON', 'EUR', 'USD')),
  status                text not null default 'PAUSED',
  creation              text not null default 'complete' check (creation in ('complete', 'partial')),
  creation_error        text,
  platform_objects      jsonb not null default '{}'::jsonb,
  plan_json             jsonb not null,
  fingerprint           text not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references auth.users (id) on delete set null,
  created_by_email      text,
  unique (platform, platform_campaign_id)
);

-- 8 · Google: platforma acceptă și 'google' (în locul constrângerii din migrarea 6).
alter table public.ads_campaigns drop constraint if exists ads_campaigns_platform_check;
alter table public.ads_campaigns
  add constraint ads_campaigns_platform_check check (platform in ('meta', 'tiktok', 'google'));

create index if not exists ads_campaigns_workspace_idx on public.ads_campaigns (workspace, created_at desc);
create index if not exists ads_campaigns_fingerprint_idx on public.ads_campaigns (fingerprint, created_at desc);

drop trigger if exists ads_campaigns_updated_at on public.ads_campaigns;
create trigger ads_campaigns_updated_at
  before update on public.ads_campaigns
  for each row execute function public.set_updated_at();

create table if not exists public.ads_metrics_daily (
  id               bigint generated always as identity primary key,
  campaign_id      uuid not null references public.ads_campaigns (id) on delete restrict,
  date             date not null,
  spend            numeric(12, 2) not null default 0,
  impressions      bigint not null default 0,
  clicks           bigint not null default 0,
  results          numeric(12, 2) not null default 0,
  cost_per_result  numeric(12, 4),
  raw              jsonb not null default '{}'::jsonb,
  synced_at        timestamptz not null default now(),
  unique (campaign_id, date)
);

create index if not exists ads_metrics_daily_date_idx on public.ads_metrics_daily (date desc);

create or replace function public.ads_metrics_frozen()
returns trigger
language plpgsql
as $$
begin
  if old.date < (now() at time zone 'Europe/Bucharest')::date - 7 then
    raise exception 'ads_metrics_daily: ziua % e înghețată (mai veche de 7 zile)', old.date
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists ads_metrics_daily_frozen on public.ads_metrics_daily;
create trigger ads_metrics_daily_frozen
  before update on public.ads_metrics_daily
  for each row execute function public.ads_metrics_frozen();

create table if not exists public.ads_runs (
  id                bigint generated always as identity primary key,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  status            text not null default 'running'
                      check (status in ('running', 'ok', 'partial', 'failed')),
  campaigns_synced  integer not null default 0,
  error             text
);

create index if not exists ads_runs_started_at_idx on public.ads_runs (started_at desc);

alter table public.ads_campaigns enable row level security;
alter table public.ads_metrics_daily enable row level security;
alter table public.ads_runs enable row level security;

drop policy if exists "ads_campaigns: select pentru admini" on public.ads_campaigns;
drop policy if exists "ads_metrics_daily: select pentru admini" on public.ads_metrics_daily;
drop policy if exists "ads_runs: select pentru admini" on public.ads_runs;

create policy "ads_campaigns: select pentru admini"
  on public.ads_campaigns for select to authenticated
  using (public.is_lead_admin());
create policy "ads_metrics_daily: select pentru admini"
  on public.ads_metrics_daily for select to authenticated
  using (public.is_lead_admin());
create policy "ads_runs: select pentru admini"
  on public.ads_runs for select to authenticated
  using (public.is_lead_admin());

-- ============================================================================
-- 7 · Anticamera video-urilor noi (bucket privat, 50 MB pe planul Free)
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ads-uploads', 'ads-uploads', false, 52428800, array['video/mp4', 'video/quicktime'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================================
-- Semnal
-- ============================================================================

do $$
begin
  if not exists (select 1 from public.admin_emails) then
    raise warning 'admin_emails e goală: adaugă adresele din ADMIN_EMAILS (vezi capul fișierului), altfel panoul nu vede nimic.';
  end if;
end;
$$;
