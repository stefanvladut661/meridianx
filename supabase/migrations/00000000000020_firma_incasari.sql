-- ============================================================
-- Adminul firmei, faza 5: încasările din extrasul BT Go.
--
-- `firma_formate_banca`: cum se citește un export (rândul antetului,
-- separatorul, ce coloană e data / suma / detaliile), ales de om la primul
-- import și recunoscut apoi după antet — formatul nu se ghicește.
-- `firma_importuri_banca`: fiecare fișier importat (și unde e pe Drive).
-- `firma_tranzactii`: rândurile extrasului, o singură dată (amprentă unică),
-- cu potrivirea lor: factura încasată sau cheltuiala plătită.
-- Se poate rula de mai multe ori.
-- ============================================================

create table if not exists public.firma_formate_banca (
  id uuid primary key default gen_random_uuid(),
  semnatura text not null unique check (char_length(semnatura) <= 200),
  nume text not null check (char_length(nume) <= 120),
  rand_antet smallint not null check (rand_antet between 0 and 50),
  delimitator text not null check (delimitator in (',', ';', 'tab', '|')),
  codare text not null default 'utf-8' check (codare in ('utf-8', 'windows-1250')),
  -- { data, suma? | debit? + credit?, detalii, contrapartida?, referinta?, moneda? } = indicii coloanelor
  coloane jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text
);

create table if not exists public.firma_importuri_banca (
  id uuid primary key default gen_random_uuid(),
  fisier_cale text not null check (char_length(fisier_cale) <= 300),
  fisier_nume text not null check (char_length(fisier_nume) <= 300),
  format_id uuid references public.firma_formate_banca (id) on delete set null,
  de_la date,
  pana_la date,
  randuri integer not null default 0,
  noi integer not null default 0,
  duplicate integer not null default 0,
  luna date,
  drive_file_id text,
  drive_link text,
  drive_mesaj text check (drive_mesaj is null or char_length(drive_mesaj) <= 1000),
  created_at timestamptz not null default now(),
  created_by text
);

create table if not exists public.firma_tranzactii (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.firma_importuri_banca (id) on delete cascade,
  data date not null,
  -- Cu semn: pozitivă = încasare, negativă = plată.
  suma numeric(12, 2) not null,
  moneda text not null default 'RON' check (char_length(moneda) <= 10),
  detalii text check (detalii is null or char_length(detalii) <= 1000),
  contrapartida text check (contrapartida is null or char_length(contrapartida) <= 300),
  referinta text check (referinta is null or char_length(referinta) <= 120),
  -- Același rând din două exporturi (ex. săptămâna și luna) nu intră de două ori.
  amprenta text not null unique check (char_length(amprenta) <= 200),
  directie text not null check (directie in ('in', 'out')),
  -- nepotrivita → sigura (adminul a legat-o singur) / de_confirmat (aștepți tu) → confirmata; ignorata = nu ține de o factură/cheltuială.
  potrivire text not null default 'nepotrivita' check (potrivire in ('nepotrivita', 'sigura', 'de_confirmat', 'confirmata', 'ignorata')),
  factura_id uuid references public.firma_facturi (id) on delete set null,
  cheltuiala_id uuid references public.firma_cheltuieli (id) on delete set null,
  -- Facturile / cheltuielile posibile, cu motivul: [{ id, motiv }]
  candidati jsonb not null default '[]'::jsonb,
  motiv text check (motiv is null or char_length(motiv) <= 500),
  -- Încasarea marcată în Oblio: nu (încă) / facuta / sarita (era deja în Oblio) / eroare.
  oblio_incasare text not null default 'nu' check (oblio_incasare in ('nu', 'facuta', 'sarita', 'eroare')),
  oblio_mesaj text check (oblio_mesaj is null or char_length(oblio_mesaj) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists firma_tranzactii_data_idx on public.firma_tranzactii (data desc);
create index if not exists firma_tranzactii_potrivire_idx on public.firma_tranzactii (potrivire);

drop trigger if exists firma_formate_banca_set_updated_at on public.firma_formate_banca;
create trigger firma_formate_banca_set_updated_at before update on public.firma_formate_banca for each row execute function public.set_updated_at();
drop trigger if exists firma_tranzactii_set_updated_at on public.firma_tranzactii;
create trigger firma_tranzactii_set_updated_at before update on public.firma_tranzactii for each row execute function public.set_updated_at();

alter table public.firma_formate_banca enable row level security;
alter table public.firma_importuri_banca enable row level security;
alter table public.firma_tranzactii enable row level security;
drop policy if exists firma_formate_banca_admin_read on public.firma_formate_banca;
create policy firma_formate_banca_admin_read on public.firma_formate_banca for select to authenticated using (public.is_lead_admin());
drop policy if exists firma_importuri_banca_admin_read on public.firma_importuri_banca;
create policy firma_importuri_banca_admin_read on public.firma_importuri_banca for select to authenticated using (public.is_lead_admin());
drop policy if exists firma_tranzactii_admin_read on public.firma_tranzactii;
create policy firma_tranzactii_admin_read on public.firma_tranzactii for select to authenticated using (public.is_lead_admin());
