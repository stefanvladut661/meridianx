-- MERIDIAN — schema lead-uri (FAZA 0, ÎNGHEȚAT)
-- Se aplică cu Supabase CLI: supabase db push
-- sau manual în SQL editor pe proiectul Supabase.

-- Enums ---------------------------------------------------------------

create type public.division as enum ('video', 'software');

create type public.lead_status as enum (
  'new',
  'contacted',
  'qualified',
  'proposal',
  'won',
  'lost'
);

-- Tabele --------------------------------------------------------------

create table public.leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  division      public.division not null,
  -- de unde a venit lead-ul: formularul/pagina sursă
  -- (ex: 'video-contact', 'video-audit', 'software-brief', 'software-fonduri')
  source        text not null,
  locale        text not null default 'ro',
  name          text not null,
  email         text,
  phone         text,
  company       text,
  project_type  text,
  budget_range  text,
  timeline      text,
  message       text,
  status        public.lead_status not null default 'new',
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  referrer      text,
  -- note libere din admin (F6)
  notes         text,
  -- lead din segmentul „fonduri de modernizare" — cel mai valoros (F6 îl marchează vizual)
  is_funded     boolean not null default false,

  constraint leads_contact_check check (email is not null or phone is not null)
);

create table public.lead_events (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads (id) on delete cascade,
  -- ex: 'created', 'status_changed', 'note_added', 'brief_step', 'email_sent'
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexuri pentru dashboard (listare + filtrare) -----------------------

create index leads_created_at_idx on public.leads (created_at desc);
create index leads_division_idx on public.leads (division);
create index leads_status_idx on public.leads (status);
create index lead_events_lead_id_idx on public.lead_events (lead_id, created_at);

-- RLS -------------------------------------------------------------------
-- Insert-ul public NU trece prin RLS: API route-ul folosește service role.
-- Select/update doar pentru utilizatori autentificați (contul de admin).

alter table public.leads enable row level security;
alter table public.lead_events enable row level security;

create policy "leads: select pentru autentificați"
  on public.leads for select
  to authenticated
  using (true);

create policy "leads: update pentru autentificați"
  on public.leads for update
  to authenticated
  using (true)
  with check (true);

create policy "lead_events: select pentru autentificați"
  on public.lead_events for select
  to authenticated
  using (true);

create policy "lead_events: insert pentru autentificați"
  on public.lead_events for insert
  to authenticated
  with check (true);

-- Fără politici de insert/delete pentru anon: service role ocolește RLS.
