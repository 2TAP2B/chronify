#!/usr/bin/env bash
# Generate a GPG key pair for encrypted backups.
# The public key stays on the server for encryption.
# The private key MUST be exported and stored offsite, then deleted from the server.

set -euo pipefail

KEY_EMAIL="${BACKUP_GPG_RECIPIENT:-backup@chronify.local}"
KEY_NAME="Chronify Backup"

echo "==> Generating GPG key pair for encrypted backups..."
echo "    Name: ${KEY_NAME}"
echo "    Email: ${KEY_EMAIL}"
echo ""

# Generate key non-interactively
gpg --batch --gen-key <<EOF
Key-Type: RSA
Key-Length: 4096
Name-Real: ${KEY_NAME}
Name-Email: ${KEY_EMAIL}
Expire-Date: 0
%no-protection
%commit
EOF

echo ""
echo "==> Key generated successfully!"
echo ""
echo "==> Exporting PRIVATE key (store this OFFSITE — e.g. USB stick, password manager)..."
echo ""

PRIVATE_KEY_FILE="chronify-backup-private-key-$(date +%Y%m%d).asc"
gpg --armor --export-secret-keys "${KEY_EMAIL}" > "${PRIVATE_KEY_FILE}"
chmod 600 "${PRIVATE_KEY_FILE}"

echo "    Private key exported to: ${PRIVATE_KEY_FILE}"
echo ""
echo "==> IMPORTANT: Move this file to a secure offsite location NOW!"
echo "    Then delete it from this server:"
echo "    rm ${PRIVATE_KEY_FILE}"
echo ""
echo "==> The PUBLIC key remains on this server for encryption."
echo "    Set in .env: BACKUP_GPG_RECIPIENT=\"${KEY_EMAIL}\""
echo ""
echo "==> To verify, run:"
echo "    gpg --list-keys \"${KEY_EMAIL}\""