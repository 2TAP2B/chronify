#!/usr/bin/env bash
# DB backup script for Chronify — OpenSSL encrypted
# Usage: ./scripts/backup-db.sh [output-dir]
# Env: DATABASE_URL (required), BACKUP_RETENTION_DAYS (default 14),
#      BACKUP_ENCRYPTION_PASSPHRASE (required for encryption)
#
# Verify semantics: a backup file is only reported complete after it
# round-trips (decrypt → gzip integrity → pg_restore TOC). A checksum
# file (.sha256) is written next to the archive for off-host tamper checks.

set -euo pipefail

OUTPUT_DIR="${1:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
FILENAME="chronify-backup-${TIMESTAMP}.sql.gz.enc"
OUTPUT_PATH="${OUTPUT_DIR}/${FILENAME}"

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

mkdir -p "${OUTPUT_DIR}"

# Prevent overlapping runs (cron catch-up, manual + cron collision).
exec 9>"${OUTPUT_DIR}/backup.lock"
flock -n 9 || { echo "ERROR: Another backup run is already in progress." >&2; exit 1; }

# pg tools reject unknown URI options; strip any query string (e.g./schema=public).
CONN="${DATABASE_URL%%\?*}"

echo "Backing up database → ${OUTPUT_PATH} (OpenSSL encrypted)"

pg_dump \
  --dbname="${CONN}" \
  --no-owner \
  --no-privileges \
  --format=custom \
  | gzip \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_ENCRYPTION_PASSPHRASE \
  > "${OUTPUT_PATH}"

# --- verify the artifact before declaring success ---------------------------
echo "Verifying backup integrity..."
{
  openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_PASSPHRASE \
    -in "${OUTPUT_PATH}" | gunzip | pg_restore --list
} > /dev/null

sha256sum "${OUTPUT_PATH}" > "${OUTPUT_PATH}.sha256"

echo "Backup complete: ${OUTPUT_PATH} ($(du -h "${OUTPUT_PATH}" | cut -f1)) [verified]"

# Prune old backups
if [ "${RETENTION_DAYS}" -gt 0 ]; then
  echo "Pruning backups older than ${RETENTION_DAYS} days..."
  find "${OUTPUT_DIR}" -name "chronify-backup-*.sql.gz.enc" -type f -mtime "+${RETENTION_DAYS}" -delete
  find "${OUTPUT_DIR}" -name "chronify-backup-*.sql.gz.enc.sha256" -type f -mtime "+${RETENTION_DAYS}" -delete
  echo "Pruned."
fi
