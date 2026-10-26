-- ============================================================
-- Adminul firmei, faza 8: panoul și alertele.
--
-- `firma_rezumate`: rezumatul de dimineață trimis într-o zi (un singur email
-- pe zi, doar în zilele cu alerte). `firma_setari.email_rezumat`: unde pleacă.
-- Se poate rula de mai multe ori.
-- ============================================================

alter table public.firma_setari add column if not exists email_rezumat text check (email_rezumat is null or char_length(email_rezumat) <= 500);

create table if not exists public.firma_rezumate (
  zi date primary key,
  alerte integer not null default 0,
  trimis boolean not null default false,
  catre text check (catre is null or char_length(catre) <= 500),
  mesaj text check (mesaj is null or char_length(mesaj) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.firma_rezumate enable row level security;
drop policy if exists firma_rezumate_admin_read on public.firma_rezumate;
create policy firma_rezumate_admin_read on public.firma_rezumate for select to authenticated using (public.is_lead_admin());
