-- MERIDIAN — portalul de reclame: termenii de căutare și regulile de propuneri (migrarea 11)
-- Se aplică DUPĂ migrarea 10, lipit în SQL editor pe proiectul Supabase.
--
-- DE CE: ce au căutat oamenii înainte să vadă anunțurile (search_term_view)
-- e materialul săptămânal din care ies negativele. Google îl păstrează, dar
-- portalul îl ține la el ca să-l poată compara între săptămâni și ca să-l
-- citească fără să consume din limita de cereri. Regulile după care portalul
-- propune negative (cuvinte „de exclus”, pragul de cost fără conversii) sunt
-- ale fiecărui cont și se editează din portal — nu stau în cod (repo-ul e public).
--
-- Fișier NOU, aditiv. Același acces ca restul portalului: citire doar pentru
-- admini (`is_lead_admin()`), scriere doar prin service role, după ce
-- cron-ul (CRON_SECRET) sau acțiunea de server (sesiunea) au verificat cine
-- scrie. Se poate rula de mai multe ori.

-- Termenii, pe zi -------------------------------------------------------------------------

create table if not exists public.ads_search_terms (
  id               bigint generated always as identity primary key,
  workspace        text not null,
  ad_account       text not null,
  campaign_id      text not null,
  campaign_name    text,
  ad_group_id      text not null,
  ad_group_name    text,
  -- Ce a scris omul în Google.
  search_term      text not null,
  -- Cum s-a potrivit (segments.search_term_match_type) și pe ce cuvânt cheie.
  match_type       text not null default '',
  keyword_text     text not null default '',
  -- Ziua (perioada e pe zile; 7 și 30 de zile se adună la citire).
  date             date not null,
  impressions      bigint not null default 0,
  clicks           bigint not null default 0,
  cost             numeric(12, 2) not null default 0,
  conversions      numeric(12, 2) not null default 0,
  -- Starea în cont: ADDED (e și cuvânt cheie), EXCLUDED (e negativ), ADDED_EXCLUDED, NONE.
  status           text not null default 'NONE',
  -- Prima și ultima zi în care termenul a apărut în grupul ăsta (din tot ce s-a sincronizat).
  first_seen       date,
  last_seen        date,
  synced_at        timestamptz not null default now(),
  unique (ad_account, campaign_id, ad_group_id, search_term, match_type, keyword_text, date)
);

create index if not exists ads_search_terms_account_date_idx
  on public.ads_search_terms (ad_account, date desc);

-- Regulile de propuneri, pe cont -----------------------------------------------------------

create table if not exists public.ads_search_term_rules (
  id                    uuid primary key default gen_random_uuid(),
  workspace             text not null,
  ad_account            text not null unique,
  -- Cuvinte care, dacă apar într-un termen, îl fac propunere de negativ
  -- („angajari”, „gratis”, „pdf”…). Un cuvânt pe element.
  exclude_words         text[] not null default '{}',
  -- Termenii cu cost peste prag (în moneda contului) și zero conversii devin propuneri.
  cost_threshold        numeric(12, 2) not null default 20,
  -- Contul intră în sincronizarea zilnică a termenilor chiar dacă portalul n-a
  -- creat nicio campanie în el (un cont preluat).
  sync_enabled          boolean not null default true,
  -- Ultima sincronizare a termenilor pentru cont și ce n-a mers (pentru ecran).
  last_synced_at        timestamptz,
  last_sync_error       text,
  updated_at            timestamptz not null default now(),
  updated_by            uuid references auth.users (id) on delete set null,
  updated_by_email      text
);

-- RLS ----------------------------------------------------------------------------------------

alter table public.ads_search_terms enable row level security;
alter table public.ads_search_term_rules enable row level security;

drop policy if exists "ads_search_terms: select pentru admini" on public.ads_search_terms;
create policy "ads_search_terms: select pentru admini"
  on public.ads_search_terms for select
  to authenticated
  using (public.is_lead_admin());

drop policy if exists "ads_search_term_rules: select pentru admini" on public.ads_search_term_rules;
create policy "ads_search_term_rules: select pentru admini"
  on public.ads_search_term_rules for select
  to authenticated
  using (public.is_lead_admin());
