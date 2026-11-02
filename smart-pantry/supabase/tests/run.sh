#!/usr/bin/env bash
# Spins up a throwaway Postgres, applies the migrations on a Supabase stub, runs rpc_test.sql.
set -euo pipefail
cd "$(dirname "$0")"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
DIR=$(mktemp -d)
"$BIN/initdb" -D "$DIR" -U postgres >/dev/null
"$BIN/pg_ctl" -D "$DIR" -o "-k $DIR -p 54329 -c listen_addresses=''" -l "$DIR/log" start >/dev/null
trap '"$BIN/pg_ctl" -D "$DIR" stop >/dev/null; rm -rf "$DIR"' EXIT
P="psql -X -q -v ON_ERROR_STOP=1 -h $DIR -p 54329 -U postgres -d postgres"
$P -f stub_supabase.sql
for f in ../migrations/*.sql; do $P -f "$f"; done
$P -f rpc_test.sql
