-- MERIDIAN — vault de parole zero-knowledge (feat/vault, faza 1)
-- Se aplică DUPĂ migrările 1 și 2.
--   supabase db push        (CLI)
--   sau lipit în SQL editor pe proiectul Supabase.
--
-- Fișier NOU, aditiv: nu atinge `leads`, `lead_events` sau politicile lor.
--
-- PRINCIPIUL: serverul nu poate decripta nimic. În clar stau DOAR id-uri,
-- timestamp-uri, numere de versiune, cheile PUBLICE și emailul membrului.
-- Titlul, tipul, tag-urile, numele clientului — toate sunt în payload-ul
-- criptat. Cheia care le deschide (DEK) există aici doar sigilată către
-- cheia publică a fiecărui membru (crypto_box_seal) și împachetată cu
-- cheia de recuperare — niciodată în clar.
--
-- CINE E MEMBRU: contul se INVITĂ din dashboard-ul Supabase (ca la admin;
-- înregistrarea publică rămâne oprită). La prima intrare, browserul
-- generează perechea X25519 și cheamă `vault_join` → rând „în așteptare"
-- (wrapped_dek NULL). Un membru activ îi sigilează DEK-ul prin
-- `vault_approve_member` → devine activ. Primul membru se auto-activează
-- prin `vault_bootstrap`, o singură dată (garantat de rândul unic din
-- `vault_meta` + lock).
--
-- DE CE funcții SECURITY DEFINER și nu politici de insert/update pe
-- `vault_members`: o politică „rândul tău" ar lăsa un membru în așteptare
-- să-și scrie singur un `wrapped_dek` non-null și să devină „activ" în
-- ochii RLS — ar citi și ar putea șterge tot. Cu funcțiile, singurul drum
-- spre `wrapped_dek` trece prin verificarea că apelantul e deja activ.
-- Triggerul `vault_members_guard` blochează în plus orice UPDATE direct
-- pe coloană, în caz că cineva adaugă vreodată o politică de update.

-- Helper -----------------------------------------------------------------

-- Aceeași funcție ca în migrarea 2 (`create or replace`, corp identic):
-- repetată ca fișierul să meargă și pe un proiect care n-are lead-uri.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tabele ----------------------------------------------------------------------

