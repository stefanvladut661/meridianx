-- ============================================================
-- Prospectare, migrarea 4: citirile adminului (doar citire).
--
-- Numărătorile se fac în bază, nu în pagină: cu mii de firme, adminul nu
-- aduce toate rândurile ca să afle câte sunt pe fiecare etapă.
-- Doar cheia de service (paginile citesc pe server, după garda de admin).
-- Se rulează după 28–30. Se poate rula de mai multe ori.
-- ============================================================

-- Începutul zilei de azi la București, ca moment (pentru activitatea „de azi”).
create or replace function public.prospectare_inceput_azi()
returns timestamptz
language sql
stable
as $$
  select (public.prospectare_azi()::timestamp at time zone 'Europe/Bucharest')
$$;

create or replace function public.prospectare_rezumat()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total', (select count(*) from public.prospectare_firme),
    'etape', (select coalesce(jsonb_object_agg(etapa, n), '{}'::jsonb) from (select etapa, count(*) as n from public.prospectare_firme group by etapa) s),
    'canale', (select coalesce(jsonb_object_agg(coalesce(canal, 'fara'), n), '{}'::jsonb) from (select canal, count(*) as n from public.prospectare_firme group by canal) s),
    'de_refacut', (select count(*) from public.prospectare_firme where de_refacut),
    'rezerva_telefon', (select count(*) from public.prospectare_firme where etapa = 'site_gata' and canal is null and link_demo is not null and telefon is not null),
    'rezerva_whatsapp', (select count(*) from public.prospectare_firme where etapa = 'site_gata' and canal is null and link_demo is not null and este_mobil),
    'in_lucru', (select count(*) from public.prospectare_rezervari where expira_la > now()),
    'roboti_activi', (select count(*) from public.prospectare_dispozitive where activ and ultima_activitate > now() - interval '15 minutes'),
    'roboti', (select count(*) from public.prospectare_dispozitive where activ),
    'azi', jsonb_build_object(
      'apeluri', (select count(*) from public.prospectare_liste_zi where data = public.prospectare_azi() and canal = 'telefon'),
      'apeluri_facute', (select count(*) from public.prospectare_liste_zi where data = public.prospectare_azi() and canal = 'telefon' and rezultat is not null),
      'whatsapp', (select count(*) from public.prospectare_liste_zi where data = public.prospectare_azi() and canal = 'whatsapp'),
      'whatsapp_trimise', (select count(*) from public.prospectare_liste_zi where data = public.prospectare_azi() and canal = 'whatsapp' and rezultat = 'trimis'),
      'emailuri', (select coalesce(sum(trimise), 0) from public.prospectare_casute_zi where zi = public.prospectare_azi()),
      'raspunsuri', (select coalesce(sum(raspunsuri), 0) from public.prospectare_casute_zi where zi = public.prospectare_azi()),
      'bounce', (select coalesce(sum(bounce), 0) from public.prospectare_casute_zi where zi = public.prospectare_azi()),
      'site_uri', (select count(*) from public.prospectare_activitate where tip = 'site' and la >= public.prospectare_inceput_azi()),
      'interesati', (select count(*) from public.prospectare_activitate where tip = 'etapa' and detalii ->> 'in' = 'interesat' and la >= public.prospectare_inceput_azi())
    )
  )
$$;

-- Valorile pentru filtre (nișă, oraș, județ, lot), cu câte firme are fiecare.
create or replace function public.prospectare_optiuni()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'nise', (select coalesce(jsonb_agg(jsonb_build_object('v', nisa, 'n', n) order by n desc, nisa), '[]'::jsonb) from (select nisa, count(*) as n from public.prospectare_firme where nisa is not null group by nisa) s),
    'orase', (select coalesce(jsonb_agg(jsonb_build_object('v', oras, 'n', n) order by n desc, oras), '[]'::jsonb) from (select oras, count(*) as n from public.prospectare_firme where oras is not null group by oras) s),
    'judete', (select coalesce(jsonb_agg(jsonb_build_object('v', judet, 'n', n) order by n desc, judet), '[]'::jsonb) from (select judet, count(*) as n from public.prospectare_firme where judet is not null group by judet) s),
    'loturi', (select coalesce(jsonb_agg(jsonb_build_object('v', lot, 'n', n) order by lot desc), '[]'::jsonb) from (select lot, count(*) as n from public.prospectare_firme where lot is not null group by lot) s)
  )
$$;

-- Rezerva pentru listele zilei, grupată pe filtre: pagina numără singură câte
-- firme ar intra pentru filtrele alese, fără să aducă firmele.
create or replace function public.prospectare_rezerva_grupe()
returns table (nisa text, oras text, judet text, scor smallint, este_mobil boolean, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select f.nisa, f.oras, f.judet, f.scor, f.este_mobil, count(*)
  from public.prospectare_firme f
  where f.etapa = 'site_gata' and f.canal is null and f.link_demo is not null and f.telefon is not null
  group by f.nisa, f.oras, f.judet, f.scor, f.este_mobil
$$;

-- Site-urile terminate de fiecare robot: azi și în total.
create or replace function public.prospectare_statistici_roboti()
returns table (dispozitiv_id uuid, azi bigint, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select (a.detalii ->> 'dispozitiv')::uuid,
         count(*) filter (where a.la >= public.prospectare_inceput_azi()),
         count(*)
  from public.prospectare_activitate a
  where a.tip = 'site' and a.detalii ? 'dispozitiv' and (a.detalii ->> 'dispozitiv') ~ '^[0-9a-f-]{36}$'
  group by 1
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.prospectare_rezumat()',
    'public.prospectare_optiuni()',
    'public.prospectare_rezerva_grupe()',
    'public.prospectare_statistici_roboti()'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke all on function %s from anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;

select 'citirile prospectării doar pentru cheia de service' as verificare,
  not has_function_privilege('anon', 'public.prospectare_rezumat()', 'execute')
  and not has_function_privilege('authenticated', 'public.prospectare_optiuni()', 'execute') as ok
union all
select 'rezumatul răspunde', (public.prospectare_rezumat() ? 'etape');
