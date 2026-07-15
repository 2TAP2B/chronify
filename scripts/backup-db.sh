#!/usr/bin/env bash
# DB backup script for Chronify — OpenSSL encrypted
# Usage: ./scripts/backup-db.sh [output-dir]
# Env: DATABASE_URL (required), BACKUP_RETENTION_DAYS (default 14),
#      BACKUP_ENCRYPTION_PASSPHRASE (required for encryption)

set -euo pipefail

OUTPUT_DIR="${1:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
FILENAME="chronify-backup-${TIMESTAMP}.sql.gz.enc"
OUTPUT_PATH="${OUTPUT_DIR}/${FILENAME}"

mkdir -p "${OUTPUT_DIR}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

if [ -z "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
  echo "ERROR: BACKUP_ENCRYPTION_PASSPHRASE is not set." >&2
  echo "Generate with: openssl rand -base64 32" >&2
  echo "Set it in .env" >&2
  exit 1
fi

# Extract connection parts from DATABASE_URL
DB_HOST="$(echo "${DATABASE_URL}" | sed -E 's|.*@([^:@/]+).*|\1|')"
DB_PORT="$(echo "${DATABASE_URL}" | sed -E 's|.*:([0-9]+)/.*|\1|')"
DB_NAME="$(echo "${DATABASE_URL}" | sed -E 's|.*/([^?]+)(\?.*)?|\1|')"
DB_USER="$(echo "${DATABASE_URL}" | sed -E 's|.*://([^:]+):.*|\1|')"
DB_PASS="$(echo "${DATABASE_URL}" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')"

export PGPASSWORD="${DB_PASS}"

echo "Backing up database '${DB_NAME}' on ${DB_HOST}:${DB_PORT} → ${OUTPUT_PATH} (OpenSSL encrypted)"

pg_dump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  --dbname="${DB_NAME}" \
  --no-owner \
  --no-privileges \
  --format=custom \
  | gzip \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_ENCRYPTION_PASSPHRASE \
  > "${OUTPUT_PATH}"

echo "Backup complete: ${OUTPUT_PATH} ($(du -h "${OUTPUT_PATH}" | cut -f1))"

# Prune old backups
if [ "${RETENTION_DAYS}" -gt 0 ]; then
  echo "Pruning backups older than ${RETENTION_DAYS} days..."
  find "${OUTPUT_DIR}" -name "chronify-backup-*.sql.gz.enc" -type f -mtime "+${RETENTION_DAYS}" -delete
  echo "Pruned."
fi