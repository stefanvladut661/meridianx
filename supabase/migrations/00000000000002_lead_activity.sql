-- MERIDIAN — activitate pe lead-uri și indexuri pentru panou (FAZA 6, pasul 2)
-- Se aplică DUPĂ `00000000000001_leads.sql`.
--   supabase db push        (CLI)
--   sau lipit în SQL editor pe proiectul Supabase, în ordine.
--
-- Migrarea 1 rămâne neatinsă (fișier înghețat după FAZA 0). Tot ce urmează
-- e aditiv: coloane cu default, indexuri, un trigger. Se poate rula pe o
-- bază care are deja lead-uri, fără migrare de date.
--
-- ⚠️ NU e opțională: `lib/supabase/leads.ts` cere `updated_at` în select.
-- Fără migrarea asta, panoul răspunde „nu putem citi lead-urile”.

-- „Ultima atingere” ------------------------------------------------------
-- Istoricul din `lead_events` spune CE s-a întâmplat, dar sortarea și
-- filtrarea după activitate cer o coloană pe rândul de lead. Fără ea,
-- „ce n-am mai atins de două săptămâni” e un JOIN cu agregare la fiecare
-- încărcare a panoului.
alter table public.leads
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row
  execute function public.set_updated_at();

-- Rândurile existente n-au fost niciodată actualizate: le aliniem la
-- momentul creării, ca „ultima atingere” să nu mintă că e de azi.
update public.leads set updated_at = created_at where updated_at > created_at;

-- Indexuri pentru cum se folosește chiar panoul ---------------------------

-- Coada de lucru: sortare după activitate.
create index if not exists leads_updated_at_idx
  on public.leads (updated_at desc);

-- Segmentul „fonduri de modernizare” e prioritatea #1 din brief și are
-- filtru propriu în panou. Index parțial: intră doar rândurile marcate.
create index if not exists leads_funded_idx
  on public.leads (created_at desc)
  where is_funded;

-- Căutarea de dubluri la trimitere (dublu-click pe „Cere ofertă”) se face
-- pe email/telefon într-o fereastră de câteva minute.
create index if not exists leads_email_recent_idx
  on public.leads (email, created_at desc)
  where email is not null;

create index if not exists leads_phone_recent_idx
  on public.leads (phone, created_at desc)
  where phone is not null;

-- Plafonul de evenimente per lead (ruta publică de evenimente) numără
-- rânduri filtrate pe lead_id; indexul din migrarea 1 acoperă exact asta.
