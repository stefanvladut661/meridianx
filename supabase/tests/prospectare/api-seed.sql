-- Datele pentru scripts/prospectare-verifica-api.mjs, pe o bază de TEST locală,
-- după migrările 28–33 (o singură dată pe bază: firmele nu se mai pot șterge,
-- activitatea lor rămâne). Tokenurile sunt cele de test din script, nu reale.
select set_config('prospectare.autor', 'test-api', false);

insert into public.prospectare_dispozitive (nume, proprietar, token_hash, activ) values
  ('api-robot-1', 'test', encode(sha256('mrx_robot_test_api_unu_0000000001'::bytea), 'hex'), true),
  ('api-robot-2', 'test', encode(sha256('mrx_robot_test_api_doi_0000000002'::bytea), 'hex'), true),
  ('api-robot-oprit', 'test', encode(sha256('mrx_robot_test_api_oprit_00000003'::bytea), 'hex'), false)
on conflict do nothing;

-- 7001: de construit, scorul cel mai mare · 7002: pe telefon (lista de apeluri) · 7003: site gata, cu email, necontactată.
insert into public.prospectare_firme (nr, nume, domeniu, scor, telefon, email, etapa, link_demo, telefon_la) values
  (7001, 'API Lucru', 'api-lucru.ro', 999, '0745 700 001', null, 'site_in_lucru', null, null),
  (7002, 'API Telefon', 'api-telefon.ro', 50, '0745 700 002', 'office@api-telefon.ro', 'site_gata', 'https://demo.test/api-telefon/', now()),
  (7003, 'API Gata', 'api-gata.ro', 50, '0232 700 003', 'office@api-gata.ro', 'site_gata', 'https://demo.test/api-gata/', null)
on conflict do nothing;

select 'datele probei API sunt în bază' as verificare,
  (select count(*) = 3 from public.prospectare_dispozitive where nume like 'api-robot-%')
  and (select count(*) = 3 from public.prospectare_firme where nr in (7001, 7002, 7003)) as ok;
