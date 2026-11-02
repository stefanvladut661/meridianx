-- ============================================================
-- Prospectare, migrarea 6: mai multe canale pe firmă, niciodată același
-- canal de două ori.
--
-- Regula nouă (2 nov): o firmă poate fi contactată pe email ȘI pe WhatsApp,
-- dar niciodată de două ori pe același canal. În loc de un singur câmp
-- `canal`, fiecare canal are data lui: `email_la`, `whatsapp_la`,
-- `telefon_la`. Odată pusă, data unui canal nu se mai schimbă (trigger,
-- PR409), oricine ar scrie. Singura excepție rămâne golirea telefonului după
-- ultima încercare „Nu răspunde”.
--
-- - Telefonul rămâne separat: în „Apeluri azi” intră doar firme fără email și
--   fără WhatsApp; o firmă de pe telefon nu mai primește email sau WhatsApp
--   (excepția acceptată: continuarea pe WhatsApp după „Interesat”, doar în
--   activitate).
-- - Emailul cere canalul înainte de trimitere: o firmă care a primit deja
--   email e refuzată (409).
-- - Lista de WhatsApp e continuă, nu pe zi: o firmă intră singură în ea când
--   are site-ul gata, cu link, și număr de mobil. Firmele care au și email
--   intră doar după ce a plecat emailul, la minimum o zi. Contorul „trimise azi
--   X / 30” pe cont e doar avertisment.
-- - „Nu contacta”, venit pe orice canal, blochează toate canalele.
--
-- Coloanele vechi (`canal`, `canal_setat_la`, `canal_setat_de`) rămân în tabel,
-- goale și blocate, ca fișierul 28–33 să se poată rula din nou.
-- Doar cheia de service. Se rulează după 28–32. Se poate rula de mai multe ori.
-- ============================================================

-- Coloanele noi -------------------------------------------------------------------

alter table public.prospectare_firme add column if not exists email_la timestamptz;
alter table public.prospectare_firme add column if not exists whatsapp_la timestamptz;
alter table public.prospectare_firme add column if not exists whatsapp_cont smallint;
alter table public.prospectare_firme add column if not exists telefon_la timestamptz;

comment on column public.prospectare_firme.email_la is 'Când a primit firma emailul (robotul cere canalul chiar înainte de trimitere). O singură dată.';
comment on column public.prospectare_firme.whatsapp_la is 'Când a primit firma mesajul pe WhatsApp. O singură dată.';
comment on column public.prospectare_firme.whatsapp_cont is 'Contul WhatsApp (1–9) de pe care a plecat mesajul.';
comment on column public.prospectare_firme.telefon_la is 'Când a intrat firma în lista de apeluri. Se golește doar după ultima încercare „Nu răspunde”.';
comment on column public.prospectare_firme.canal is 'Vechi (până la migrarea 33), gol și nefolosit.';
comment on column public.prospectare_firme.canal_setat_la is 'Vechi (până la migrarea 33), gol și nefolosit.';
comment on column public.prospectare_firme.canal_setat_de is 'Vechi (până la migrarea 33), gol și nefolosit.';

-- Regulile firmei: fiecare canal o singură dată ---------------------------------------

