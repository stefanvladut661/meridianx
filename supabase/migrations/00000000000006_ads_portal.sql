-- MERIDIAN — portalul de reclame /admin/ads (migrarea 6, feat/ads-portal)
-- Se aplică DUPĂ migrarea 5 (are nevoie de `public.is_lead_admin()`),
-- lipit în SQL editor pe proiectul Supabase.
--
-- Fișier NOU, aditiv: nu atinge lead-urile, vault-ul sau `admin_emails`.
--
-- ACCES: RLS activ pe tot. Citirea — doar adminii (`is_lead_admin()`),
-- exact ca la lead-uri. Scrierea — doar prin service role, după ce acțiunea
-- de server a verificat sesiunea (la fel ca la lead-uri). Nu există politici
-- de insert/update/delete: un JWT de sesiune nu poate scrie nimic aici.
--
-- CE NU ȚINE BAZA: tokenurile. Ele stau doar în variabilele de mediu de pe
-- server. Id-urile de cont și de campanie stau aici (nu în repo, care e public).

-- Helper -------------------------------------------------------------------------

-- Aceeași funcție ca în migrările 2 și 3 (`create or replace`, corp identic).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Campaniile create din portal -------------------------------------------------------

create table public.ads_campaigns (
  id                    uuid primary key default gen_random_uuid(),
  -- Id-ul spațiului de lucru din lib/ads/workspaces.ts (`meta-meridian`).
  workspace             text not null,
  platform              text not null check (platform in ('meta', 'tiktok')),
  -- `act_…` pe Meta, advertiser_id pe TikTok.
  ad_account            text not null,
  platform_campaign_id  text not null,
  name                  text not null,
  -- Valoarea din plan (`leads`, `traffic`…), nu cea a platformei.
  objective             text not null,
  -- În unități întregi ale monedei, ca în plan (60 = 60 lei).
  daily_budget          numeric(12, 2) not null check (daily_budget > 0),
  currency              text not null check (currency in ('RON', 'EUR', 'USD')),
  -- Ultimul status cunoscut în platformă. Portalul scrie doar PAUSED la
  -- creare; restul vine de la sincronizare (activarea o face omul).
  status                text not null default 'PAUSED',
  -- `complete` = tot lanțul creat. `partial` = campania există, dar ceva de
  -- sub ea n-a mers — rămâne oprită, iar `creation_error` spune ce lipsește.
  creation              text not null default 'complete' check (creation in ('complete', 'partial')),
  creation_error        text,
  -- Id-urile obiectelor de sub campanie: { adset, creatives: [], ads: [] }.
  platform_objects      jsonb not null default '{}'::jsonb,
  -- Planul întreg, așa cum a fost creat (după rezolvarea numelor).
  plan_json             jsonb not null,
  -- Amprenta planului verificat (SHA-256). Prinde dublul clic și „încă o
  -- dată" din alt tab: același plan creat de două ori = buget dublu.
  fingerprint           text not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references auth.users (id) on delete set null,
  -- Rămâne și după ce contul e șters: cine a creat-o, în clar.
  created_by_email      text,
  unique (platform, platform_campaign_id)
);

create index ads_campaigns_workspace_idx on public.ads_campaigns (workspace, created_at desc);
create index ads_campaigns_fingerprint_idx on public.ads_campaigns (fingerprint, created_at desc);

create trigger ads_campaigns_updated_at
  before update on public.ads_campaigns
  for each row execute function public.set_updated_at();

-- Cifrele pe zile ----------------------------------------------------------------------

-- Un rând pe campanie pe zi. Istoricul e PERMANENT: platformele nu țin
-- datele la infinit, snapshot-urile de aici devin singura memorie.
create table public.ads_metrics_daily (
  id               bigint generated always as identity primary key,
  -- `restrict`: o campanie cu istoric nu se poate șterge din greșeală.
  campaign_id      uuid not null references public.ads_campaigns (id) on delete restrict,
  -- Ziua în fusul orar al contului de reclame.
  date             date not null,
  spend            numeric(12, 2) not null default 0,
  impressions      bigint not null default 0,
  clicks           bigint not null default 0,
  results          numeric(12, 2) not null default 0,
  cost_per_result  numeric(12, 4),
  -- Răspunsul platformei pentru ziua asta, ca să se poată recalcula orice.
  raw              jsonb not null default '{}'::jsonb,
  synced_at        timestamptz not null default now(),
  unique (campaign_id, date)
);

create index ads_metrics_daily_date_idx on public.ads_metrics_daily (date desc);

-- Istoricul înghețat: platformele își mai corectează cifrele câteva zile
-- după (Meta: „o pereche de zile”, niciodată după 28), deci ultimele 7 zile
-- se mai pot actualiza. Ce e mai vechi rămâne cum a fost scris — și baza
-- refuză, nu doar codul.
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

create trigger ads_metrics_daily_frozen
  before update on public.ads_metrics_daily
  for each row execute function public.ads_metrics_frozen();

-- Jurnalul sincronizărilor ---------------------------------------------------------------

create table public.ads_runs (
  id                bigint generated always as identity primary key,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  status            text not null default 'running'
                      check (status in ('running', 'ok', 'partial', 'failed')),
  campaigns_synced  integer not null default 0,
  error             text
);

create index ads_runs_started_at_idx on public.ads_runs (started_at desc);

-- RLS ------------------------------------------------------------------------------------

alter table public.ads_campaigns enable row level security;
alter table public.ads_metrics_daily enable row level security;
alter table public.ads_runs enable row level security;

create policy "ads_campaigns: select pentru admini"
  on public.ads_campaigns for select
  to authenticated
  using (public.is_lead_admin());

create policy "ads_metrics_daily: select pentru admini"
  on public.ads_metrics_daily for select
  to authenticated
  using (public.is_lead_admin());

create policy "ads_runs: select pentru admini"
  on public.ads_runs for select
  to authenticated
  using (public.is_lead_admin());
