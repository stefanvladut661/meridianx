-- ============================================================
-- Postări, fazele 5–6: conturile Instagram și TikTok și stocarea temporară.
--
-- `postari_conturi`: un rând pe platformă, cu tokenurile CRIPTATE pe server
-- (AES-256-GCM; cheia, POSTARI_TOKEN_KEY, stă doar în Vercel). Adminii pot
-- citi prin REST doar coloanele fără tokenuri; tokenurile le citește doar
-- cheia de service.
--
-- Bucket-ul `postari-temp`: copia temporară a clipului pentru Instagram
-- (Instagram ia clipul de la o adresă publică; cu Instagram Login nu există
-- urcare directă). Privat și fără politici: doar serverul, cu cheia de service,
-- scrie și face linkuri semnate. Copia se șterge după publicare sau după
-- eșecul definitiv.
--
-- LIMITA: 50 MB e maximul pe planul Free Supabase. Pe Pro se ridică aici și
-- în Postări → Setări („Limita stocării temporare”), cu același număr, ex. 300 MB:
--   update storage.buckets set file_size_limit = 314572800 where id = 'postari-temp';
-- Se poate rula de mai multe ori.
-- ============================================================

create table if not exists public.postari_conturi (
  platforma text primary key check (platforma in ('instagram', 'tiktok')),
  -- Instagram: user_id (id-ul contului profesional); TikTok: open_id.
  cont_id text not null check (char_length(cont_id) <= 200),
  -- @utilizator (Instagram) sau numele afișat (TikTok).
  nume text check (nume is null or char_length(nume) <= 200),
  token_criptat text not null check (char_length(token_criptat) <= 4000),
  token_expira_la timestamptz,
  refresh_criptat text check (refresh_criptat is null or char_length(refresh_criptat) <= 4000),
  refresh_expira_la timestamptz,
  scope text check (scope is null or char_length(scope) <= 500),
  reinnoit_la timestamptz,
  stare text not null default 'activ' check (stare in ('activ', 'expirat', 'eroare')),
  eroare text check (eroare is null or char_length(eroare) <= 1000),
  conectat_la timestamptz not null default now(),
  conectat_de text not null check (char_length(conectat_de) <= 200),
  updated_at timestamptz not null default now()
);

alter table public.postari_conturi enable row level security;
drop policy if exists postari_conturi_admin_read on public.postari_conturi;
create policy postari_conturi_admin_read on public.postari_conturi for select to authenticated using (public.is_lead_admin());

-- Tokenurile nu se citesc prin REST nici de admini: doar coloanele de stare.
revoke all on table public.postari_conturi from anon, authenticated;
grant select (platforma, cont_id, nume, token_expira_la, refresh_expira_la, scope, reinnoit_la, stare, eroare, conectat_la, conectat_de, updated_at) on public.postari_conturi to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'postari-temp',
  'postari-temp',
  false,
  52428800, -- 50 MB
  array['video/mp4', 'video/quicktime']
)
on conflict (id) do update
  set public = excluded.public,
      allowed_mime_types = excluded.allowed_mime_types;

select 'RLS activ pe postari_conturi' as verificare,
  (select relrowsecurity from pg_class where relname = 'postari_conturi' and relnamespace = 'public'::regnamespace) as ok
union all
select 'tokenurile nu se citesc cu o sesiune',
  not has_column_privilege('authenticated', 'public.postari_conturi', 'token_criptat', 'select')
  and not has_column_privilege('authenticated', 'public.postari_conturi', 'refresh_criptat', 'select')
union all
select 'bucket-ul postari-temp e privat',
  exists (select 1 from storage.buckets where id = 'postari-temp' and public = false);
