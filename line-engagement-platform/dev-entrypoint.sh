#!/bin/sh
set -e

ROLE="${1:-app}"

POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"

echo "[entrypoint] role=${ROLE}"
echo "[entrypoint] waiting for postgres at ${POSTGRES_HOST}:${POSTGRES_PORT} (user=${POSTGRES_USER})..."

n=0
until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" >/dev/null 2>&1 || [ $n -ge 30 ]; do
  n=$((n+1))
  echo "[entrypoint] waiting for postgres... ($n/30)"
  sleep 1
done

if ! pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" >/dev/null 2>&1; then
  echo "[entrypoint] postgres not ready after 30s"
  exit 1
fi

echo "[entrypoint] generating prisma client..."
npx prisma generate

echo "[entrypoint] running prisma migrate..."
# แนะนำใน container ใช้ deploy เป็น default (ปลอดภัยกว่า migrate dev)
if [ "${PRISMA_MIGRATE_MODE:-deploy}" = "dev" ]; then
  npx prisma migrate dev --name init --skip-seed || true
else
  npx prisma migrate deploy || true
fi

echo "[entrypoint] running seed..."
npm run prisma:seed || true

if [ "$ROLE" = "worker" ]; then
  echo "[entrypoint] starting worker (dev)..."
  exec npm run dev:worker
else
  echo "[entrypoint] starting app (dev)..."
  exec npm run dev
fi
