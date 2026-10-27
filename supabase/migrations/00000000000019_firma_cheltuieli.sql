-- ============================================================
-- Adminul firmei, faza 4: cheltuielile.
--
-- Bonul sau factura de la furnizor se urcă din telefon (poză sau PDF) în
-- bucket-ul privat `firma-docs`; adminul citește furnizorul, data și suma,
-- tu le poți corecta, iar fișierul ajunge în folderul lunii de pe Drive.
-- Bucket-ul ține și extrasele (faza 5) și zip-ul pentru contabil (faza 6).
-- Se poate rula de mai multe ori.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'firma-docs',
  'firma-docs',
  false,
  52428800, -- 50 MB (zip-ul lunii poate fi mare)
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf',
    'text/csv', 'text/plain', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.firma_cheltuieli (
  id uuid primary key default gen_random_uuid(),
  -- Prima zi a lunii documentului (până la citire: luna în care s-a urcat).
  luna date not null,
  furnizor text check (furnizor is null or char_length(furnizor) <= 200),
  furnizor_cui text check (furnizor_cui is null or char_length(furnizor_cui) <= 20),
  nr_document text check (nr_document is null or char_length(nr_document) <= 60),
  data_doc date,
  suma numeric(12, 2) check (suma is null or suma >= 0),
  moneda text not null default 'RON' check (moneda in ('RON', 'EUR', 'USD', 'altele')),
  categoria text not null default 'altele' check (categoria in ('software', 'echipament', 'transport', 'reclame', 'altele')),
  descriere text check (descriere is null or char_length(descriere) <= 500),
  fisier_cale text not null unique check (char_length(fisier_cale) <= 300),
  fisier_nume text not null check (char_length(fisier_nume) <= 300),
  fisier_tip text not null check (char_length(fisier_tip) <= 120),
  fisier_marime bigint,
  -- Citirea automată: neîncepută → ok / eroare / sărită (fără cheie).
  citire_stare text not null default 'neinceputa' check (citire_stare in ('neinceputa', 'ok', 'eroare', 'sarita')),
  citire_mesaj text check (citire_mesaj is null or char_length(citire_mesaj) <= 1000),
  citire jsonb,
  -- Tu ai văzut și ai salvat datele (după citire sau de mână).
  confirmata boolean not null default false,
  drive_file_id text,
  drive_link text,
  drive_mesaj text check (drive_mesaj is null or char_length(drive_mesaj) <= 1000),
  -- Plata din extras (faza 5).
  tranzactie_id uuid,
  scoasa_la timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text
);
create index if not exists firma_cheltuieli_luna_idx on public.firma_cheltuieli (luna, data_doc);

drop trigger if exists firma_cheltuieli_set_updated_at on public.firma_cheltuieli;
create trigger firma_cheltuieli_set_updated_at before update on public.firma_cheltuieli for each row execute function public.set_updated_at();

alter table public.firma_cheltuieli enable row level security;
drop policy if exists firma_cheltuieli_admin_read on public.firma_cheltuieli;
create policy firma_cheltuieli_admin_read on public.firma_cheltuieli for select to authenticated using (public.is_lead_admin());
