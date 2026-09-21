-- MERIDIAN — vault: rotația cheii de date (feat/vault, faza 10)
-- Se aplică DUPĂ migrarea 3. Aditivă: nu șterge și nu redenumește nimic.
--
-- PROBLEMA: DEK-ul (cheia care criptează intrările) e unul singur, sigilat
-- pentru fiecare membru. Un membru eliminat l-a avut în memorie; dacă
-- vreodată ajunge și la blob-uri (o scurgere a bazei), le deschide. Nu
-- putem „retrage" o cheie din capul cuiva — putem doar să nu mai criptăm
-- nimic nou cu ea.
--
-- SOLUȚIA: un INEL de chei. Cheia originală rămâne (istoricul e criptat
-- cu ea și `vault_entry_versions` nu se poate rescrie — clientul n-are
-- politică de update acolo, intenționat). Rotația adaugă o cheie NOUĂ:
--   1. sigilată pentru fiecare membru activ (`vault_member_deks`);
--   2. împachetată cu un COD DE RECUPERARE NOU (codul vechi moare —
--      altfel un ex-membru care l-a văzut ar deschide tot, inclusiv
--      cheile de după el);
--   3. toate cheile mai vechi re-împachetate cu noul cod, ca recuperarea
--      să deschidă și istoricul.
-- Apoi browserul re-criptează rândurile vii cu cheia nouă, în loturi;
-- fiecare rând spune cu ce cheie e scris (`dek_id`; NULL = cheia
-- originală din `vault_members.wrapped_dek`). O rotație întreruptă lasă
-- rânduri sub ambele chei — toate lizibile pentru un membru cu inelul
-- complet, deci se poate relua oricând.
--
-- GARANȚIA (nu mai mult): ce a fost scris DUPĂ rotație nu se deschide cu
-- cheile de dinainte. Ce a văzut ex-membrul cât era activ, a văzut.

-- Chei --------------------------------------------------------------------

create table public.vault_deks (
  -- Generat în browser, ca AD-ul să lege blob-urile de rând de la insert.
  id                   uuid primary key,
  -- DEK-ul împachetat cu cheia de recuperare CURENTĂ (XChaCha20: 32 + 16).
  recovery_wrapped_dek bytea not null,
  recovery_nonce       bytea not null,
  created_by           uuid references public.vault_members (id) on delete set null,
  created_at           timestamptz not null default now(),
  -- Nu mai criptează nimic nou; rămâne pentru citit.
  retired_at           timestamptz,

  constraint vault_deks_wrapped_len check (octet_length(recovery_wrapped_dek) = 48),
  constraint vault_deks_nonce_len check (octet_length(recovery_nonce) = 24)
);

-- O cheie rotită, sigilată către cheia publică a unui membru (crypto_box_seal).
create table public.vault_member_deks (
  member_id  uuid not null references public.vault_members (id) on delete cascade,
  dek_id     uuid not null references public.vault_deks (id) on delete cascade,
  sealed_dek bytea not null,
  created_at timestamptz not null default now(),

  primary key (member_id, dek_id),
  constraint vault_member_deks_sealed_len check (octet_length(sealed_dek) = 80)
);

-- Cu ce cheie e scris fiecare rând. NULL = cheia originală.
alter table public.vault_clients        add column dek_id uuid references public.vault_deks (id);
alter table public.vault_entries        add column dek_id uuid references public.vault_deks (id);
alter table public.vault_entry_versions add column dek_id uuid references public.vault_deks (id);

create index vault_member_deks_member_idx on public.vault_member_deks (member_id);

-- Trigger --------------------------------------------------------------------
-- Aceeași versionare ca în migrarea 3, plus: istoricul reține `dek_id`-ul
-- rândului vechi, iar o RE-CRIPTARE (doar `dek_id` + bytes noi, același
-- conținut) NU produce versiune nouă — altfel fiecare rotație ar umple
-- istoricul cu „conținut identic". Clientul nu schimbă niciodată
-- conținutul și cheia în același update.

create or replace function public.vault_stamp_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.version = 1;
    new.created_at = now();
    new.updated_at = now();
    new.updated_by = auth.uid();
    return new;
  end if;

  new.created_at = old.created_at;

  if new.dek_id is distinct from old.dek_id then
    -- Re-criptare: aceeași versiune, fără rând în istoric.
    new.version = old.version;
  elsif new.encrypted_payload is distinct from old.encrypted_payload
     or new.nonce is distinct from old.nonce
     or new.client_id is distinct from old.client_id then
    insert into public.vault_entry_versions
      (entry_id, encrypted_payload, nonce, version, created_at, created_by, dek_id)
    values
      (old.id, old.encrypted_payload, old.nonce, old.version, old.updated_at, old.updated_by, old.dek_id);
    new.version = old.version + 1;
  else
    new.version = old.version;
  end if;

  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

