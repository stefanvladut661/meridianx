-- MERIDIAN — portalul de reclame v2: modelul comun Meta · Google · TikTok (migrarea 12)
-- Se aplică DUPĂ migrările 5–11, lipit în Supabase → SQL Editor → Run.
--
-- DE CE: până acum portalul ținea doar campaniile CREATE de el (`ads_campaigns`)
-- și cifrele lor la nivel de campanie (`ads_metrics_daily`). Ecranul v2 arată
-- toate campaniile, grupurile și reclamele conturilor unui client, pe toate trei
-- platformele, cu aceleași coloane. Pentru asta:
--
--   ads_clients        — clientul: un nume care adună conturile lui de pe Meta,
--                        Google și TikTok. Numele stă doar aici (repo-ul e public).
--   ads_accounts       — conturile de reclame urmărite, fiecare legat de un client
--                        și de spațiul lui de lucru (deci de token și de plafon).
--   ads_entities       — un rând pe campanie, grup (ad set / ad group) sau reclamă.
--   ads_entity_daily   — cifrele pe zi, la fiecare nivel.
--   ads_result_choices — ce conversie se numără ca „rezultat” pe o campanie.
--   ads_changes        — jurnalul acțiunilor din portal pe conturi (pauzele).
--   ads_sync_runs      — jurnalul sincronizărilor modelului comun.
--
-- Fișier NOU, aditiv: tabelele vechi rămân cum sunt. Același acces ca restul
-- portalului: citire doar pentru admini (`is_lead_admin()`, migrarea 5),
-- scriere doar prin service role, după ce acțiunea de server (sesiunea) sau
-- cron-ul (CRON_SECRET) au verificat cine scrie. Se poate rula de mai multe ori.

-- Clienții -----------------------------------------------------------------------------

create table if not exists public.ads_clients (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(btrim(name)) between 1 and 80),
  -- Al cui sunt banii, ca la spațiile de lucru: conturile agenției sau ale clienților.
  owner             text not null check (owner in ('agentie', 'clienti')),
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  created_by_email  text
);

create unique index if not exists ads_clients_name_idx
  on public.ads_clients (lower(btrim(name)))
  where archived_at is null;

-- Conturile urmărite -------------------------------------------------------------------

create table if not exists public.ads_accounts (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.ads_clients (id) on delete restrict,
  platform          text not null check (platform in ('meta', 'tiktok', 'google')),
  -- Spațiul din lib/ads/workspaces.ts (`meta-clienti`): tokenul și plafonul.
  workspace         text not null,
  -- `act_…` pe Meta, advertiser_id pe TikTok, 10 cifre pe Google.
  ad_account        text not null,
  -- Ce spune platforma despre cont, la ultima citire.
  name              text,
  currency          text,
  timezone          text,
  -- Catalogul conversiilor contului: [{ key, label, kind, primary }].
  conversions       jsonb not null default '[]'::jsonb,
  -- Contul are măcar o conversie configurată. null = încă necitit.
  measured          boolean,
  sync_enabled      boolean not null default true,
  last_synced_at    timestamptz,
  last_sync_status  text check (last_sync_status in ('ok', 'partial', 'failed')),
  last_sync_error   text,
  -- Ultima zi pentru care cifrele au venit fără eroare (de aici se calculează golul).
  synced_through    date,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  created_by_email  text,
  unique (platform, ad_account)
);

create index if not exists ads_accounts_client_idx on public.ads_accounts (client_id);

-- Campaniile, grupurile și reclamele ------------------------------------------------------

create table if not exists public.ads_entities (
  id                    uuid primary key default gen_random_uuid(),
  account_id            uuid not null references public.ads_accounts (id) on delete restrict,
  platform              text not null check (platform in ('meta', 'tiktok', 'google')),
  level                 text not null check (level in ('campaign', 'group', 'ad')),
  -- Id-ul pe platformă. Pe Google, reclama e `grup~reclamă` (ca în numele resursei).
  platform_id           text not null,
  campaign_platform_id  text not null,
  -- Grupul reclamei (doar la nivelul `ad`).
  group_platform_id     text,
  name                  text not null default '',
  -- Starea normalizată: active, paused, review, rejected, removed, archived, issues, ended, other.
  status                text not null default 'other',
  -- Starea cum o spune platforma (ENABLED · LIMITED, CAMPAIGN_PAUSED, ADGROUP_STATUS_AUDIT…).
  status_detail         text,
  daily_budget          numeric(14, 2),
  lifetime_budget       numeric(14, 2),
  -- Tipul campaniei sau ținta grupului, cum o spune platforma (SEARCH, OUTCOME_LEADS…).
  kind                  text,
  -- Cheia conversiei numărate implicit ca rezultat; null = nemăsurat.
  default_result        text,
  -- Setările, doar pentru citit în panou (licitare, program, public, texte).
  settings              jsonb not null default '{}'::jsonb,
  -- Rândul din `ads_campaigns`, dacă a fost creată din portal.
  portal_campaign_id    uuid references public.ads_campaigns (id) on delete set null,
  platform_created_at   timestamptz,
  first_seen_at         timestamptz not null default now(),
  last_seen_at          timestamptz not null default now(),
  unique (account_id, level, platform_id)
);