create table public.vault_members (
  -- = auth.users.id; contul dispare → dispare și membrul.
  id                    uuid primary key references auth.users (id) on delete cascade,
  email                 text not null unique,
  -- X25519, 32 bytes, în clar: către ea se sigilează DEK-ul.
  public_key            bytea not null,
  -- Cheia privată X25519 criptată cu KEK (XChaCha20-Poly1305): 32 + 16 tag.
  encrypted_private_key bytea not null,
  private_key_nonce     bytea not null,
  -- DEK sigilat către public_key (crypto_box_seal: 32 + 48). NULL = membru
  -- în așteptare, fără acces la date. Se scrie DOAR prin funcțiile de jos.
  wrapped_dek           bytea,
  approved_by           uuid references public.vault_members (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint vault_members_public_key_len check (octet_length(public_key) = 32),
  constraint vault_members_private_key_len check (octet_length(encrypted_private_key) = 48),
  constraint vault_members_nonce_len check (octet_length(private_key_nonce) = 24),
  constraint vault_members_wrapped_dek_len check (wrapped_dek is null or octet_length(wrapped_dek) = 80)
);

-- Un singur rând, pentru tot vault-ul: DEK-ul împachetat cu cheia derivată
-- din codul de recuperare. `id boolean ... check (id)` = cheie primară care
-- nu poate fi decât `true`, deci al doilea insert pică pe unicitate.
create table public.vault_meta (
  id                   boolean primary key default true check (id),
  recovery_wrapped_dek bytea not null,
  recovery_nonce       bytea not null,
  -- De câte ori a fost regenerat codul. Informativ.
  recovery_rotations   int not null default 0,
  created_by           uuid references public.vault_members (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint vault_meta_wrapped_len check (octet_length(recovery_wrapped_dek) = 48),
  constraint vault_meta_nonce_len check (octet_length(recovery_nonce) = 24)
);

create table public.vault_clients (
  id             uuid primary key default gen_random_uuid(),
  -- Și numele clientului e criptat: serverul nu știe pentru cine ținem parole.
  encrypted_name bytea not null,
  nonce          bytea not null,
  -- Soft delete: rândul rămâne, intrările lui la fel.
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.vault_members (id) on delete set null,

  constraint vault_clients_nonce_len check (octet_length(nonce) = 24)
);

create table public.vault_entries (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.vault_clients (id),
  -- Tot conținutul: titlu, tip, câmpuri, tag-uri, note — un singur JSON criptat.
  encrypted_payload bytea not null,
  nonce             bytea not null,
  -- Pornește de la 1 și crește DOAR prin trigger, la fiecare schimbare de payload.
  version           int not null default 1,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references public.vault_members (id) on delete set null,

  constraint vault_entries_nonce_len check (octet_length(nonce) = 24),
  constraint vault_entries_version_positive check (version >= 1)
);

-- Istoric: fiecare payload care a fost vreodată „curent", în forma lui
-- criptată de atunci. Scris DOAR de trigger; clientul nu poate insera,
-- modifica sau șterge aici.
create table public.vault_entry_versions (
  id                uuid primary key default gen_random_uuid(),
  entry_id          uuid not null references public.vault_entries (id) on delete cascade,
  encrypted_payload bytea not null,
  nonce             bytea not null,
  version           int not null,
  created_at        timestamptz not null,
  created_by        uuid references public.vault_members (id) on delete set null,

  constraint vault_entry_versions_unique unique (entry_id, version)
);

-- Indexuri ------------------------------------------------------------------

create index vault_entries_client_idx
  on public.vault_entries (client_id)
  where deleted_at is null;

create index vault_entry_versions_entry_idx
  on public.vault_entry_versions (entry_id, version desc);

-- Triggere --------------------------------------------------------------------

create trigger vault_members_set_updated_at
  before update on public.vault_members
  for each row execute function public.set_updated_at();

create trigger vault_meta_set_updated_at
  before update on public.vault_meta
  for each row execute function public.set_updated_at();

-- Clienți: autorul și momentul le pune serverul, nu browserul.
create or replace function public.vault_stamp_client()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at = now();
  else
    new.created_at = old.created_at;
  end if;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger vault_clients_stamp
  before insert or update on public.vault_clients
  for each row execute function public.vault_stamp_client();

-- Intrări: versionare atomică. La orice schimbare de conținut, rândul VECHI
-- se copiază în istoric și versiunea crește. Clientul nu controlează
-- `version` — ce trimite e ignorat. Concurența optimistă se face în
-- client: `update ... where id = ? and version = ?`; zero rânduri = altcineva
-- a salvat între timp.
--
-- SECURITY DEFINER: insertul în istoric ocolește RLS (tabelul n-are politică
-- de insert), deci istoricul se scrie EXCLUSIV de aici.
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

  if new.encrypted_payload is distinct from old.encrypted_payload
     or new.nonce is distinct from old.nonce
     or new.client_id is distinct from old.client_id then
    insert into public.vault_entry_versions
      (entry_id, encrypted_payload, nonce, version, created_at, created_by)
    values
      (old.id, old.encrypted_payload, old.nonce, old.version, old.updated_at, old.updated_by);
    new.version = old.version + 1;
  else
    -- Doar deleted_at (sau nimic): fără versiune nouă.
    new.version = old.version;
  end if;

  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger vault_entries_stamp
  before insert or update on public.vault_entries
  for each row execute function public.vault_stamp_entry();

-- Garda: `wrapped_dek` și `approved_by` se schimbă DOAR din funcțiile de
-- membru (care setează `vault.internal`). Orice alt UPDATE care le atinge
-- e refuzat, indiferent de politici.
create or replace function public.vault_members_guard()
returns trigger
language plpgsql
as $$
begin
  if (new.wrapped_dek is distinct from old.wrapped_dek
      or new.approved_by is distinct from old.approved_by)
     and coalesce(current_setting('vault.internal', true), '') <> 'on' then
    raise exception 'vault: wrapped_dek se scrie doar prin vault_bootstrap / vault_approve_member'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger vault_members_guard
  before update on public.vault_members
  for each row execute function public.vault_members_guard();

-- Cine e „activ" -----------------------------------------------------------

-- SECURITY DEFINER ca verificarea să nu treacă recursiv prin politica de pe
-- `vault_members`. STABLE: același răspuns în interiorul unei interogări.
create or replace function public.vault_is_active_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vault_members m
    where m.id = auth.uid()
      and m.wrapped_dek is not null
  );
$$;

revoke all on function public.vault_is_active_member() from public;
grant execute on function public.vault_is_active_member() to authenticated;

-- Funcțiile de membru ------------------------------------------------------------
-- Toate cer sesiune (auth.uid() non-null) și rulează atomic într-o singură
-- tranzacție. Emailul vine din JWT, nu din parametri.

-- Primul membru: își sigilează singur DEK-ul și depune blob-ul de recuperare.
-- Reușește O SINGURĂ DATĂ: lock pe vault_meta + verificare că nu există deja
-- un membru activ, apoi insert în vault_meta (a doua oară ar pica pe PK).
create or replace function public.vault_bootstrap(
  p_public_key            bytea,
  p_encrypted_private_key bytea,
  p_private_key_nonce     bytea,
  p_wrapped_dek           bytea,
  p_recovery_wrapped_dek  bytea,
  p_recovery_nonce        bytea
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_uid is null or v_email = '' then
    raise exception 'vault: fără sesiune' using errcode = 'insufficient_privilege';
  end if;

  lock table public.vault_meta in exclusive mode;

  if exists (select 1 from public.vault_meta)
     or exists (select 1 from public.vault_members where wrapped_dek is not null) then
    raise exception 'vault: deja inițializat' using errcode = 'unique_violation';
  end if;

  perform set_config('vault.internal', 'on', true);

  insert into public.vault_members
    (id, email, public_key, encrypted_private_key, private_key_nonce, wrapped_dek, approved_by)
  values
    (v_uid, v_email, p_public_key, p_encrypted_private_key, p_private_key_nonce, p_wrapped_dek, v_uid)
  on conflict (id) do update set
    public_key            = excluded.public_key,
    encrypted_private_key = excluded.encrypted_private_key,
    private_key_nonce     = excluded.private_key_nonce,
    wrapped_dek           = excluded.wrapped_dek,
    approved_by           = excluded.approved_by;

  insert into public.vault_meta (recovery_wrapped_dek, recovery_nonce, created_by)
  values (p_recovery_wrapped_dek, p_recovery_nonce, v_uid);
end;
$$;

-- Un cont invitat își depune cheile → membru în așteptare. Dacă rândul
-- există deja și e tot în așteptare (și-a schimbat parola înainte să fie
-- aprobat), cheile se înlocuiesc. Un membru activ NU poate trece pe aici —
-- pentru el există vault_rekey_self.
create or replace function public.vault_join(
  p_public_key            bytea,
  p_encrypted_private_key bytea,
  p_private_key_nonce     bytea
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_uid is null or v_email = '' then
    raise exception 'vault: fără sesiune' using errcode = 'insufficient_privilege';
  end if;

  if exists (select 1 from public.vault_members where id = v_uid and wrapped_dek is not null) then
    raise exception 'vault: membrul e deja activ' using errcode = 'unique_violation';
  end if;

  insert into public.vault_members
    (id, email, public_key, encrypted_private_key, private_key_nonce)
  values
    (v_uid, v_email, p_public_key, p_encrypted_private_key, p_private_key_nonce)
  on conflict (id) do update set
    public_key            = excluded.public_key,
    encrypted_private_key = excluded.encrypted_private_key,
    private_key_nonce     = excluded.private_key_nonce;
end;
$$;

-- Un membru activ sigilează DEK-ul pentru unul în așteptare. Browserul
-- apelantului a desigilat DEK-ul cu cheia lui și l-a re-sigilat către
-- `public_key` a țintei; aici ajunge doar rezultatul.
create or replace function public.vault_approve_member(
  p_member      uuid,
  p_wrapped_dek bytea
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.vault_is_active_member() then
    raise exception 'vault: doar un membru activ poate aproba' using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.vault_members where id = p_member and wrapped_dek is null) then
    raise exception 'vault: membrul nu există sau e deja activ' using errcode = 'no_data_found';
  end if;

  perform set_config('vault.internal', 'on', true);

  update public.vault_members
  set wrapped_dek = p_wrapped_dek,
      approved_by = auth.uid()
  where id = p_member;
end;
$$;

-- Un membru activ își schimbă cheile (parolă nouă sau recuperare): pereche
-- nouă, privată împachetată cu noul KEK, DEK re-sigilat către noua publică.
-- Toate patru vin împreună — altfel ar rămâne cu un DEK sigilat către o
-- cheie pe care n-o mai are.
create or replace function public.vault_rekey_self(
  p_public_key            bytea,
  p_encrypted_private_key bytea,
  p_private_key_nonce     bytea,
  p_wrapped_dek           bytea
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.vault_is_active_member() then
    raise exception 'vault: doar un membru activ' using errcode = 'insufficient_privilege';
  end if;

  perform set_config('vault.internal', 'on', true);

  update public.vault_members
  set public_key            = p_public_key,
      encrypted_private_key = p_encrypted_private_key,
      private_key_nonce     = p_private_key_nonce,
      wrapped_dek           = p_wrapped_dek
  where id = auth.uid();
end;
$$;

-- Un membru activ scoate pe altcineva (respinge o cerere sau elimină un
-- membru). NU pe sine, și NU ultimul membru activ.
-- ⚠️ Eliminarea unui membru ACTIV nu rotește DEK-ul: ce a apucat să vadă
-- a văzut. Rotația DEK-ului (re-criptarea tuturor intrărilor) e o operație
-- pentru o iterație viitoare.
create or replace function public.vault_remove_member(p_member uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.vault_is_active_member() then
    raise exception 'vault: doar un membru activ' using errcode = 'insufficient_privilege';
  end if;
  if p_member = auth.uid() then
    raise exception 'vault: nu te poți elimina singur' using errcode = 'check_violation';
  end if;

  delete from public.vault_members where id = p_member;
end;
$$;

revoke all on function public.vault_bootstrap(bytea, bytea, bytea, bytea, bytea, bytea) from public;
revoke all on function public.vault_join(bytea, bytea, bytea) from public;
revoke all on function public.vault_approve_member(uuid, bytea) from public;
revoke all on function public.vault_rekey_self(bytea, bytea, bytea, bytea) from public;
revoke all on function public.vault_remove_member(uuid) from public;

grant execute on function public.vault_bootstrap(bytea, bytea, bytea, bytea, bytea, bytea) to authenticated;
grant execute on function public.vault_join(bytea, bytea, bytea) to authenticated;
grant execute on function public.vault_approve_member(uuid, bytea) to authenticated;
grant execute on function public.vault_rekey_self(bytea, bytea, bytea, bytea) to authenticated;
grant execute on function public.vault_remove_member(uuid) to authenticated;

-- RLS ---------------------------------------------------------------------------
-- Toate tabelele: RLS activ. Nicio politică `using (true)`. Nicio politică
-- pentru `anon`. Ștergerea e soft (update pe deleted_at) — nu există
-- politici de delete pe date. Istoricul e doar de citit.

alter table public.vault_members enable row level security;
alter table public.vault_meta enable row level security;
alter table public.vault_clients enable row level security;
alter table public.vault_entries enable row level security;
alter table public.vault_entry_versions enable row level security;

-- Membri: rândul tău (ca să vezi dacă ești în așteptare) sau, dacă ești
-- activ, toți (ca să aprobi). Scrierile: doar prin funcții.
create policy "vault_members: select propriu sau activ"
  on public.vault_members for select
  to authenticated
  using (id = auth.uid() or public.vault_is_active_member());

-- Meta: activii citesc și pot regenera codul de recuperare.
create policy "vault_meta: select pentru activi"
  on public.vault_meta for select
  to authenticated
  using (public.vault_is_active_member());

create policy "vault_meta: update pentru activi"
  on public.vault_meta for update
  to authenticated
  using (public.vault_is_active_member())
  with check (public.vault_is_active_member());

-- Clienți
create policy "vault_clients: select pentru activi"
  on public.vault_clients for select
  to authenticated
  using (public.vault_is_active_member());

create policy "vault_clients: insert pentru activi"
  on public.vault_clients for insert
  to authenticated
  with check (public.vault_is_active_member());

create policy "vault_clients: update pentru activi"
  on public.vault_clients for update
  to authenticated
  using (public.vault_is_active_member())
  with check (public.vault_is_active_member());

-- Intrări
create policy "vault_entries: select pentru activi"
  on public.vault_entries for select
  to authenticated
  using (public.vault_is_active_member());

create policy "vault_entries: insert pentru activi"
  on public.vault_entries for insert
  to authenticated
  with check (public.vault_is_active_member());

create policy "vault_entries: update pentru activi"
  on public.vault_entries for update
  to authenticated
  using (public.vault_is_active_member())
  with check (public.vault_is_active_member());

-- Istoric: doar citire. Insertul vine din triggerul SECURITY DEFINER.
create policy "vault_entry_versions: select pentru activi"
  on public.vault_entry_versions for select
  to authenticated
  using (public.vault_is_active_member());

-- Verificare rapidă după aplicare (SQL editor, fără sesiune):
--   select count(*) from public.vault_entries;   → 0 rânduri sau eroare de
--   permisiune, niciodată date. Cu un cont invitat dar neaprobat: la fel.
