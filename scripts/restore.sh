#!/usr/bin/env bash
# Restores the minutes database from a backup file produced by scripts/backup.sh.
# Re-runs migrations afterwards so the schema matches the app version.
set -euo pipefail

cd "$(dirname "$0")/.."

file="${1:-}"
if [[ -z "$file" || ! -f "$file" ]]; then
  echo "usage: bun run db:restore <backup-file>" >&2
  echo "e.g.:   bun run db:restore backups/minutes_20260803_120000.sql" >&2
  exit 1
fi

# ON_ERROR_STOP makes psql fail on the first SQL error instead of continuing
# (and then "restoring" over a partially-loaded DB).
docker compose exec -T db psql -U postgres -d minutes_dev --set ON_ERROR_STOP=1 < "$file"

bun drizzle-kit migrate

echo "Restored $file and applied migrations."
