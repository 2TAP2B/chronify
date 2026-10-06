#!/usr/bin/env bash
# DB restore script for Chronify — Docker variant of scripts/restore-db.sh.
#
# Accepts both encrypted (*.sql.gz.enc) and plain (*.sql.gz) backups.
# Decryption / gunzip run on the host, pg_restore inside the db container
# (the postgres:16-alpine image has no openssl CLI).
#
# Usage: ./scripts/restore-db-docker.sh <backup-file.sql.gz[.enc]>
# Env:   BACKUP_ENCRYPTION_PASSPHRASE (required for *.enc backups)
#        COMPOSE_CMD (default "docker compose"), DB_SERVICE (default "db")
#
# Safety: the backup is fully verified BEFORE anything destructive runs.
# A wrong passphrase or truncated file aborts without touching the database.

set -euo pipefail

BACKUP_FILE="${1:-}"
if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: $0 <backup-file.sql.gz[.enc]>" >&2
  exit 1
fi
if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

case "${BACKUP_FILE}" in
  *.sql.gz.enc) ENCRYPTED=1 ;;
  *.sql.gz)     ENCRYPTED=0 ;;
  *) echo "ERROR: unexpected file extension (expected .sql.gz or .sql.gz.enc): ${BACKUP_FILE}" >&2; exit 1 ;;
esac

if [ "${ENCRYPTED}" -eq 1 ] && [ -z "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
  echo "ERROR: BACKUP_ENCRYPTION_PASSPHRASE is not set (required for encrypted backups)." >&2
  exit 1
fi

# --- locate the db container -------------------------------------------------
COMPOSE="${COMPOSE_CMD:-docker compose}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_CID="$(${COMPOSE} ps -q "${DB_SERVICE}" 2>/dev/null || true)"
if [ -z "${DB_CID}" ]; then
  DB_CID="$(docker ps --filter "label=com.docker.compose.service=${DB_SERVICE}" --format '{{.ID}}' | head -1)"
fi
if [ -z "${DB_CID}" ]; then
  echo "ERROR: no running '${DB_SERVICE}' container found (run from the compose project dir or set DB_SERVICE)." >&2
  exit 1
fi

echo "WARNING: This will OVERWRITE the database in container ${DB_CID} (public schema)."
echo "Backup file: ${BACKUP_FILE}"
read -r -p "Type 'CONFIRM' to proceed: " CONFIRM
if [ "${CONFIRM}" != "CONFIRM" ]; then
  echo "Aborted."
  exit 1
fi

# Plain stream: decrypt (if encrypted) → gunzip.
plain_stream() {
  if [ "${ENCRYPTED}" -eq 1 ]; then
    openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_PASSPHRASE \
      -in "${BACKUP_FILE}" | gunzip
  else
    gunzip -c "${BACKUP_FILE}"
  fi
}

# --- verify BEFORE any destructive step --------------------------------------
echo "Verifying backup integrity (decrypt → gzip → TOC)..."
# Stage 1: full integrity pass. gunzip -t consumes its entire input, so there
# is no early-exiting consumer and no SIGPIPE ambiguity — any non-zero rc
# here (bad decrypt, corruption, truncation) is a hard error.
integrity_rc=0
if [ "${ENCRYPTED}" -eq 1 ]; then
  openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_PASSPHRASE \
    -in "${BACKUP_FILE}" | gunzip -t || integrity_rc=$?
else
  gunzip -t "${BACKUP_FILE}" || integrity_rc=$?
fi
if [ "${integrity_rc}" -ne 0 ]; then
  echo "ERROR: Backup failed integrity check (rc=${integrity_rc}; wrong passphrase or corrupt file)." >&2
  echo "Nothing was modified. Check BACKUP_ENCRYPTION_PASSPHRASE / file integrity." >&2
  exit 1
fi

# Stage 2: TOC check. pg_restore --list stops reading before EOF, so the
# producer can die of SIGPIPE (rc 141) under pipefail even on success —
# tolerate it; any other non-zero rc is a hard error.
verify_rc=0
plain_stream | docker exec -i "${DB_CID}" pg_restore --list > /dev/null 2>&1 || verify_rc=$?
if [ "${verify_rc}" -ne 0 ] && [ "${verify_rc}" -ne 141 ]; then
  echo "ERROR: Backup failed TOC verification (rc=${verify_rc}; wrong passphrase or corrupt file)." >&2
  echo "Nothing was modified. Check BACKUP_ENCRYPTION_PASSPHRASE / file integrity." >&2
  exit 1
fi
echo "Backup verified."

echo "Dropping existing schema..."
docker exec "${DB_CID}" psql \
  --username="${POSTGRES_USER:-puku}" \
  --dbname="${POSTGRES_DB:-puku}" \
  --command="DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "Restoring from backup..."
# Tolerate rc 141 (producer SIGPIPE if pg_restore stops before EOF); any
# other non-zero rc is a failed restore.
restore_rc=0
plain_stream | docker exec -i "${DB_CID}" pg_restore \
  --username="${POSTGRES_USER:-puku}" \
  --dbname="${POSTGRES_DB:-puku}" \
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