create index if not exists ads_entities_campaign_idx on public.ads_entities (account_id, campaign_platform_id);

-- Cifrele pe zi --------------------------------------------------------------------------

create table if not exists public.ads_entity_daily (
  id           bigint generated always as identity primary key,
  -- `restrict`: un rând cu istoric nu se poate șterge din greșeală.
  entity_id    uuid not null references public.ads_entities (id) on delete restrict,
  -- Ziua în fusul orar al contului.
  date         date not null,
  spend        numeric(14, 2) not null default 0,
  impressions  bigint not null default 0,
  -- Meta: clicuri pe link; Google și TikTok: clicuri.
  clicks       bigint not null default 0,
  -- Conversiile pe tipuri: { "g:conversions": 2, "g:ca:123": 1, "m:lead": 1 }.
  conversions  jsonb not null default '{}'::jsonb,
  -- Cifrele specifice canalului: vizionări, acoperire, apeluri din anunț.
  extra        jsonb not null default '{}'::jsonb,
  synced_at    timestamptz not null default now(),
  unique (entity_id, date)
);

create index if not exists ads_entity_daily_date_idx on public.ads_entity_daily (date desc);

-- Istoricul înghețat, ca în migrarea 6: platformele își mai corectează cifrele
-- câteva zile după, deci ultimele 7 zile se pot actualiza; restul rămâne cum a
-- fost scris, iar baza refuză, nu doar codul.
create or replace function public.ads_entity_daily_frozen()
returns trigger
language plpgsql
as $$
begin
  if old.date < (now() at time zone 'Europe/Bucharest')::date - 7 then
    raise exception 'ads_entity_daily: ziua % e înghețată (mai veche de 7 zile)', old.date
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists ads_entity_daily_frozen on public.ads_entity_daily;
create trigger ads_entity_daily_frozen
  before update on public.ads_entity_daily
  for each row execute function public.ads_entity_daily_frozen();

-- Rezultatul ales pe campanie ------------------------------------------------------------

create table if not exists public.ads_result_choices (
  -- Campania (rând de nivel `campaign` din ads_entities).
  entity_id         uuid primary key references public.ads_entities (id) on delete cascade,
  -- Cheia din catalogul contului, sau `none` = nemăsurat, ales intenționat.
  result_key        text not null check (char_length(result_key) between 1 and 200),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references auth.users (id) on delete set null,
  updated_by_email  text
);

-- Jurnalul acțiunilor pe conturi ---------------------------------------------------------

create table if not exists public.ads_changes (
  id                uuid primary key default gen_random_uuid(),
  platform          text not null check (platform in ('meta', 'tiktok', 'google')),
  workspace         text not null,
  ad_account        text not null,
  kind              text not null check (kind in ('pause')),
  -- O propoziție, cum apare în Istoric („2 campanii puse pe pauză”).
  summary           text not null,
  -- Ce exact: id-urile, numele, nivelul, ce s-a sărit și de ce.
  detail            jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  created_by_email  text
);

create index if not exists ads_changes_created_idx on public.ads_changes (created_at desc);

-- Jurnalul sincronizărilor ---------------------------------------------------------------

create table if not exists public.ads_sync_runs (
  id               bigint generated always as identity primary key,
  trigger          text not null check (trigger in ('cron', 'manual')),
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  status           text not null default 'running' check (status in ('running', 'ok', 'partial', 'failed')),
  accounts_synced  integer not null default 0,
  rows_written     integer not null default 0,
  -- Problemele, în română, câte una pe rând. Fără tokenuri.
  problems         text
);

create index if not exists ads_sync_runs_started_idx on public.ads_sync_runs (started_at desc);

-- Citirile ecranului ------------------------------------------------------------------------
-- Sumele se fac în bază, nu în pagină: un client cu câteva sute de reclame are
-- zeci de mii de rânduri pe zi într-o perioadă de 90 de zile, iar API-ul
-- Supabase întoarce cel mult 1.000 de rânduri pe cerere. SECURITY INVOKER: rulează
-- cu drepturile celui care întreabă, deci RLS de mai jos se aplică și aici.