-- Funcții ----------------------------------------------------------------------

-- Rotația, atomic. Apelantul (activ) trimite:
--   p_dek_id             — id-ul cheii NOI (generat în browser);
--   p_legacy_wrapped/nonce — cheia ORIGINALĂ re-împachetată cu noul cod;
--   p_deks               — [{id, recovery_wrapped_dek, recovery_nonce}]:
--                          TOATE cheile rotite (inclusiv cea nouă), sub noul cod;
--   p_sealed             — [{member_id, sealed_dek}]: cheia nouă, sigilată
--                          pentru FIECARE membru activ. Lipsește unul → refuz:
--                          nimeni nu rămâne fără cheia curentă.
create or replace function public.vault_rotate_dek(
  p_dek_id         uuid,
  p_legacy_wrapped bytea,
  p_legacy_nonce   bytea,
  p_deks           jsonb,
  p_sealed         jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_active int;
  v_given  int;
  v_row    jsonb;
begin
  if not public.vault_is_active_member() then
    raise exception 'vault: doar un membru activ poate roti cheia' using errcode = 'insufficient_privilege';
  end if;

  lock table public.vault_deks in exclusive mode;

  if exists (select 1 from public.vault_deks where id = p_dek_id) then
    raise exception 'vault: cheia există deja' using errcode = 'unique_violation';
  end if;

  select count(*) into v_active from public.vault_members where wrapped_dek is not null;
  select count(*) into v_given
    from jsonb_array_elements(p_sealed) s
    join public.vault_members m on m.id = (s.value ->> 'member_id')::uuid and m.wrapped_dek is not null;
  if v_given <> v_active then
    raise exception 'vault: cheia nouă trebuie sigilată pentru toți membrii activi (% din %)', v_given, v_active
      using errcode = 'check_violation';
  end if;

  -- Cheile rotite existente, re-împachetate; cea nouă, inserată.
  for v_row in select * from jsonb_array_elements(p_deks) loop
    insert into public.vault_deks (id, recovery_wrapped_dek, recovery_nonce, created_by)
    values (
      (v_row ->> 'id')::uuid,
      decode(substr(v_row ->> 'recovery_wrapped_dek', 3), 'hex'),
      decode(substr(v_row ->> 'recovery_nonce', 3), 'hex'),
      v_uid
    )
    on conflict (id) do update set
      recovery_wrapped_dek = excluded.recovery_wrapped_dek,
      recovery_nonce       = excluded.recovery_nonce;
  end loop;

  if not exists (select 1 from public.vault_deks where id = p_dek_id) then
    raise exception 'vault: p_deks nu conține cheia nouă' using errcode = 'check_violation';
  end if;

  update public.vault_deks set retired_at = now()
   where id <> p_dek_id and retired_at is null;

  for v_row in select * from jsonb_array_elements(p_sealed) loop
    insert into public.vault_member_deks (member_id, dek_id, sealed_dek)
    values ((v_row ->> 'member_id')::uuid, p_dek_id, decode(substr(v_row ->> 'sealed_dek', 3), 'hex'));
  end loop;

  update public.vault_meta
     set recovery_wrapped_dek = p_legacy_wrapped,
         recovery_nonce       = p_legacy_nonce,
         recovery_rotations   = recovery_rotations + 1
   where id;  -- rândul unic; safeupdate (Supabase) refuză UPDATE fără WHERE
end;
$$;

-- Un membru activ acordă altui membru cheile rotite (la aprobare, sau dacă
-- i-au lipsit după o rotație întreruptă). [{dek_id, sealed_dek}].
create or replace function public.vault_grant_deks(
  p_member uuid,
  p_sealed jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  if not public.vault_is_active_member() then
    raise exception 'vault: doar un membru activ' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.vault_members where id = p_member) then
    raise exception 'vault: membrul nu există' using errcode = 'no_data_found';
  end if;

  for v_row in select * from jsonb_array_elements(p_sealed) loop
    insert into public.vault_member_deks (member_id, dek_id, sealed_dek)
    values (p_member, (v_row ->> 'dek_id')::uuid, decode(substr(v_row ->> 'sealed_dek', 3), 'hex'))
    on conflict (member_id, dek_id) do update set sealed_dek = excluded.sealed_dek;
  end loop;
end;
$$;

-- După chei noi (parolă schimbată, recuperare): membrul își re-sigilează
-- cheile rotite către noua lui cheie publică. Rândurile vechi se înlocuiesc.
create or replace function public.vault_reseal_self(p_sealed jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  if not public.vault_is_active_member() then
    raise exception 'vault: doar un membru activ' using errcode = 'insufficient_privilege';
  end if;

  delete from public.vault_member_deks where member_id = auth.uid();
  for v_row in select * from jsonb_array_elements(p_sealed) loop
    insert into public.vault_member_deks (member_id, dek_id, sealed_dek)
    values (auth.uid(), (v_row ->> 'dek_id')::uuid, decode(substr(v_row ->> 'sealed_dek', 3), 'hex'));
  end loop;
end;
$$;

-- Cod de recuperare nou FĂRĂ rotația cheii: toate cheile (originala din
-- vault_meta + cele rotite) re-împachetate cu noul cod, atomic. Înlocuiește
-- update-ul direct pe vault_meta din faza 2 — de acum sunt mai multe blob-uri
-- de ținut în pas.
create or replace function public.vault_rewrap_recovery(
  p_legacy_wrapped bytea,
  p_legacy_nonce   bytea,
  p_deks           jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row   jsonb;
  v_count int;
begin
  if not public.vault_is_active_member() then
    raise exception 'vault: doar un membru activ' using errcode = 'insufficient_privilege';
  end if;

  select count(*) into v_count from public.vault_deks;
  if v_count <> jsonb_array_length(p_deks) then
    raise exception 'vault: trebuie re-împachetate toate cheile (% din %)', jsonb_array_length(p_deks), v_count
      using errcode = 'check_violation';
  end if;

  for v_row in select * from jsonb_array_elements(p_deks) loop
    update public.vault_deks
       set recovery_wrapped_dek = decode(substr(v_row ->> 'recovery_wrapped_dek', 3), 'hex'),
           recovery_nonce       = decode(substr(v_row ->> 'recovery_nonce', 3), 'hex')
     where id = (v_row ->> 'id')::uuid;
    if not found then
      raise exception 'vault: cheie necunoscută în p_deks' using errcode = 'no_data_found';
    end if;
  end loop;

  update public.vault_meta
     set recovery_wrapped_dek = p_legacy_wrapped,
         recovery_nonce       = p_legacy_nonce,
         recovery_rotations   = recovery_rotations + 1
   where id;  -- rândul unic; safeupdate (Supabase) refuză UPDATE fără WHERE
end;
$$;

revoke all on function public.vault_rewrap_recovery(bytea, bytea, jsonb) from public;
grant execute on function public.vault_rewrap_recovery(bytea, bytea, jsonb) to authenticated;

revoke all on function public.vault_rotate_dek(uuid, bytea, bytea, jsonb, jsonb) from public;
revoke all on function public.vault_grant_deks(uuid, jsonb) from public;
revoke all on function public.vault_reseal_self(jsonb) from public;

grant execute on function public.vault_rotate_dek(uuid, bytea, bytea, jsonb, jsonb) to authenticated;
grant execute on function public.vault_grant_deks(uuid, jsonb) to authenticated;
grant execute on function public.vault_reseal_self(jsonb) to authenticated;

-- RLS ---------------------------------------------------------------------------

alter table public.vault_deks enable row level security;
alter table public.vault_member_deks enable row level security;

-- Cheile (blob-uri de recuperare) le văd doar membrii activi.
create policy "vault_deks: select pentru activi"
  on public.vault_deks for select
  to authenticated
  using (public.vault_is_active_member());

-- Sigilările: ale tale, sau — dacă ești activ — ale tuturor (ca să vezi
-- cui îi lipsește o cheie și s-o acorzi). Un blob sigilat către altcineva
-- nu se deschide fără cheia lui privată.
create policy "vault_member_deks: select propriu sau activ"
  on public.vault_member_deks for select
  to authenticated
  using (member_id = auth.uid() or public.vault_is_active_member());

-- Scrierile: doar prin funcțiile de mai sus.

-- Verificare rapidă după aplicare (SQL editor):
--   select count(*) from public.vault_deks;   → 0, sau eroare de permisiune.
