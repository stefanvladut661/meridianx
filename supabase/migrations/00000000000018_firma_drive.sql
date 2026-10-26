-- ============================================================
-- Adminul firmei, faza 3: Drive.
--
-- `firma_luni_drive`: folderul fiecărei luni (creat de admin în folderul
-- rădăcină din Setări, după modelul de nume ales acolo).
-- `firma_fisiere`: ce s-a urcat și unde — o factură, o cheltuială sau un
-- extras se urcă o singură dată (unic pe fel + sursă).
-- Se poate rula de mai multe ori.
-- ============================================================

create table if not exists public.firma_luni_drive (
  luna date primary key,
  folder_id text not null check (char_length(folder_id) <= 200),
  folder_nume text not null check (char_length(folder_nume) <= 200),
  link text check (link is null or char_length(link) <= 1000),
  radacina text not null check (char_length(radacina) <= 200),
  created_at timestamptz not null default now()
);

create table if not exists public.firma_fisiere (
  id uuid primary key default gen_random_uuid(),
  luna date not null,
  felul text not null check (felul in ('factura', 'cheltuiala', 'extras', 'pachet')),
  -- Id-ul rândului din admin (factura, cheltuiala, importul de extras, pachetul).
  sursa_id text not null check (char_length(sursa_id) <= 200),
  nume text not null check (char_length(nume) <= 300),
  drive_file_id text not null check (char_length(drive_file_id) <= 200),
  link text check (link is null or char_length(link) <= 1000),
  marime bigint,
  created_at timestamptz not null default now(),
  created_by text
);
create unique index if not exists firma_fisiere_sursa_uidx on public.firma_fisiere (felul, sursa_id);
create index if not exists firma_fisiere_luna_idx on public.firma_fisiere (luna, felul);

alter table public.firma_luni_drive enable row level security;
alter table public.firma_fisiere enable row level security;
drop policy if exists firma_luni_drive_admin_read on public.firma_luni_drive;
create policy firma_luni_drive_admin_read on public.firma_luni_drive for select to authenticated using (public.is_lead_admin());
drop policy if exists firma_fisiere_admin_read on public.firma_fisiere;
create policy firma_fisiere_admin_read on public.firma_fisiere for select to authenticated using (public.is_lead_admin());
