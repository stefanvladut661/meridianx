-- Din migrarea 5: doar lista de admini și is_lead_admin(), plus două adrese de test.
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
insert into public.admin_emails (email) values ('stefan@test.local'), ('vladut@test.local');
