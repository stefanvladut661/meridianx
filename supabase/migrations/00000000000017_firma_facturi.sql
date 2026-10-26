-- ============================================================
-- Adminul firmei, faza 2: facturile.
--
-- O factură stă întâi aici, ca ciornă. Doar „Aprobă” (omul) o emite în
-- Oblio, o trimite în e-Factura, îi pune PDF-ul pe Drive și îi pregătește
-- emailul; emailul pleacă doar la „Trimite”. Adminul nu anulează, nu
-- stornează și nu șterge facturi emise — acelea se fac în Oblio.
--
-- `cheie_idempotenta` merge la Oblio ca `idempotencyKey`: aceeași factură
-- aprobată de două ori (dublu-click, reluare după o eroare) nu se emite a doua oară.
-- Se poate rula de mai multe ori.
-- ============================================================

create table if not exists public.firma_facturi (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.firma_clienti (id) on delete restrict,
  contract_id uuid references public.firma_contracte (id) on delete set null,
  felul text not null check (felul in ('contract', 'manuala')),
  -- Prima zi a lunii facturate (la cele din contract).
  luna date,
  -- ciorna → in_lucru (aprobată, pașii rulează) → emisa; eroare = emiterea n-a mers;
  -- renuntat = ciornă la care s-a renunțat (n-a existat niciodată în Oblio).
  starea text not null default 'ciorna' check (starea in ('ciorna', 'in_lucru', 'emisa', 'eroare', 'renuntat')),
  serie text check (serie is null or char_length(serie) <= 20),
  numar text check (numar is null or char_length(numar) <= 20),
  link_oblio text check (link_oblio is null or char_length(link_oblio) <= 1000),
  data_planificata date not null,
  data_emiterii date,
  zile_scadenta smallint not null default 5 check (zile_scadenta between 0 and 120),
  scadenta date,
  moneda text not null default 'RON' check (moneda in ('RON', 'EUR')),
  -- [{ denumire, descriere, cantitate, um, pretUnitar }]
  randuri jsonb not null default '[]'::jsonb,
  total numeric(12, 2) not null default 0 check (total >= 0),
  mentiuni text check (mentiuni is null or char_length(mentiuni) <= 1000),
  cheie_idempotenta text not null unique check (char_length(cheie_idempotenta) <= 120),
  -- e-Factura, după Oblio: -1 netrimisă, 2 cu erori, 0 primită de SPV (în procesare), 1 trimisă cu succes.
  efactura_cod smallint,
  efactura_text text check (efactura_text is null or char_length(efactura_text) <= 1000),
  efactura_la timestamptz,
  drive_file_id text,
  drive_link text,
  email_stare text not null default 'nepregatit' check (email_stare in ('nepregatit', 'pregatit', 'trimis', 'esuat')),
  email_catre text check (email_catre is null or char_length(email_catre) <= 500),
  email_subiect text check (email_subiect is null or char_length(email_subiect) <= 300),
  email_text text check (email_text is null or char_length(email_text) <= 5000),
  email_trimis_la timestamptz,
  -- Încasat, după Oblio (suma încasărilor de pe factură) și data ultimei încasări.
  incasat numeric(12, 2) not null default 0,
  incasata_la date,
  -- Pașii aprobării: { emitere|efactura|drive|email: { stare: ok|eroare|sarit, la, mesaj } }.
  pasi jsonb not null default '{}'::jsonb,
  aprobata_de text,
  aprobata_la timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text
);

-- O singură factură de contract pe lună (ciorna nu se pregătește de două ori).
create unique index if not exists firma_facturi_contract_luna_uidx on public.firma_facturi (contract_id, luna) where felul = 'contract';
create unique index if not exists firma_facturi_serie_numar_uidx on public.firma_facturi (serie, numar) where numar is not null;
create index if not exists firma_facturi_client_idx on public.firma_facturi (client_id);
create index if not exists firma_facturi_emiterii_idx on public.firma_facturi (data_emiterii desc);
create index if not exists firma_facturi_starea_idx on public.firma_facturi (starea);

drop trigger if exists firma_facturi_set_updated_at on public.firma_facturi;
create trigger firma_facturi_set_updated_at before update on public.firma_facturi for each row execute function public.set_updated_at();

alter table public.firma_facturi enable row level security;
drop policy if exists firma_facturi_admin_read on public.firma_facturi;
create policy firma_facturi_admin_read on public.firma_facturi for select to authenticated using (public.is_lead_admin());
