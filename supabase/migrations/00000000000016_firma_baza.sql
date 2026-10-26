-- ============================================================
-- Adminul firmei, faza 1: setările, istoricul, clienții, persoanele de
-- contact, contractele și prețurile pe perioade.
--
-- Datele reale (nume de clienți, CUI-uri, sume) stau doar aici, nu în repo.
-- Citirea: doar adminii (`is_lead_admin()`, din migrarea 5). Scrierile trec
-- prin cheia de service, pe server, din acțiunile modulului.
-- Se poate rula de mai multe ori.
-- ============================================================

-- Setările modulului: un singur rând.
create table if not exists public.firma_setari (
  id smallint primary key default 1 check (id = 1),
  -- Seria din Oblio pe care se emit facturile (ex. cea implicită a firmei).
  serie_factura text check (serie_factura is null or char_length(serie_factura) <= 20),
  -- Emailul contabilului, unde pleacă pachetul lunar (după „Trimite”).
  email_contabil text check (email_contabil is null or char_length(email_contabil) <= 200),
  -- Folderul rădăcină de pe Drive (id-ul din adresa folderului) și modelul de nume al lunii.
  drive_radacina text check (drive_radacina is null or char_length(drive_radacina) <= 200),
  drive_model_luna text not null default '{luna} {an}' check (char_length(drive_model_luna) between 1 and 80),
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.firma_setari (id) values (1) on conflict (id) do nothing;

-- Istoricul: fiecare acțiune a modulului — cine, ce, când, rezultatul.
create table if not exists public.firma_istoric (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor text not null check (char_length(actor) <= 200),
  zona text not null check (zona in ('clienti', 'facturi', 'drive', 'cheltuieli', 'incasari', 'contabil', 'accese', 'panou', 'setari', 'sistem')),
  actiune text not null check (char_length(actiune) <= 120),
  tinta text check (tinta is null or char_length(tinta) <= 200),
  rezultat text not null check (rezultat in ('ok', 'eroare', 'sarit')),
  mesaj text check (mesaj is null or char_length(mesaj) <= 2000),
  detalii jsonb not null default '{}'::jsonb
);
create index if not exists firma_istoric_created_idx on public.firma_istoric (created_at desc);
create index if not exists firma_istoric_zona_idx on public.firma_istoric (zona, created_at desc);

-- Clienții firmei (diferiți de clienții portalului de reclame, cu care se leagă).
create table if not exists public.firma_clienti (
  id uuid primary key default gen_random_uuid(),
  nume text not null check (char_length(nume) between 1 and 200),
  cui text check (cui is null or char_length(cui) <= 20),
  reg_com text check (reg_com is null or char_length(reg_com) <= 40),
  adresa text check (adresa is null or char_length(adresa) <= 300),
  oras text check (oras is null or char_length(oras) <= 100),
  judet text check (judet is null or char_length(judet) <= 100),
  tara text not null default 'România' check (char_length(tara) <= 60),
  email_facturare text check (email_facturare is null or char_length(email_facturare) <= 200),
  -- Clientul din portalul de reclame (`ads_clients.id`). Fără cheie străină:
  -- modulul merge și dacă migrarea portalului (12) nu e rulată.
  ads_client_id uuid,
  note text check (note is null or char_length(note) <= 2000),
  oblio_importat_la timestamptz,
  arhivat_la timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text
);
-- Același CUI nu poate fi la doi clienți activi.
create unique index if not exists firma_clienti_cui_uidx on public.firma_clienti (upper(cui)) where cui is not null and arhivat_la is null;

create table if not exists public.firma_contacte (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.firma_clienti (id) on delete cascade,
  nume text not null check (char_length(nume) between 1 and 120),
  rol text check (rol is null or char_length(rol) <= 80),
  telefon text check (telefon is null or char_length(telefon) <= 40),
  email text check (email is null or char_length(email) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists firma_contacte_client_idx on public.firma_contacte (client_id);

create table if not exists public.firma_contracte (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.firma_clienti (id) on delete restrict,
  numar text check (numar is null or char_length(numar) <= 60),
  incepe date not null,
  se_termina date,
  servicii text not null check (char_length(servicii) between 1 and 1000),
  moneda text not null default 'RON' check (moneda in ('RON', 'EUR')),
  -- Bugetul de reclame recomandat, pe lună. Îl plătește clientul direct platformelor: nu se facturează.
  buget_reclame numeric(12, 2) check (buget_reclame is null or buget_reclame >= 0),
  -- Ziua din lună în care se emite factura și în câte zile e scadentă.
  zi_emitere smallint not null default 1 check (zi_emitere between 1 and 28),
  zile_scadenta smallint not null default 5 check (zile_scadenta between 0 and 120),
  starea text not null default 'activ' check (starea in ('activ', 'suspendat', 'incheiat')),
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (se_termina is null or se_termina >= incepe)
);
create index if not exists firma_contracte_client_idx on public.firma_contracte (client_id);

-- Prețul se poate schimba pe perioade (ex. primele 3 luni o sumă, următoarele 3 alta).
-- Perioadele sunt pe luni întregi: `de_la` e prima zi a lunii, `pana_la` ultima.
create table if not exists public.firma_preturi (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.firma_contracte (id) on delete cascade,
  de_la date not null,
  pana_la date,
  suma numeric(12, 2) not null check (suma > 0),
  -- Rândul de pe factură; luna se adaugă la emitere.
  descriere text not null check (char_length(descriere) between 1 and 300),
  created_at timestamptz not null default now(),
  check (pana_la is null or pana_la >= de_la)
);
create index if not exists firma_preturi_contract_idx on public.firma_preturi (contract_id, de_la);

-- updated_at (funcția `set_updated_at` vine din migrarea 2).
drop trigger if exists firma_setari_set_updated_at on public.firma_setari;
create trigger firma_setari_set_updated_at before update on public.firma_setari for each row execute function public.set_updated_at();
drop trigger if exists firma_clienti_set_updated_at on public.firma_clienti;
create trigger firma_clienti_set_updated_at before update on public.firma_clienti for each row execute function public.set_updated_at();
drop trigger if exists firma_contracte_set_updated_at on public.firma_contracte;
create trigger firma_contracte_set_updated_at before update on public.firma_contracte for each row execute function public.set_updated_at();

-- RLS: citire doar pentru admini; fără politici de scriere (scrie doar cheia de service).
alter table public.firma_setari enable row level security;
alter table public.firma_istoric enable row level security;
alter table public.firma_clienti enable row level security;
alter table public.firma_contacte enable row level security;
alter table public.firma_contracte enable row level security;
alter table public.firma_preturi enable row level security;

drop policy if exists firma_setari_admin_read on public.firma_setari;
create policy firma_setari_admin_read on public.firma_setari for select to authenticated using (public.is_lead_admin());
drop policy if exists firma_istoric_admin_read on public.firma_istoric;
create policy firma_istoric_admin_read on public.firma_istoric for select to authenticated using (public.is_lead_admin());
drop policy if exists firma_clienti_admin_read on public.firma_clienti;
create policy firma_clienti_admin_read on public.firma_clienti for select to authenticated using (public.is_lead_admin());
drop policy if exists firma_contacte_admin_read on public.firma_contacte;
create policy firma_contacte_admin_read on public.firma_contacte for select to authenticated using (public.is_lead_admin());
drop policy if exists firma_contracte_admin_read on public.firma_contracte;
create policy firma_contracte_admin_read on public.firma_contracte for select to authenticated using (public.is_lead_admin());
drop policy if exists firma_preturi_admin_read on public.firma_preturi;
create policy firma_preturi_admin_read on public.firma_preturi for select to authenticated using (public.is_lead_admin());
