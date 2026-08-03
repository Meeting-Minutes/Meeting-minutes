#!/usr/bin/env bash
# Backs up the minutes database to backups/ with a timestamped filename.
# No Postgres client tools needed on the host: pg_dump runs inside the DB container.
set -euo pipefail

cd "$(dirname "$0")/.."

mkdir -p backups
file="backups/minutes_$(date +%Y%m%d_%H%M%S).sql"
# --clean/--if-exists so the dump can be restored into a non-empty DB (incident
# recovery); --no-owner/--no-privileges so it restores under any role setup.
docker compose exec -T db pg_dump -U postgres --clean --if-exists --no-owner --no-privileges minutes_dev > "$file"

echo "Backup written to $file"
echo "Keep it somewhere safe (off this machine). Restore with: bun run db:restore $file"
