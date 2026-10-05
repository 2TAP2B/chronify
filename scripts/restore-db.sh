#!/usr/bin/env bash
# DB restore script for Chronify — OpenSSL encrypted backups
# Usage: ./scripts/restore-db.sh <backup-file.enc>
# Env: DATABASE_URL (required), BACKUP_ENCRYPTION_PASSPHRASE (required)
#
# Safety: the backup is fully verified (decrypt → gzip integrity → TOC)
# BEFORE anything destructive runs. A wrong passphrase or truncated file
# aborts without touching the database.

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

# pg tools reject unknown URI options; strip any query string (e.g. schema=public).
CONN="${DATABASE_URL%%\?*}"

echo "WARNING: This will OVERWRITE the database (public schema) targeted by DATABASE_URL."
echo "Backup file: ${BACKUP_FILE}"
read -r -p "Type 'CONFIRM' to proceed: " CONFIRM
if [ "${CONFIRM}" != "CONFIRM" ]; then
  echo "Aborted."
  exit 1
fi

# --- verify BEFORE any destructive step ------------------------------------
echo "Verifying backup integrity (decrypt → gzip → TOC)..."
if {
  openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_PASSPHRASE \
    -in "${BACKUP_FILE}" | gunzip | pg_restore --list
} > /dev/null 2>&1; then
  echo "Backup verified."
else
  echo "ERROR: Backup failed verification (wrong passphrase or corrupt file)." >&2
  echo "Nothing was modified. Check BACKUP_ENCRYPTION_PASSPHRASE / file integrity." >&2
  exit 1
fi

echo "Dropping existing schema..."
psql \
  --dbname="${CONN}" \
  --command="DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "Decrypting and restoring from backup..."
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_PASSPHRASE -in "${BACKUP_FILE}" \
  | gunzip \
  | pg_restore \
  --dbname="${CONN}" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --exit-on-error

echo "Restore complete."
