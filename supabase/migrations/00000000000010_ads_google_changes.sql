-- MERIDIAN — portalul de reclame: jurnalul modificărilor pe conturile Google (migrarea 10)
-- Se aplică DUPĂ migrarea 9, lipit în SQL editor pe proiectul Supabase.
--
-- DE CE: din faza 11 portalul poate face, pe un cont Google EXISTENT, lucruri
-- care nu sunt „o campanie nouă”: pune campanii pe pauză, adaugă cuvinte
-- negative, leagă liste comune de negative, creează acțiuni de conversie
-- (faza 13). Fiecare se notează aici: cine, când, în ce cont, ce exact.
-- Jurnalul nu se modifică și nu se șterge din portal.
--
-- Fișier NOU, aditiv. Același acces ca restul portalului: citire doar pentru
-- admini (`is_lead_admin()`), scriere doar prin service role, după ce acțiunea
-- de server a verificat sesiunea. Se poate rula de mai multe ori.

create table if not exists public.ads_google_changes (
  id                uuid primary key default gen_random_uuid(),
  -- Spațiul din lib/ads/workspaces.ts (`google-clienti`) și contul (10 cifre).
  workspace         text not null,
  ad_account        text not null,
  -- Ce s-a făcut.
  kind              text not null check (kind in ('pause', 'negatives', 'negative_list_link', 'conversion_actions')),
  -- O propoziție, în română, cum apare în portal („3 campanii puse pe pauză”).
  summary           text not null,
  -- Ce exact: id-urile și numele campaniilor, cuvintele, listele, acțiunile.
  detail            jsonb not null default '{}'::jsonb,
  -- Câte operații au plecat spre Google.
  operations        integer not null default 0,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  created_by_email  text
);

create index if not exists ads_google_changes_account_idx
  on public.ads_google_changes (ad_account, created_at desc);

alter table public.ads_google_changes enable row level security;

drop policy if exists "ads_google_changes: select pentru admini" on public.ads_google_changes;
create policy "ads_google_changes: select pentru admini"
  on public.ads_google_changes for select
  to authenticated
  using (public.is_lead_admin());
