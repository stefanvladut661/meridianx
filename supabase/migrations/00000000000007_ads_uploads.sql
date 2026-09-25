-- MERIDIAN — portalul de reclame: stocarea temporară a video-urilor (migrarea 7)
-- Se aplică DUPĂ migrarea 6, lipit în SQL editor pe proiectul Supabase.
--
-- DE CE: un video de reclamă trece de limita de ~4,5 MB a cererilor către
-- Vercel, iar urcarea direct la Meta ar cere tokenul System User-ului în
-- browser. Drumul ales: browserul urcă fișierul AICI, cu un URL semnat
-- valabil pentru un singur fișier; serverul îi dă apoi Meta un link de
-- descărcare semnat, Meta îl copiază în biblioteca contului, iar fișierul
-- de aici se șterge când Meta spune că video-ul e gata (sau că a eșuat).
-- Ce rămâne uitat se șterge după 6 ore. Bucket-ul e o anticameră, nu o arhivă.
--
-- Bucket PRIVAT și FĂRĂ politici pe `storage.objects`: nimeni nu citește
-- și nu scrie aici cu cheia anon sau cu o sesiune. Singurele căi sunt
-- URL-urile semnate create de server (cu service role), după ce acțiunea a
-- verificat că e un admin.
--
-- LIMITA DE MĂRIME: 50 MB e maximul pe planul Free al Supabase (limita
-- globală a proiectului; un bucket nu o poate depăși). Pe Pro limita
-- globală urcă până la 500 GB; atunci se ridică aici și în
-- lib/ads/constants.ts (`VIDEO_UPLOAD_MAX_BYTES`), cu același număr — de
-- exemplu 1 GB:
--   update storage.buckets set file_size_limit = 1073741824 where id = 'ads-uploads';
-- Meta primește video-uri de reclamă până la 4 GB.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ads-uploads',
  'ads-uploads',
  false,
  52428800, -- 50 MB
  array['video/mp4', 'video/quicktime']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
