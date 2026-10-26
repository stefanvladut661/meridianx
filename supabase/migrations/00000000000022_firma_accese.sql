-- ============================================================
-- Adminul firmei, faza 7: lista conturilor firmei (accese).
--
-- Pentru fiecare cont: cine are acces, dacă are 2FA, UNDE e parola (în
-- managerul de parole — parola nu stă aici), abonamentul și data reînnoirii.
-- Niciun câmp de parolă sau de cheie. Se poate rula de mai multe ori.
-- ============================================================

create table if not exists public.firma_conturi (
  id uuid primary key default gen_random_uuid(),
  nume text not null check (char_length(nume) between 1 and 120),
  categoria text not null default 'platforma' check (categoria in ('platforma', 'banca', 'facturare', 'google', 'meta', 'tiktok', 'vercel', 'supabase', 'github', 'domeniu', 'altele')),
  adresa text check (adresa is null or char_length(adresa) <= 300),
  -- Cu ce cont se intră (de obicei un email), nu parola.
  cont text check (cont is null or char_length(cont) <= 200),
  cine_are_acces text check (cine_are_acces is null or char_length(cine_are_acces) <= 500),
  doi_fa text not null default 'necunoscut' check (doi_fa in ('da', 'nu', 'necunoscut')),
  -- Ex. „managerul de parole → seiful Firmă”. Doar locul, niciodată parola.
  unde_e_parola text check (unde_e_parola is null or char_length(unde_e_parola) <= 200),
  abonament numeric(12, 2) check (abonament is null or abonament >= 0),
  moneda text not null default 'RON' check (moneda in ('RON', 'EUR', 'USD')),
  ciclu text check (ciclu is null or ciclu in ('lunar', 'anual')),
  reinnoire date,
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists firma_conturi_reinnoire_idx on public.firma_conturi (reinnoire);

drop trigger if exists firma_conturi_set_updated_at on public.firma_conturi;
create trigger firma_conturi_set_updated_at before update on public.firma_conturi for each row execute function public.set_updated_at();

alter table public.firma_conturi enable row level security;
drop policy if exists firma_conturi_admin_read on public.firma_conturi;
create policy firma_conturi_admin_read on public.firma_conturi for select to authenticated using (public.is_lead_admin());
