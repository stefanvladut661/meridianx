#!/bin/bash
# 10 roboți cer o firmă în același timp, două liste de apeluri se importă deodată și
# 5 oameni trimit WhatsApp aceleiași firme în același timp: fiecare robot ia altă firmă,
# nicio firmă nu intră în două liste, iar WhatsApp-ul pleacă o singură dată.
T=$(cd "$(dirname "$0")" && pwd); W=$(mktemp -d)
q(){ docker exec -i pgprospectare psql -U postgres -d test -X -q -tA -v ON_ERROR_STOP=1 "$@"; }
q <<'SQL' >/dev/null
delete from public.prospectare_rezervari;
delete from public.prospectare_liste_zi;
insert into public.prospectare_firme (nr, nume, domeniu, scor, etapa) select 9000 + g, 'Conc ' || g, 'conc' || g || '.ro', g, 'site_in_lucru' from generate_series(1, 30) g;
insert into public.prospectare_firme (nr, nume, domeniu, scor, telefon, etapa, link_demo) select 9100 + g, 'Gata ' || g, 'concgata' || g || '.ro', g, '0745 100 ' || lpad(g::text, 3, '0'), 'site_gata', 'https://demo.test/' || g || '/' from generate_series(1, 100) g;
insert into public.prospectare_firme (nr, nume, domeniu, scor, telefon, email, email_la, etapa, link_demo) values (9300, 'WhatsApp deodată', 'concwa.ro', 1, '0745 930 930', 'office@concwa.ro', now() - interval '2 days', 'email_trimis', 'https://demo.test/wa/');
insert into public.prospectare_dispozitive (nume, proprietar, token_hash) select 'conc-' || g, 'test', encode(sha256(('conc-' || g)::bytea), 'hex') from generate_series(1, 10) g on conflict do nothing;
SQL
for g in $(seq 1 10); do q -c "select public.prospectare_rezerva_urmatoarea((select id from public.prospectare_dispozitive where nume = 'conc-$g'), 'construire') ->> 'nr'" > "$W/r$g" 2>&1 & done
q -c "select public.prospectare_importa_lista_zi('stefan', 'telefon', 80, '{}'::jsonb, null, 'Ștefan') ->> 'adaugate'" > "$W/ls" 2>&1 &
q -c "select public.prospectare_importa_lista_zi('vladut', 'telefon', 80, '{}'::jsonb, null, 'Vlăduț') ->> 'adaugate'" > "$W/lv" 2>&1 &
for g in $(seq 1 5); do q -c "select public.prospectare_whatsapp_trimis((select id from public.prospectare_firme where nr = 9300), 1::smallint, 'om-$g') ->> 'nr'" > "$W/wa$g" 2>&1 & done
wait
erori=$(cat "$W"/r* "$W"/ls "$W"/lv | grep -ci error)
rez=$(q -c "select count(*) || ' ' || count(distinct firma_id) || ' ' || count(distinct dispozitiv_id) from public.prospectare_rezervari")
lis=$(q -c "select count(*) || ' ' || count(distinct firma_id) from public.prospectare_liste_zi")
wa_ok=$(cat "$W"/wa* | grep -cx 9300); wa_409=$(cat "$W"/wa* | grep -c 'a primit deja WhatsApp')
wa_act=$(q -c "select count(*) from public.prospectare_activitate a join public.prospectare_firme f on f.id = a.firma_id where f.nr = 9300 and a.tip = 'whatsapp'")
echo "Concurență: rezervări/firme/roboți = $rez; liste (Ștefan $(cat "$W/ls") + Vlăduț $(cat "$W/lv")) rânduri/firme = $lis; WhatsApp deodată: $wa_ok trimis, $wa_409 refuzate (409), $wa_act în activitate; erori = $erori"
rm -rf "$W"
[ "$erori" -eq 0 ] && [ "$rez" = "10 10 10" ] && [ "$(echo $lis | cut -d' ' -f1)" = "$(echo $lis | cut -d' ' -f2)" ] && [ "$wa_ok" = "1" ] && [ "$wa_409" = "4" ] && [ "$wa_act" = "1" ] || { echo "CONCURENȚĂ PICATĂ"; exit 1; }
echo "Concurență: ok."
