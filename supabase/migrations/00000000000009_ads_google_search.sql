-- MERIDIAN — portalul de reclame: campaniile de căutare Google (migrarea 9)
-- Se aplică DUPĂ migrarea 8, lipit în SQL editor pe proiectul Supabase.
--
-- DE CE: un plan de căutare creează MAI MULTE campanii odată, într-o singură
-- cerere atomică. Fiecare campanie are rândul ei în `ads_campaigns` (ca să
-- apară în listă, în statistici și în sincronizare), iar rândurile create
-- din același plan se leagă între ele prin `plan_group_id`. `channel` spune
-- că rândul e o campanie de căutare (planul ei are altă formă decât cel video).
--
-- Fișier NOU, aditiv: două coloane opționale și un index. Rândurile vechi
-- rămân cum sunt (`channel` null = campanie din planul video). Se poate rula
-- de mai multe ori.

alter table public.ads_campaigns add column if not exists plan_group_id uuid;
alter table public.ads_campaigns add column if not exists channel text;

alter table public.ads_campaigns drop constraint if exists ads_campaigns_channel_check;
alter table public.ads_campaigns
  add constraint ads_campaigns_channel_check check (channel is null or channel in ('search'));

create index if not exists ads_campaigns_plan_group_idx
  on public.ads_campaigns (plan_group_id)
  where plan_group_id is not null;
