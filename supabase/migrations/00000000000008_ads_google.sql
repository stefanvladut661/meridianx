-- MERIDIAN — portalul de reclame: Google Ads (migrarea 8)
-- Se aplică DUPĂ migrarea 6, lipit în SQL editor pe proiectul Supabase.
-- (Sau, mai simplu: supabase/portal-reclame.sql, care le aplică pe toate.)
--
-- DE CE: `ads_campaigns.platform` accepta doar 'meta' și 'tiktok'. Campaniile
-- create pe Google trebuie să încapă în aceeași tabelă, cu aceleași reguli.
--
-- Fișier NOU, aditiv: lărgește o singură constrângere. Nu atinge datele.

alter table public.ads_campaigns drop constraint if exists ads_campaigns_platform_check;
alter table public.ads_campaigns
  add constraint ads_campaigns_platform_check check (platform in ('meta', 'tiktok', 'google'));
