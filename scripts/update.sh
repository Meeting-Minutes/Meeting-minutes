#!/usr/bin/env bash
# Updates the self-hosted installation to the latest version:
# pull code, install deps, apply new migrations. Safe to re-run.
set -euo pipefail

cd "$(dirname "$0")/.."

git pull --ff-only

bun install

bun drizzle-kit migrate

echo "Update complete."
