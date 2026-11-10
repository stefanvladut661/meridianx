-- MERIDIAN Prospectare, migrarea 39: distribuirea manuală, listele de construcție, lacătul de publicare.
--
-- Modul de lucru nou: un calculator caută firme; omul le împarte în admin pe liste de construcție (câte una pe
-- terminal); fiecare terminal construiește local și la final publică („push”) prin /termina. Contactarea se
-- pornește manual, din tabelul Firme („Selectează” → „Distribuie”).
--
-- 1. Programarea automată se oprește: ciclul de la 00:00 nu mai programează nicio firmă, pe niciun canal, iar
--    completarea zilei (import, /termina, limitele din Setări) nu mai face nimic. Ce e programat pe email sau
--    WhatsApp și n-a plecat NU se mai eliberează la 00:00: rămâne pe contul lui și apare a doua zi ca restanță,
--    până pleacă sau până o scoate omul din coadă („Scoate din coadă”). Telefonul rămâne ca înainte (nesunatele
--    se întorc la 00:00, „Sună înapoi” trece pe azi); apelurile distribuite pe o zi intră în lista ei.
-- 2. Canalele se pot suspenda (Setări): un canal suspendat nu se poate distribui, /coada-email întoarce o listă
--    goală (emailul), iar firmele programate pe el așteaptă (nu se pierd). Emailul pornește suspendat:
--    „livrabilitate, reparăm”.
-- 3. „Distribuie”: firmele alese, pe un canal, pe conturile alese (împărțite egal sau câte firme pe cont), după
--    scor sau cele mai recente site-uri, pentru azi sau altă zi. Regulile se aplică singure (același canal nu se
--    folosește de două ori, „Nu contacta” / respinse / duplicate sărite, link demo verificat, mobil la WhatsApp),
--    iar limita zilnică a unui cont e doar avertisment. Proba (p_proba) întoarce rezumatul fără să scrie.
-- 4. Șablonul WhatsApp: titularul contului ({nume_titular}); conturile 1–3 sunt ale lui Ștefan, Vlăduț și Vlad.
-- 5. Listele de construcție: `alocat_lui` (terminalul care construiește firma); /lista-mea întoarce lista unui
--    terminal; /rezerva nu mai dă unui terminal firmele alocate altuia.
-- 6. Lacătul de publicare: un singur calculator publică odată; expiră după 30 de minute fără „bate”.
-- 7. Corecturile din 9 nov: nicio migrare nu schimbă `nr` sau `nr_site` (verificat la final); /termina copiază
--    mobilul, „doar WhatsApp”, problema site-ului și cele 3 schimbări; importul nu mai strică telefonul și nu
--    mai sare o firmă nouă al cărei număr e deja luat; „A răspuns” din fișa firmei.
--
-- Doar cheia de service. Cere migrările 28–38. Se poate rula de mai multe ori.

-- 0. Numerele de dinainte (verificarea de la final: nicio migrare nu le schimbă) ----------------------------

drop table if exists pg_temp.m39_numere;
create temp table m39_numere as select id, nr, nr_site from public.prospectare_firme;

-- 1. Coloanele noi -----------------------------------------------------------------------------------------

alter table public.prospectare_firme add column if not exists alocat_lui text;
alter table public.prospectare_firme add column if not exists alocat_la timestamptz;
alter table public.prospectare_firme add column if not exists alocat_de text;
alter table public.prospectare_conturi_whatsapp add column if not exists titular text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prospectare_firme_alocat_lui') then
    alter table public.prospectare_firme add constraint prospectare_firme_alocat_lui check (alocat_lui is null or alocat_lui ~ '^[A-Za-z0-9._-]{1,40}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prospectare_firme_alocat_de') then
    alter table public.prospectare_firme add constraint prospectare_firme_alocat_de check (alocat_de is null or char_length(alocat_de) <= 200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prospectare_conturi_whatsapp_titular') then
    alter table public.prospectare_conturi_whatsapp add constraint prospectare_conturi_whatsapp_titular check (titular is null or char_length(titular) between 1 and 60);
  end if;
end;
$$;
create index if not exists prospectare_firme_alocat_idx on public.prospectare_firme (alocat_lui, scor desc nulls last) where alocat_lui is not null;

-- Titularii conturilor (o singură dată: un titular schimbat din Setări rămâne).
update public.prospectare_conturi_whatsapp
  set titular = case nume when 'Cont 1' then 'Ștefan' when 'Cont 2' then 'Vlăduț' when 'Cont 3' then 'Vlad' end
  where titular is null and nume in ('Cont 1', 'Cont 2', 'Cont 3');

alter table public.prospectare_activitate drop constraint if exists prospectare_activitate_tip_check;
alter table public.prospectare_activitate add constraint prospectare_activitate_tip_check check (tip in (
  'creata', 'etapa', 'canal', 'apel', 'whatsapp', 'email', 'bounce', 'raspuns',
  'site', 'rezervare', 'nota', 'lista', 'import', 'cercetare', 'sistem', 'recontactare', 'evaluare', 'programare', 'alocare'
));

-- 2. Canalele: activ sau suspendat ----------------------------------------------------------------------

create table if not exists public.prospectare_canale (
  canal text primary key check (canal in ('email', 'whatsapp', 'telefon')),
  activ boolean not null default true,
  motiv text check (motiv is null or char_length(motiv) <= 300),
  schimbat_la timestamptz not null default now(),
  schimbat_de text check (schimbat_de is null or char_length(schimbat_de) <= 200)
);
alter table public.prospectare_canale enable row level security;
drop policy if exists prospectare_canale_admin_read on public.prospectare_canale;
create policy prospectare_canale_admin_read on public.prospectare_canale for select to authenticated using (public.is_lead_admin());
revoke all on public.prospectare_canale from anon;
-- Emailul pornește suspendat (o singură dată: la o rulare din nou, starea din Setări rămâne).
insert into public.prospectare_canale (canal, activ, motiv, schimbat_de) values
  ('email', false, 'livrabilitate, reparăm', 'migrarea 39'),
  ('whatsapp', true, null, 'migrarea 39'),
  ('telefon', true, null, 'migrarea 39')
on conflict (canal) do nothing;

create or replace function public.prospectare_canal_activ(p_canal text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select activ from public.prospectare_canale where canal = p_canal), true)
$$;

-- „Emailul e suspendat (livrabilitate, reparăm)”, pentru mesajele de refuz.
create or replace function public.prospectare_canal_suspendat_text(p_canal text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select format('%s e suspendat din Setări%s', case p_canal when 'email' then 'Emailul' when 'whatsapp' then 'WhatsApp-ul' else 'Telefonul' end,
    coalesce(' (' || nullif(btrim(c.motiv), '') || ')', ''))
  from public.prospectare_canale c where c.canal = p_canal
$$;

create or replace function public.prospectare_seteaza_canal(p_canal text, p_activ boolean, p_motiv text, p_autor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.prospectare_canale%rowtype;
begin
  if p_canal not in ('email', 'whatsapp', 'telefon') then
    raise exception 'Canal necunoscut: %.', p_canal using errcode = 'PR422';
  end if;
  if p_activ is null then
    raise exception 'Alege Activ sau Suspendat.' using errcode = 'PR422';
  end if;
  insert into public.prospectare_canale (canal, activ, motiv, schimbat_la, schimbat_de)
  values (p_canal, p_activ, case when p_activ then null else nullif(left(btrim(coalesce(p_motiv, '')), 300), '') end, now(), left(coalesce(nullif(btrim(p_autor), ''), 'admin'), 200))
  on conflict (canal) do update
    set activ = excluded.activ, motiv = excluded.motiv, schimbat_la = excluded.schimbat_la, schimbat_de = excluded.schimbat_de
  returning * into c;
  return to_jsonb(c);
end;
$$;

-- 3. Programarea automată se oprește -----------------------------------------------------------------------

-- Completarea zilei (import, /termina, limitele din Setări) nu mai programează nimic.
drop trigger if exists prospectare_conturi_whatsapp_completeaza on public.prospectare_conturi_whatsapp;
drop trigger if exists prospectare_conturi_whatsapp_completeaza_nou on public.prospectare_conturi_whatsapp;
drop trigger if exists prospectare_casute_completeaza on public.prospectare_casute;
drop trigger if exists prospectare_casute_completeaza_nou on public.prospectare_casute;
drop trigger if exists prospectare_setari_completeaza on public.prospectare_setari;
drop function if exists public.prospectare_limite_completeaza();

create or replace function public.prospectare_umple_zi(p_zi date, p_autor text)
returns jsonb
language sql
stable
as $$
  -- Din migrarea 39 nu se mai programează nimic automat: firmele se distribuie din tabelul Firme.
  select jsonb_build_object('email', 0, 'whatsapp', 0)
$$;

create or replace function public.prospectare_completeaza_azi(p_motiv text default null)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object('email', 0, 'whatsapp', 0, 'zi', public.prospectare_azi(), 'automat', false)
$$;

-- Ciclul de la 00:00: doar telefonul (nesunatele se întorc, „Sună înapoi” trece pe azi, apelurile distribuite
-- pe ziua asta intră în liste). Emailul și WhatsApp-ul nu se programează și nu se eliberează: restanțele rămân.
create or replace function public.prospectare_ciclu_zi(p_zi date default null, p_fortat boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zi date := coalesce(p_zi, public.prospectare_azi());
  v_rez jsonb;
  r record;
  v_el_tel integer := 0;
  v_man_tel integer := 0;
  v_anulate integer := 0;
  v_suna_inapoi integer := 0;
  v_rest_email integer := 0;
  v_rest_wa integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('prospectare_ciclu_zi'));
  if not p_fortat then
    select rezultat into v_rez from public.prospectare_cicluri where zi = v_zi;
    if found then
      return v_rez;
    end if;
  end if;
  perform set_config('prospectare.autor', 'ciclul de la 00:00', true);

  -- a) Telefonul, ca înainte: apelurile nesunate se întorc în rezervă.
  for r in
    select l.id, l.firma_id from public.prospectare_liste_zi l
    where l.data < v_zi and l.rezultat is null and l.canal = 'telefon'
    for update skip locked
  loop
    perform set_config('prospectare.reseteaza_canal', 'telefon', true);
    perform set_config('prospectare.motiv', 'Nesunată până la 00:00: înapoi în rezervă', true);
    update public.prospectare_firme
      set telefon_la = null, etapa = case when etapa = 'sunat' then 'site_gata' else etapa end
      where id = r.firma_id and telefon_la is not null;
    perform set_config('prospectare.reseteaza_canal', '', true);
    perform set_config('prospectare.motiv', '', true);
    delete from public.prospectare_liste_zi where id = r.id;
    v_el_tel := v_el_tel + 1;
  end loop;

  -- „Sună înapoi” rămâne pe telefon: trece în lista zilei.
  update public.prospectare_liste_zi l set data = v_zi, actualizat_la = now()
    where l.data < v_zi and l.rezultat = 'suna_inapoi'
      and not exists (select 1 from public.prospectare_liste_zi t where t.firma_id = l.firma_id and t.data = v_zi);
  get diagnostics v_suna_inapoi = row_count;

  -- b) Apelurile distribuite pe ziua asta (sau rămase din zilele trecute) intră în lista omului ales.
  for r in
    select p.*, f2 as firma from public.prospectare_programari p join public.prospectare_firme f2 on f2.id = p.firma_id
    where p.zi <= v_zi and p.stare = 'programata' and p.canal = 'telefon'
    order by p.zi, p.id
    for update of p
  loop
    if not public.prospectare_poate_canal_in(r.firma, 'telefon', v_zi) then
      update public.prospectare_programari set stare = 'anulata', inchis_la = now(),
        motiv = 'nu mai poate merge pe telefon: ' || coalesce(public.prospectare_motiv_canal_in(r.firma, 'telefon', v_zi), '—')
        where id = r.id;
      v_anulate := v_anulate + 1;
      continue;
    end if;
    update public.prospectare_programari set stare = 'folosita', inchis_la = now(), motiv = 'pusă în lista de apeluri' where id = r.id;
    perform set_config('prospectare.motiv', 'Distribuită în lista de apeluri', true);
    update public.prospectare_firme set telefon_la = now() where id = r.firma_id;
    insert into public.prospectare_liste_zi (data, utilizator, canal, firma_id) values (v_zi, r.utilizator, 'telefon', r.firma_id)
      on conflict (firma_id, data) do nothing;
    v_man_tel := v_man_tel + 1;
  end loop;

  -- c) Emailul și WhatsApp-ul: nimic automat. Ce n-a plecat rămâne pe contul lui (restanță).
  select count(*) filter (where canal = 'email'), count(*) filter (where canal = 'whatsapp')
    into v_rest_email, v_rest_wa
    from public.prospectare_programari where zi < v_zi and stare = 'programata';

  v_rez := jsonb_build_object(
    'zi', v_zi,
    'rulat_la', now(),
    'automat', false,
    'eliberate', jsonb_build_object('email', 0, 'whatsapp', 0, 'telefon', v_el_tel),
    'programate', jsonb_build_object(
      'email', jsonb_build_object('manual', 0, 'automat', 0),
      'whatsapp', jsonb_build_object('manual', 0, 'automat', 0),
      'telefon', jsonb_build_object('manual', v_man_tel)),
    'mutate', 0,
    'anulate', v_anulate,
    'suna_inapoi', v_suna_inapoi,
    'rezerva', 0,
    'restante', jsonb_build_object('email', v_rest_email, 'whatsapp', v_rest_wa)
  );
  insert into public.prospectare_cicluri (zi, rulat_la, rezultat) values (v_zi, now(), v_rez)
    on conflict (zi) do update set rulat_la = excluded.rulat_la, rezultat = excluded.rezultat
    returning rezultat into v_rez;
  return v_rez;