create or replace function public.prospectare_firme_reguli()
returns trigger
language plpgsql
as $$
begin
  new.domeniu := public.prospectare_domeniu(new.domeniu);

  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.nr <> old.nr then
      raise exception 'Numărul și id-ul unei firme nu se schimbă (#%).', old.nr using errcode = 'PR400';
    end if;
    new.creat_la := old.creat_la;

    -- Același canal nu se folosește de două ori: data lui, odată pusă, rămâne.
    if old.email_la is not null and new.email_la is distinct from old.email_la then
      raise exception 'Firma #% a primit deja email (%): același canal nu se folosește de două ori.', old.nr,
        to_char(old.email_la at time zone 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI') using errcode = 'PR409';
    end if;
    if old.whatsapp_la is not null and (new.whatsapp_la is distinct from old.whatsapp_la or new.whatsapp_cont is distinct from old.whatsapp_cont) then
      raise exception 'Firma #% a primit deja WhatsApp (%): același canal nu se folosește de două ori.', old.nr,
        to_char(old.whatsapp_la at time zone 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI') using errcode = 'PR409';
    end if;
    if old.telefon_la is not null and new.telefon_la is distinct from old.telefon_la then
      -- Singura excepție: după ultima încercare „Nu răspunde”, firma iese din listă și își pierde telefonul.
      -- `coalesce`: fără setare, `current_setting` dă NULL, iar `not (… and NULL)` ar lăsa schimbarea să treacă.
      if not (new.telefon_la is null and coalesce(current_setting('prospectare.reseteaza_canal', true), '') = 'da') then
        raise exception 'Firma #% e deja pe telefon: același canal nu se folosește de două ori.', old.nr using errcode = 'PR409';
      end if;
    end if;

    -- „Nu contacta” blochează toate canalele: nimic nou după ce a cerut asta.
    if old.etapa = 'nu_contacta' and (
         (new.email_la is not null and old.email_la is null)
      or (new.whatsapp_la is not null and old.whatsapp_la is null)
      or (new.telefon_la is not null and old.telefon_la is null)) then
      raise exception 'Firma #% e „Nu contacta”: nu mai primește niciun canal.', old.nr using errcode = 'PR410';
    end if;
  end if;

  if new.whatsapp_cont is not null and new.whatsapp_la is null then
    raise exception 'Contul WhatsApp se pune doar odată cu data mesajului (#%).', new.nr using errcode = 'PR422';
  end if;

  new.actualizat_la := now();
  return new;
end;
$$;

-- Activitatea: fiecare canal nou (sau telefonul golit) intră acolo, cu motivul.
create or replace function public.prospectare_firme_jurnal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_motiv text := nullif(current_setting('prospectare.motiv', true), '');
begin
  if tg_op = 'INSERT' then
    perform public.prospectare_noteaza(new.id, 'creata', null,
      jsonb_strip_nulls(jsonb_build_object('etapa', new.etapa, 'domeniu', new.domeniu,
        'email_la', new.email_la, 'whatsapp_la', new.whatsapp_la, 'telefon_la', new.telefon_la)));
    return null;
  end if;

  if new.etapa is distinct from old.etapa then
    perform public.prospectare_noteaza(new.id, 'etapa', null,
      jsonb_strip_nulls(jsonb_build_object('din', old.etapa, 'in', new.etapa, 'motiv', v_motiv)));
  end if;
  if new.email_la is distinct from old.email_la then
    perform public.prospectare_noteaza(new.id, 'canal', 'email',
      jsonb_strip_nulls(jsonb_build_object('in', 'email', 'la', new.email_la, 'motiv', v_motiv)));
  end if;
  if new.whatsapp_la is distinct from old.whatsapp_la then
    perform public.prospectare_noteaza(new.id, 'canal', 'whatsapp',
      jsonb_strip_nulls(jsonb_build_object('in', 'whatsapp', 'la', new.whatsapp_la, 'cont', new.whatsapp_cont, 'motiv', v_motiv)));
  end if;
  if new.telefon_la is distinct from old.telefon_la then
    perform public.prospectare_noteaza(new.id, 'canal', 'telefon',
      jsonb_strip_nulls(case when new.telefon_la is null
        then jsonb_build_object('din', 'telefon', 'motiv', v_motiv)
        else jsonb_build_object('in', 'telefon', 'la', new.telefon_la, 'motiv', v_motiv) end));
  end if;
  return null;
end;
$$;

-- Datele din modelul vechi (un singur canal) trec pe canale -----------------------------
-- Rulată din nou, nu mai găsește nimic: coloana veche e goală după prima rulare.
-- Triggerele stau oprite doar în acest bloc (atomic): mutarea nu e o întâmplare nouă.

do $$
begin
  if exists (select 1 from public.prospectare_firme where canal is not null or canal_setat_la is not null or canal_setat_de is not null)
     or exists (select 1 from public.prospectare_liste_zi where canal = 'whatsapp') then
    alter table public.prospectare_firme disable trigger user;

    update public.prospectare_firme f set
      email_la = coalesce(f.email_la,
        case when f.canal = 'email' then f.canal_setat_la end,
        (select min(a.la) from public.prospectare_activitate a where a.firma_id = f.id and a.tip = 'email')),
      -- WhatsApp: în modelul vechi canalul se punea la intrarea în listă; acum contează doar mesajul trimis.
      whatsapp_la = coalesce(f.whatsapp_la,
        (select min(a.la) from public.prospectare_activitate a
          where a.firma_id = f.id and a.tip = 'whatsapp' and coalesce(a.detalii ->> 'continuare_apel', '') <> 'true'),
        (select min(l.actualizat_la) from public.prospectare_liste_zi l where l.firma_id = f.id and l.canal = 'whatsapp' and l.rezultat = 'trimis')),
      telefon_la = coalesce(f.telefon_la, case when f.canal = 'telefon' then f.canal_setat_la end),
      canal = null, canal_setat_la = null, canal_setat_de = null;

    update public.prospectare_firme f set whatsapp_cont = coalesce(
        (select (a.detalii ->> 'cont')::smallint from public.prospectare_activitate a
          where a.firma_id = f.id and a.tip = 'whatsapp' and a.detalii ->> 'cont' ~ '^[1-9]$' order by a.la limit 1),
        (select l.cont_whatsapp from public.prospectare_liste_zi l where l.firma_id = f.id and l.canal = 'whatsapp' and l.rezultat = 'trimis' order by l.actualizat_la limit 1))
      where f.whatsapp_la is not null and f.whatsapp_cont is null;

    -- Listele de WhatsApp pe zi dispar: cele trimise sunt în whatsapp_la și în activitate, restul revin în lista continuă.
    delete from public.prospectare_liste_zi where canal = 'whatsapp';

    alter table public.prospectare_firme enable trigger user;
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prospectare_firme_canal_vechi_gol') then
    alter table public.prospectare_firme add constraint prospectare_firme_canal_vechi_gol
      check (canal is null and canal_setat_la is null and canal_setat_de is null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prospectare_firme_whatsapp_cont') then
    alter table public.prospectare_firme add constraint prospectare_firme_whatsapp_cont
      check (whatsapp_cont is null or (whatsapp_cont between 1 and 9 and whatsapp_la is not null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prospectare_liste_zi_doar_telefon') then
    alter table public.prospectare_liste_zi add constraint prospectare_liste_zi_doar_telefon check (canal = 'telefon');
  end if;
end;
$$;

create index if not exists prospectare_firme_whatsapp_coada_idx on public.prospectare_firme (scor desc nulls last, nr)
  where whatsapp_la is null and telefon_la is null and este_mobil and link_demo is not null and etapa in ('site_gata', 'email_trimis');
create index if not exists prospectare_firme_rezerva_telefon_idx on public.prospectare_firme (scor desc nulls last, nr)
  where etapa = 'site_gata' and email_la is null and whatsapp_la is null and telefon_la is null and link_demo is not null;
create index if not exists prospectare_firme_whatsapp_la_idx on public.prospectare_firme (whatsapp_la desc) where whatsapp_la is not null;

-- Lista de WhatsApp, continuă ---------------------------------------------------------
-- O firmă e în listă dacă: are site gata (sau a primit doar emailul), link demo,
-- mobil, n-a primit încă WhatsApp, nu e pe telefon, nu a răspuns la email și,
-- dacă are adresă de email, emailul a plecat de cel puțin o zi.

create or replace function public.prospectare_whatsapp_eligibila(f public.prospectare_firme)
returns boolean
language sql
stable
set search_path = public
as $$
  select f.etapa in ('site_gata', 'email_trimis')
    and f.link_demo is not null
    and f.este_mobil
    and f.whatsapp_la is null
    and f.telefon_la is null
    and (f.email is null or f.email_la <= now() - interval '1 day')
    and not exists (
      select 1 from public.prospectare_activitate a
      where a.firma_id = f.id and a.tip = 'raspuns' and coalesce(a.detalii ->> 'tip', '') <> 'automat')
$$;

create or replace function public.prospectare_whatsapp_coada(p_limit integer default 200, p_offset integer default 0)
returns setof public.prospectare_firme
language sql
stable
security definer
set search_path = public
as $$
  select f.*
  from public.prospectare_firme f
  where f.whatsapp_la is null and f.telefon_la is null and f.este_mobil and f.link_demo is not null
    and f.etapa in ('site_gata', 'email_trimis')
    and public.prospectare_whatsapp_eligibila(f)
  order by f.scor desc nulls last, f.nr
  limit least(greatest(coalesce(p_limit, 200), 1), 1000)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

-- Mesajul WhatsApp: se cere înainte de deschidere, ca emailul. A doua oară → 409.
create or replace function public.prospectare_whatsapp_trimis(p_firma uuid, p_cont smallint, p_autor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.prospectare_firme%rowtype;
  v_limita integer;
  v_trimise integer;
begin
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
  if f.telefon_la is not null then
    raise exception 'Firma #% e pe telefon (lista de apeluri): fără WhatsApp.', f.nr using errcode = 'PR409';
  end if;
  if not public.prospectare_whatsapp_eligibila(f) then
    raise exception 'Firma #% nu e în lista de WhatsApp: %.', f.nr,
      case
        when f.etapa not in ('site_gata', 'email_trimis') then format('etapa e „%s”', f.etapa)
        when f.link_demo is null then 'site-ul demo nu are link'
        when not f.este_mobil then 'numărul nu e de mobil'
        when f.email is not null and f.email_la is null then 'are adresă de email, iar emailul n-a plecat încă'
        when f.email is not null then format('emailul a plecat %s; WhatsApp-ul merge după o zi', to_char(f.email_la at time zone 'Europe/Bucharest', 'DD.MM HH24:MI'))
        else 'a răspuns la email'
      end using errcode = 'PR422';
  end if;
  if p_cont is null or p_cont not between 1 and 9 then
    raise exception 'Alege contul WhatsApp (1–9).' using errcode = 'PR422';
  end if;
  select nullif(whatsapp_pe_cont ->> p_cont::text, '')::integer into v_limita from public.prospectare_setari where id = 1;
  if v_limita is null then
    raise exception 'Contul WhatsApp % nu e în Setări.', p_cont using errcode = 'PR422';
  end if;

  perform set_config('prospectare.autor', coalesce(nullif(btrim(p_autor), ''), 'admin'), true);
  perform set_config('prospectare.motiv', format('WhatsApp de pe contul %s', p_cont), true);
  update public.prospectare_firme
    set whatsapp_la = now(), whatsapp_cont = p_cont,
        etapa = case when etapa in ('site_gata', 'email_trimis') then 'whatsapp_trimis' else etapa end
    where id = f.id;
  perform public.prospectare_noteaza(f.id, 'whatsapp', 'whatsapp', jsonb_build_object('cont', p_cont));

  select count(*) into v_trimise from public.prospectare_firme
    where whatsapp_cont = p_cont and whatsapp_la >= public.prospectare_inceput_azi();
  -- Limita contului e doar avertisment: mesajul a plecat oricum.
  return jsonb_build_object('nr', f.nr, 'cont', p_cont, 'trimise_azi', v_trimise, 'limita', v_limita, 'peste_limita', v_trimise > v_limita);
end;
$$;

drop function if exists public.prospectare_marcheaza_whatsapp(bigint, text);

-- Lista de apeluri: doar telefon ----------------------------------------------------

create or replace function public.prospectare_liste_reguli()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
begin
  select etapa, telefon_la, nr into f from public.prospectare_firme where id = new.firma_id;
  if f.etapa = 'nu_contacta' then
    raise exception 'Firma #% e „Nu contacta”: nu intră în liste.', f.nr using errcode = 'PR410';
  end if;
  if new.canal <> 'telefon' then
    raise exception 'Lista zilei e doar de telefon; WhatsApp-ul are lista lui, continuă.' using errcode = 'PR422';
  end if;
  if f.telefon_la is null then
    raise exception 'Firma #% nu e pe telefon: intră în listă doar prin import.', f.nr using errcode = 'PR409';
  end if;
  new.actualizat_la := now();
  return new;
end;
$$;

-- Importul în lista de apeluri: firme cu site gata, link, telefon, fără email și
-- fără WhatsApp (și fără telefon). Primesc telefonul în aceeași tranzacție.
create or replace function public.prospectare_importa_lista_zi(
  p_utilizator text,
  p_canal text,
  p_numar integer,
  p_filtre jsonb default '{}'::jsonb,
  p_cont_whatsapp smallint default null,
  p_autor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_azi date := public.prospectare_azi();
  v_luate integer := 0;
  v_nume text := case p_utilizator when 'stefan' then 'Ștefan' when 'vladut' then 'Vlăduț' else p_utilizator end;
  v_nisa text := nullif(btrim(p_filtre ->> 'nisa'), '');
  v_oras text := nullif(btrim(p_filtre ->> 'oras'), '');
  v_judet text := nullif(btrim(p_filtre ->> 'judet'), '');
  v_scor integer := nullif(p_filtre ->> 'scor_min', '')::integer;
  v_mobil boolean := coalesce((p_filtre ->> 'doar_mobil')::boolean, false);
  r record;
begin
  if p_utilizator not in ('stefan', 'vladut') then
    raise exception 'Utilizator necunoscut: %.', p_utilizator using errcode = 'PR422';
  end if;
  if p_canal is distinct from 'telefon' then
    raise exception 'Doar lista de apeluri se importă. WhatsApp-ul are lista lui, continuă: firmele intră singure.' using errcode = 'PR422';
  end if;
  if p_numar is null or p_numar < 1 or p_numar > 500 then
    raise exception 'Câte firme: între 1 și 500.' using errcode = 'PR422';
  end if;

  perform set_config('prospectare.autor', coalesce(nullif(btrim(p_autor), ''), v_nume), true);
  perform set_config('prospectare.motiv', format('Adăugată în lista de apeluri a lui %s', v_nume), true);

  for r in
    select f.id
    from public.prospectare_firme f
    where f.etapa = 'site_gata'
      and f.email_la is null and f.whatsapp_la is null and f.telefon_la is null
      and f.link_demo is not null
      and f.telefon is not null
      and (not v_mobil or f.este_mobil)
      and (v_nisa is null or f.nisa = v_nisa)
      and (v_oras is null or f.oras = v_oras)
      and (v_judet is null or f.judet = v_judet)
      and (v_scor is null or f.scor >= v_scor)
    order by f.scor desc nulls last, f.nr
    limit p_numar
    for update of f skip locked
  loop
    update public.prospectare_firme set telefon_la = now()
      where id = r.id and etapa = 'site_gata' and email_la is null and whatsapp_la is null and telefon_la is null;
    if found then
      insert into public.prospectare_liste_zi (data, utilizator, canal, firma_id)
      values (v_azi, p_utilizator, 'telefon', r.id);
      v_luate := v_luate + 1;
    end if;
  end loop;

  return jsonb_build_object('adaugate', v_luate, 'cerute', p_numar);
end;
$$;

-- Rezultatul unui apel: ca înainte, doar că ultima încercare golește `telefon_la`.
create or replace function public.prospectare_seteaza_rezultat(
  p_lista bigint,
  p_rezultat text,
  p_nota text default null,
  p_suna_inapoi_la timestamptz default null,
  p_autor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.prospectare_liste_zi%rowtype;
  f public.prospectare_firme%rowtype;
  v_limita integer;
  v_incercari integer;
  v_nume text;
  v_etapa text;
begin
  select * into l from public.prospectare_liste_zi where id = p_lista for update;
  if not found then
    raise exception 'Rândul din listă nu mai există (poate a fost scos între timp).' using errcode = 'PR404';
  end if;
  if p_rezultat not in ('nu_raspunde', 'interesat', 'nu_vrea', 'suna_inapoi', 'numar_gresit') then
    raise exception 'Rezultat necunoscut: %.', p_rezultat using errcode = 'PR422';
  end if;
  if p_rezultat = 'suna_inapoi' and p_suna_inapoi_la is null then
    raise exception 'Alege ora la care suni înapoi.' using errcode = 'PR422';
  end if;

  select * into f from public.prospectare_firme where id = l.firma_id for update;
  v_nume := case l.utilizator when 'stefan' then 'Ștefan' when 'vladut' then 'Vlăduț' else l.utilizator end;
  perform set_config('prospectare.autor', coalesce(nullif(btrim(p_autor), ''), v_nume), true);
  select incercari_max into v_limita from public.prospectare_setari where id = 1;
  v_limita := coalesce(v_limita, 3);
  v_incercari := case when p_rezultat = 'nu_raspunde' then l.incercari + 1 else l.incercari end;

  -- Ultima încercare fără răspuns: firma iese din listă și își pierde telefonul
  -- (singura golire de canal permisă), apoi revine în rezervă.
  if p_rezultat = 'nu_raspunde' and v_incercari >= v_limita then
    perform set_config('prospectare.reseteaza_canal', 'da', true);
    perform set_config('prospectare.motiv', format('Nu a răspuns la %s încercări: iese din listă și își pierde canalul telefon', v_limita), true);
    update public.prospectare_firme
      set telefon_la = null, etapa = case when etapa in ('site_gata', 'sunat') then 'site_gata' else etapa end
      where id = f.id;
    perform set_config('prospectare.reseteaza_canal', '', true);
    perform set_config('prospectare.motiv', '', true);
    delete from public.prospectare_liste_zi where id = l.id;
    perform public.prospectare_noteaza(f.id, 'apel', 'telefon',
      jsonb_build_object('rezultat', p_rezultat, 'incercari', v_incercari, 'limita', v_limita, 'revenit_in_rezerva', true));
    return jsonb_build_object('revenit', true, 'incercari', v_incercari, 'limita', v_limita);
  end if;

  if p_rezultat = 'numar_gresit' then
    perform set_config('prospectare.motiv', 'Număr greșit la apel', true);
    update public.prospectare_firme
      set etapa = 'nu_contacta', nota = coalesce(nullif(btrim(nota), '') || E'\n', '') || 'Număr greșit la apel.'
      where id = f.id;
    delete from public.prospectare_liste_zi where id = l.id;
    perform public.prospectare_noteaza(f.id, 'apel', 'telefon',
      jsonb_strip_nulls(jsonb_build_object('rezultat', p_rezultat, 'nota', nullif(btrim(p_nota), ''))));
    return jsonb_build_object('revenit', false, 'scoasa', true, 'incercari', v_incercari);
  end if;

  update public.prospectare_liste_zi
    set rezultat = p_rezultat,
        incercari = v_incercari,
        nota = coalesce(p_nota, nota),
        suna_inapoi_la = case when p_rezultat = 'suna_inapoi' then p_suna_inapoi_la end
    where id = l.id;

  v_etapa := case p_rezultat
    when 'interesat' then case when f.etapa = 'client' then f.etapa else 'interesat' end
    when 'nu_vrea' then 'respins'
    else case when f.etapa = 'site_gata' then 'sunat' else f.etapa end
  end;
  if v_etapa is distinct from f.etapa then
    update public.prospectare_firme set etapa = v_etapa where id = f.id;
  end if;

  perform public.prospectare_noteaza(f.id, 'apel', 'telefon',
    jsonb_strip_nulls(jsonb_build_object('rezultat', p_rezultat, 'incercari', v_incercari, 'limita', v_limita,
      'suna_inapoi_la', p_suna_inapoi_la, 'nota', nullif(btrim(p_nota), ''))));
  return jsonb_build_object('revenit', false, 'incercari', v_incercari, 'limita', v_limita);
end;
$$;

-- Continuarea pe WhatsApp după „Interesat” (migrarea 32): firma e pe telefon.
create or replace function public.prospectare_continua_pe_whatsapp(p_lista bigint, p_autor text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.prospectare_liste_zi%rowtype;
  f public.prospectare_firme%rowtype;
  v_cheie text;
  v_nume text;
begin
  select * into l from public.prospectare_liste_zi where id = p_lista;
  if not found then
    raise exception 'Rândul din listă nu mai există.' using errcode = 'PR404';
  end if;
  if l.rezultat is distinct from 'interesat' then
    raise exception 'WhatsApp după apel se deschide doar după rezultatul „Interesat”.' using errcode = 'PR409';
  end if;

  select * into f from public.prospectare_firme where id = l.firma_id;
  if f.etapa = 'nu_contacta' then
    raise exception 'Firma #% e „Nu contacta”: nu mai primește niciun mesaj.', f.nr using errcode = 'PR410';
  end if;
  if f.telefon_la is null then
    raise exception 'Firma #% nu mai e pe telefon: continuarea pe WhatsApp nu se aplică.', f.nr using errcode = 'PR409';
  end if;
  if f.telefon is null or not f.este_mobil then
    raise exception 'Firma #% are număr fix: fără WhatsApp.', f.nr using errcode = 'PR422';
  end if;

  v_cheie := 'whatsapp_dupa_apel:' || l.id;
  if exists (select 1 from public.prospectare_activitate where cheie = v_cheie) then
    return jsonb_build_object('deja', true);
  end if;

  v_nume := case l.utilizator when 'stefan' then 'Ștefan' when 'vladut' then 'Vlăduț' else l.utilizator end;
  perform set_config('prospectare.autor', coalesce(nullif(btrim(p_autor), ''), v_nume), true);
  perform public.prospectare_noteaza(f.id, 'whatsapp', 'telefon',
    jsonb_build_object('continuare_apel', true, 'text', 'Continuare apel pe WhatsApp', 'lista', l.id), v_cheie);
  return jsonb_build_object('deja', false);
end;
$$;

-- Emailul: cere canalul înainte; o firmă care a primit deja email e refuzată ----------

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
  v_limita integer;
  v_nume text;
begin
  select nume into v_nume from public.prospectare_dispozitive where id = p_dispozitiv;
  perform set_config('prospectare.autor', coalesce(v_nume, 'robot'), true);
  f := public.prospectare_gaseste_firma(p_domeniu, p_nr);

  if f.etapa in ('nu_contacta', 'respins', 'client') then
    raise exception 'Firma #% e „%”: nu se trimite email.', f.nr, f.etapa using errcode = 'PR410';
  end if;
  if f.email_la is not null then
    raise exception 'Firma #% a primit deja email (%): același canal nu se folosește de două ori.', f.nr,
      to_char(f.email_la at time zone 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI') using errcode = 'PR409';
  end if;
  if f.telefon_la is not null then
    raise exception 'Firma #% e pe telefon (lista de apeluri): emailul nu se trimite.', f.nr using errcode = 'PR409';
  end if;
  if f.email is null then
    raise exception 'Firma #% nu are adresă de email.', f.nr using errcode = 'PR422';
  end if;
  -- Emailul pleacă doar cu site-ul demo gata (linkul e în mesaj).
  if f.link_demo is null or f.etapa not in ('site_gata', 'whatsapp_trimis') then
    raise exception 'Firma #% nu are încă site demo gata, cu link: emailul nu se trimite.', f.nr using errcode = 'PR422';
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

create or replace function public.prospectare_email_eveniment(
  p_dispozitiv uuid,
  p_tip text,
  p_domeniu text,
  p_nr integer,
  p_casuta text,
  p_detalii jsonb default '{}'::jsonb,
  p_cheie text default null,
  p_limita integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.prospectare_firme%rowtype;
  z public.prospectare_casute_zi%rowtype;
  c public.prospectare_casute%rowtype;
  v_nume text;
  v_tip_raspuns text := lower(coalesce(p_detalii ->> 'tip', ''));
  v_nou bigint;
  v_cheie text := nullif(btrim(coalesce(p_cheie, '')), '');
  v_limita integer;
begin
  if p_tip not in ('trimis', 'bounce', 'raspuns') then
    raise exception 'Evenimentul de email e trimis, bounce sau raspuns, nu %.', p_tip using errcode = 'PR422';
  end if;
  if p_tip = 'raspuns' and v_tip_raspuns not in ('pozitiv', 'nu', 'automat', 'altul') then
    raise exception 'La răspuns, detalii.tip e pozitiv, nu, automat sau altul.' using errcode = 'PR422';
  end if;
  select nume into v_nume from public.prospectare_dispozitive where id = p_dispozitiv;
  perform set_config('prospectare.autor', coalesce(v_nume, 'robot'), true);
  f := public.prospectare_gaseste_firma(p_domeniu, p_nr);

  if p_tip = 'trimis' and f.email_la is null then
    raise exception 'Firma #% n-a cerut canalul email: cere-l înainte de trimitere.', f.nr using errcode = 'PR409';
  end if;

  insert into public.prospectare_activitate (firma_id, tip, canal, autor, detalii, cheie)
  values (f.id, case p_tip when 'trimis' then 'email' else p_tip end, 'email', public.prospectare_autor(),
    coalesce(p_detalii, '{}'::jsonb) || jsonb_build_object('casuta', lower(btrim(coalesce(p_casuta, '')))),
    case when v_cheie is null then null else 'email:' || p_tip || ':' || v_cheie end)
  on conflict (cheie) do nothing
  returning id into v_nou;

  -- Același eveniment a doua oară (cererea repetată): nu se mai numără.
  if v_nou is null then
    return jsonb_build_object('nou', false, 'nr', f.nr, 'etapa', f.etapa);
  end if;

  z := public.prospectare_casuta_azi(p_casuta, p_limita);
  select * into c from public.prospectare_casute where adresa = z.adresa;
  v_limita := coalesce(c.limita_zi, z.limita);

  if p_tip = 'trimis' then
    update public.prospectare_casute_zi
      set trimise = trimise + 1,
          limita_atinsa_la = case when v_limita is not null and trimise + 1 >= v_limita then coalesce(limita_atinsa_la, now()) else limita_atinsa_la end
      where adresa = z.adresa and zi = z.zi;
    if f.etapa = 'site_gata' then
      perform set_config('prospectare.motiv', 'Email trimis', true);
      update public.prospectare_firme set etapa = 'email_trimis' where id = f.id returning * into f;
    end if;
  elsif p_tip = 'bounce' then
    update public.prospectare_casute_zi set bounce = bounce + 1 where adresa = z.adresa and zi = z.zi;
  else
    update public.prospectare_casute_zi set raspunsuri = raspunsuri + 1 where adresa = z.adresa and zi = z.zi;
    -- „NU” pe email blochează toate canalele: firma iese și din lista de WhatsApp.
    if v_tip_raspuns = 'nu' and f.etapa <> 'nu_contacta' then
      perform set_config('prospectare.motiv', 'A răspuns „NU” la email', true);
      update public.prospectare_firme set etapa = 'nu_contacta' where id = f.id returning * into f;
    end if;
  end if;

  return jsonb_build_object('nou', true, 'nr', f.nr, 'etapa', f.etapa);
end;
$$;

-- Importul: datele canalelor vin din auto-web-rebuilder ------------------------------
-- Element (jsonb): ca în migrarea 30, iar canalele (doar din import): email_la,
-- whatsapp_la, whatsapp_cont, telefon_la. O dată deja în bază nu se schimbă.

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
  v_nr integer;
  v_altul uuid;
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
    -- Robotul trimite doar firme cercetate sau alese pentru construit; restul trece prin rutele lui.
    if not v_import and v_etapa is not null and v_etapa not in ('cercetat', 'site_in_lucru') then
      v_etapa := null;
    end if;
    -- Canalele: doar din import (robotul le obține prin rutele lui: email, termina).
    v_email_la := case when v_import then nullif(e ->> 'email_la', '')::timestamptz end;
    v_whatsapp_la := case when v_import then nullif(e ->> 'whatsapp_la', '')::timestamptz end;
    v_whatsapp_cont := case when v_import and v_whatsapp_la is not null then nullif(e ->> 'whatsapp_cont', '')::smallint end;
    v_telefon_la := case when v_import then nullif(e ->> 'telefon_la', '')::timestamptz end;

    select * into f from public.prospectare_firme where domeniu = v_dom for update;

    if f.id is null then
      v_nr := nullif(e ->> 'nr', '')::integer;
      if v_nr is not null then
        select id into v_altul from public.prospectare_firme where nr = v_nr;
        if v_altul is not null then
          v_conflicte := v_conflicte || jsonb_build_object('nr', v_nr, 'domeniu', v_dom, 'motiv', 'numărul e deja al altei firme');
          continue;
        end if;
      end if;
      v_adaugate := v_adaugate + 1;
      if v_email_la is not null or v_whatsapp_la is not null or v_telefon_la is not null then
        v_canale_noi := v_canale_noi + 1;
      end if;
      if not p_proba then
        insert into public.prospectare_firme (
          nr, nume, domeniu, site_vechi, nisa, oras, judet, scor, telefon, email, persoana_contact,
          etapa, email_la, whatsapp_la, whatsapp_cont, telefon_la, link_demo, captura_url, lot, slug, de_refacut, date_extra
        ) values (
          coalesce(v_nr, nextval('public.prospectare_firme_nr_seq')::integer),
          coalesce(nullif(btrim(e ->> 'nume'), ''), v_dom),
          v_dom,
          nullif(e ->> 'site_vechi', ''), nullif(e ->> 'nisa', ''), nullif(e ->> 'oras', ''), nullif(e ->> 'judet', ''),
          nullif(e ->> 'scor', '')::smallint, nullif(btrim(e ->> 'telefon'), ''), nullif(lower(btrim(e ->> 'email')), ''),
          nullif(btrim(e ->> 'persoana_contact'), ''),
          coalesce(v_etapa, 'cercetat'),
          v_email_la, v_whatsapp_la, v_whatsapp_cont, v_telefon_la,
          case when v_import then nullif(e ->> 'link_demo', '') end,
          case when v_import then nullif(e ->> 'captura_url', '') end,
          nullif(e ->> 'lot', ''), nullif(e ->> 'slug', ''),
          coalesce((e ->> 'de_refacut')::boolean, false),
          coalesce(e -> 'date_extra', '{}'::jsonb)
        );
      end if;
      continue;
    end if;

    -- Firma există: datele de cercetare se completează (nu se golesc).
    n := f;
    n.nume := coalesce(nullif(btrim(e ->> 'nume'), ''), f.nume);
    n.site_vechi := coalesce(nullif(e ->> 'site_vechi', ''), f.site_vechi);
    n.nisa := coalesce(nullif(e ->> 'nisa', ''), f.nisa);
    n.oras := coalesce(nullif(e ->> 'oras', ''), f.oras);
    n.judet := coalesce(nullif(e ->> 'judet', ''), f.judet);
    n.scor := coalesce(nullif(e ->> 'scor', '')::smallint, f.scor);
    n.telefon := coalesce(nullif(btrim(e ->> 'telefon'), ''), f.telefon);
    n.email := coalesce(nullif(lower(btrim(e ->> 'email')), ''), f.email);
    n.persoana_contact := coalesce(nullif(btrim(e ->> 'persoana_contact'), ''), f.persoana_contact);
    n.lot := coalesce(nullif(e ->> 'lot', ''), f.lot);
    n.slug := coalesce(nullif(e ->> 'slug', ''), f.slug);
    n.date_extra := f.date_extra || coalesce(e -> 'date_extra', '{}'::jsonb);
    if v_import then
      n.link_demo := coalesce(nullif(e ->> 'link_demo', ''), f.link_demo);
      n.captura_url := coalesce(nullif(e ->> 'captura_url', ''), f.captura_url);
    end if;

    -- Etapa: „Nu contacta” se aplică mereu; restul doar înainte, pe etapele robotului.
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

    -- De refăcut (ex. conversie pe v3): un site gata, încă necontactat, se întoarce în lucru.
    if coalesce((e ->> 'de_refacut')::boolean, false) and not f.de_refacut then
      n.de_refacut := true;
      if n.etapa = 'site_gata' and f.email_la is null and f.whatsapp_la is null and f.telefon_la is null then
        n.etapa := 'site_in_lucru';
      end if;
    elsif (e ->> 'de_refacut') is not null and not (e ->> 'de_refacut')::boolean and f.de_refacut and v_import then
      n.de_refacut := false;
    end if;

    -- Canalele: se completează doar cele goale; o dată deja în bază rămâne.
    -- O firmă deja „Nu contacta” nu primește canal nou nici din import.
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
           n.date_extra, n.link_demo, n.captura_url, n.etapa, n.email_la, n.whatsapp_la, n.whatsapp_cont, n.telefon_la, n.de_refacut)
       is distinct from
       row(f.nume, f.site_vechi, f.nisa, f.oras, f.judet, f.scor, f.telefon, f.email, f.persoana_contact, f.lot, f.slug,
           f.date_extra, f.link_demo, f.captura_url, f.etapa, f.email_la, f.whatsapp_la, f.whatsapp_cont, f.telefon_la, f.de_refacut) then
      v_actualizate := v_actualizate + 1;
      if not p_proba then
        perform set_config('prospectare.motiv', case when v_import then 'Import din auto-web-rebuilder' else 'Actualizare de la robot' end, true);
        update public.prospectare_firme set
          nume = n.nume, site_vechi = n.site_vechi, nisa = n.nisa, oras = n.oras, judet = n.judet, scor = n.scor,
          telefon = n.telefon, email = n.email, persoana_contact = n.persoana_contact, lot = n.lot, slug = n.slug,
          date_extra = n.date_extra, link_demo = n.link_demo, captura_url = n.captura_url, etapa = n.etapa,
          email_la = n.email_la, whatsapp_la = n.whatsapp_la, whatsapp_cont = n.whatsapp_cont, telefon_la = n.telefon_la,
          de_refacut = n.de_refacut
        where id = f.id;
      end if;
    else
      v_neschimbate := v_neschimbate + 1;
    end if;
  end loop;

  -- Numerele explicite din import nu consumă secvența: o aducem după cel mai mare număr.
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
    'conflicte', v_conflicte
  );
end;
$$;

-- Citirile adminului ------------------------------------------------------------------

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
    'canale', (select jsonb_build_object(
        'email', count(*) filter (where email_la is not null),
        'whatsapp', count(*) filter (where whatsapp_la is not null),
        'telefon', count(*) filter (where telefon_la is not null),
        'email_si_whatsapp', count(*) filter (where email_la is not null and whatsapp_la is not null),
        'fara', count(*) filter (where email_la is null and whatsapp_la is null and telefon_la is null))
      from public.prospectare_firme),
    'de_refacut', (select count(*) from public.prospectare_firme where de_refacut),
    'rezerva_telefon', (select count(*) from public.prospectare_firme
      where etapa = 'site_gata' and email_la is null and whatsapp_la is null and telefon_la is null and link_demo is not null and telefon is not null),
    'whatsapp_lista', (select count(*) from public.prospectare_firme f
      where f.whatsapp_la is null and f.telefon_la is null and f.este_mobil and f.link_demo is not null
        and f.etapa in ('site_gata', 'email_trimis') and public.prospectare_whatsapp_eligibila(f)),
    -- Au primit emailul în ultima zi și au mobil: intră în lista de WhatsApp după 24 de ore.
    'whatsapp_dupa_email', (select count(*) from public.prospectare_firme f
      where f.whatsapp_la is null and f.telefon_la is null and f.este_mobil and f.link_demo is not null
        and f.etapa = 'email_trimis' and f.email_la > now() - interval '1 day'),
    'in_lucru', (select count(*) from public.prospectare_rezervari where expira_la > now()),
    'roboti_activi', (select count(*) from public.prospectare_dispozitive where activ and ultima_activitate > now() - interval '15 minutes'),
    'roboti', (select count(*) from public.prospectare_dispozitive where activ),
    'azi', jsonb_build_object(
      'apeluri', (select count(*) from public.prospectare_liste_zi where data = public.prospectare_azi()),
      'apeluri_facute', (select count(*) from public.prospectare_liste_zi where data = public.prospectare_azi() and rezultat is not null),
      'whatsapp_trimise', (select count(*) from public.prospectare_firme where whatsapp_la >= public.prospectare_inceput_azi()),
      'whatsapp_pe_cont', (select coalesce(jsonb_object_agg(whatsapp_cont::text, n), '{}'::jsonb) from (
        select whatsapp_cont, count(*) as n from public.prospectare_firme
        where whatsapp_la >= public.prospectare_inceput_azi() and whatsapp_cont is not null group by whatsapp_cont) s),
      'emailuri', (select coalesce(sum(trimise), 0) from public.prospectare_casute_zi where zi = public.prospectare_azi()),
      'raspunsuri', (select coalesce(sum(raspunsuri), 0) from public.prospectare_casute_zi where zi = public.prospectare_azi()),
      'bounce', (select coalesce(sum(bounce), 0) from public.prospectare_casute_zi where zi = public.prospectare_azi()),
      'site_uri', (select count(*) from public.prospectare_activitate where tip = 'site' and la >= public.prospectare_inceput_azi()),
      'interesati', (select count(*) from public.prospectare_activitate where tip = 'etapa' and detalii ->> 'in' = 'interesat' and la >= public.prospectare_inceput_azi())
    )
  )
$$;

-- Rezerva pentru lista de apeluri, grupată pe filtre (semnătura rămâne cea din 31).
create or replace function public.prospectare_rezerva_grupe()
returns table (nisa text, oras text, judet text, scor smallint, este_mobil boolean, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select f.nisa, f.oras, f.judet, f.scor, f.este_mobil, count(*)
  from public.prospectare_firme f
  where f.etapa = 'site_gata' and f.email_la is null and f.whatsapp_la is null and f.telefon_la is null
    and f.link_demo is not null and f.telefon is not null
  group by f.nisa, f.oras, f.judet, f.scor, f.este_mobil
$$;

-- Drepturi --------------------------------------------------------------------------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.prospectare_whatsapp_eligibila(public.prospectare_firme)',
    'public.prospectare_whatsapp_coada(integer, integer)',
    'public.prospectare_whatsapp_trimis(uuid, smallint, text)',
    'public.prospectare_importa_lista_zi(text, text, integer, jsonb, smallint, text)',
    'public.prospectare_seteaza_rezultat(bigint, text, text, timestamptz, text)',
    'public.prospectare_continua_pe_whatsapp(bigint, text)',
    'public.prospectare_email_cere_canal(uuid, text, integer, text, integer)',
    'public.prospectare_email_eveniment(uuid, text, text, integer, text, jsonb, text, integer)',
    'public.prospectare_upsert_firme(jsonb, text, text, boolean)',
    'public.prospectare_rezumat()',
    'public.prospectare_rezerva_grupe()'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke all on function %s from anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;

select 'canalele au fiecare data lor (email_la, whatsapp_la, telefon_la)' as verificare,
  (select count(*) = 4 from information_schema.columns
    where table_schema = 'public' and table_name = 'prospectare_firme' and column_name in ('email_la', 'whatsapp_la', 'whatsapp_cont', 'telefon_la')) as ok
union all
select 'canalul vechi e gol și blocat', exists (select 1 from pg_constraint where conname = 'prospectare_firme_canal_vechi_gol')
  and not exists (select 1 from public.prospectare_firme where canal is not null)
union all
select 'listele zilei sunt doar de telefon', exists (select 1 from pg_constraint where conname = 'prospectare_liste_zi_doar_telefon')
union all
select 'WhatsApp: funcțiile noi doar pentru cheia de service',
  to_regprocedure('public.prospectare_whatsapp_trimis(uuid, smallint, text)') is not null
  and not has_function_privilege('authenticated', 'public.prospectare_whatsapp_trimis(uuid, smallint, text)', 'execute')
  and not has_function_privilege('anon', 'public.prospectare_whatsapp_coada(integer, integer)', 'execute')
  and to_regprocedure('public.prospectare_marcheaza_whatsapp(bigint, text)') is null;
