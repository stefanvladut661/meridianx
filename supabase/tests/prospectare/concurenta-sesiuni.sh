#!/bin/bash
# Sesiunile aceluiași robot sub concurență (migrarea 38): un singur robot (un token), 3 sesiuni.
# (a) Fiecare sesiune cere o firmă de 4 ori deodată (12 cereri simultane): fiecare sesiune ajunge cu exact
#     o firmă, toate cererile ei primesc aceeași firmă, iar cele 3 sesiuni au firme diferite.
# (b) Cele 3 sesiuni cer aceeași nișă deodată (de câte 2 ori): una singură o primește, celelalte primesc 409.
# (c) Cele 3 sesiuni cer câte o nișă diferită deodată: toate le primesc.
W=$(mktemp -d)
q(){ docker exec -i pgprospectare psql -U postgres -d test -X -q -tA -v ON_ERROR_STOP=1 "$@"; }
q <<'SQL' >/dev/null
select set_config('prospectare.autor', 'test', false);
insert into public.prospectare_dispozitive (nume, proprietar, token_hash) values ('PC Concurență', 'test', encode(sha256('pc-concurenta'::bytea), 'hex'))
  on conflict do nothing;
delete from public.prospectare_rezervari where expira_la <= now();
insert into public.prospectare_firme (nr, nume, domeniu, email, etapa, scor, evaluare)
select 9830 + g, 'Conc sesiuni ' || g, 'conc-ses-' || g || '.ro', 'o@conc-ses-' || g || '.ro', 'site_in_lucru', 1000, 'eligibila'
from generate_series(1, 12) g
on conflict do nothing;
SQL
R="(select id from public.prospectare_dispozitive where nume = 'PC Concurență')"
for s in 1 2 3; do
  for k in 1 2 3 4; do
    q -c "select '$s ' || (public.prospectare_rezerva_urmatoarea($R, null, '$s') ->> 'nr')" > "$W/f$s-$k" 2>&1 &
  done
done
for s in 1 2 3; do
  for k in 1 2; do
    q -c "select public.prospectare_nisa_rezerva($R, 'concurență sesiuni', 'Aceeași', '$s') ->> 'sesiune'" > "$W/n$s-$k" 2>&1 &
  done
  q -c "select public.prospectare_nisa_rezerva($R, 'concurență sesiuni', 'Zona $s', '$s') ->> 'sesiune'" > "$W/d$s" 2>&1 &
done
wait
# (a)
firme=$(cat "$W"/f* | grep -E '^[123] [0-9]+$' | sort -u)
pe_sesiune=$(echo "$firme" | awk '{print $1}' | sort | uniq -c | awk '{print $1}' | tr '\n' ' ' | sed 's/ $//')
distincte=$(echo "$firme" | awk '{print $2}' | sort -u | wc -l)
rez=$(q -c "select count(*) || ' ' || count(distinct firma_id) || ' ' || count(distinct sesiune) from public.prospectare_rezervari where dispozitiv_id = $R and expira_la > now()")
# (b)
castig=$(cat "$W"/n* | grep -cE '^[123]$')
refuz=$(cat "$W"/n* | grep -c 'e rezervată de PC Concurență (sesiunea')
proprietar=$(q -c "select sesiune from public.prospectare_nise where nisa = 'concurență sesiuni' and zona = 'Aceeași'")
castigatori=$(cat "$W"/n* | grep -E '^[123]$' | sort -u | tr '\n' ' ' | sed 's/ $//')
# (c)
diferite=$(cat "$W"/d* | grep -cE '^[123]$')
erori=$(cat "$W"/f* "$W"/d* | grep -ci -E 'error|deadlock'; cat "$W"/n* | grep -i error | grep -vc 'e rezervată de PC Concurență')
erori=$(echo "$erori" | awk '{s+=$1} END {print s+0}')
echo "Concurență sesiuni (38): 12 cereri /rezerva deodată (3 sesiuni × 4) → firme pe sesiune = $pe_sesiune, firme distincte = $distincte, rezervări (rânduri, firme, sesiuni) = $rez; aceeași nișă cerută de 6 ori din 3 sesiuni → $castig primite (sesiunea $castigatori, în bază: $proprietar), $refuz refuzate (409); 3 nișe diferite deodată → $diferite primite; erori = $erori"
[ "$erori" = "0" ] || cat "$W"/* | grep -i -E 'error|deadlock' | grep -v 'e rezervată de PC Concurență' | head -5
rm -rf "$W"
[ "$pe_sesiune" = "1 1 1" ] && [ "$distincte" = "3" ] && [ "$rez" = "3 3 3" ] && [ "$castig" -ge 1 ] && [ "$castigatori" = "$proprietar" ] && [ "$((castig + refuz))" = "6" ] && [ "$diferite" = "3" ] && [ "$erori" = "0" ]
