#!/usr/bin/env bash
# Backs up the minutes database to backups/ with a timestamped filename.
# No Postgres client tools needed on the host: pg_dump runs inside the DB container.
set -euo pipefail

cd "$(dirname "$0")/.."

mkdir -p backups
file="backups/minutes_$(date +%Y%m%d_%H%M%S).sql"
docker compose exec -T db pg_dump -U postgres minutes_dev > "$file"

echo "Backup written to $file"
echo "Keep it somewhere safe (off this machine). Restore with: bun run db:restore $file"
