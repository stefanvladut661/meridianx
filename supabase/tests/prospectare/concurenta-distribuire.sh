#!/bin/bash
# Migrarea 39 sub concurență.
# (a) Lacătul de publicare: 6 calculatoare (roboți diferiți) cer „ia” deodată, de câte 2 ori → unul singur îl primește,
#     ceilalți primesc refuz (ok = false) cu numele celui care îl ține; în bază, deținătorul e câștigătorul.
# (b) Listele de construcție: 12 firme alocate egal pe 2 terminale; aceleași 2 sesiuni ale aceluiași token cer deodată
#     /lista-mea și /rezerva (de câte 4 ori fiecare) → listele sunt disjuncte, fiecare sesiune rezervă doar din lista ei,
#     nicio firmă nu e rezervată de ambele.
# (c) Două distribuiri deodată pe aceleași 6 firme (WhatsApp, pe conturi diferite) → fiecare firmă are o singură programare activă.
W=$(mktemp -d)
q(){ docker exec -i pgprospectare psql -U postgres -d test -X -q -tA -v ON_ERROR_STOP=1 "$@"; }
q <<'SQL' >/dev/null
select set_config('prospectare.autor', 'test', false);
update public.prospectare_lacate set dispozitiv_id = null, sesiune = null, luat_la = null, batut_la = null where cheie = 'publicare';
insert into public.prospectare_dispozitive (nume, proprietar, token_hash) values ('PC Liste', 'test', encode(sha256('pc-liste'::bytea), 'hex'))
  on conflict do nothing;
insert into public.prospectare_firme (nr, nume, domeniu, email, etapa, scor, evaluare)
select 9470 + g, 'Liste conc ' || g, 'dm-lc' || g || '.ro', 'o@dm-lc' || g || '.ro', 'cercetat', 100 - g, 'eligibila' from generate_series(1, 12) g
on conflict do nothing;
select public.prospectare_aloca_constructie((select array_agg(id) from public.prospectare_firme where nr between 9471 and 9482),
  array['conc-a', 'conc-b'], null, false, 'test');
insert into public.prospectare_firme (nr, nume, domeniu, telefon, email, etapa, scor, evaluare, link_demo, demo_verificat, site_gata_la)
select 9490 + g, 'Dist conc ' || g, 'dm-dc' || g || '.ro', '0722 900 ' || lpad(g::text, 3, '0'), 'o@dm-dc' || g || '.ro', 'site_gata', 80, 'eligibila',
  'https://demo.alfa.test/dc' || g || '/', true, now() - interval '10 days'
from generate_series(1, 6) g
on conflict do nothing;
update public.prospectare_conturi_whatsapp set activ = true where id in (1, 2);
SQL
# (a)
for n in 1 2 3 4 5 6; do
  for k in 1 2; do
    q -c "select (public.prospectare_lacat_publicare((select id from public.prospectare_dispozitive where nume = 'robot-$n'), 'ia', '1') ->> 'ok') || ' robot-$n'" > "$W/l$n-$k" 2>&1 &
  done
done
# (b)
R="(select id from public.prospectare_dispozitive where nume = 'PC Liste')"
for s in a b; do
  for k in 1 2 3 4; do
    q -c "select string_agg(e ->> 'nr', ',' order by (e ->> 'nr')::integer) from jsonb_array_elements(public.prospectare_lista_mea($R, 'conc-$s') -> 'firme') e" > "$W/lista-$s-$k" 2>&1 &
    q -c "select '$s ' || coalesce(public.prospectare_rezerva_urmatoarea($R, null, 'conc-$s') ->> 'alocat_lui', 'nimic')" > "$W/rez-$s-$k" 2>&1 &
  done
done
# (c)
IDS="(select array_agg(id) from public.prospectare_firme where nr between 9491 and 9496)"
q -c "select public.prospectare_distribuie('whatsapp', public.prospectare_azi(), $IDS, array['1'], null, 'scor', '{}', false, 'test') ->> 'programate'" > "$W/d1" 2>&1 &
q -c "select public.prospectare_distribuie('whatsapp', public.prospectare_azi(), $IDS, array['2'], null, 'scor', '{}', false, 'test') ->> 'programate'" > "$W/d2" 2>&1 &
wait
# (a)
castig=$(cat "$W"/l* | grep -c '^true ')
refuz=$(cat "$W"/l* | grep -c '^false ')
castigatori=$(cat "$W"/l* | grep '^true ' | awk '{print $2}' | sort -u | tr '\n' ' ' | sed 's/ $//')
detinator=$(q -c "select d.nume from public.prospectare_lacate l join public.prospectare_dispozitive d on d.id = l.dispozitiv_id where l.cheie = 'publicare'")
# (b)
la=$(cat "$W"/lista-a-* | sort -u); lb=$(cat "$W"/lista-b-* | sort -u)
comune=$(comm -12 <(echo "$la" | tr ',' '\n' | sort) <(echo "$lb" | tr ',' '\n' | sort) | grep -c .)
rez_gresite=$(cat "$W"/rez-* | awk '{ if ($2 != "conc-" $1) print }' | grep -c .)
rez_db=$(q -c "select count(*) || ' ' || count(distinct firma_id) || ' ' || count(distinct sesiune) from public.prospectare_rezervari where dispozitiv_id = $R and expira_la > now()")
incrucisate=$(q -c "select count(*) from public.prospectare_rezervari r join public.prospectare_firme f on f.id = r.firma_id where r.dispozitiv_id = $R and r.expira_la > now() and f.alocat_lui is distinct from r.sesiune")
# (c)
prog=$(q -c "select count(*) || ' ' || count(distinct firma_id) from public.prospectare_programari where stare = 'programata' and firma_id in (select id from public.prospectare_firme where nr between 9491 and 9496)")
dist=$(cat "$W"/d1 "$W"/d2 | grep -E '^[0-9]+$' | sort -n | tr '\n' ' ' | sed 's/ $//')
erori=$(cat "$W"/* | grep -ci -E 'error|deadlock')
echo "Concurență distribuire (39): lacătul cerut de 12 ori din 6 calculatoare deodată → $castig primit ($castigatori; în bază: $detinator), $refuz refuzate; /lista-mea + /rezerva din 2 sesiuni ale aceluiași token (×4) → liste: [$la] și [$lb], comune = $comune, rezervări din lista altei sesiuni = $rez_gresite (în bază: $incrucisate), rezervări (rânduri, firme, sesiuni) = $rez_db; 2 distribuiri deodată pe 6 firme → $dist programate, active (rânduri, firme) = $prog; erori = $erori"
[ "$erori" = "0" ] || cat "$W"/* | grep -i -E 'error|deadlock' | head -5
rm -rf "$W"
[ "$castig" -ge 1 ] && [ "$(echo "$castigatori" | wc -w)" = "1" ] && [ "$castigatori" = "$detinator" ] && [ "$((castig + refuz))" = "12" ] \
  && [ -n "$la" ] && [ -n "$lb" ] && [ "$(echo "$la" | wc -l)" = "1" ] && [ "$(echo "$lb" | wc -l)" = "1" ] && [ "$comune" = "0" ] \
  && [ "$rez_gresite" = "0" ] && [ "$incrucisate" = "0" ] && [ "$rez_db" = "2 2 2" ] && [ "$prog" = "6 6" ] && [ "$dist" = "0 6" ] && [ "$erori" = "0" ]
