#!/usr/bin/env bash
# FS-25: back up the demo database (public schema: events, tickets, orders, staff, audit, ...).
# Usage: SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@<host>:5432/postgres' deploy/scripts/backup.sh
# The connection string comes from Supabase -> Project Settings -> Database. Never commit it.
set -euo pipefail
: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to the database connection string}"
dir="$(cd "$(dirname "$0")/.." && pwd)/backups"
mkdir -p "$dir"
file="biletflow-$(date +%Y%m%d-%H%M%S).dump"
docker run --rm -e PGURL="$SUPABASE_DB_URL" -v "$dir:/backups" postgres:17-alpine \
  sh -c "pg_dump \"\$PGURL\" --schema=public --no-owner --no-privileges -Fc -f /backups/$file"
echo "Backup written to deploy/backups/$file"