end;
$$;

-- 4. Restanțele: programările netrimise rămân până pleacă sau până le scoate omul ------------------------

create or replace function public.prospectare_scoate_din_coada(p_ids bigint[], p_autor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_autor text := left(coalesce(nullif(btrim(p_autor), ''), 'admin'), 200);
  v_scoase integer := 0;
  r record;
begin
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 1000 then
    raise exception 'Alege între 1 și 1000 de programări.' using errcode = 'PR422';
  end if;
  perform set_config('prospectare.autor', v_autor, true);
  for r in
    update public.prospectare_programari
      set stare = 'anulata', inchis_la = now(), motiv = 'scoasă din coadă de ' || v_autor
      where id = any(p_ids) and stare = 'programata'
      returning firma_id, canal, zi
  loop
    perform public.prospectare_noteaza(r.firma_id, 'programare', r.canal,
      jsonb_build_object('canal', r.canal, 'zi', r.zi, 'scoasa_din_coada', true));
    v_scoase := v_scoase + 1;
  end loop;
  return jsonb_build_object('scoase', v_scoase, 'refuzate', cardinality(p_ids) - v_scoase);
end;
$$;

-- WhatsApp: se trimite ce e programat azi sau mai demult (restanțele), de pe contul programării.
create or replace function public.prospectare_whatsapp_trimis(p_firma uuid, p_cont smallint, p_autor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.prospectare_firme%rowtype;
  k public.prospectare_conturi_whatsapp%rowtype;
  p public.prospectare_programari%rowtype;
  v_alta record;
  v_trimise integer;
  v_autor text := coalesce(nullif(btrim(p_autor), ''), 'admin');
begin
  perform public.prospectare_asigura_ciclu();
  if not public.prospectare_canal_activ('whatsapp') then
    raise exception '%: nu se trimite.', public.prospectare_canal_suspendat_text('whatsapp') using errcode = 'PR409';
  end if;
  select * into f from public.prospectare_firme where id = p_firma for update;
  if not found then
    raise exception 'Firma nu există.' using errcode = 'PR404';
  end if;
  if f.etapa = 'nu_contacta' then
    raise exception 'Firma #% e „Nu contacta”: nu mai primește niciun mesaj.', f.nr using errcode = 'PR410';
  end if;
  if f.whatsapp_la is not null then
    raise exception 'Firma #% a primit deja WhatsApp (%, contul %): nu-i trimite încă o dată.', f.nr,
      to_char(f.whatsapp_la at time zone 'Europe/Bucharest', 'DD.MM HH24:MI'), coalesce(f.whatsapp_cont::text, '—') using errcode = 'PR409';
  end if;
  if f.telefon_la is not null and f.canal_permis is distinct from 'whatsapp' then
    raise exception 'Firma #% e pe telefon: WhatsApp-ul se permite doar din fișa firmei.', f.nr using errcode = 'PR409';
  end if;
  if f.email_la >= public.prospectare_inceput_azi() and f.canal_permis is distinct from 'whatsapp' then
    raise exception 'Firma #% a primit email azi: WhatsApp-ul pleacă de mâine.', f.nr using errcode = 'PR409';
  end if;
  if not public.prospectare_poate_canal(f, 'whatsapp') then
    raise exception 'Firma #% nu poate primi WhatsApp: %.', f.nr, public.prospectare_motiv_canal(f, 'whatsapp') using errcode = 'PR422';
  end if;
  select * into p from public.prospectare_programari
    where firma_id = f.id and stare = 'programata' and canal = 'whatsapp' and zi <= public.prospectare_azi()
    order by zi, id limit 1
    for update;
  if not found then
    select canal, zi into v_alta from public.prospectare_programari where firma_id = f.id and stare = 'programata';
    if found then
      raise exception 'Firma #% e programată pe % (%), nu pe WhatsApp azi.', f.nr,
        case v_alta.canal when 'email' then 'email' when 'whatsapp' then 'WhatsApp' else 'apeluri' end, to_char(v_alta.zi, 'DD.MM') using errcode = 'PR409';
    end if;
    raise exception 'Firma #% nu e programată azi pe WhatsApp.', f.nr using errcode = 'PR409';
  end if;
  select * into k from public.prospectare_conturi_whatsapp where id = coalesce(p_cont, p.cont_whatsapp);
  if not found then
    raise exception 'Contul WhatsApp % nu există: alege un cont din Setări.', coalesce(p_cont, p.cont_whatsapp) using errcode = 'PR422';
  end if;
  if not k.activ then
    raise exception '„%” e dezactivat în Setări.', k.nume using errcode = 'PR422';
  end if;

  update public.prospectare_programari set stare = 'folosita', inchis_la = now(), cont_whatsapp = k.id, motiv = left('trimis de ' || v_autor, 500)
    where id = p.id;
  perform set_config('prospectare.autor', v_autor, true);
  perform set_config('prospectare.motiv', format('WhatsApp de pe %s (%s)', k.nume, k.telefon), true);
  update public.prospectare_firme
    set whatsapp_la = now(), whatsapp_cont = k.id,
        etapa = case when etapa in ('site_gata', 'email_trimis') then 'whatsapp_trimis' else etapa end
    where id = f.id;
  perform public.prospectare_noteaza(f.id, 'whatsapp', 'whatsapp', jsonb_strip_nulls(jsonb_build_object('cont', k.id, 'cont_nume', k.nume,
    'titular', k.titular, 'trimis_de', v_autor, 'restanta_din', case when p.zi < public.prospectare_azi() then p.zi end)));

  select count(*) into v_trimise from public.prospectare_firme
    where whatsapp_cont = k.id and whatsapp_la >= public.prospectare_inceput_azi();
  -- Limita contului e doar avertisment: mesajul a plecat oricum.
  return jsonb_build_object('nr', f.nr, 'cont', k.id, 'cont_nume', k.nume, 'trimise_azi', v_trimise, 'limita', k.limita_zi, 'peste_limita', v_trimise > k.limita_zi);
end;
$$;

-- „Anulează” după „Trimite pe WhatsApp”: programarea (și o restanță) se întoarce în coadă, cu ziua ei.
create or replace function public.prospectare_whatsapp_anuleaza(p_firma uuid, p_autor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.prospectare_firme%rowtype;
  p public.prospectare_programari%rowtype;
  v_cont smallint;
  v_trimise integer;
begin
  select * into f from public.prospectare_firme where id = p_firma for update;
  if not found then
    raise exception 'Firma nu există.' using errcode = 'PR404';
  end if;
  if f.whatsapp_la is null then
    raise exception 'Firma #% n-are WhatsApp trimis: nu e nimic de anulat.', f.nr using errcode = 'PR409';
  end if;
  if f.whatsapp_la < now() - interval '2 minutes' then
    raise exception 'WhatsApp-ul către #% a plecat la %: anularea merge doar în primele 2 minute.', f.nr,
      to_char(f.whatsapp_la at time zone 'Europe/Bucharest', 'HH24:MI') using errcode = 'PR409';
  end if;
  v_cont := f.whatsapp_cont;
  select * into p from public.prospectare_programari
    where firma_id = f.id and canal = 'whatsapp' and stare = 'folosita' and inchis_la >= now() - interval '10 minutes'
    order by inchis_la desc limit 1 for update;

  perform set_config('prospectare.autor', coalesce(nullif(btrim(p_autor), ''), 'admin'), true);
  perform set_config('prospectare.motiv', 'WhatsApp anulat imediat după trimitere', true);
  perform set_config('prospectare.reseteaza_canal', 'whatsapp', true);
  update public.prospectare_firme
    set whatsapp_la = null, whatsapp_cont = null,
        etapa = case when etapa = 'whatsapp_trimis' then case when email_la is not null then 'email_trimis' else 'site_gata' end else etapa end,
        canal_permis = case when telefon_la is not null or email_la >= public.prospectare_inceput_azi() then 'whatsapp' else canal_permis end,
        canal_permis_motiv = case when telefon_la is not null or email_la >= public.prospectare_inceput_azi() then 'restabilită după anularea WhatsApp-ului' else canal_permis_motiv end,
        canal_permis_la = case when telefon_la is not null or email_la >= public.prospectare_inceput_azi() then now() else canal_permis_la end,
        canal_permis_de = case when telefon_la is not null or email_la >= public.prospectare_inceput_azi() then coalesce(nullif(btrim(p_autor), ''), 'admin') else canal_permis_de end
    where id = f.id;
  perform set_config('prospectare.reseteaza_canal', '', true);
  if p.id is not null then
    update public.prospectare_programari set stare = 'programata', inchis_la = null, motiv = 'trimiterea a fost anulată' where id = p.id;
  end if;
  perform public.prospectare_noteaza(f.id, 'whatsapp', 'whatsapp', jsonb_build_object('anulat', true, 'cont', v_cont));
  select count(*) into v_trimise from public.prospectare_firme where whatsapp_cont = v_cont and whatsapp_la >= public.prospectare_inceput_azi();
  return jsonb_build_object('nr', f.nr, 'cont', v_cont, 'trimise_azi', v_trimise, 'reprogramata', p.id is not null);
end;
$$;

-- Emailul: doar cu canalul activ; programările de azi și restanțele, de pe căsuța lor.
create or replace function public.prospectare_email_cere_canal(
  p_dispozitiv uuid,
  p_domeniu text,
  p_nr integer,
  p_casuta text,
  p_limita integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.prospectare_firme%rowtype;
  c public.prospectare_casute%rowtype;
  z public.prospectare_casute_zi%rowtype;
  p public.prospectare_programari%rowtype;
  v_limita integer;
  v_nume text;
  v_alta record;
begin
  perform public.prospectare_asigura_ciclu();
  if not public.prospectare_canal_activ('email') then
    raise exception '%: nu trimiți.', public.prospectare_canal_suspendat_text('email') using errcode = 'PR409';
  end if;
  select nume into v_nume from public.prospectare_dispozitive where id = p_dispozitiv;
  perform set_config('prospectare.autor', coalesce(v_nume, 'robot'), true);
  f := public.prospectare_gaseste_firma(p_domeniu, p_nr);

  if f.etapa in ('nu_contacta', 'client') or (f.etapa = 'respins' and f.canal_permis is distinct from 'email') then
    raise exception 'Firma #% e „%”: nu se trimite email.', f.nr, f.etapa using errcode = 'PR410';
  end if;
  if f.email_la is not null then
    raise exception 'Firma #% a primit deja email (%): același canal nu se folosește de două ori.', f.nr,
      to_char(f.email_la at time zone 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI') using errcode = 'PR409';
  end if;
  if f.telefon_la is not null and f.canal_permis is distinct from 'email' then
    raise exception 'Firma #% e pe telefon: emailul nu se trimite.', f.nr using errcode = 'PR409';
  end if;
  if f.whatsapp_la >= public.prospectare_inceput_azi() and f.canal_permis is distinct from 'email' then
    raise exception 'Firma #% a primit WhatsApp azi: emailul pleacă de mâine.', f.nr using errcode = 'PR409';
  end if;
  if f.email is null then
    raise exception 'Firma #% nu are adresă de email.', f.nr using errcode = 'PR422';
  end if;
  if f.link_demo is null or (f.etapa not in ('site_gata', 'whatsapp_trimis') and f.canal_permis is distinct from 'email') then
    raise exception 'Firma #% nu are încă site demo gata, cu link: emailul nu se trimite.', f.nr using errcode = 'PR422';
  end if;

  select * into p from public.prospectare_programari
    where firma_id = f.id and stare = 'programata' and canal = 'email' and zi <= public.prospectare_azi()
    order by zi, id limit 1
    for update;
  if not found then
    select canal, zi into v_alta from public.prospectare_programari where firma_id = f.id and stare = 'programata';
    if found then
      raise exception 'Firma #% e programată pe % (%), nu pe email azi: nu trimiți.', f.nr,
        case v_alta.canal when 'email' then 'email' when 'whatsapp' then 'WhatsApp' else 'apeluri' end, to_char(v_alta.zi, 'DD.MM') using errcode = 'PR409';
    end if;
    raise exception 'Firma #% nu e programată azi pe email: robotul trimite doar ce primește din /coada-email.', f.nr using errcode = 'PR409';
  end if;
  if lower(btrim(coalesce(p_casuta, ''))) <> p.casuta then
    raise exception 'Firma #% e programată pe căsuța %, nu pe %.', f.nr, p.casuta, lower(btrim(coalesce(p_casuta, ''))) using errcode = 'PR409';
  end if;

  z := public.prospectare_casuta_azi(p_casuta, p_limita);
  select * into c from public.prospectare_casute where adresa = z.adresa;
  if not c.activa then
    raise exception 'Căsuța % e oprită din admin.', c.adresa using errcode = 'PR429';
  end if;
  v_limita := coalesce(c.limita_zi, z.limita);
  if v_limita is not null and z.trimise >= v_limita then
    raise exception 'Căsuța % și-a atins limita de azi (%/%).', c.adresa, z.trimise, v_limita using errcode = 'PR429';
  end if;

  update public.prospectare_programari set stare = 'folosita', inchis_la = now(), motiv = 'emailul cerut de ' || coalesce(v_nume, 'robot') where id = p.id;
  perform set_config('prospectare.motiv', format('Robotul a cerut canalul email (căsuța %s)', c.adresa), true);
  update public.prospectare_firme set email_la = now() where id = f.id returning * into f;

  return jsonb_build_object(
    'trimite', true,
    'firma', jsonb_build_object('id', f.id, 'nr', f.nr, 'nume', f.nume, 'domeniu', f.domeniu, 'email', f.email,
      'persoana_contact', f.persoana_contact, 'link_demo', f.link_demo, 'etapa', f.etapa),
    'casuta', jsonb_build_object('adresa', c.adresa, 'trimise_azi', z.trimise, 'limita_azi', v_limita)
  );
end;
$$;

-- /coada-email: azi și restanțele; listă goală cât emailul e suspendat.
create or replace function public.prospectare_coada_email(p_dispozitiv uuid, p_casuta text default null, p_sesiune text default '1')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zi date;
  v_cas text := nullif(lower(btrim(coalesce(p_casuta, ''))), '');
  v_activ boolean := public.prospectare_canal_activ('email');
begin
  perform public.prospectare_asigura_ciclu();
  v_zi := public.prospectare_azi();
  if p_dispozitiv is not null then
    perform public.prospectare_robot_ce_face(p_dispozitiv, 'trimitere',
      case when v_activ then coalesce('coada de email: ' || v_cas, 'coada de email') else 'coada de email: emailul e suspendat' end, p_sesiune);
  end if;
  return jsonb_build_object(
    'zi', v_zi,
    'suspendat', not v_activ,
    'motiv', case when not v_activ then (select motiv from public.prospectare_canale where canal = 'email') end,
    'firme', case when not v_activ then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('programare_id', p.id, 'firma_id', x.id, 'nr', x.nr, 'nr_site', x.nr_site, 'nume', x.nume, 'domeniu', x.domeniu,
          'email', x.email, 'persoana_contact', x.persoana_contact, 'link_demo', x.link_demo, 'oras', x.oras, 'nisa', x.nisa,
          'casuta', p.casuta, 'sursa', p.sursa, 'zi', p.zi, 'restanta', p.zi < v_zi) order by p.zi, p.casuta, x.nr_site nulls last, p.id)
      from public.prospectare_programari p join public.prospectare_firme x on x.id = p.firma_id
      where p.zi <= v_zi and p.canal = 'email' and p.stare = 'programata' and (v_cas is null or p.casuta = v_cas)), '[]'::jsonb) end,
    'casute', coalesce((
      select jsonb_agg(jsonb_build_object('adresa', c.adresa, 'activa', c.activa, 'limita', public.prospectare_limita_casuta(c),
          'programate', case when v_activ then (select count(*) from public.prospectare_programari p where p.zi <= v_zi and p.canal = 'email' and p.casuta = c.adresa and p.stare = 'programata') else 0 end,
          'trimise', (select count(*) from public.prospectare_programari p where p.zi = v_zi and p.canal = 'email' and p.casuta = c.adresa and p.stare = 'folosita'))
        order by c.adresa)
      from public.prospectare_casute c where v_cas is null or c.adresa = v_cas), '[]'::jsonb)
  );
end;
$$;

create or replace function public.prospectare_whatsapp_coada(p_limit integer default 200, p_offset integer default 0)
returns setof public.prospectare_firme
language sql
stable
security definer
set search_path = public
as $$
  select f.*
  from public.prospectare_programari p join public.prospectare_firme f on f.id = p.firma_id
  where p.zi <= public.prospectare_azi() and p.canal = 'whatsapp' and p.stare = 'programata'
  order by p.zi, p.cont_whatsapp, f.nr_site nulls last, p.id
  limit least(greatest(coalesce(p_limit, 200), 1), 1000)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

create or replace function public.prospectare_rezumat_distributie()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_azi date;
  v_maine date;
  v_ciclu jsonb;
  v_plafon integer;
begin
  v_ciclu := public.prospectare_asigura_ciclu();
  v_azi := public.prospectare_azi();
  v_maine := v_azi + 1;
  select email_plafon_casuta into v_plafon from public.prospectare_setari where id = 1;
  return jsonb_build_object(
    'azi', v_azi,
    'maine', v_maine,
    'ciclu', v_ciclu,
    'automat', false,
    'programate_azi', (select jsonb_build_object(
        'email', count(*) filter (where canal = 'email'),
        'whatsapp', count(*) filter (where canal = 'whatsapp'),
        'telefon', count(*) filter (where canal = 'telefon'),
        'email_ramase', count(*) filter (where canal = 'email' and stare = 'programata'),
        'whatsapp_ramase', count(*) filter (where canal = 'whatsapp' and stare = 'programata'))
      from public.prospectare_programari where zi = v_azi and stare in ('programata', 'folosita')),
    'restante', (select jsonb_build_object(
        'email', count(*) filter (where canal = 'email'),
        'whatsapp', count(*) filter (where canal = 'whatsapp'),
        'cea_mai_veche', min(zi))
      from public.prospectare_programari where zi < v_azi and stare = 'programata' and canal in ('email', 'whatsapp')),
    'canale', (select coalesce(jsonb_object_agg(canal, jsonb_build_object('activ', activ, 'motiv', motiv)), '{}'::jsonb) from public.prospectare_canale),
    'apeluri_azi', (select jsonb_build_object('total', count(*), 'sunate', count(*) filter (where rezultat is not null))
      from public.prospectare_liste_zi where data = v_azi and canal = 'telefon'),
    'programate_maine', (select jsonb_build_object(
        'email', count(*) filter (where canal = 'email'),
        'whatsapp', count(*) filter (where canal = 'whatsapp'),
        'telefon', count(*) filter (where canal = 'telefon'))
      from public.prospectare_programari where zi = v_maine and stare = 'programata'),
    'capacitate', jsonb_build_object(
      'email', (select coalesce(sum(public.prospectare_limita_casuta(c)), 0) from public.prospectare_casute c where c.activa),
      'whatsapp', (select coalesce(sum(limita_zi), 0) from public.prospectare_conturi_whatsapp where activ),
      'telefon', (select apeluri_pe_zi from public.prospectare_setari where id = 1),
      'plafon_casuta', v_plafon),
    'rezerva', (select jsonb_build_object(
        'total', count(*) filter (where pe_email or pe_whatsapp or pe_telefon),
        'email', count(*) filter (where pe_email),
        'whatsapp', count(*) filter (where pe_whatsapp),
        'telefon', count(*) filter (where pe_telefon))
      from (
        select public.prospectare_poate_canal(x, 'email') as pe_email, public.prospectare_poate_canal(x, 'whatsapp') as pe_whatsapp,
          public.prospectare_poate_canal(x, 'telefon') and not exists (select 1 from public.prospectare_liste_zi l where l.firma_id = x.id and l.data = v_azi) as pe_telefon
        from public.prospectare_firme x
        where not exists (select 1 from public.prospectare_programari p where p.firma_id = x.id and p.stare = 'programata')
      ) s),
    'intoarse_la_00', coalesce(v_ciclu -> 'eliberate', '{}'::jsonb)
  );
end;
$$;

-- 5. „Distribuie”: firmele alese, pe un canal, pe conturile alese ------------------------------------------

-- p_conturi: cheile conturilor alese, în ordine — WhatsApp: numărul contului („1”, „2”); email: adresa căsuței;
-- apel: „stefan” / „vladut”. p_numere: null = împarte egal; altfel câte firme pe fiecare cont (aceeași ordine),
-- cu suma egală cu numărul de firme alese. p_ordine: „scor” (implicit) sau „recente” (nr_site descrescător).
-- Primul cont primește primele firme din ordinea aleasă, al doilea următoarele etc. Emailul pleacă mereu de pe
-- căsuța domeniului din linkul demo (dacă e printre cele alese). p_alocari: { "<firma_id>": "<cheie cont>" }
-- (opțiunile avansate). p_proba = true: doar rezumatul, nimic scris.
create or replace function public.prospectare_distribuie(
  p_canal text,
  p_zi date,
  p_firme uuid[],
  p_conturi text[],
  p_numere integer[] default null,
  p_ordine text default 'scor',
  p_alocari jsonb default '{}'::jsonb,
  p_proba boolean default true,
  p_autor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_azi date := public.prospectare_azi();
  v_zi date := coalesce(p_zi, public.prospectare_azi());
  v_autor text := left(coalesce(nullif(btrim(p_autor), ''), 'admin'), 200);
  v_firme uuid[];
  v_n integer;
  v_k integer;
  v_chei text[] := '{}';
  v_nume text[] := '{}';
  v_limite integer[] := '{}';
  v_deja integer[] := '{}';
  v_cnt integer[];
  v_quota integer[];
  v_cheie text;
  v_i integer;
  v_j integer;
  v_suma integer;
  v_alocari jsonb := case when jsonb_typeof(p_alocari) = 'object' then p_alocari else '{}'::jsonb end;
  f public.prospectare_firme%rowtype;
  v_activa record;
  v_motiv text;
  v_elig jsonb := '[]'::jsonb;
  v_rest jsonb := '[]'::jsonb;
  v_plan jsonb := '[]'::jsonb;
  v_sarite jsonb := '[]'::jsonb;
  v_av jsonb := '[]'::jsonb;
  v_pe jsonb := '[]'::jsonb;
  e jsonb;
  v_cont text;
  v_casuta public.prospectare_casute%rowtype;
  v_cont_wa public.prospectare_conturi_whatsapp%rowtype;
  v_apeluri integer;
  v_programate integer := 0;
  v_id uuid;
begin
  if p_canal is null or p_canal not in ('email', 'whatsapp', 'telefon') then
    raise exception 'Alege canalul: WhatsApp, email sau apel.' using errcode = 'PR422';
  end if;
  if not public.prospectare_canal_activ(p_canal) then
    raise exception '%: nu se distribuie.', public.prospectare_canal_suspendat_text(p_canal) using errcode = 'PR409';
  end if;
  if v_zi < v_azi then
    raise exception 'Ziua: azi (%) sau mai târziu.', to_char(v_azi, 'DD.MM.YYYY') using errcode = 'PR422';
  end if;
  if v_zi > v_azi + 60 then
    raise exception 'Distribuirea merge cel mult 60 de zile înainte.' using errcode = 'PR422';
  end if;
  if coalesce(p_ordine, 'scor') not in ('scor', 'recente') then
    raise exception 'Ordinea: „scor” sau „recente”.' using errcode = 'PR422';
  end if;
  select array_agg(distinct x) into v_firme from unnest(coalesce(p_firme, '{}'::uuid[])) x where x is not null;
  v_n := coalesce(cardinality(v_firme), 0);
  if v_n = 0 or v_n > 5000 then
    raise exception 'Alege între 1 și 5000 de firme.' using errcode = 'PR422';
  end if;

  -- Conturile alese, în ordinea lor: numele, limita zilei și ce au deja programat în ziua aleasă.
  select apeluri_pe_zi into v_apeluri from public.prospectare_setari where id = 1;
  foreach v_cheie in array coalesce(p_conturi, '{}'::text[]) loop
    v_cheie := btrim(coalesce(v_cheie, ''));
    if p_canal = 'email' then
      v_cheie := lower(v_cheie);
    end if;
    continue when v_cheie = '' or v_cheie = any(v_chei);
    if p_canal = 'whatsapp' then
      select * into v_cont_wa from public.prospectare_conturi_whatsapp where v_cheie ~ '^\d{1,2}$' and id = v_cheie::smallint;
      if not found or not v_cont_wa.activ then
        raise exception 'Contul WhatsApp % nu există sau e dezactivat în Setări.', v_cheie using errcode = 'PR422';
      end if;
      v_nume := v_nume || v_cont_wa.nume;
      v_limite := v_limite || v_cont_wa.limita_zi::integer;
    elsif p_canal = 'email' then
      select * into v_casuta from public.prospectare_casute where adresa = v_cheie;
      if not found or not v_casuta.activa then
        raise exception 'Căsuța % nu există sau e oprită.', v_cheie using errcode = 'PR422';
      end if;
      v_nume := v_nume || v_casuta.adresa;
      v_limite := v_limite || public.prospectare_limita_casuta(v_casuta);
    else
      if v_cheie not in ('stefan', 'vladut') then
        raise exception 'Cine sună: Ștefan sau Vlăduț.' using errcode = 'PR422';
      end if;
      v_nume := v_nume || case v_cheie when 'stefan' then 'Ștefan' else 'Vlăduț' end;
      v_limite := v_limite || coalesce(v_apeluri, 20);
    end if;
    v_chei := v_chei || v_cheie;
    v_deja := v_deja || public.prospectare_ocupate(p_canal, v_zi, v_cheie);
  end loop;
  v_k := cardinality(v_chei);
  if v_k = 0 then
    raise exception 'Alege cel puțin un cont.' using errcode = 'PR422';
  end if;
  if p_numere is not null then
    if cardinality(p_numere) <> v_k or exists (select 1 from unnest(p_numere) x where x is null or x < 0) then
      raise exception 'Scrie câte firme merg pe fiecare cont ales (numere de la 0 în sus).' using errcode = 'PR422';
    end if;
    select sum(x) into v_suma from unnest(p_numere) x;
    if v_suma <> v_n then
      raise exception 'Suma pe conturi (%) trebuie să fie egală cu numărul de firme alese (%).', v_suma, v_n using errcode = 'PR422';
    end if;
  end if;
  for v_cheie in select value from jsonb_each_text(v_alocari) loop
    if not (v_cheie = any(v_chei) or lower(v_cheie) = any(v_chei)) then
      raise exception 'Opțiunile avansate: contul „%” nu e printre cele alese.', v_cheie using errcode = 'PR422';
    end if;
  end loop;

  if not p_proba then
    -- Două distribuiri simultane pe același canal nu împart aceleași locuri; firmele se blochează în aceeași ordine.
    perform pg_advisory_xact_lock(hashtext('prospectare_programeaza_' || p_canal));
    perform 1 from public.prospectare_firme where id = any(v_firme) order by id for update;
  end if;

  -- Ordinea aleasă, apoi regulile: cine nu poate merge pe canal e sărit, cu motivul.
  for f in
    select x.* from public.prospectare_firme x where x.id = any(v_firme)
    order by case when p_ordine = 'recente' then x.nr_site end desc nulls last,
             case when coalesce(p_ordine, 'scor') = 'scor' then x.scor end desc nulls last,
             x.nr_site desc nulls last, x.nr desc
  loop
    select p.canal, p.zi into v_activa from public.prospectare_programari p where p.firma_id = f.id and p.stare = 'programata' limit 1;
    if found then
      v_motiv := format('e deja programată pe %s pentru %s', case v_activa.canal when 'email' then 'email' when 'whatsapp' then 'WhatsApp' else 'apel' end,
        to_char(v_activa.zi, 'DD.MM'));
    else
      v_motiv := public.prospectare_motiv_canal_in(f, p_canal, v_zi);
    end if;
    if v_motiv is not null then
      v_sarite := v_sarite || jsonb_build_object('id', f.id, 'nr', f.nr, 'nr_site', f.nr_site, 'nume', f.nume, 'motiv', v_motiv);
      continue;
    end if;
    v_elig := v_elig || jsonb_build_object('id', f.id, 'nr', f.nr, 'nr_site', f.nr_site, 'nume', f.nume, 'scor', f.scor, 'link', f.link_demo);
  end loop;

  -- Conturile: întâi alegerile din opțiunile avansate, apoi restul, în blocuri, în ordinea aleasă.
  v_cnt := array_fill(0, array[v_k]);
  for e in select value from jsonb_array_elements(v_elig) loop
    v_cont := coalesce(v_alocari ->> (e ->> 'id'), lower(v_alocari ->> (e ->> 'id')));
    if v_cont is null then
      v_rest := v_rest || e;
      continue;
    end if;
    v_i := array_position(v_chei, v_cont);
    if v_i is null then
      v_i := array_position(v_chei, lower(v_cont));
    end if;
    if p_canal = 'email' and not exists (select 1 from public.prospectare_casute c where c.adresa = v_chei[v_i] and public.prospectare_casuta_potrivita(e ->> 'link', c)) then
      v_sarite := v_sarite || jsonb_build_object('id', e -> 'id', 'nr', e -> 'nr', 'nr_site', e -> 'nr_site', 'nume', e -> 'nume',
        'motiv', format('căsuța aleasă (%s) nu e pe domeniul linkului demo (%s)', v_chei[v_i], public.prospectare_domeniu(e ->> 'link')));
      continue;
    end if;
    v_cnt[v_i] := v_cnt[v_i] + 1;
    v_plan := v_plan || (e - 'link' || jsonb_build_object('cont', v_chei[v_i], 'fixat', true));
  end loop;

  if p_canal = 'email' then
    -- Emailul: căsuța domeniului din linkul demo (dacă e aleasă); numerele, dacă sunt scrise, sunt plafoane.
    for e in select value from jsonb_array_elements(v_rest) loop
      v_i := null;
      for v_j in 1 .. v_k loop
        if exists (select 1 from public.prospectare_casute c where c.adresa = v_chei[v_j] and public.prospectare_casuta_potrivita(e ->> 'link', c)) then
          v_i := v_j;
          exit;
        end if;
      end loop;
      if v_i is null then
        v_sarite := v_sarite || jsonb_build_object('id', e -> 'id', 'nr', e -> 'nr', 'nr_site', e -> 'nr_site', 'nume', e -> 'nume',
          'motiv', format('nicio căsuță aleasă pe domeniul linkului demo (%s)', public.prospectare_domeniu(e ->> 'link')));
        continue;
      end if;
      if p_numere is not null and v_cnt[v_i] >= p_numere[v_i] then
        v_sarite := v_sarite || jsonb_build_object('id', e -> 'id', 'nr', e -> 'nr', 'nr_site', e -> 'nr_site', 'nume', e -> 'nume',
          'motiv', format('căsuța %s are deja %s (numărul ales)', v_chei[v_i], p_numere[v_i]));
        continue;
      end if;
      v_cnt[v_i] := v_cnt[v_i] + 1;
      v_plan := v_plan || (e - 'link' || jsonb_build_object('cont', v_chei[v_i], 'fixat', false));
    end loop;
  else
    -- WhatsApp și apel: blocuri în ordinea aleasă. Egal: diferența dintre conturi e cel mult o firmă.
    v_quota := array_fill(0, array[v_k]);
    for v_i in 1 .. v_k loop
      if p_numere is null then
        v_quota[v_i] := jsonb_array_length(v_rest) / v_k + case when v_i <= jsonb_array_length(v_rest) % v_k then 1 else 0 end;
      else
        v_quota[v_i] := greatest(p_numere[v_i] - v_cnt[v_i], 0);
      end if;
    end loop;
    v_i := 1;
    for e in select value from jsonb_array_elements(v_rest) loop
      while v_i <= v_k and v_quota[v_i] <= 0 loop
        v_i := v_i + 1;
      end loop;
      -- Nu se întâmplă (suma numerelor = firmele alese), dar nimic nu se pierde: ultimul cont.
      if v_i > v_k then
        v_i := v_k;
      end if;
      v_quota[v_i] := v_quota[v_i] - 1;
      v_cnt[v_i] := v_cnt[v_i] + 1;
      v_plan := v_plan || (e - 'link' || jsonb_build_object('cont', v_chei[v_i], 'fixat', false));
    end loop;
  end if;

  -- Pe conturi, cu avertismentul limitei (nu blochează).
  for v_i in 1 .. v_k loop
    v_pe := v_pe || jsonb_build_object('cheie', v_chei[v_i], 'nume', v_nume[v_i], 'n', v_cnt[v_i], 'deja', v_deja[v_i], 'limita', v_limite[v_i],
      'peste_limita', v_cnt[v_i] > 0 and v_deja[v_i] + v_cnt[v_i] > v_limite[v_i]);
    if v_cnt[v_i] > 0 and v_deja[v_i] + v_cnt[v_i] > v_limite[v_i] then
      v_av := v_av || to_jsonb(format('%s: %s pe %s (%s deja + %s acum), peste limita de %s pe zi.', v_nume[v_i], v_deja[v_i] + v_cnt[v_i],
        to_char(v_zi, 'DD.MM'), v_deja[v_i], v_cnt[v_i], v_limite[v_i]));
    end if;
  end loop;

  if not p_proba then
    perform set_config('prospectare.autor', v_autor, true);
    for e in select value from jsonb_array_elements(v_plan) loop
      v_id := (e ->> 'id')::uuid;
      v_cont := e ->> 'cont';
      if p_canal = 'telefon' and v_zi = v_azi then
        -- Apelurile de azi intră direct în lista omului ales.
        perform set_config('prospectare.motiv', format('Distribuită în lista de apeluri a lui %s', case v_cont when 'stefan' then 'Ștefan' else 'Vlăduț' end), true);
        update public.prospectare_firme set telefon_la = now() where id = v_id;
        insert into public.prospectare_liste_zi (data, utilizator, canal, firma_id) values (v_azi, v_cont, 'telefon', v_id)
          on conflict (firma_id, data) do nothing;
        insert into public.prospectare_programari (firma_id, canal, zi, sursa, utilizator, stare, creat_de, inchis_la, motiv)
          values (v_id, 'telefon', v_zi, 'manual', v_cont, 'folosita', v_autor, now(), 'distribuită din Firme: pusă în lista de apeluri');
        perform set_config('prospectare.motiv', '', true);
      else
        insert into public.prospectare_programari (firma_id, canal, zi, sursa, casuta, cont_whatsapp, utilizator, creat_de, motiv)
        values (v_id, p_canal, v_zi, 'manual',
          case when p_canal = 'email' then v_cont end,
          case when p_canal = 'whatsapp' then v_cont::smallint end,
          case when p_canal = 'telefon' then v_cont end,
          v_autor, 'distribuită din Firme');
      end if;
      perform public.prospectare_noteaza(v_id, 'programare', p_canal,
        jsonb_strip_nulls(jsonb_build_object('canal', p_canal, 'zi', v_zi, 'sursa', 'distribuire',
          'casuta', case when p_canal = 'email' then v_cont end,
          'cont', case when p_canal = 'whatsapp' then v_cont::integer end,
          'utilizator', case when p_canal = 'telefon' then v_cont end)));
      v_programate := v_programate + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'proba', p_proba,
    'canal', p_canal,
    'zi', v_zi,
    'ordine', coalesce(p_ordine, 'scor'),
    'selectate', v_n,
    'programate', case when p_proba then jsonb_array_length(v_plan) else v_programate end,
    'pe_conturi', v_pe,
    'sarite', v_sarite,
    'firme', v_plan,
    'avertismente', v_av
  );
end;
$$;

-- 6. Listele de construcție: firmele, pe terminale -----------------------------------------------------------

-- O firmă e încă de construit (pentru listele terminalelor): fără site publicat, nu închisă.
create or replace function public.prospectare_de_construit(f public.prospectare_firme)
returns boolean
language sql
stable
set search_path = public
as $$
  select f.etapa in ('cercetat', 'site_in_lucru')
    and not (f.link_demo is not null and f.demo_verificat)
    and coalesce(f.evaluare, 'eligibila') <> 'respinsa'
    and not (f.date_extra ? 'duplicat_de')
$$;

-- Împarte firmele alese pe terminale. Egal: alternativ după scor (1 la primul, 2 la al doilea…), ca toți să
-- primească și firme bune, și slabe. Cu numere: tot alternativ, cât are fiecare terminal loc; suma = firmele
-- alese. Firmele începute (rezervate acum de un robot) nu se mută. p_proba = true: doar rezumatul.
create or replace function public.prospectare_aloca_constructie(
  p_firme uuid[],
  p_terminale text[],
  p_numere integer[] default null,
  p_proba boolean default true,
  p_autor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_autor text := left(coalesce(nullif(btrim(p_autor), ''), 'admin'), 200);
  v_firme uuid[];
  v_n integer;
  v_t text[] := '{}';
  v_k integer;
  v_s text;
  v_suma integer;
  v_cnt integer[];
  v_quota integer[];
  v_i integer := 0;
  v_poz integer;
  v_incercari integer;
  f public.prospectare_firme%rowtype;
  v_motiv text;
  v_rez record;
  v_sarite jsonb := '[]'::jsonb;
  v_plan jsonb := '[]'::jsonb;
  v_pe jsonb := '[]'::jsonb;
  e jsonb;
  v_alocate integer := 0;
begin
  select array_agg(distinct x) into v_firme from unnest(coalesce(p_firme, '{}'::uuid[])) x where x is not null;
  v_n := coalesce(cardinality(v_firme), 0);
  if v_n = 0 or v_n > 5000 then
    raise exception 'Alege între 1 și 5000 de firme.' using errcode = 'PR422';
  end if;
  foreach v_s in array coalesce(p_terminale, '{}'::text[]) loop
    continue when nullif(btrim(coalesce(v_s, '')), '') is null;
    if btrim(v_s) !~ '^[A-Za-z0-9._-]{1,40}$' then
      raise exception 'Terminalul „%”: un nume scurt, ex. stefan-1 (litere, cifre, punct, liniuță; cel mult 40).', btrim(v_s) using errcode = 'PR422';
    end if;
    continue when btrim(v_s) = any(v_t);
    v_t := v_t || btrim(v_s);
  end loop;
  v_k := cardinality(v_t);
  if v_k = 0 or v_k > 50 then
    raise exception 'Alege între 1 și 50 de terminale.' using errcode = 'PR422';
  end if;
  if p_numere is not null then
    if cardinality(p_numere) <> v_k or exists (select 1 from unnest(p_numere) x where x is null or x < 0) then
      raise exception 'Scrie câte firme merg la fiecare terminal ales (numere de la 0 în sus).' using errcode = 'PR422';
    end if;
    select sum(x) into v_suma from unnest(p_numere) x;
    if v_suma <> v_n then
      raise exception 'Suma pe terminale (%) trebuie să fie egală cu numărul de firme alese (%).', v_suma, v_n using errcode = 'PR422';
    end if;
  end if;
  if not p_proba then
    perform pg_advisory_xact_lock(hashtext('prospectare_aloca_constructie'));
    perform 1 from public.prospectare_firme where id = any(v_firme) order by id for update;
  end if;

  v_cnt := array_fill(0, array[v_k]);
  v_quota := case when p_numere is null then array_fill(v_n, array[v_k]) else p_numere end;
  for f in
    select x.* from public.prospectare_firme x where x.id = any(v_firme)
    order by x.scor desc nulls last, x.nr
  loop
    v_motiv := case
      when f.etapa = 'nu_contacta' then '„Nu contacta”'
      when f.date_extra ? 'duplicat_de' then format('duplicat al #%s', f.date_extra ->> 'duplicat_de')
      when f.evaluare = 'respinsa' then 'respinsă la evaluare'
      when f.link_demo is not null and f.demo_verificat then
        'are deja site publicat' || coalesce(format(' (site %s)', f.nr_site), '')
      when f.etapa not in ('cercetat', 'site_in_lucru') then format('etapa „%s”: nu mai e de construit', f.etapa)
    end;
    if v_motiv is null then
      select r.sesiune, d.nume, r.expira_la into v_rez from public.prospectare_rezervari r left join public.prospectare_dispozitive d on d.id = r.dispozitiv_id
        where r.firma_id = f.id and r.expira_la > now();
      if found then
        v_motiv := format('începută: în lucru la %s (sesiunea %s)', coalesce(v_rez.nume, 'un robot'), v_rez.sesiune);
      end if;
    end if;
    if v_motiv is not null then
      v_sarite := v_sarite || jsonb_build_object('id', f.id, 'nr', f.nr, 'nume', f.nume, 'motiv', v_motiv);
      continue;
    end if;
    -- Alternativ: următorul terminal care mai are loc.
    v_poz := null;
    v_incercari := 0;
    while v_incercari < v_k loop
      v_i := v_i % v_k + 1;
      v_incercari := v_incercari + 1;
      if v_cnt[v_i] < v_quota[v_i] then
        v_poz := v_i;
        exit;
      end if;
    end loop;
    if v_poz is null then
      v_poz := v_k;
    end if;
    v_cnt[v_poz] := v_cnt[v_poz] + 1;
    v_plan := v_plan || jsonb_build_object('id', f.id, 'nr', f.nr, 'nume', f.nume, 'scor', f.scor, 'terminal', v_t[v_poz], 'din', f.alocat_lui);
  end loop;

  for v_i in 1 .. v_k loop
    v_pe := v_pe || jsonb_build_object('terminal', v_t[v_i], 'n', v_cnt[v_i],
      'deja', (select count(*) from public.prospectare_firme x where x.alocat_lui = v_t[v_i] and public.prospectare_de_construit(x) and not (x.id = any(v_firme))));
  end loop;

  if not p_proba then
    perform set_config('prospectare.autor', v_autor, true);
    perform set_config('prospectare.pastreaza_actualizat', 'da', true);
    for e in select value from jsonb_array_elements(v_plan) loop
      update public.prospectare_firme set alocat_lui = e ->> 'terminal', alocat_la = now(), alocat_de = v_autor
        where id = (e ->> 'id')::uuid and alocat_lui is distinct from e ->> 'terminal';
      if found then
        perform public.prospectare_noteaza((e ->> 'id')::uuid, 'alocare', null,
          jsonb_strip_nulls(jsonb_build_object('terminal', e ->> 'terminal', 'din', e ->> 'din')));
      end if;
      v_alocate := v_alocate + 1;
    end loop;
    perform set_config('prospectare.pastreaza_actualizat', '', true);
  end if;

  return jsonb_build_object('proba', p_proba, 'selectate', v_n, 'alocate', case when p_proba then jsonb_array_length(v_plan) else v_alocate end,
    'pe_terminale', v_pe, 'sarite', v_sarite, 'firme', v_plan);
end;
$$;

-- /lista-mea: firmele alocate terminalului (sesiunii), încă neconstruite, cu toate datele lor.
create or replace function public.prospectare_lista_mea(p_dispozitiv uuid, p_sesiune text default '1')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s text := public.prospectare_sesiune(p_sesiune);
  v_firme jsonb;
  v_n integer;
begin
  if not exists (select 1 from public.prospectare_dispozitive where id = p_dispozitiv and activ) then
    raise exception 'Robotul nu există sau e dezactivat.' using errcode = 'PR401';
  end if;
  select count(*), coalesce(jsonb_agg(to_jsonb(x) - 'grupa_tabel' - 'canal' - 'canal_setat_la' - 'canal_setat_de'
      || jsonb_build_object('rezervare', (select jsonb_build_object('robot', d.nume, 'sesiune', r.sesiune, 'expira_la', r.expira_la,
           'a_mea', r.dispozitiv_id = p_dispozitiv and r.sesiune = v_s)
         from public.prospectare_rezervari r left join public.prospectare_dispozitive d on d.id = r.dispozitiv_id
         where r.firma_id = x.id and r.expira_la > now()))
      order by x.scor desc nulls last, x.nr), '[]'::jsonb)
    into v_n, v_firme
  from public.prospectare_firme x
  where x.alocat_lui = v_s and public.prospectare_de_construit(x);
  perform public.prospectare_robot_ce_face(p_dispozitiv, 'constructie', format('lista de construcție: %s %s', v_n, case when v_n = 1 then 'firmă' else 'firme' end), v_s);
  return jsonb_build_object('sesiune', v_s, 'total', v_n, 'firme', v_firme);
end;
$$;

-- /rezerva nu mai dă unui terminal firmele alocate altuia; pe cele alocate lui i le dă primele.
create or replace function public.prospectare_rezerva_urmatoarea(p_dispozitiv uuid, p_tip_lucru text default null, p_sesiune text default '1')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ore integer;
  v_prag integer;
  v_nume text;
  v_rez public.prospectare_rezervari%rowtype;
  f public.prospectare_firme%rowtype;
  v_vechi uuid;
  v_vechi_s text;
  v_incercare integer := 0;
  v_s text := public.prospectare_sesiune(p_sesiune);
begin
  if p_tip_lucru is not null and p_tip_lucru not in ('construire', 'refacere') then
    raise exception 'Tipul de lucru e „construire” sau „refacere”.' using errcode = 'PR422';
  end if;
  select nume into v_nume from public.prospectare_dispozitive where id = p_dispozitiv and activ;
  if not found then
    raise exception 'Robotul nu există sau e dezactivat.' using errcode = 'PR401';
  end if;
  perform set_config('prospectare.autor', v_nume, true);
  perform pg_advisory_xact_lock(hashtext('prospectare_rezerva:' || p_dispozitiv::text || ':' || v_s));
  select rezervare_ore, scor_minim_constructie into v_ore, v_prag from public.prospectare_setari where id = 1;
  v_ore := coalesce(v_ore, 3);
  v_prag := coalesce(v_prag, 45);

  select r.* into v_rez
  from public.prospectare_rezervari r
  join public.prospectare_firme ff on ff.id = r.firma_id
  where r.dispozitiv_id = p_dispozitiv and r.sesiune = v_s and ff.etapa <> 'nu_contacta'
    and (p_tip_lucru is null or r.tip_lucru = p_tip_lucru)
  order by r.luat_la
  limit 1
  for update of r;
  if found then
    update public.prospectare_rezervari set expira_la = now() + make_interval(hours => v_ore)
      where firma_id = v_rez.firma_id returning * into v_rez;
    select * into f from public.prospectare_firme where id = v_rez.firma_id;
    perform public.prospectare_robot_ce_face(p_dispozitiv, 'constructie', format('#%s %s', f.nr, f.nume), v_s);
    return to_jsonb(f) || jsonb_build_object('rezervare', jsonb_build_object('tip_lucru', v_rez.tip_lucru, 'expira_la', v_rez.expira_la, 'reluata', true, 'sesiune', v_s));
  end if;

  loop
    v_incercare := v_incercare + 1;
    exit when v_incercare > 5;

    select ff.* into f
    from public.prospectare_firme ff
    left join public.prospectare_rezervari r on r.firma_id = ff.id
    where (r.firma_id is null or r.expira_la <= now())
      and (ff.alocat_lui is null or ff.alocat_lui = v_s)
      and (
        ff.etapa = 'site_in_lucru'
        or (ff.etapa = 'cercetat' and ff.link_demo is null and coalesce(ff.evaluare, 'eligibila') <> 'respinsa'
            and ff.scor >= v_prag and (ff.email is not null or ff.este_mobil))
      )
      and (p_tip_lucru is null or ff.de_refacut = (p_tip_lucru = 'refacere'))
    order by (ff.alocat_lui is not distinct from v_s) desc, (r.firma_id is not null) desc, ff.de_refacut desc,
      (ff.etapa = 'site_in_lucru') desc, ff.scor desc nulls last, ff.nr
    limit 1
    for update of ff skip locked;
    if not found then
      return null;
    end if;

    select dispozitiv_id, sesiune into v_vechi, v_vechi_s from public.prospectare_rezervari where firma_id = f.id for update;
    insert into public.prospectare_rezervari (firma_id, dispozitiv_id, sesiune, tip_lucru, luat_la, expira_la)
    values (f.id, p_dispozitiv, v_s, case when f.de_refacut then 'refacere' else 'construire' end, now(), now() + make_interval(hours => v_ore))
    on conflict (firma_id) do update
      set dispozitiv_id = excluded.dispozitiv_id, sesiune = excluded.sesiune, tip_lucru = excluded.tip_lucru, luat_la = excluded.luat_la, expira_la = excluded.expira_la
      where public.prospectare_rezervari.expira_la <= now()
    returning * into v_rez;
    if found then
      if f.etapa = 'cercetat' then
        perform set_config('prospectare.motiv', format('Luată din coada comună de %s', v_nume), true);
        update public.prospectare_firme set etapa = 'site_in_lucru' where id = f.id returning * into f;
      end if;
      perform public.prospectare_noteaza(f.id, 'rezervare', null,
        jsonb_strip_nulls(jsonb_build_object('dispozitiv', p_dispozitiv, 'tip_lucru', v_rez.tip_lucru, 'expira_la', v_rez.expira_la,
          'sesiune', v_s,
          'preluata_de_la', case when v_vechi is distinct from p_dispozitiv or v_vechi_s is distinct from v_s then v_vechi end,
          'preluata_de_la_sesiune', case when v_vechi is not null and (v_vechi is distinct from p_dispozitiv or v_vechi_s is distinct from v_s) then v_vechi_s end)));
      perform public.prospectare_robot_ce_face(p_dispozitiv, 'constructie', format('#%s %s', f.nr, f.nume), v_s);
      return to_jsonb(f) || jsonb_build_object('rezervare', jsonb_build_object('tip_lucru', v_rez.tip_lucru, 'expira_la', v_rez.expira_la, 'reluata', false, 'sesiune', v_s));
    end if;
  end loop;
  return null;
end;
$$;

-- 7. Lacătul de publicare: un singur calculator publică odată --------------------------------------------

create table if not exists public.prospectare_lacate (
  cheie text primary key check (char_length(cheie) between 1 and 60),
  dispozitiv_id uuid references public.prospectare_dispozitive (id) on delete set null,
  sesiune text check (sesiune is null or sesiune ~ '^[A-Za-z0-9._-]{1,40}$'),
  luat_la timestamptz,
  batut_la timestamptz,
  actualizat_la timestamptz not null default now()
);
alter table public.prospectare_lacate enable row level security;
drop policy if exists prospectare_lacate_admin_read on public.prospectare_lacate;
create policy prospectare_lacate_admin_read on public.prospectare_lacate for select to authenticated using (public.is_lead_admin());
revoke all on public.prospectare_lacate from anon;
insert into public.prospectare_lacate (cheie) values ('publicare') on conflict (cheie) do nothing;

-- p_actiune: „ia” | „bate” | „elibereaza” | „stare”. Lacătul e al calculatorului (robotului): oricare sesiune a
-- lui îl poate bate sau elibera. Fără „bate” 30 de minute, expiră și îl poate lua alt calculator. Răspunsul
-- spune mereu cine îl ține și de când; `ok` = false când acțiunea nu s-a putut face (409 la rută).
create or replace function public.prospectare_lacat_publicare(p_dispozitiv uuid, p_actiune text, p_sesiune text default '1')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s text := public.prospectare_sesiune(p_sesiune);
  l public.prospectare_lacate%rowtype;
  v_liber boolean;
  v_al_meu boolean;
  v_ok boolean := true;
  v_mesaj text;
  v_robot text;
begin
  if p_actiune is null or p_actiune not in ('ia', 'bate', 'elibereaza', 'stare') then
    raise exception 'actiune: „ia”, „bate”, „elibereaza” sau „stare”.' using errcode = 'PR422';
  end if;
  if not exists (select 1 from public.prospectare_dispozitive where id = p_dispozitiv and activ) then
    raise exception 'Robotul nu există sau e dezactivat.' using errcode = 'PR401';
  end if;
  insert into public.prospectare_lacate (cheie) values ('publicare') on conflict (cheie) do nothing;
  select * into l from public.prospectare_lacate where cheie = 'publicare' for update;
  v_liber := l.dispozitiv_id is null or l.batut_la is null or l.batut_la <= now() - interval '30 minutes';
  v_al_meu := not v_liber and l.dispozitiv_id = p_dispozitiv;

  if p_actiune = 'ia' then
    if v_liber or v_al_meu then
      update public.prospectare_lacate
        set dispozitiv_id = p_dispozitiv, sesiune = v_s,
            luat_la = case when v_al_meu then l.luat_la else now() end,
            batut_la = now(), actualizat_la = now()
        where cheie = 'publicare' returning * into l;
      v_mesaj := case when v_al_meu then 'Lacătul era deja al acestui calculator: prelungit.' else 'Lacătul e al tău: publică, apoi „elibereaza”.' end;
    else
      v_ok := false;
    end if;
  elsif p_actiune = 'bate' then
    if v_al_meu then
      update public.prospectare_lacate set batut_la = now(), actualizat_la = now() where cheie = 'publicare' returning * into l;
      v_mesaj := 'Prelungit cu 30 de minute.';
    else
      v_ok := false;
    end if;
  elsif p_actiune = 'elibereaza' then
    if v_al_meu then
      update public.prospectare_lacate set dispozitiv_id = null, sesiune = null, luat_la = null, batut_la = null, actualizat_la = now()
        where cheie = 'publicare' returning * into l;
      v_mesaj := 'Eliberat.';
    elsif v_liber then
      v_mesaj := 'Lacătul era deja liber.';
    else
      v_ok := false;
    end if;
  end if;

  v_liber := l.dispozitiv_id is null or l.batut_la is null or l.batut_la <= now() - interval '30 minutes';
  v_al_meu := not v_liber and l.dispozitiv_id = p_dispozitiv;
  select nume into v_robot from public.prospectare_dispozitive where id = l.dispozitiv_id;
  if not v_ok then
    v_mesaj := case
      when v_liber then 'Lacătul nu e al acestui calculator: a expirat (30 de minute fără „bate”). Ia-l din nou înainte să publici.'
      else format('Lacătul de publicare e la %s (sesiunea %s) din %s; expiră la %s dacă nu mai bate.', coalesce(v_robot, 'alt robot'), coalesce(l.sesiune, '1'),
        to_char(l.luat_la at time zone 'Europe/Bucharest', 'DD.MM HH24:MI'), to_char((l.batut_la + interval '30 minutes') at time zone 'Europe/Bucharest', 'HH24:MI'))
    end;
  elsif p_actiune = 'stare' then
    v_mesaj := case when v_liber then 'Lacătul e liber.' when v_al_meu then 'Lacătul e al acestui calculator.'
      else format('Lacătul e la %s (sesiunea %s).', coalesce(v_robot, 'alt robot'), coalesce(l.sesiune, '1')) end;
  end if;

  return jsonb_build_object(
    'ok', v_ok,
    'actiune', p_actiune,
    'mesaj', v_mesaj,
    'lacat', jsonb_build_object(
      'liber', v_liber,
      'al_meu', v_al_meu,
      'robot', case when v_liber then null else v_robot end,
      'sesiune', case when v_liber then null else l.sesiune end,
      'din', case when v_liber then null else l.luat_la end,
      'batut_la', case when v_liber then null else l.batut_la end,
      'expira_la', case when v_liber then null else l.batut_la + interval '30 minutes' end)
  );
end;
$$;

-- 8. /termina: mobilul, „doar WhatsApp”, problema site-ului și cele 3 schimbări ------------------------------

-- Punctele („ce am schimbat”): listă sau text pe rânduri; cel mult 6, fiecare cel mult 300 de caractere.
create or replace function public.prospectare_puncte(p jsonb)
returns jsonb
language sql
immutable
as $$
  select case jsonb_typeof(p)
    when 'array' then (select jsonb_agg(v) from (
        select left(btrim(regexp_replace(x, '^\s*[*•\-–]\s*', '')), 300) as v from jsonb_array_elements_text(p) with ordinality as t(x, i)
        where btrim(regexp_replace(x, '^\s*[*•\-–]\s*', '')) <> '' order by i limit 6) s)
    when 'string' then (select jsonb_agg(v) from (
        select left(btrim(regexp_replace(x, '^\s*[*•\-–]\s*', '')), 300) as v from regexp_split_to_table(p #>> '{}', '\r?\n') with ordinality as t(x, i)
        where btrim(regexp_replace(x, '^\s*[*•\-–]\s*', '')) <> '' order by i limit 6) s)
  end
$$;

create or replace function public.prospectare_termina_lot(p_dispozitiv uuid, p_firme jsonb, p_sesiune text default '1')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nume text;
  e jsonb;
  v_i integer := 0;
  v_id uuid;
  v_link text;
  v_capt text;
  v_verif boolean;
  v_detalii jsonb;
  v_mobil text;
  v_doar jsonb;
  v_problema text;
  v_puncte jsonb;
  f public.prospectare_firme%rowtype;
  g public.prospectare_firme%rowtype;
  v_rez jsonb := '[]'::jsonb;
  v_ok integer := 0;
  v_cod text;
  v_mesaj text;
  v_final jsonb := '[]'::jsonb;
  r jsonb;
  v_s text := public.prospectare_sesiune(p_sesiune);
begin
  select nume into v_nume from public.prospectare_dispozitive where id = p_dispozitiv and activ;
  if not found then
    raise exception 'Robotul nu există sau e dezactivat.' using errcode = 'PR401';
  end if;
  if jsonb_typeof(p_firme) <> 'array' or jsonb_array_length(p_firme) = 0 then
    raise exception 'Trimite firmele ca listă.' using errcode = 'PR422';
  end if;
  if jsonb_array_length(p_firme) > 100 then
    raise exception 'Cel mult 100 de firme într-o cerere.' using errcode = 'PR422';
  end if;
  perform set_config('prospectare.autor', v_nume, true);

  perform 1 from public.prospectare_firme x
    where x.id in (select public.prospectare_firma_din(el) from jsonb_array_elements(p_firme) el)
    order by x.id
    for update;

  for e in select value from jsonb_array_elements(p_firme) loop
    v_i := v_i + 1;
    begin
      if jsonb_typeof(e) <> 'object' then
        raise exception 'Fiecare firmă e un obiect: firma_id, domeniu sau nr, plus link_demo.' using errcode = 'PR422';
      end if;
      v_link := nullif(btrim(e ->> 'link_demo'), '');
      v_capt := nullif(btrim(e ->> 'captura_url'), '');
      v_verif := coalesce(nullif(e ->> 'link_verificat', '')::boolean, true);
      v_detalii := case when jsonb_typeof(e -> 'detalii') = 'object' then e -> 'detalii' else '{}'::jsonb end;
      if v_link is null or v_link !~ '^https://[^\s]+$' or char_length(v_link) > 500 then
        raise exception 'Linkul demo trebuie să fie o adresă https://.' using errcode = 'PR422';
      end if;
      if v_capt is not null and (v_capt !~ '^https://[^\s]+$' or char_length(v_capt) > 1000) then
        raise exception 'Linkul capturii trebuie să fie o adresă https:// (Drive).' using errcode = 'PR422';
      end if;
      if char_length(v_detalii::text) > 5000 then
        raise exception 'detalii: cel mult 5000 de caractere.' using errcode = 'PR422';
      end if;
      -- Ce copiază /termina în firmă (39): de sus sau din `detalii` (robotul de până acum le pune acolo).
      v_mobil := nullif(btrim(coalesce(e ->> 'telefon_mobil', v_detalii ->> 'telefon_mobil', e ->> 'mobil', v_detalii ->> 'mobil', '')), '');
      if v_mobil is not null and (char_length(v_mobil) > 40 or not public.prospectare_e_mobil(v_mobil)) then
        v_mobil := null;
      end if;
      v_doar := case when jsonb_typeof(coalesce(e -> 'doar_whatsapp', v_detalii -> 'doar_whatsapp')) = 'boolean'
        then coalesce(e -> 'doar_whatsapp', v_detalii -> 'doar_whatsapp') end;
      v_problema := nullif(left(btrim(regexp_replace(coalesce(e ->> 'problema', v_detalii ->> 'problema', ''), '\s+', ' ', 'g')), 500), '');
      v_puncte := public.prospectare_puncte(coalesce(e -> 'puncte', v_detalii -> 'puncte'));
      v_id := public.prospectare_firma_din(e);
      if v_id is null then
        raise exception 'Firma nu există: %.', coalesce(e ->> 'firma_id', e ->> 'domeniu', '#' || (e ->> 'nr'), '(fără firma_id, domeniu sau nr)') using errcode = 'PR404';
      end if;
      select * into f from public.prospectare_firme where id = v_id;

      perform set_config('prospectare.motiv', 'Site demo gata', true);
      update public.prospectare_firme
        set etapa = case when etapa in ('cercetat', 'site_in_lucru') then 'site_gata' else etapa end,
            link_demo = v_link,
            captura_url = coalesce(v_capt, captura_url),
            de_refacut = false,
            site_gata_la = case when site_gata_la is null or de_refacut or link_demo is distinct from v_link then now() else site_gata_la end,
            construit_de = coalesce(v_nume, construit_de),
            demo_verificat = v_verif,
            evaluare = 'eligibila',
            evaluare_motiv = case when evaluare = 'respinsa' then null else evaluare_motiv end,
            -- Mobilul robotului înlocuiește doar un fix (sau lipsa telefonului); un mobil existent rămâne.
            telefon = case when v_mobil is not null and (telefon is null or not public.prospectare_e_mobil(telefon)) then v_mobil else telefon end,
            telefon_gresit = case when v_mobil is not null and (telefon is null or not public.prospectare_e_mobil(telefon)) then false else telefon_gresit end,
            date_extra = date_extra || jsonb_build_object('status_robot', 'gata', 'terminat_la', now())
              || jsonb_strip_nulls(jsonb_build_object(
                   'doar_whatsapp', v_doar,
                   'problema', v_problema,
                   'puncte', v_puncte,
                   'telefon_fix', case when v_mobil is not null and telefon is not null and not public.prospectare_e_mobil(telefon) then telefon end))
        where id = v_id
        returning * into g;
      delete from public.prospectare_rezervari where firma_id = v_id;
      if g.link_demo is distinct from f.link_demo or g.demo_verificat is distinct from f.demo_verificat or g.etapa is distinct from f.etapa then
        perform public.prospectare_noteaza(g.id, 'site', null,
          jsonb_strip_nulls(jsonb_build_object('dispozitiv', p_dispozitiv, 'sesiune', v_s, 'link_demo', v_link, 'captura_url', v_capt, 'link_verificat', v_verif))
            || v_detalii);
      end if;
      v_ok := v_ok + 1;
      v_rez := v_rez || jsonb_build_object('index', v_i, 'firma_id', g.id, 'nr', g.nr, 'etapa', g.etapa, 'link_demo', g.link_demo,
        'demo_verificat', g.demo_verificat, 'telefon', g.telefon, 'este_mobil', g.este_mobil);
    exception when others then
      get stacked diagnostics v_cod = returned_sqlstate, v_mesaj = message_text;
      v_rez := v_rez || jsonb_build_object('index', v_i, 'firma_id', e ->> 'firma_id', 'domeniu', e ->> 'domeniu', 'nr', e -> 'nr',
        'eroare', jsonb_build_object('cod', v_cod, 'mesaj', v_mesaj));
    end;
  end loop;

  -- Numerele de site (contactarea nu mai pornește singură: firmele se distribuie din tabelul Firme).
  if v_ok > 0 then
    perform public.prospectare_numeroteaza_site();
  end if;

  for r in select value from jsonb_array_elements(v_rez) loop
    if r ? 'eroare' then
      v_final := v_final || r;
    else
      v_final := v_final || (r || jsonb_build_object('nr_site', (select x.nr_site from public.prospectare_firme x where x.id = (r ->> 'firma_id')::uuid)));
    end if;
  end loop;
  return jsonb_build_object('terminate', v_ok, 'erori', jsonb_array_length(v_rez) - v_ok, 'firme', v_final);
end;
$$;

-- 9. Importul: telefonul nu se strică, numărul unei firme noi nu se suprapune -------------------------------

create or replace function public.prospectare_upsert_firme(
  p_firme jsonb,
  p_sursa text,
  p_autor text,
  p_proba boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e jsonb;
  f public.prospectare_firme%rowtype;
  n public.prospectare_firme%rowtype;
  v_dom text;
  v_etapa text;
  v_import boolean := p_sursa = 'import';
  v_email_la timestamptz;
  v_whatsapp_la timestamptz;
  v_whatsapp_cont smallint;
  v_telefon_la timestamptz;
  v_adaugate integer := 0;
  v_actualizate integer := 0;
  v_neschimbate integer := 0;
  v_etape_pastrate integer := 0;
  v_canale_noi integer := 0;
  v_conflicte jsonb := '[]'::jsonb;
  v_nr_ocupat jsonb := '[]'::jsonb;
  v_nr integer;
  v_altul uuid;
  v_eval text;
  v_eval_motiv text;
  v_eval_la timestamptz;
  v_eval_de text;
  v_minim boolean;
  v_neatinsa boolean;
  v_respinse integer := 0;
  v_tel text;
  v_tel_mobil text;
  v_tel_cand text;
  v_extra jsonb;
begin
  if p_sursa not in ('robot', 'import') then
    raise exception 'Sursa e robot sau import.' using errcode = 'PR422';
  end if;
  if jsonb_typeof(p_firme) <> 'array' then
    raise exception 'Firmele vin ca listă.' using errcode = 'PR422';
  end if;
  if jsonb_array_length(p_firme) > 1000 then
    raise exception 'Cel mult 1000 de firme într-o cerere.' using errcode = 'PR422';
  end if;
  perform set_config('prospectare.autor', p_autor, true);
  if v_import then
    perform set_config('prospectare.import_istoric', 'da', true);
  end if;

  for e in select value from jsonb_array_elements(p_firme) loop
    v_dom := public.prospectare_domeniu(e ->> 'domeniu');
    if v_dom is null then
      v_conflicte := v_conflicte || jsonb_build_object('nr', e -> 'nr', 'motiv', 'fără domeniu');
      continue;
    end if;
    v_etapa := nullif(e ->> 'etapa', '');
    if v_etapa is not null and v_etapa not in ('cercetat', 'site_in_lucru', 'site_gata', 'email_trimis', 'whatsapp_trimis', 'sunat', 'interesat', 'client', 'nu_contacta', 'respins') then
      v_conflicte := v_conflicte || jsonb_build_object('domeniu', v_dom, 'motiv', 'etapă necunoscută: ' || v_etapa);
      continue;
    end if;
    if not v_import and v_etapa is not null and v_etapa not in ('cercetat', 'site_in_lucru') then
      v_etapa := null;
    end if;
    v_email_la := case when v_import then nullif(e ->> 'email_la', '')::timestamptz end;
    v_whatsapp_la := case when v_import then nullif(e ->> 'whatsapp_la', '')::timestamptz end;
    v_whatsapp_cont := case when v_import and v_whatsapp_la is not null then nullif(e ->> 'whatsapp_cont', '')::smallint end;
    v_telefon_la := case when v_import then nullif(e ->> 'telefon_la', '')::timestamptz end;
    v_eval := lower(nullif(btrim(e ->> 'evaluare'), ''));
    if v_eval is not null and v_eval not in ('eligibila', 'respinsa') then
      v_eval := null;
    end if;
    v_eval_motiv := nullif(left(btrim(e ->> 'evaluare_motiv'), 500), '');
    v_eval_la := nullif(e ->> 'evaluat_la', '')::timestamptz;
    v_eval_de := nullif(left(btrim(e ->> 'evaluat_de'), 200), '');
    v_minim := coalesce(v_eval = 'respinsa', false) and coalesce(v_etapa, 'cercetat') = 'cercetat'
      and v_email_la is null and v_whatsapp_la is null and v_telefon_la is null and nullif(e ->> 'link_demo', '') is null;
    -- Telefonul (39): mobilul are întâietate (al firmei sau cel din date_extra.telefon_mobil).
    v_extra := case when jsonb_typeof(e -> 'date_extra') = 'object' then e -> 'date_extra' else '{}'::jsonb end;
    v_tel := nullif(btrim(e ->> 'telefon'), '');
    v_tel_mobil := nullif(btrim(coalesce(e ->> 'telefon_mobil', v_extra ->> 'telefon_mobil', '')), '');
    v_tel_cand := case
      when v_tel is not null and public.prospectare_e_mobil(v_tel) then v_tel
      when v_tel_mobil is not null and public.prospectare_e_mobil(v_tel_mobil) then left(v_tel_mobil, 40)
      else v_tel end;

    select * into f from public.prospectare_firme where domeniu = v_dom for update;

    if f.id is null then
      v_nr := nullif(e ->> 'nr', '')::integer;
      if v_nr is not null then
        select id into v_altul from public.prospectare_firme where nr = v_nr;
        if v_altul is not null then
          -- Numărul e al altei firme: firma nouă primește următorul număr liber (nu se suprapune, nu se sare).
          v_nr_ocupat := v_nr_ocupat || jsonb_build_object('nr_cerut', v_nr, 'domeniu', v_dom);
          v_extra := v_extra || jsonb_build_object('nr_robot', v_nr);
          v_nr := null;
        end if;
      end if;
      v_adaugate := v_adaugate + 1;
      if v_email_la is not null or v_whatsapp_la is not null or v_telefon_la is not null then
        v_canale_noi := v_canale_noi + 1;
      end if;
      if v_minim then
        v_respinse := v_respinse + 1;
      end if;
      if not p_proba and v_minim then
        insert into public.prospectare_firme (nr, nume, domeniu, nisa, scor, etapa, evaluare, evaluare_motiv, evaluat_la, evaluat_de)
        values (
          coalesce(v_nr, nextval('public.prospectare_firme_nr_seq')::integer),
          coalesce(nullif(btrim(e ->> 'nume'), ''), v_dom), v_dom, nullif(e ->> 'nisa', ''), nullif(e ->> 'scor', '')::smallint,
          'cercetat', 'respinsa', v_eval_motiv, coalesce(v_eval_la, now()), v_eval_de
        );
      elsif not p_proba then
        insert into public.prospectare_firme (
          nr, nume, domeniu, site_vechi, nisa, oras, judet, scor, telefon, email, persoana_contact,
          etapa, email_la, whatsapp_la, whatsapp_cont, telefon_la, link_demo, captura_url, lot, slug, de_refacut, date_extra,
          site_gata_la, construit_de, demo_verificat, evaluare, evaluat_la, evaluat_de
        ) values (
          coalesce(v_nr, nextval('public.prospectare_firme_nr_seq')::integer),
          coalesce(nullif(btrim(e ->> 'nume'), ''), v_dom),
          v_dom,
          nullif(e ->> 'site_vechi', ''), nullif(e ->> 'nisa', ''), nullif(e ->> 'oras', ''), nullif(e ->> 'judet', ''),
          nullif(e ->> 'scor', '')::smallint, v_tel_cand, nullif(lower(btrim(e ->> 'email')), ''),
          nullif(btrim(e ->> 'persoana_contact'), ''),
          coalesce(v_etapa, 'cercetat'),
          v_email_la, v_whatsapp_la, v_whatsapp_cont, v_telefon_la,
          case when v_import then nullif(e ->> 'link_demo', '') end,
          case when v_import then nullif(e ->> 'captura_url', '') end,
          nullif(e ->> 'lot', ''), nullif(e ->> 'slug', ''),
          coalesce((e ->> 'de_refacut')::boolean, false),
          v_extra,
          case when v_import then nullif(e ->> 'site_gata_la', '')::timestamptz end,
          case when v_import then nullif(btrim(e ->> 'construit_de'), '') end,
          case when v_import then coalesce(nullif(e ->> 'demo_verificat', '')::boolean, false) else false end,
          nullif(v_eval, 'respinsa'), case when nullif(v_eval, 'respinsa') is not null then coalesce(v_eval_la, now()) end, v_eval_de
        );
      end if;
      continue;
    end if;

    v_neatinsa := f.etapa = 'cercetat' and f.link_demo is null and f.email_la is null and f.whatsapp_la is null and f.telefon_la is null
      and f.canal_permis is null and not exists (select 1 from public.prospectare_rezervari r where r.firma_id = f.id)
      and not exists (select 1 from public.prospectare_programari p where p.firma_id = f.id and p.stare = 'programata');

    n := f;
    n.nume := coalesce(nullif(btrim(e ->> 'nume'), ''), f.nume);
    n.site_vechi := coalesce(nullif(e ->> 'site_vechi', ''), f.site_vechi);
    n.nisa := coalesce(nullif(e ->> 'nisa', ''), f.nisa);
    n.oras := coalesce(nullif(e ->> 'oras', ''), f.oras);
    n.judet := coalesce(nullif(e ->> 'judet', ''), f.judet);
    n.scor := coalesce(nullif(e ->> 'scor', '')::smallint, f.scor);
    -- Telefonul existent rămâne; se completează doar unde lipsește, iar un fix se înlocuiește doar cu un mobil.
    n.telefon := case
      when f.telefon is null then v_tel_cand
      when public.prospectare_e_mobil(f.telefon) then f.telefon
      when v_tel_cand is not null and public.prospectare_e_mobil(v_tel_cand) then v_tel_cand
      else f.telefon end;
    n.email := coalesce(nullif(lower(btrim(e ->> 'email')), ''), f.email);
    n.persoana_contact := coalesce(nullif(btrim(e ->> 'persoana_contact'), ''), f.persoana_contact);
    n.lot := coalesce(nullif(e ->> 'lot', ''), f.lot);
    n.slug := coalesce(nullif(e ->> 'slug', ''), f.slug);
    n.date_extra := f.date_extra || v_extra;
    if v_import then
      n.link_demo := coalesce(nullif(e ->> 'link_demo', ''), f.link_demo);
      n.captura_url := coalesce(nullif(e ->> 'captura_url', ''), f.captura_url);
      n.site_gata_la := coalesce(nullif(e ->> 'site_gata_la', '')::timestamptz, f.site_gata_la);
      n.construit_de := coalesce(nullif(btrim(e ->> 'construit_de'), ''), f.construit_de);
      if e ? 'demo_verificat' then
        n.demo_verificat := coalesce(nullif(e ->> 'demo_verificat', '')::boolean, f.demo_verificat);
      end if;
    end if;
    if v_minim and v_neatinsa then
      if f.evaluare is distinct from 'respinsa' then
        v_respinse := v_respinse + 1;
      end if;
      n.site_vechi := null; n.oras := null; n.judet := null; n.telefon := null; n.email := null; n.persoana_contact := null;
      n.lot := null; n.slug := null; n.captura_url := null; n.construit_de := null; n.date_extra := '{}'::jsonb;
      n.evaluare := 'respinsa';
      n.evaluare_motiv := coalesce(v_eval_motiv, f.evaluare_motiv);
      n.evaluat_la := coalesce(f.evaluat_la, v_eval_la, now());
      n.evaluat_de := coalesce(v_eval_de, f.evaluat_de);
    elsif f.evaluare = 'respinsa' and (v_eval = 'eligibila' or coalesce(v_etapa, 'cercetat') <> 'cercetat'
          or nullif(e ->> 'link_demo', '') is not null or v_email_la is not null or v_whatsapp_la is not null or v_telefon_la is not null) then
      n.evaluare := 'eligibila';
      n.evaluare_motiv := null;
      n.evaluat_la := coalesce(v_eval_la, now());
      n.evaluat_de := coalesce(v_eval_de, f.evaluat_de);
    elsif f.evaluare = 'respinsa' then
      n.site_vechi := f.site_vechi; n.oras := f.oras; n.judet := f.judet; n.telefon := f.telefon; n.email := f.email;
      n.persoana_contact := f.persoana_contact; n.lot := f.lot; n.slug := f.slug; n.date_extra := f.date_extra;
      n.evaluare_motiv := coalesce(v_eval_motiv, f.evaluare_motiv);
      n.evaluat_de := coalesce(v_eval_de, f.evaluat_de);
    elsif v_eval = 'eligibila' and f.evaluare is null then
      n.evaluare := 'eligibila';
      n.evaluat_la := coalesce(f.evaluat_la, v_eval_la, now());
      n.evaluat_de := coalesce(f.evaluat_de, v_eval_de);
    end if;

    if n.telefon is distinct from f.telefon then
      n.telefon_gresit := false;
    end if;

    if v_etapa is not null and v_etapa <> f.etapa then
      if v_etapa = 'nu_contacta' then
        n.etapa := 'nu_contacta';
      elsif f.etapa = 'nu_contacta' then
        v_etape_pastrate := v_etape_pastrate + 1;
      elsif v_etapa = 'respins' and public.prospectare_rang_etapa(f.etapa) is not null then
        n.etapa := 'respins';
      elsif public.prospectare_rang_etapa(v_etapa) is not null and public.prospectare_rang_etapa(f.etapa) is not null
            and public.prospectare_rang_etapa(v_etapa) > public.prospectare_rang_etapa(f.etapa) then
        n.etapa := v_etapa;
      else
        v_etape_pastrate := v_etape_pastrate + 1;
      end if;
    end if;

    if coalesce((e ->> 'de_refacut')::boolean, false) and not f.de_refacut then
      n.de_refacut := true;
      if n.etapa = 'site_gata' and f.email_la is null and f.whatsapp_la is null and f.telefon_la is null then
        n.etapa := 'site_in_lucru';
      end if;
    elsif (e ->> 'de_refacut') is not null and not (e ->> 'de_refacut')::boolean and f.de_refacut and v_import then
      n.de_refacut := false;
    end if;

    if (v_email_la is not null and f.email_la is null) or (v_whatsapp_la is not null and f.whatsapp_la is null)
       or (v_telefon_la is not null and f.telefon_la is null) then
      if f.etapa = 'nu_contacta' then
        v_conflicte := v_conflicte || jsonb_build_object('nr', f.nr, 'domeniu', v_dom, 'motiv', '„Nu contacta”: nu primește canal nou');
      else
        n.email_la := coalesce(f.email_la, v_email_la);
        if f.whatsapp_la is null and v_whatsapp_la is not null then
          n.whatsapp_la := v_whatsapp_la;
          n.whatsapp_cont := v_whatsapp_cont;
        end if;
        n.telefon_la := coalesce(f.telefon_la, v_telefon_la);
        v_canale_noi := v_canale_noi + 1;
      end if;
    end if;

    if row(n.nume, n.site_vechi, n.nisa, n.oras, n.judet, n.scor, n.telefon, n.email, n.persoana_contact, n.lot, n.slug,
           n.date_extra, n.link_demo, n.captura_url, n.etapa, n.email_la, n.whatsapp_la, n.whatsapp_cont, n.telefon_la, n.de_refacut,
           n.site_gata_la, n.construit_de, n.demo_verificat, n.telefon_gresit, n.evaluare, n.evaluare_motiv, n.evaluat_la, n.evaluat_de)
       is distinct from
       row(f.nume, f.site_vechi, f.nisa, f.oras, f.judet, f.scor, f.telefon, f.email, f.persoana_contact, f.lot, f.slug,
           f.date_extra, f.link_demo, f.captura_url, f.etapa, f.email_la, f.whatsapp_la, f.whatsapp_cont, f.telefon_la, f.de_refacut,
           f.site_gata_la, f.construit_de, f.demo_verificat, f.telefon_gresit, f.evaluare, f.evaluare_motiv, f.evaluat_la, f.evaluat_de) then
      v_actualizate := v_actualizate + 1;
      if not p_proba then
        perform set_config('prospectare.motiv', case when v_import then 'Import din auto-web-rebuilder' else 'Actualizare de la robot' end, true);
        update public.prospectare_firme set
          nume = n.nume, site_vechi = n.site_vechi, nisa = n.nisa, oras = n.oras, judet = n.judet, scor = n.scor,
          telefon = n.telefon, email = n.email, persoana_contact = n.persoana_contact, lot = n.lot, slug = n.slug,
          date_extra = n.date_extra, link_demo = n.link_demo, captura_url = n.captura_url, etapa = n.etapa,
          email_la = n.email_la, whatsapp_la = n.whatsapp_la, whatsapp_cont = n.whatsapp_cont, telefon_la = n.telefon_la,
          de_refacut = n.de_refacut, site_gata_la = n.site_gata_la, construit_de = n.construit_de,
          demo_verificat = n.demo_verificat, telefon_gresit = n.telefon_gresit,
          evaluare = n.evaluare, evaluare_motiv = n.evaluare_motiv, evaluat_la = n.evaluat_la, evaluat_de = n.evaluat_de
        where id = f.id;
      end if;
    else
      v_neschimbate := v_neschimbate + 1;
    end if;
  end loop;

  if not p_proba then
    perform setval('public.prospectare_firme_nr_seq',
      greatest((select coalesce(max(nr), 0) from public.prospectare_firme), (select last_value from public.prospectare_firme_nr_seq), 1));
  end if;

  return jsonb_build_object(
    'proba', p_proba,
    'adaugate', v_adaugate,
    'actualizate', v_actualizate,
    'neschimbate', v_neschimbate,
    'etape_pastrate', v_etape_pastrate,
    'canale_noi', v_canale_noi,
    'respinse', v_respinse,
    'nr_ocupat', v_nr_ocupat,
    'conflicte', v_conflicte
  );
end;
$$;

-- 10. Conturile WhatsApp: titularul -------------------------------------------------------------------------

drop function if exists public.prospectare_salveaza_cont_whatsapp(smallint, text, text, integer, boolean, text);
create or replace function public.prospectare_salveaza_cont_whatsapp(
  p_id smallint, p_nume text, p_telefon text, p_limita integer, p_activ boolean, p_autor text, p_titular text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id smallint := p_id;
  v_titular text := nullif(btrim(coalesce(p_titular, '')), '');
begin
  if nullif(btrim(p_nume), '') is null then
    raise exception 'Contul are nevoie de un nume.' using errcode = 'PR422';
  end if;
  if regexp_replace(coalesce(p_telefon, ''), '\D', '', 'g') !~ '^(40|0)?7[0-9]{8}$' then
    raise exception 'Numărul contului trebuie să fie un mobil românesc (+40 7xx xxx xxx).' using errcode = 'PR422';
  end if;
  if p_limita is null or p_limita < 0 or p_limita > 1000 then
    raise exception 'Limita pe zi: între 0 și 1000.' using errcode = 'PR422';
  end if;
  if v_titular is not null and char_length(v_titular) > 60 then
    raise exception 'Titularul: cel mult 60 de caractere.' using errcode = 'PR422';
  end if;
  if v_id is null then
    select coalesce(max(id), 0) + 1 into v_id from public.prospectare_conturi_whatsapp;
    if v_id > 99 then
      raise exception 'Sunt deja 99 de conturi.' using errcode = 'PR422';
    end if;
    insert into public.prospectare_conturi_whatsapp (id, nume, telefon, limita_zi, activ, ordine, actualizat_de, titular)
    values (v_id, btrim(p_nume), btrim(p_telefon), p_limita, coalesce(p_activ, true), v_id, p_autor, v_titular);
  else
    update public.prospectare_conturi_whatsapp
      set nume = btrim(p_nume), telefon = btrim(p_telefon), limita_zi = p_limita, activ = coalesce(p_activ, activ),
          titular = case when p_titular is null then titular else v_titular end,
          actualizat_la = now(), actualizat_de = p_autor
      where id = v_id;
    if not found then
      raise exception 'Contul % nu există.', v_id using errcode = 'PR404';
    end if;
  end if;
  return (select to_jsonb(c) from public.prospectare_conturi_whatsapp c where id = v_id);
end;
$$;

-- 11. Fișa firmei: „A răspuns”, cu o notă ---------------------------------------------------------------------

create or replace function public.prospectare_marcheaza_raspuns(p_firma uuid, p_canal text, p_nota text, p_autor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.prospectare_firme%rowtype;
begin
  if p_canal is not null and p_canal not in ('email', 'whatsapp', 'telefon') then
    raise exception 'Canal necunoscut: %.', p_canal using errcode = 'PR422';
  end if;
  select * into f from public.prospectare_firme where id = p_firma for update;
  if not found then
    raise exception 'Firma nu există.' using errcode = 'PR404';
  end if;
  perform set_config('prospectare.autor', left(coalesce(nullif(btrim(p_autor), ''), 'admin'), 200), true);
  -- Un răspuns de om: al doilea canal nu mai pleacă singur (prospectare_a_raspuns), continuă omul.
  perform public.prospectare_noteaza(f.id, 'raspuns', p_canal,
    jsonb_strip_nulls(jsonb_build_object('tip', 'om', 'sursa', 'admin', 'nota', nullif(left(btrim(coalesce(p_nota, '')), 2000), ''))));
  return jsonb_build_object('nr', f.nr, 'etapa', f.etapa);
end;
$$;

-- 12. Șablonul WhatsApp implicit (o dată: un șablon care are deja {nume_titular} rămâne) ---------------------

update public.prospectare_setari
  set sablon_whatsapp_primul = 'Bună ziua, sunt {nume_titular} de la MeridianX.' || E'\n\n'
    || 'Pe site-ul {nume_firma}, {problema}.' || E'\n\n'
    || 'Am pregătit o variantă nouă, pe care o puteți vedea aici:' || E'\n'
    || '{link_demo}' || E'\n\n'
    || 'Pe scurt, ce am schimbat:' || E'\n'
    || '{puncte}' || E'\n\n'
    || 'Spuneți-mi ce părere aveți și, dacă vă place, vă explic pașii ca s-o punem online. Dacă nu vă interesează, scrieți NU și nu vă mai deranjăm.',
      actualizat_la = now(), actualizat_de = 'migrarea 39'
  where id = 1 and position('{nume_titular}' in coalesce(sablon_whatsapp_primul, '')) = 0;

-- 13. Drepturi ------------------------------------------------------------------------------------------------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.prospectare_canal_activ(text)',
    'public.prospectare_canal_suspendat_text(text)',
    'public.prospectare_seteaza_canal(text, boolean, text, text)',
    'public.prospectare_umple_zi(date, text)',
    'public.prospectare_completeaza_azi(text)',
    'public.prospectare_ciclu_zi(date, boolean)',
    'public.prospectare_scoate_din_coada(bigint[], text)',
    'public.prospectare_whatsapp_trimis(uuid, smallint, text)',
    'public.prospectare_whatsapp_anuleaza(uuid, text)',
    'public.prospectare_email_cere_canal(uuid, text, integer, text, integer)',
    'public.prospectare_coada_email(uuid, text, text)',
    'public.prospectare_whatsapp_coada(integer, integer)',
    'public.prospectare_rezumat_distributie()',
    'public.prospectare_distribuie(text, date, uuid[], text[], integer[], text, jsonb, boolean, text)',
    'public.prospectare_de_construit(public.prospectare_firme)',
    'public.prospectare_aloca_constructie(uuid[], text[], integer[], boolean, text)',
    'public.prospectare_lista_mea(uuid, text)',
    'public.prospectare_rezerva_urmatoarea(uuid, text, text)',
    'public.prospectare_lacat_publicare(uuid, text, text)',
    'public.prospectare_puncte(jsonb)',
    'public.prospectare_termina_lot(uuid, jsonb, text)',
    'public.prospectare_upsert_firme(jsonb, text, text, boolean)',
    'public.prospectare_salveaza_cont_whatsapp(smallint, text, text, integer, boolean, text, text)',
    'public.prospectare_marcheaza_raspuns(uuid, text, text, text)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke all on function %s from anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;

-- Verificarea (toate rândurile trebuie să fie `true`).
select 'numerele firmelor (nr) și ale site-urilor (nr_site) au rămas neschimbate' as verificare,
  not exists (select 1 from pg_temp.m39_numere s join public.prospectare_firme f on f.id = s.id
    where f.nr <> s.nr or (s.nr_site is not null and f.nr_site is distinct from s.nr_site)) as ok
union all
select 'programarea automată oprită: completarea zilei nu mai programează, triggerele pe limite scoase',
  (public.prospectare_completeaza_azi('verificare') ->> 'email')::integer = 0
  and not exists (select 1 from pg_trigger where tgname in ('prospectare_conturi_whatsapp_completeaza', 'prospectare_conturi_whatsapp_completeaza_nou',
    'prospectare_casute_completeaza', 'prospectare_casute_completeaza_nou', 'prospectare_setari_completeaza') and not tgisinternal)
union all
select format('canalele: email %s, WhatsApp %s, apel %s',
    coalesce((select case when activ then 'activ' else 'suspendat (' || coalesce(motiv, 'fără motiv') || ')' end from public.prospectare_canale where canal = 'email'), '?'),
    coalesce((select case when activ then 'activ' else 'suspendat' end from public.prospectare_canale where canal = 'whatsapp'), '?'),
    coalesce((select case when activ then 'activ' else 'suspendat' end from public.prospectare_canale where canal = 'telefon'), '?')),
  (select count(*) = 3 from public.prospectare_canale)
union all
select 'listele de construcție (alocat_lui), lacătul de publicare, titularii conturilor',
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prospectare_firme' and column_name = 'alocat_lui')
  and exists (select 1 from public.prospectare_lacate where cheie = 'publicare')
  and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prospectare_conturi_whatsapp' and column_name = 'titular')
union all
select format('conturile WhatsApp: %s', coalesce((select string_agg(nume || ' = ' || coalesce(titular, '—'), ', ' order by ordine, id) from public.prospectare_conturi_whatsapp), 'niciunul')),
  true
union all
select format('programate și netrimise: azi %s, restanțe %s (rămân pe contul lor)',
    (select count(*) from public.prospectare_programari where zi = public.prospectare_azi() and stare = 'programata'),
    (select count(*) from public.prospectare_programari where zi < public.prospectare_azi() and stare = 'programata')),
  true
union all
select 'funcțiile noi doar pentru cheia de service',
  not has_function_privilege('authenticated', 'public.prospectare_distribuie(text, date, uuid[], text[], integer[], text, jsonb, boolean, text)', 'execute')
  and not has_function_privilege('anon', 'public.prospectare_lacat_publicare(uuid, text, text)', 'execute')
  and has_function_privilege('service_role', 'public.prospectare_lista_mea(uuid, text)', 'execute')
  and (select count(*) = 1 from pg_proc where proname = 'prospectare_salveaza_cont_whatsapp' and pronamespace = 'public'::regnamespace);