-- Sumele perioadei, pe rând (campanie, grup sau reclamă), cu conversiile pe tipuri.
create or replace function public.ads_entity_totals(p_accounts uuid[], p_from date, p_to date)
returns table (
  entity_id    uuid,
  spend        numeric,
  impressions  bigint,
  clicks       bigint,
  conversions  jsonb,
  extra        jsonb,
  days         integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select d.entity_id, d.spend, d.impressions, d.clicks, d.conversions, d.extra
    from public.ads_entity_daily d
    join public.ads_entities e on e.id = d.entity_id
    where e.account_id = any (p_accounts)
      and d.date between p_from and p_to
  ),
  sums as (
    select b.entity_id, sum(b.spend) as spend, sum(b.impressions)::bigint as impressions,
           sum(b.clicks)::bigint as clicks, count(*)::integer as days
    from base b
    group by b.entity_id
  ),
  conv as (
    select x.entity_id, jsonb_object_agg(x.key, x.value) as conversions
    from (
      select b.entity_id, kv.key, sum(kv.value::numeric) as value
      from base b, lateral jsonb_each_text(b.conversions) as kv(key, value)
      group by b.entity_id, kv.key
    ) x
    group by x.entity_id
  ),
  ext as (
    select x.entity_id, jsonb_object_agg(x.key, x.value) as extra
    from (
      select b.entity_id, kv.key, sum(kv.value::numeric) as value
      from base b, lateral jsonb_each_text(b.extra) as kv(key, value)
      group by b.entity_id, kv.key
    ) x
    group by x.entity_id
  )
  select s.entity_id, s.spend, s.impressions, s.clicks,
         coalesce(c.conversions, '{}'::jsonb), coalesce(x.extra, '{}'::jsonb), s.days
  from sums s
  left join conv c on c.entity_id = s.entity_id
  left join ext x on x.entity_id = s.entity_id;
$$;

-- Zilele unor rânduri anume (graficul din panou, statisticile pe campanii).
create or replace function public.ads_entity_days(p_entities uuid[], p_from date, p_to date)
returns table (
  entity_id    uuid,
  date         date,
  spend        numeric,
  impressions  bigint,
  clicks       bigint,
  conversions  jsonb,
  extra        jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  select d.entity_id, d.date, d.spend, d.impressions, d.clicks, d.conversions, d.extra
  from public.ads_entity_daily d
  where d.entity_id = any (p_entities)
    and d.date between p_from and p_to
  order by d.date, d.entity_id;
$$;

revoke all on function public.ads_entity_totals(uuid[], date, date) from public;
revoke all on function public.ads_entity_days(uuid[], date, date) from public;
grant execute on function public.ads_entity_totals(uuid[], date, date) to authenticated, service_role;
grant execute on function public.ads_entity_days(uuid[], date, date) to authenticated, service_role;

-- RLS ------------------------------------------------------------------------------------

alter table public.ads_clients enable row level security;
alter table public.ads_accounts enable row level security;
alter table public.ads_entities enable row level security;
alter table public.ads_entity_daily enable row level security;
alter table public.ads_result_choices enable row level security;
alter table public.ads_changes enable row level security;
alter table public.ads_sync_runs enable row level security;

drop policy if exists "ads_clients: select pentru admini" on public.ads_clients;
create policy "ads_clients: select pentru admini"
  on public.ads_clients for select to authenticated using (public.is_lead_admin());

drop policy if exists "ads_accounts: select pentru admini" on public.ads_accounts;
create policy "ads_accounts: select pentru admini"
  on public.ads_accounts for select to authenticated using (public.is_lead_admin());

drop policy if exists "ads_entities: select pentru admini" on public.ads_entities;
create policy "ads_entities: select pentru admini"
  on public.ads_entities for select to authenticated using (public.is_lead_admin());

drop policy if exists "ads_entity_daily: select pentru admini" on public.ads_entity_daily;
create policy "ads_entity_daily: select pentru admini"
  on public.ads_entity_daily for select to authenticated using (public.is_lead_admin());

drop policy if exists "ads_result_choices: select pentru admini" on public.ads_result_choices;
create policy "ads_result_choices: select pentru admini"
  on public.ads_result_choices for select to authenticated using (public.is_lead_admin());

drop policy if exists "ads_changes: select pentru admini" on public.ads_changes;
create policy "ads_changes: select pentru admini"
  on public.ads_changes for select to authenticated using (public.is_lead_admin());

drop policy if exists "ads_sync_runs: select pentru admini" on public.ads_sync_runs;
create policy "ads_sync_runs: select pentru admini"
  on public.ads_sync_runs for select to authenticated using (public.is_lead_admin());
