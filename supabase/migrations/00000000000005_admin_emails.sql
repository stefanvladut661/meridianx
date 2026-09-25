-- MERIDIAN — cine e admin, verificat în bază (migrarea 5)
-- Se aplică DUPĂ migrările 1–4, lipit în SQL editor pe proiectul Supabase.
--
-- DE CE: politicile din migrarea 1 sunt `to authenticated using (true)`.
-- ORICE cont Supabase Auth de pe proiect — nu doar adresele din
-- ADMIN_EMAILS — putea citi toate lead-urile prin REST, cu cheia anon și
-- JWT-ul lui de sesiune. Lista de admini era verificată doar în aplicație.
-- Membrii vault-ului au conturi pe același proiect, deci „autentificat"
-- nu mai înseamnă „admin". De acum baza verifică singură.
--
-- Fișier NOU, aditiv. Migrarea 1 rămâne neatinsă (înghețată); politicile ei
-- se înlocuiesc de aici cu `drop policy` + `create policy`.
--
-- ⚠️ IMEDIAT DUPĂ APLICARE — altfel panoul de lead-uri arată zero lead-uri:
--
--   insert into public.admin_emails (email) values
--     ('adresa-ta@exemplu.ro');
--
-- Aceleași adrese ca în variabila ADMIN_EMAILS din Vercel. Panoul CITEȘTE
-- prin sesiune (deci prin RLS) și scrie prin service role: fără rânduri aici
-- nu crapă nimic și nu se pierde nimic, doar lista apare goală. Adresele NU
-- stau în fișierul ăsta — repo-ul e public.
--
-- Când scoți pe cineva din ADMIN_EMAILS, scoate-l și de aici:
--   delete from public.admin_emails where email = 'adresa@exemplu.ro';

-- Lista ----------------------------------------------------------------------

create table if not exists public.admin_emails (
  -- Litere mici, fără spații: comparația din `is_lead_admin()` e exactă.
  email      text primary key check (email = lower(btrim(email)) and email like '%_@_%'),
  added_at   timestamptz not null default now()
);

-- RLS activ și NICIO politică: tabela nu se citește și nu se scrie prin REST,
-- nici măcar de un admin. O citește doar funcția de mai jos (security
-- definer); o scrie omul, din SQL editor.
alter table public.admin_emails enable row level security;

-- Verificarea --------------------------------------------------------------

-- SECURITY DEFINER: rulează cu drepturile proprietarului, deci trece de RLS
-- pe `admin_emails` fără să expună tabela. STABLE: un singur răspuns pe
-- interogare, nu unul pe rând. Emailul vine din JWT-ul semnat de Supabase,
-- nu dintr-un parametru.
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

-- Politicile pe lead-uri ---------------------------------------------------------

drop policy if exists "leads: select pentru autentificați" on public.leads;
drop policy if exists "leads: update pentru autentificați" on public.leads;
drop policy if exists "lead_events: select pentru autentificați" on public.lead_events;
drop policy if exists "lead_events: insert pentru autentificați" on public.lead_events;

create policy "leads: select pentru admini"
  on public.leads for select
  to authenticated
  using (public.is_lead_admin());

create policy "leads: update pentru admini"
  on public.leads for update
  to authenticated
  using (public.is_lead_admin())
  with check (public.is_lead_admin());

create policy "lead_events: select pentru admini"
  on public.lead_events for select
  to authenticated
  using (public.is_lead_admin());

create policy "lead_events: insert pentru admini"
  on public.lead_events for insert
  to authenticated
  with check (public.is_lead_admin());

-- Semnal ----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from public.admin_emails) then
    raise warning 'admin_emails e goală: panoul de lead-uri nu vede niciun lead până nu inserezi adresele din ADMIN_EMAILS (vezi capul fișierului).';
  end if;
end;
$$;
