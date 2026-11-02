#!/bin/bash
# Distribuția sub concurență: 5 cicluri pornite deodată pentru aceeași zi (rulează unul singur),
# două programări manuale simultane peste aceleași firme (fiecare firmă o singură dată, limita
# contului respectată), 5 trimiteri WhatsApp și 4 cereri de email simultane pentru aceeași firmă.
T=$(cd "$(dirname "$0")" && pwd); W=$(mktemp -d)
q(){ docker exec -i pgprospectare psql -U postgres -d test -X -q -tA -v ON_ERROR_STOP=1 "$@"; }
q <<'SQL' >/dev/null
select set_config('prospectare.autor', 'test', false);
update public.prospectare_firme set demo_verificat = false where nr < 8000 or nr >= 9000;
update public.prospectare_conturi_whatsapp set activ = (id in (1, 2)), limita_zi = 2;
insert into public.prospectare_firme (nr, nume, domeniu, telefon, email, etapa, link_demo, demo_verificat, site_gata_la)
select 8000 + g, 'Conc dist ' || g, 'cd' || g || '.ro', '0746 800 ' || lpad(g::text, 3, '0'), 'o@cd' || g || '.ro', 'site_gata',
  'https://demo.alfa.test/cd' || g || '/', true, now() - (g || ' hours')::interval
from generate_series(1, 60) g;
SQL
Z=$(q -c "select public.prospectare_azi() + 5")
for g in $(seq 1 5); do q -c "select public.prospectare_ciclu_zi('$Z'::date) ->> 'rulat_la'" > "$W/c$g" 2>&1 & done
wait
cicluri=$(cat "$W"/c* | sort -u | wc -l)
prog=$(q -c "select count(*) || ' ' || count(distinct firma_id) from public.prospectare_programari where zi = '$Z' and stare = 'programata'")
# Două programări manuale simultane peste aceleași 10 firme, pe contul 1 (2/zi), peste 10 zile.
Y=$(q -c "select public.prospectare_azi() + 10")
ids=$(q -c "select string_agg(quote_literal(id::text) || '::uuid', ',' order by nr) from (select id, nr from public.prospectare_firme where nr between 8001 and 8060 and not exists (select 1 from public.prospectare_programari p where p.firma_id = prospectare_firme.id and p.stare = 'programata') order by nr limit 10) s")
for g in 1 2; do q -c "select public.prospectare_programeaza('whatsapp', '$Y'::date, array[$ids], 1::smallint, null, 'om-$g') ->> 'programate'" > "$W/m$g" 2>&1 & done
wait
manual=$(q -c "select count(*) || ' ' || count(distinct firma_id) || ' ' || coalesce(max(n), 0) from public.prospectare_programari p, lateral (select count(*) as n from public.prospectare_programari o where o.zi = p.zi and o.canal = 'whatsapp' and o.cont_whatsapp = 1 and o.stare = 'programata') x where p.sursa = 'manual' and p.creat_de like 'om-%' and p.stare = 'programata'")
# WhatsApp: 5 oameni trimit deodată aceleiași firme programate azi.
F=$(q -c "select f.id from public.prospectare_firme f where f.nr between 8001 and 8060 and public.prospectare_poate_canal(f, 'whatsapp') and not exists (select 1 from public.prospectare_programari p where p.firma_id = f.id and p.stare = 'programata') order by nr limit 1")
q -c "insert into public.prospectare_programari (firma_id, canal, zi, sursa, cont_whatsapp, creat_de) values ('$F', 'whatsapp', public.prospectare_azi(), 'manual', 1, 'test')" >/dev/null
for g in $(seq 1 5); do q -c "select public.prospectare_whatsapp_trimis('$F', null, 'om-$g') ->> 'nr'" > "$W/wa$g" 2>&1 & done
# Email: 4 cereri deodată pentru aceeași firmă programată azi pe alfa.
E=$(q -c "select f.domeniu from public.prospectare_firme f where f.nr between 8001 and 8060 and public.prospectare_poate_canal(f, 'email') and not exists (select 1 from public.prospectare_programari p where p.firma_id = f.id and p.stare = 'programata') order by nr limit 1")
q -c "update public.prospectare_casute set activa = true, limita_zi = 50 where adresa = 'stefan@alfa.test'; insert into public.prospectare_programari (firma_id, canal, zi, sursa, casuta, creat_de) select id, 'email', public.prospectare_azi(), 'manual', 'stefan@alfa.test', 'test' from public.prospectare_firme where domeniu = '$E'" >/dev/null
for g in $(seq 1 4); do q -c "select public.prospectare_email_cere_canal((select id from public.prospectare_dispozitive where nume = 'robot-email'), '$E', null, 'stefan@alfa.test') ->> 'trimite'" > "$W/em$g" 2>&1 & done
wait
wa_ok=$(cat "$W"/wa* | grep -cE '^[0-9]+$'); wa_409=$(cat "$W"/wa* | grep -c 'a primit deja WhatsApp\|nu e programată azi')
em_ok=$(cat "$W"/em* | grep -cx true); em_409=$(cat "$W"/em* | grep -c 'a primit deja email\|nu e programată azi')
erori=$(cat "$W"/c* "$W"/m* | grep -ci error)
echo "Concurență distribuție: cicluri deodată → $cicluri rulare distinctă; programate în ziua lor = $prog (rânduri, firme); manual simultan (rânduri, firme, maxim pe contul 1 în zi) = $manual; WhatsApp deodată: $wa_ok trimis, $wa_409 refuzate; email deodată: $em_ok cerut, $em_409 refuzate; erori = $erori"
rm -rf "$W"
[ "$erori" -eq 0 ] && [ "$cicluri" = "1" ] && [ "$(echo $prog | cut -d' ' -f1)" = "$(echo $prog | cut -d' ' -f2)" ] \
  && [ "$(echo $manual | cut -d' ' -f1)" = "$(echo $manual | cut -d' ' -f2)" ] && [ "$(echo $manual | cut -d' ' -f3)" -le 2 ] \
  && [ "$wa_ok" = "1" ] && [ "$wa_409" = "4" ] && [ "$em_ok" = "1" ] && [ "$em_409" = "3" ] || { echo "CONCURENȚĂ DISTRIBUȚIE PICATĂ"; exit 1; }
echo "Concurență distribuție: ok."
