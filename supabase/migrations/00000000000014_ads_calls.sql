-- MERIDIAN — portalul de reclame v2: apelurile notate de mână (migrarea 14)
-- Se aplică DUPĂ migrarea 12, lipit în Supabase → SQL Editor → Run.
--
-- DE CE: un client de video sună, nu completează formulare. Platformele numără
-- un apel doar când omul apasă butonul din reclamă (și nici atunci nu știu ce s-a
-- vorbit). Aici se notează fiecare apel venit de pe o reclamă: ziua, clientul,
-- canalul, campania (dacă se știe) și ce a ieșit — doar o întrebare, o programare
-- sau un contract semnat. Ecranul Campanii le arată lângă „Rezultate”.
--
-- Fișier NOU, aditiv. Același acces ca restul portalului: citire doar pentru
-- admini (`is_lead_admin()`), scriere doar prin service role. Se poate rula de
-- mai multe ori.

create table if not exists public.ads_calls (
  id                uuid primary key default gen_random_uuid(),
  -- Clienții se arhivează, nu se șterg: un client cu apeluri nu poate dispărea din greșeală.
  client_id         uuid not null references public.ads_clients (id) on delete restrict,
  -- Canalul de pe care a venit apelul; null = omul n-a spus.
  platform          text check (platform in ('meta', 'google', 'tiktok')),
  -- Campania (rândul ei din modelul comun), dacă se știe.
  entity_id         uuid references public.ads_entities (id) on delete set null,
  called_on         date not null,
  result            text not null check (result in ('intrebare', 'programat', 'semnat')),
  note              text check (note is null or char_length(note) <= 1000),
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  created_by_email  text
);

create index if not exists ads_calls_client_day_idx on public.ads_calls (client_id, called_on desc);
create index if not exists ads_calls_entity_idx on public.ads_calls (entity_id) where entity_id is not null;

alter table public.ads_calls enable row level security;

drop policy if exists "ads_calls: select pentru admini" on public.ads_calls;
create policy "ads_calls: select pentru admini"
  on public.ads_calls for select to authenticated using (public.is_lead_admin());

-- Verificare (trebuie să dea true):
--   select to_regclass('public.ads_calls') is not null;
