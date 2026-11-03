#!/bin/bash
# Numărul de site sub concurență (migrarea 37): 10 roboți care termină câte 3 site-uri deodată, 3 cereri care
# raportează din nou site-uri deja terminate și 2 importuri care publică câte 5 site-uri, toate pornite deodată.
# Fiecare site publicat primește un singur număr, numerele sunt consecutive (fără goluri), fără blocaje reciproce.
W=$(mktemp -d)
q(){ docker exec -i pgprospectare psql -U postgres -d test -X -q -tA -v ON_ERROR_STOP=1 "$@"; }
q <<'SQL' >/dev/null
select set_config('prospectare.autor', 'test', false);
insert into public.prospectare_dispozitive (nume, proprietar, token_hash) select 'nrs-' || g, 'test', encode(sha256(('nrs-' || g)::bytea), 'hex') from generate_series(1, 10) g on conflict do nothing;
insert into public.prospectare_firme (nr, nume, domeniu, email, etapa, scor, evaluare)
select 9950 + g, 'Conc nr site ' || g, 'nrs-' || g || '.ro', 'o@nrs-' || g || '.ro', 'site_in_lucru', 60, 'eligibila'
from generate_series(1, 40) g
on conflict do nothing;
SQL
inainte=$(q -c "select coalesce(max(nr_site), 0) from public.prospectare_firme")
for r in $(seq 1 10); do
  a=$(( (r - 1) * 3 + 1 ))
  q -c "select public.prospectare_termina_lot((select id from public.prospectare_dispozitive where nume = 'nrs-$r'),
    (select jsonb_agg(jsonb_build_object('nr', 9950 + g, 'link_demo', 'https://demo.delta.test/nrs-' || g || '/')) from generate_series($a, $a + 2) g)) ->> 'terminate'" > "$W/t$r" 2>&1 &
done
for r in 1 2 3; do
  q -c "select public.prospectare_termina_lot((select id from public.prospectare_dispozitive where nume = 'nrs-$r'),
    (select jsonb_agg(jsonb_build_object('nr', 9950 + g, 'link_demo', 'https://demo.delta.test/nrs-' || g || '/')) from generate_series($r * 2, $r * 2 + 4) g)) ->> 'terminate'" > "$W/d$r" 2>&1 &
done
for r in 0 1; do
  a=$(( 31 + r * 5 ))
  q -c "select public.prospectare_upsert_firme((select jsonb_agg(jsonb_build_object('domeniu', 'nrs-' || g || '.ro', 'nr', 9950 + g, 'etapa', 'site_gata',
    'link_demo', 'https://demo.delta.test/nrs-' || g || '/', 'demo_verificat', true, 'site_gata_la', now() - (g || ' minutes')::interval)) from generate_series($a, $a + 4) g),
    'import', 'import') ->> 'actualizate'" > "$W/i$r" 2>&1 &
done
wait
rez=$(q -c "select count(nr_site) || ' ' || count(distinct nr_site) || ' ' || coalesce(min(nr_site), 0) || ' ' || coalesce(max(nr_site), 0)
  from public.prospectare_firme where nr between 9951 and 9990")
fara_gol=$(q -c "select count(nr_site) = max(nr_site) and (select valoare from public.prospectare_contoare where cheie = 'nr_site') = max(nr_site) from public.prospectare_firme")
erori=$(cat "$W"/* | grep -ci -E 'error|deadlock')
echo "Concurență nr_site (37): 10 roboți × 3 site-uri + 3 cereri repetate + 2 importuri × 5, deodată → (cu număr, distincte, primul, ultimul) = $rez (înainte $inainte); fără goluri = $fara_gol; erori = $erori"
[ "$erori" = "0" ] || cat "$W"/* | grep -i -E 'error|deadlock' | head -5
rm -rf "$W"
[ "$rez" = "40 40 $((inainte + 1)) $((inainte + 40))" ] && [ "$fara_gol" = "t" ] && [ "$erori" = "0" ]
