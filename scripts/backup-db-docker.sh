#!/usr/bin/env bash
# DB backup script for Chronify — Docker variant.
#
# For hosts where the app runs via compose (compose.yaml) and no postgres
# client tools are installed: pg_dump runs INSIDE the db container, gzip /
# encryption / verification run on the host (the postgres:16-alpine image has
# no openssl CLI). Same output format and verification semantics as
# scripts/backup-db.sh.
#
# Usage: ./scripts/backup-db-docker.sh [output-dir]
# Env:   BACKUP_RETENTION_DAYS (default 14)
#        BACKUP_ENCRYPTION_PASSPHRASE (optional — if set, output is OpenSSL
#        encrypted *.sql.gz.enc; if unset, output is plain *.sql.gz)
#        COMPOSE_CMD (default "docker compose"), DB_SERVICE (default "db")
#
# NOTE: without a passphrase the dumps contain unencrypted personal data —
# keep the output directory private (mode 0700) and protect offsite copies.

set -euo pipefail

OUTPUT_DIR="${1:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

if [ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
  SUFFIX=".sql.gz.enc"
else
  SUFFIX=".sql.gz"
  echo "WARNING: BACKUP_ENCRYPTION_PASSPHRASE is not set — writing UNENCRYPTED backups." >&2
  echo "Keep '${OUTPUT_DIR}' private (mode 0700) and protect any copies of these files." >&2
fi

FILENAME="chronify-backup-${TIMESTAMP}${SUFFIX}"
OUTPUT_PATH="${OUTPUT_DIR}/${FILENAME}"

# --- locate the db container -------------------------------------------------
COMPOSE="${COMPOSE_CMD:-docker compose}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_CID="$(${COMPOSE} ps -q "${DB_SERVICE}" 2>/dev/null || true)"
if [ -z "${DB_CID}" ]; then
  # Fall back to any running container labelled as the compose db service.
  DB_CID="$(docker ps --filter "label=com.docker.compose.service=${DB_SERVICE}" --format '{{.ID}}' 2>/dev/null | head -1 || true)"
fi
if [ -z "${DB_CID}" ]; then
  echo "ERROR: no running '${DB_SERVICE}' container found (run from the compose project dir or set DB_SERVICE)." >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"
chmod 700 "${OUTPUT_DIR}" 2>/dev/null || \
  echo "WARNING: could not ensure mode 0700 on ${OUTPUT_DIR} — check its permissions." >&2

umask 077

# Prevent overlapping runs (cron catch-up, manual + cron collision).
exec 9>"${OUTPUT_DIR}/backup.lock"
flock -n 9 || { echo "ERROR: Another backup run is already in progress." >&2; exit 1; }

# Write to a temp file and rename only after verification, so a failed run
# never leaves a truncated archive that could be mistaken for a good backup.
PARTIAL="${OUTPUT_PATH}.partial"
trap 'rm -f "${PARTIAL}"' EXIT

echo "Backing up database (container ${DB_CID}) → ${OUTPUT_PATH}"

# pg_dump inside the container; gzip (+ optional openssl) on the host.
docker exec "${DB_CID}" pg_dump \
  --username="${POSTGRES_USER:-puku}" \
  --dbname="${POSTGRES_DB:-puku}" \
  --no-owner \
  --no-privileges \
  --format=custom \
  | gzip \
  | {
    if [ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
      openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_ENCRYPTION_PASSPHRASE
    else
      cat
    fi
  } > "${PARTIAL}"

# --- verify the artifact before declaring success ---------------------------
echo "Verifying backup integrity..."
# Stage 1: full integrity pass. gunzip -t consumes its entire input, so there
# is no early-exiting consumer and no SIGPIPE ambiguity — any non-zero rc
# here (bad decrypt, corruption, truncation) is a hard error.
integrity_rc=0
if [ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
  openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_PASSPHRASE \
    -in "${PARTIAL}" | gunzip -t || integrity_rc=$?
else
  gunzip -t "${PARTIAL}" || integrity_rc=$?
fi
if [ "${integrity_rc}" -ne 0 ]; then
  echo "ERROR: backup failed integrity check (rc=${integrity_rc}) — removing ${PARTIAL}" >&2
  exit 1
fi

# Stage 2: TOC check. pg_restore --list stops reading before EOF, so the
# producer can die of SIGPIPE (rc 141) under pipefail even on success —
# tolerate it; any other non-zero rc is a hard error.
verify_rc=0
if [ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
  openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_PASSPHRASE \
    -in "${PARTIAL}" | gunzip
else
  gunzip -c "${PARTIAL}"
fi | docker exec -i "${DB_CID}" pg_restore --list > /dev/null || verify_rc=$?
if [ "${verify_rc}" -ne 0 ] && [ "${verify_rc}" -ne 141 ]; then
  echo "ERROR: backup failed TOC verification (rc=${verify_rc}) — removing ${PARTIAL}" >&2
  exit 1
fi

mv "${PARTIAL}" "${OUTPUT_PATH}"
sha256sum "${OUTPUT_PATH}" > "${OUTPUT_PATH}.sha256"

echo "Backup complete: ${OUTPUT_PATH} ($(du -h "${OUTPUT_PATH}" | cut -f1)) [verified]"

# Prune old backups
if [ "${RETENTION_DAYS}" -gt 0 ]; then
  echo "Pruning backups older than ${RETENTION_DAYS} days..."
  find "${OUTPUT_DIR}" -name "chronify-backup-*.sql.gz*" -type f -mtime "+${RETENTION_DAYS}" -delete
  echo "Pruned."
fi
