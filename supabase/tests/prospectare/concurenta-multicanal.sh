#!/bin/bash
# Completarea zilei sub concurență (migrarea 36): 6 completări pornite deodată, peste 30 de firme
# eligibile și două conturi cu loc pentru 5 fiecare. Fiecare firmă o singură dată, nicio limită depășită.
W=$(mktemp -d)
q(){ docker exec -i pgprospectare psql -U postgres -d test -X -q -tA -v ON_ERROR_STOP=1 "$@"; }
q <<'SQL' >/dev/null
select set_config('prospectare.autor', 'test', false);
update public.prospectare_firme set demo_verificat = false where nr < 9700 or nr >= 9800;
-- Locurile de azi (întâi limitele: triggerul lor completează ziua, dar firmele noi încă nu există).
update public.prospectare_conturi_whatsapp set activ = (id in (1, 2));
update public.prospectare_conturi_whatsapp set limita_zi = 5 + (select count(*) from public.prospectare_programari p where p.zi = public.prospectare_azi() and p.canal = 'whatsapp'
  and p.cont_whatsapp = prospectare_conturi_whatsapp.id and p.stare in ('programata', 'folosita'))::integer where id in (1, 2);
insert into public.prospectare_firme (nr, nume, domeniu, telefon, email, etapa, link_demo, demo_verificat, site_gata_la, email_la)
select 9700 + g, 'Conc 36 ' || g, 'c36-' || g || '.ro', '0746 910 ' || lpad(g::text, 3, '0'), 'o@c36-' || g || '.ro', 'email_trimis',
  'https://demo.delta.test/c36-' || g || '/', true, now() - (g || ' hours')::interval, public.prospectare_inceput_azi() - interval '1 day'
from generate_series(1, 30) g
on conflict do nothing;
SQL
inainte=$(q -c "select count(*) from public.prospectare_programari p join public.prospectare_firme f on f.id = p.firma_id where f.nr between 9701 and 9730 and p.stare = 'programata'")
for g in $(seq 1 6); do q -c "select public.prospectare_completeaza_azi('concurență $g') ->> 'whatsapp'" > "$W/c$g" 2>&1 & done
wait
total=$(cat "$W"/c* | grep -E '^[0-9]+$' | awk '{s+=$1} END {print s+0}')
rez=$(q -c "select count(*) || ' ' || count(distinct firma_id) from public.prospectare_programari p join public.prospectare_firme f on f.id = p.firma_id where f.nr between 9701 and 9730 and p.stare = 'programata' and p.zi = public.prospectare_azi()")
peste=$(q -c "select count(*) from public.prospectare_conturi_whatsapp k where k.activ and (select count(*) from public.prospectare_programari p where p.zi = public.prospectare_azi() and p.canal = 'whatsapp' and p.cont_whatsapp = k.id and p.stare in ('programata', 'folosita')) > k.limita_zi")
erori=$(cat "$W"/c* | grep -ci error)
echo "Concurență completare (36): 6 completări deodată → $total firme adăugate în total (înainte $inainte); programate (rânduri, firme) = $rez; conturi peste limită = $peste; erori = $erori"
rm -rf "$W"
[ "$total" = "10" ] && [ "$rez" = "10 10" ] && [ "$peste" = "0" ] && [ "$erori" = "0" ]
