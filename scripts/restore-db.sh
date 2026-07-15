#!/usr/bin/env bash
# DB restore script for Chronify — OpenSSL encrypted backups
# Usage: ./scripts/restore-db.sh <backup-file.enc>
# Env: DATABASE_URL (required), BACKUP_ENCRYPTION_PASSPHRASE (required)

set -euo pipefail

BACKUP_FILE="${1:-}"
if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: $0 <backup-file.enc>" >&2
  exit 1
fi
if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

if [ -z "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
  echo "ERROR: BACKUP_ENCRYPTION_PASSPHRASE is not set" >&2
  exit 1
fi

DB_HOST="$(echo "${DATABASE_URL}" | sed -E 's|.*@([^:@/]+).*|\1|')"
DB_PORT="$(echo "${DATABASE_URL}" | sed -E 's|.*:([0-9]+)/.*|\1|')"
DB_NAME="$(echo "${DATABASE_URL}" | sed -E 's|.*/([^?]+)(\?.*)?|\1|')"
DB_USER="$(echo "${DATABASE_URL}" | sed -E 's|.*://([^:]+):.*|\1|')"
DB_PASS="$(echo "${DATABASE_URL}" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')"

export PGPASSWORD="${DB_PASS}"

echo "WARNING: This will OVERWRITE the database '${DB_NAME}' on ${DB_HOST}:${DB_PORT}."
echo "Backup file: ${BACKUP_FILE}"
read -r -p "Type 'CONFIRM' to proceed: " CONFIRM
if [ "${CONFIRM}" != "CONFIRM" ]; then
  echo "Aborted."
  exit 1
fi

echo "Dropping existing schema..."
psql \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  --dbname="${DB_NAME}" \
  --command="DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "Decrypting and restoring from backup..."
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_PASSPHRASE -in "${BACKUP_FILE}" \
  | gunzip \
  | pg_restore \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  --dbname="${DB_NAME}" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists

echo "Restore complete."