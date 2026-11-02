#!/bin/bash
# Testele prospectării pe un Postgres LOCAL în Docker (niciodată pe producție).
# Folosire, din rădăcina repo-ului:  bash supabase/tests/prospectare/ruleaza.sh
# Pornește (o dată) containerul `pgprospectare` din imaginea oficială postgres:17-alpine,
# face baza `test` de la zero, rulează migrările 28–32 de două ori (trebuie să fie
# reluabile), apoi testele regulilor și proba de concurență.
set -u
T=$(cd "$(dirname "$0")" && pwd); M="$T/../../migrations"
if ! docker ps --format '{{.Names}}' | grep -qx pgprospectare; then
  docker rm -f pgprospectare >/dev/null 2>&1
  docker run -d --name pgprospectare -e POSTGRES_PASSWORD=doar-local-de-test postgres:17-alpine >/dev/null || exit 1
  for i in $(seq 1 30); do docker exec pgprospectare pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
fi
q(){ docker exec -i pgprospectare psql -U postgres -d test -X -q -tA -v ON_ERROR_STOP=1 "$@"; }
docker exec pgprospectare psql -U postgres -X -q -c 'drop database if exists test with (force)' -c 'create database test' >/dev/null || exit 1
q < "$T/00-supabase-roluri.sql" >/dev/null || exit 1
q < "$T/01-admini-test.sql" >/dev/null || exit 1
for runda in 1 2; do
  for f in "$M"/00000000000028_*.sql "$M"/00000000000029_*.sql "$M"/00000000000030_*.sql "$M"/00000000000031_*.sql "$M"/00000000000032_*.sql; do
    out=$(q < "$f" 2>&1) || { echo "MIGRARE PICATĂ ($runda): $f"; echo "$out" | tail -5; exit 1; }
    echo "$out" | grep -q '|f$' && { echo "VERIFICARE FALSĂ în $f:"; echo "$out" | grep '|f$'; exit 1; }
  done
done
echo "Migrările 28–32: rulate de două ori, toate verificările true."
rez=$(q -1 < "$T/reguli.sql" 2>&1 | grep -E '^(ok|ERROR)')
echo "$rez" | sed 's/→ \([0-9A-Z]*\): .*/→ \1/'
ok=$(echo "$rez" | grep -c '^ok'); bad=$(echo "$rez" | grep -c '^ERROR')
echo "Reguli: $ok ok, $bad picate."
[ "$bad" -eq 0 ] || exit 1
bash "$T/concurenta.sh"
