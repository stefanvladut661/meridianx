-- MERIDIAN Prospectare, migrarea 40: pagina Roboți pe înțelesul nostru.
--
-- Un robot = un calculator (un singur token), cu mai multe terminale (sesiuni) pe el.
--   - `calculator`: numele afișat mare („PC Ștefan”, „Laptop Vlăduț”). `nume` rămâne numele tehnic, mic, dedesubt.
--   - Token nou (din admin, fără funcție nouă): hash-ul se înlocuiește, deci tokenul vechi nu mai merge din clipa aceea,
--     iar robotul e pornit din nou (activ). `token_schimbat_la` ține minte când.
--   - Arhivează (`prospectare_robot_arhiveaza`): robotul iese din listă, dar rămâne în bază și în istoric. Tokenul lui nu mai
--     merge (hash înlocuit cu unul pe care nu-l știe nimeni, plus activ = false), firmele rezervate de el se eliberează acum,
--     la fel nișele și lacătul de publicare. „Scoate din arhivă” îl aduce înapoi, oprit până la un token nou.
--     Regula din bază: un robot arhivat nu poate fi activ.
--   - Proprietarii corectați: „vladut 2” e al lui Vlăduț, „sincron” al lui Ștefan.
-- Niciun robot nu se șterge. Se poate rula de mai multe ori. Cere migrările 28–39.

-- 1. Coloanele ----------------------------------------------------------------------------------

