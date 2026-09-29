#!/bin/zsh
# Start PostgreSQL via docker compose and verify the schema loaded.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose up -d postgres
echo "waiting for postgres..."
for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-zecians}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker compose exec postgres psql -U "${POSTGRES_USER:-zecians}" -d "${POSTGRES_DB:-zecians}" -c "\dt"
