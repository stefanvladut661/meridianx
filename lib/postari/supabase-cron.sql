-- ============================================================
-- Postări: jobul din Supabase Cron care pornește coada la 5 minute.
--
-- NU e o migrare: îl rulezi tu, o dată, în Supabase → SQL Editor, după ce
-- ai pus POSTARI_CRON_SECRET în Vercel (Production) și ai dat Redeploy.
-- Înlocuiește <SECRETUL> cu exact același șir ca în Vercel.
--
-- Jobul trimite POST la /admin/postari/cron cu „Authorization: Bearer
-- <secret>”. Cererea pleacă prin pg_net, asincron: jobul nu așteaptă
-- răspunsul. Timeout-ul implicit al pg_net e de 2 secunde, așa că aici e pus
-- 60 de secunde, cât poate lucra o rulare.
-- ============================================================

-- 1. Extensiile (dacă sunt deja pornite, nu se întâmplă nimic).
--    Le poți porni și din Database → Extensions: pg_cron și pg_net.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Secretul, în Supabase Vault (seiful bazei de date Supabase, nu vault-ul
--    MERIDIAN din /vault). Rulat din nou, înlocuiește secretul vechi.
do $$
declare
  existent uuid;
begin
  select id into existent from vault.secrets where name = 'postari_cron_secret';
  if existent is null then
    perform vault.create_secret('<SECRETUL>', 'postari_cron_secret', 'Postări: secretul cu care Supabase Cron pornește coada');
  else
    perform vault.update_secret(existent, '<SECRETUL>', 'postari_cron_secret', 'Postări: secretul cu care Supabase Cron pornește coada');
  end if;
end;
$$;

-- 3. Jobul. Rulat din nou cu același nume, îl înlocuiește pe cel vechi.
select cron.schedule(
  'postari-coada',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://www.meridianx.ro/admin/postari/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'postari_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- ------------------------------------------------------------
-- Verificări (rulează-le când vrei)
-- ------------------------------------------------------------

-- Jobul există și e activ:
-- select jobid, jobname, schedule, active from cron.job where jobname = 'postari-coada';

-- Ultimele porniri ale jobului (spun doar că cererea a plecat, nu ce a răspuns adminul):
-- select status, return_message, start_time from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'postari-coada')
--   order by start_time desc limit 10;

-- Ce a răspuns adminul (pg_net ține răspunsurile 6 ore). 200 = rulare făcută, 401 = secret greșit:
-- select created, status_code, left(content::text, 200) as raspuns, error_msg from net._http_response order by created desc limit 10;

-- ------------------------------------------------------------
-- Oprirea de tot a jobului (coada se oprește mai simplu din admin: „Oprește coada”)
-- ------------------------------------------------------------
-- select cron.unschedule('postari-coada');

-- Varianta fără Vault (secretul scris direct în job; oricine vede cron.job îl vede):
-- select cron.schedule('postari-coada', '*/5 * * * *', $$
--   select net.http_post(
--     url := 'https://www.meridianx.ro/admin/postari/cron',
--     headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SECRETUL>"}'::jsonb,
--     body := '{}'::jsonb,
--     timeout_milliseconds := 60000
--   );
-- $$);
