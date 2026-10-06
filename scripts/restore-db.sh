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
# Stage 1: full integrity pass. gunzip -t consumes its entire input, so there
# is no early-exiting consumer and no SIGPIPE ambiguity — any non-zero rc
# here (bad decrypt, corruption, truncation) is a hard error.
integrity_rc=0
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_PASSPHRASE \
  -in "${BACKUP_FILE}" | gunzip -t || integrity_rc=$?
if [ "${integrity_rc}" -ne 0 ]; then
  echo "ERROR: Backup failed integrity check (rc=${integrity_rc}; wrong passphrase or corrupt file)." >&2
  echo "Nothing was modified. Check BACKUP_ENCRYPTION_PASSPHRASE / file integrity." >&2
  exit 1
fi

# Stage 2: TOC check. pg_restore --list stops reading before EOF, so the
# producer can die of SIGPIPE (rc 141) under pipefail even on success —
# tolerate it; any other non-zero rc is a hard error.
verify_rc=0
{
  openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_PASSPHRASE \
    -in "${BACKUP_FILE}" | gunzip | pg_restore --list
} > /dev/null 2>&1 || verify_rc=$?
if [ "${verify_rc}" -ne 0 ] && [ "${verify_rc}" -ne 141 ]; then
  echo "ERROR: Backup failed TOC verification (rc=${verify_rc}; wrong passphrase or corrupt file)." >&2
  echo "Nothing was modified. Check BACKUP_ENCRYPTION_PASSPHRASE / file integrity." >&2
  exit 1
fi
echo "Backup verified."

echo "Dropping existing schema..."
psql \
  --dbname="${CONN}" \
  --command="DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "Decrypting and restoring from backup..."
# Tolerate rc 141 (producer SIGPIPE if pg_restore stops before EOF); any
# other non-zero rc is a failed restore.
restore_rc=0
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_PASSPHRASE -in "${BACKUP_FILE}" \
  | gunzip \
  | pg_restore \
  --dbname="${CONN}" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --exit-on-error || restore_rc=$?
if [ "${restore_rc}" -ne 0 ] && [ "${restore_rc}" -ne 141 ]; then
  echo "ERROR: pg_restore failed (rc=${restore_rc})." >&2
  exit 1
fi

echo "Restore complete."