alter table public.prospectare_dispozitive add column if not exists calculator text;
alter table public.prospectare_dispozitive add column if not exists arhivat_la timestamptz;
alter table public.prospectare_dispozitive add column if not exists arhivat_de text;
alter table public.prospectare_dispozitive add column if not exists token_schimbat_la timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prospectare_dispozitive_calculator') then
    alter table public.prospectare_dispozitive add constraint prospectare_dispozitive_calculator
      check (calculator is null or char_length(btrim(calculator)) between 1 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prospectare_dispozitive_arhivat_de') then
    alter table public.prospectare_dispozitive add constraint prospectare_dispozitive_arhivat_de
      check (arhivat_de is null or char_length(arhivat_de) <= 200);
  end if;
  -- Arhivat = oprit: un robot arhivat nu poate primi cereri, nici dacă cineva îl activează direct în bază.
  if not exists (select 1 from pg_constraint where conname = 'prospectare_dispozitive_arhivat_oprit') then
    update public.prospectare_dispozitive set activ = false where arhivat_la is not null and activ;
    alter table public.prospectare_dispozitive add constraint prospectare_dispozitive_arhivat_oprit
      check (arhivat_la is null or not activ);
  end if;
end;
$$;

-- 2. Proprietarii (doar dacă sunt încă greșiți) --------------------------------------------------

update public.prospectare_dispozitive
  set proprietar = 'Vlăduț', schimbat_la = now(), schimbat_de = 'migrarea 40 (proprietar corectat)'
  where lower(btrim(nume)) = 'vladut 2' and proprietar <> 'Vlăduț';
update public.prospectare_dispozitive
  set proprietar = 'Ștefan', schimbat_la = now(), schimbat_de = 'migrarea 40 (proprietar corectat)'
  where lower(btrim(nume)) = 'sincron' and proprietar <> 'Ștefan';

-- 3. Arhivează / scoate din arhivă ------------------------------------------------------------------

create or replace function public.prospectare_robot_arhiveaza(p_id uuid, p_arhivat boolean, p_autor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.prospectare_dispozitive%rowtype;
  v_cine text := left(coalesce(nullif(btrim(p_autor), ''), 'admin'), 200);
  v_eticheta text;
  v_firme integer := 0;
  v_nise integer := 0;
  v_lacat integer := 0;
  r record;
begin
  if p_arhivat is null then
    raise exception 'Spune dacă robotul se arhivează sau se scoate din arhivă.' using errcode = 'PR422';
  end if;
  select * into d from public.prospectare_dispozitive where id = p_id for update;
  if not found then
    raise exception 'Robotul nu mai există.' using errcode = 'PR404';
  end if;
  v_eticheta := coalesce(nullif(btrim(d.calculator), ''), d.nume);
  perform set_config('prospectare.autor', v_cine, true);

  if p_arhivat then
    if d.arhivat_la is not null then
      return jsonb_build_object('nume', d.nume, 'calculator', d.calculator, 'arhivat', true, 'deja', true, 'firme', 0, 'nise', 0, 'lacat', false);
    end if;
    -- Tokenul vechi nu mai merge: hash nou, al unui text pe care nu-l mai vede nimeni.
    update public.prospectare_dispozitive
      set arhivat_la = now(), arhivat_de = v_cine, activ = false,
          token_hash = encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'hex'),
          token_schimbat_la = now(), schimbat_la = now(), schimbat_de = v_cine
      where id = d.id
      returning * into d;
    -- Firmele lui: rezervarea expiră acum, așa că le ia primul terminal care cere (ca la o rezervare expirată).
    for r in
      select rz.firma_id, rz.sesiune, rz.tip_lucru from public.prospectare_rezervari rz
      where rz.dispozitiv_id = d.id and rz.expira_la > now()
      order by rz.firma_id
      for update
    loop
      update public.prospectare_rezervari set expira_la = now() where firma_id = r.firma_id;
      perform public.prospectare_noteaza(r.firma_id, 'rezervare', null, jsonb_build_object(
        'dispozitiv', d.id, 'sesiune', r.sesiune, 'tip_lucru', r.tip_lucru, 'eliberata', 'robot arhivat',
        'robot', v_eticheta, 'autor', v_cine));
      v_firme := v_firme + 1;
    end loop;
    -- Nișele lui se eliberează (ca „Eliberează” din admin).
    update public.prospectare_nise
      set status = 'libera', dispozitiv_id = null, sesiune = null, rezervata_la = null, semn_la = null, actualizat_la = now(),
          nota = left(concat_ws(E'\n', nota, format('Eliberată: robotul %s a fost arhivat de %s, %s', v_eticheta, v_cine,
            to_char(now() at time zone 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI'))), 1000)
      where dispozitiv_id = d.id and status in ('rezervata', 'in_cercetare');
    get diagnostics v_nise = row_count;
    update public.prospectare_lacate
      set dispozitiv_id = null, sesiune = null, luat_la = null, batut_la = null, actualizat_la = now()
      where dispozitiv_id = d.id;
    get diagnostics v_lacat = row_count;
  else
    if d.arhivat_la is null then
      return jsonb_build_object('nume', d.nume, 'calculator', d.calculator, 'arhivat', false, 'deja', true, 'firme', 0, 'nise', 0, 'lacat', false);
    end if;
    -- Înapoi în listă, dar oprit: pornește doar cu un token nou.
    update public.prospectare_dispozitive
      set arhivat_la = null, arhivat_de = null, activ = false, schimbat_la = now(), schimbat_de = v_cine
      where id = d.id
      returning * into d;
  end if;
  return jsonb_build_object('nume', d.nume, 'calculator', d.calculator, 'arhivat', d.arhivat_la is not null, 'deja', false,
    'firme', v_firme, 'nise', v_nise, 'lacat', v_lacat > 0);
end;
$$;

-- 4. Drepturi -------------------------------------------------------------------------------------

revoke all on function public.prospectare_robot_arhiveaza(uuid, boolean, text) from public;
revoke all on function public.prospectare_robot_arhiveaza(uuid, boolean, text) from anon, authenticated;
grant execute on function public.prospectare_robot_arhiveaza(uuid, boolean, text) to service_role;

-- Verificarea (toate rândurile trebuie să fie `true`).
select 'coloanele noi: calculator, arhivat_la, arhivat_de, token_schimbat_la' as verificare,
  (select count(*) = 4 from information_schema.columns where table_schema = 'public' and table_name = 'prospectare_dispozitive'
    and column_name in ('calculator', 'arhivat_la', 'arhivat_de', 'token_schimbat_la')) as ok
union all
select 'regula din bază: un robot arhivat nu poate fi activ',
  exists (select 1 from pg_constraint where conname = 'prospectare_dispozitive_arhivat_oprit')
  and not exists (select 1 from public.prospectare_dispozitive where arhivat_la is not null and activ)
union all
select 'proprietarii: „vladut 2” la Vlăduț, „sincron” la Ștefan (dacă există)',
  not exists (select 1 from public.prospectare_dispozitive where lower(btrim(nume)) = 'vladut 2' and proprietar <> 'Vlăduț')
  and not exists (select 1 from public.prospectare_dispozitive where lower(btrim(nume)) = 'sincron' and proprietar <> 'Ștefan')
union all
select format('roboții (niciunul șters): %s', coalesce((select string_agg(nume || ' = ' || proprietar
    || case when arhivat_la is not null then ', arhivat' when activ then ', activ' else ', oprit' end, '; ' order by creat_la)
    from public.prospectare_dispozitive), 'niciunul')),
  true
union all
select 'arhivarea doar pentru cheia de service',
  not has_function_privilege('authenticated', 'public.prospectare_robot_arhiveaza(uuid, boolean, text)', 'execute')
  and not has_function_privilege('anon', 'public.prospectare_robot_arhiveaza(uuid, boolean, text)', 'execute')
  and has_function_privilege('service_role', 'public.prospectare_robot_arhiveaza(uuid, boolean, text)', 'execute');
