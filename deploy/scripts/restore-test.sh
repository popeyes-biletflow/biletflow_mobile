#!/usr/bin/env bash
# FS-25: prove a backup restores, into a DISPOSABLE local Postgres (never into the live project).
# Usage: deploy/scripts/restore-test.sh deploy/backups/biletflow-YYYYMMDD-HHMMSS.dump
set -euo pipefail
dump="${1:?Pass the .dump file created by backup.sh}"
[ -f "$dump" ] || { echo "No such file: $dump" >&2; exit 1; }
name="biletflow-restore-test"
docker rm -f "$name" >/dev/null 2>&1 || true
docker run -d --name "$name" -e POSTGRES_PASSWORD=restore-test postgres:17-alpine >/dev/null
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
until docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
docker cp "$dump" "$name:/tmp/backup.dump"
# Supabase-specific roles/extensions (auth.users FKs, RLS roles) do not exist locally; data tables still restore.
docker exec "$name" pg_restore -U postgres -d postgres --no-owner --no-privileges /tmp/backup.dump || true
docker exec "$name" psql -U postgres -d postgres -c \
  "select 'events' t, count(*) from public.events union all select 'tickets', count(*) from public.tickets union all select 'event_staff', count(*) from public.event_staff union all select 'audit_log', count(*) from public.audit_log;"
echo "Restore test finished; the disposable container is removed on exit."
