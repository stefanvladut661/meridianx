-- ============================================================
-- Postări, faza 4: coada.
--
-- `postari_claim` ia din coadă postările ajunse la timp, fără dubluri: un
-- rând e luat doar dacă nu e deja în lucrul altei rulări (termenul de lucru
-- n-a expirat), cu `for update skip locked`, iar condiția se verifică din nou
-- pe rândul blocat. Două rulări simultane nu pot lua același rând.
-- Pe fiecare platformă pornește cel mult o postare nouă pe rulare: după o
-- pauză, postările rămase în urmă pleacă pe rând, nu toate deodată.
--
-- Citirea tabelelor noi: doar adminii (`is_lead_admin()`). Funcția: doar
-- cheia de service. Se poate rula de mai multe ori.
-- ============================================================

-- „Reîncearcă”: când și cine a repus postarea în coadă (o postare repusă nu e
-- „rămasă în urmă”, chiar dacă ora ei a trecut).
alter table public.postari add column if not exists reluata_la timestamptz;
alter table public.postari add column if not exists reluata_de text check (reluata_de is null or char_length(reluata_de) <= 200);
-- Pentru TikTok: până când se mai verifică dacă ai publicat ciorna din aplicație.
alter table public.postari add column if not exists verificare_pana_la timestamptz;

create index if not exists postari_lucru_idx on public.postari (stare, urmatoarea_incercare) where stare in ('planificata', 'in_lucru', 'in_ciorne');

-- Fiecare rulare a cozii: când, cât, ce a făcut.
create table if not exists public.postari_rulari (
  id uuid primary key,
  sursa text not null check (sursa in ('cron', 'manual')),
  actor text not null check (char_length(actor) <= 200),
  inceput_la timestamptz not null default now(),
  terminat_la timestamptz,
  durata_ms integer,
  -- Rezumatul: câte luate, publicate, trimise, în așteptare, eșuate; coada oprită etc.
  rezultat jsonb not null default '{}'::jsonb,
  eroare text check (eroare is null or char_length(eroare) <= 1000)
);
create index if not exists postari_rulari_inceput_idx on public.postari_rulari (inceput_la desc);

-- Alertele trimise pe email: aceeași alertă nu pleacă de două ori în aceeași zi.
create table if not exists public.postari_alerte (
  id bigint generated always as identity primary key,
  cheie text not null check (char_length(cheie) <= 200),
  zi date not null,
  tip text not null check (char_length(tip) <= 60),
  mesaj text not null check (char_length(mesaj) <= 2000),
  trimisa boolean not null default false,
  eroare text check (eroare is null or char_length(eroare) <= 500),
  created_at timestamptz not null default now()
);
create unique index if not exists postari_alerte_cheie_zi_uidx on public.postari_alerte (cheie, zi);

alter table public.postari_rulari enable row level security;
alter table public.postari_alerte enable row level security;
drop policy if exists postari_rulari_admin_read on public.postari_rulari;
create policy postari_rulari_admin_read on public.postari_rulari for select to authenticated using (public.is_lead_admin());
drop policy if exists postari_alerte_admin_read on public.postari_alerte;
create policy postari_alerte_admin_read on public.postari_alerte for select to authenticated using (public.is_lead_admin());

create or replace function public.postari_claim(p_run uuid, p_lease_seconds integer default 90, p_limit integer default 6)
returns setof public.postari
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Coada oprită: nu se ia nimic.
  if not coalesce((select coada_pornita from public.postari_setari where id = 1), true) then
    return;
  end if;

  return query
  with due as (
    select p.id, p.platforma, p.stare, p.programata_la, p.element
    from public.postari p
    where (
        (p.stare in ('planificata', 'in_lucru') and p.programata_la <= now())
        or (p.stare = 'in_ciorne' and p.verificare_pana_la > now())
      )
      and (p.urmatoarea_incercare is null or p.urmatoarea_incercare <= now())
      and (p.termen_lucru is null or p.termen_lucru < now())
  ),
  ranked as (
    -- Postările noi (încă neîncepute), numerotate pe platformă, în ordinea orei.
    select d.id, d.stare, row_number() over (partition by d.platforma, d.stare = 'planificata' order by d.programata_la, d.element) as rn
    from due d
  ),
  picked as (
    select p.id
    from public.postari p
    join ranked r on r.id = p.id
    where r.stare <> 'planificata' or r.rn = 1
    order by (r.stare = 'in_lucru') desc, p.programata_la, p.element
    limit p_limit
    for update of p skip locked
  )
  update public.postari p
  set stare = case when p.stare = 'planificata' then 'in_lucru' else p.stare end,
      lucrata_de = p_run,
      termen_lucru = now() + make_interval(secs => p_lease_seconds),
      updated_at = now()
  from picked
  where p.id = picked.id
    -- Verificat din nou pe rândul blocat: nimeni altcineva nu-l lucrează.
    and (p.termen_lucru is null or p.termen_lucru < now())
    and p.stare in ('planificata', 'in_lucru', 'in_ciorne')
  returning p.*;
end;
$$;

revoke all on function public.postari_claim(uuid, integer, integer) from public;
revoke all on function public.postari_claim(uuid, integer, integer) from anon, authenticated;
grant execute on function public.postari_claim(uuid, integer, integer) to service_role;

select 'RLS activ pe postari_rulari și postari_alerte' as verificare,
  (select bool_and(relrowsecurity) from pg_class where relname in ('postari_rulari', 'postari_alerte') and relnamespace = 'public'::regnamespace) as ok
union all
select 'postari_claim doar pentru cheia de service',
  not has_function_privilege('anon', 'public.postari_claim(uuid, integer, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.postari_claim(uuid, integer, integer)', 'execute');
