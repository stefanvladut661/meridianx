-- ============================================================
-- Adminul firmei, faza 6: pachetul lunar pentru contabil.
--
-- Pentru fiecare lună: ce lipsește (facturi fără PDF pe Drive, plăți fără
-- document, extrasul), zip-ul cu folderul lunii și extrasul (pe Drive și în
-- stocare) și emailul către contabil — care pleacă doar la „Trimite”.
-- Se poate rula de mai multe ori.
-- ============================================================

create table if not exists public.firma_pachete (
  luna date primary key,
  -- incomplet / complet (verificarea) → zip_gata → trimis
  stare text not null default 'incomplet' check (stare in ('incomplet', 'complet', 'zip_gata', 'trimis')),
  verificat_la timestamptz,
  -- [{ fel, text }] — ce lipsea la ultima verificare.
  lipsuri jsonb not null default '[]'::jsonb,
  zip_cale text check (zip_cale is null or char_length(zip_cale) <= 300),
  zip_drive_id text,
  zip_link text,
  zip_marime bigint,
  zip_fisiere integer,
  zip_facut_la timestamptz,
  email_catre text check (email_catre is null or char_length(email_catre) <= 500),
  email_subiect text check (email_subiect is null or char_length(email_subiect) <= 300),
  email_text text check (email_text is null or char_length(email_text) <= 5000),
  email_stare text not null default 'nepregatit' check (email_stare in ('nepregatit', 'pregatit', 'trimis', 'esuat')),
  email_trimis_la timestamptz,
  updated_at timestamptz not null default now(),
  updated_by text
);

drop trigger if exists firma_pachete_set_updated_at on public.firma_pachete;
create trigger firma_pachete_set_updated_at before update on public.firma_pachete for each row execute function public.set_updated_at();

alter table public.firma_pachete enable row level security;
drop policy if exists firma_pachete_admin_read on public.firma_pachete;
create policy firma_pachete_admin_read on public.firma_pachete for select to authenticated using (public.is_lead_admin());
