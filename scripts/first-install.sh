#!/usr/bin/env bash
#
# Chronify — interactive first-install setup.
#
# Asks for every relevant configuration value, generates all secrets with
# openssl (and VAPID keys via npx web-push), writes .env, prepares the report
# export folder and brings the Docker compose stack up.
#
# Usage:
#   bash scripts/first-install.sh            interactive
#   bash scripts/first-install.sh --yes      accept all defaults / skips optional
#   DRY_RUN=1 bash scripts/first-install.sh  stop right after writing .env
#
# Requires: docker + docker compose (for the stack step), openssl, sed.
# Node (optional): only needed to auto-generate VAPID keys.

set -euo pipefail

# Allow overriding the project root (tests use a scratch dir); defaults to the
# repo root next to this script.
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$PROJECT_ROOT" || exit 1
REPO_DIR="$(pwd)"

RED=$'\e[31m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; BOLD=$'\e[1m'; RESET=$'\e[0m'
info() { printf "%b\n" "${GREEN}==>${RESET} $1"; }
warn() { printf "%b\n" "${YELLOW} ==>${RESET} $1"; }
die()  { printf "%b\n" "${RED}==>${RESET} $1"; exit 1; }

ACCEPT_ALL=0
for arg in "$@"; do
  case "$arg" in
    --yes|-y) ACCEPT_ALL=1 ;;
    *) echo "unknown option: $arg (use --yes)" >&2; exit 64 ;;
  esac
done

[ -f .env.example ] || die ".env.example not found (run from the repo root)"
if [ -f .env ] && [ "${KEEP_EXISTING_ENV:-0}" != "1" ]; then
  die ".env already exists. Remove it first or run with KEEP_EXISTING_ENV=1."
fi
for bin in openssl sed; do
  command -v "$bin" >/dev/null || die "missing tool: $bin"
done

# Non-interactive `--yes` runs (CI/tests) accept the defaults directly.
ask() {
  local prompt="$1" def="$2" reply
  if [ "$ACCEPT_ALL" = "1" ]; then
    out="$def"
    return
  fi
  read -r -p "  ${prompt} ${BOLD}[${def}]${RESET}: " reply || reply=""
  out="${reply:-$def}"
}

echo
echo "${BOLD}Chronify first-install${RESET}"
echo "This wizard collects all settings, writes .env and starts the stack."
echo "Press enter to accept the [default] — empty means disabled/keep default."

# --- core domains ------------------------------------------------------------
echo
echo "${BOLD}1. Domains (main app + NFC kiosk)${RESET}"
while :; do
  ask "Main domain (without https://, used for Traefik + NEXTAUTH_URL)" "chronify.example.com"; APP_DOMAIN="$out"
  case "$APP_DOMAIN" in *.*) break ;; *) warn "needs at least one dot (e.g. chronify.example.com)" ;; esac
done
while :; do
  ask "Kiosk subdomain (NFC stamp wall; must be a subdomain of the main domain)" "kiosk.${APP_DOMAIN}"; KIOSK_DOMAIN="$out"
  case "$KIOSK_DOMAIN" in *.*) break ;; *) warn "please provide a kiosk subdomain (compose needs it) or type 'none'" ;; esac
done
[ "$KIOSK_DOMAIN" = "none" ] && KIOSK_DOMAIN=""
if [ -n "$KIOSK_DOMAIN" ]; then
  CSRF_ALLOWED_ORIGINS="https://${APP_DOMAIN},https://${KIOSK_DOMAIN}"
else
  CSRF_ALLOWED_ORIGINS="https://${APP_DOMAIN}"
fi

# --- app basics ---------------------------------------------------------------
echo
echo "${BOLD}2. Application${RESET}"
ask "App name (shown in login / branding; editable later via Admin > Settings)" "Chronify"; APP_NAME="$out"
ask "Default locale (de|en)" "de"; DEFAULT_LOCALE="$out"
ask "Default timezone (IANA, e.g. Europe/Berlin)" "Europe/Berlin"; DEFAULT_TIMEZONE="$out"

# --- SMTP (optional) ----------------------------------------------------------
echo
echo "${BOLD}3. SMTP (password reset mails, vacation notifications) — optional${RESET}"
echo "  Press enter on every question to skip mail entirely."
ask "SMTP host (e.g. mail.example.com — leave empty to disable mail)" ""; SMTP_HOST="$out"
if [ -n "$SMTP_HOST" ]; then
  ask "SMTP port" "587"; SMTP_PORT="$out"
  ask "SMTP user" ""; SMTP_USER="$out"
  read -rs -p "  SMTP password (input hidden) [keep empty]: " pw || pw=""; echo; SMTP_PASS="$pw"
  ask "From address" "chronify@example.com"; SMTP_FROM="$out"
  ask "Use TLS (true|false)" "true"; SMTP_TLS="$out"
else
  SMTP_PORT="587"; SMTP_USER=""; SMTP_PASS=""; SMTP_FROM="chronify@example.com"; SMTP_TLS="true"
  warn "Mail is disabled — password reset / vacation e-mails will not be sent."
fi

# --- push (VAPID) ------------------------------------------------------------
echo
echo "${BOLD}4. Push notifications (Web Push / VAPID)${RESET}"
ask "Enable push notifications? (y/N)" "n"; ENABLE_PUSH="$out"
PUSH_VAPID_PUBLIC_KEY=""; PUSH_VAPID_PRIVATE_KEY=""
if [[ "$ENABLE_PUSH" =~ ^[Yy] ]]; then
  if command -v node >/dev/null && node -e "" 2>/dev/null; then
    info "Generating VAPID keys with npx web-push ..."
    if KEYS=$(npx --yes web-push generate-vapid-keys 2>/dev/null); then
      PUSH_VAPID_PUBLIC_KEY="$(echo "$KEYS" | sed -n 's/^Public Key:[[:space:]]*//p' | tr -d ' ')"
      PUSH_VAPID_PRIVATE_KEY="$(echo "$KEYS" | sed -n 's/^Private Key:[[:space:]]*//p' | tr -d '\n')"
    fi
  fi
  if [ -z "$PUSH_VAPID_PUBLIC_KEY" ]; then
    warn "Could not generate VAPID keys automatically (node missing / npx failed)."
    ask "Paste your web-push public key (or leave empty to skip push)" ""
    PUSH_VAPID_PUBLIC_KEY="$out"
    ask "Paste your web-push private key (or leave empty)" ""
    PUSH_VAPID_PRIVATE_KEY="$out"
  fi
  ask "VAPID subject (contact, e.g. mailto:admin@example.com)" "mailto:admin@${APP_DOMAIN#*.}"; PUSH_VAPID_SUBJECT="$out"
else
  PUSH_VAPID_SUBJECT="mailto:admin@${APP_DOMAIN#*.}"
fi

# --- OIDC (Pocket ID) ----------------------------------------------------------
echo
echo "${BOLD}5. OIDC / Pocket-ID (optional)${RESET}"
ask "Configure OIDC SSO now? (y/N)" "n"; ENABLE_OIDC="n"
if [[ "$ENABLE_OIDC" =~ ^[Yy] ]]; then
  ask "OIDC issuer URL" "https://idp.example.com"; OIDC_ISSUER="$out"
  ask "OIDC client id" ""; OIDC_CLIENT_ID="$out"
  read -rs -p "  OIDC client secret (hidden): " secret || secret=""; echo; OIDC_CLIENT_SECRET="$secret"
  NEXT_PUBLIC_OIDC_ENABLED="true"
else
  OIDC_ISSUER=""; OIDC_CLIENT_ID=""; OIDC_CLIENT_SECRET=""; NEXT_PUBLIC_OIDC_ENABLED="false"
fi

# --- holiday API ---------------------------------------------------------------
echo
echo "${BOLD}6. Public holidays${RESET}"
ask "Federal state code (DE_NW, DE_BY, DE_BE …, shorthand like 'nw' works)" "DE_NW"; NAGER_DATE_DEFAULT_STATE="$out"
# Normalise: accept 'nw'/'bw' → DE_NW / DE_BW.
case "${NAGER_DATE_DEFAULT_STATE,,}" in
  de_*) NAGER_DATE_DEFAULT_STATE="${NAGER_DATE_DEFAULT_STATE^^}" ;;
  *) NAGER_DATE_DEFAULT_STATE="DE_${NAGER_DATE_DEFAULT_STATE^^}" ;;
esac

# --- report automation ------------------------------------------------------------
echo
echo "${BOLD}6. Report automation (PDF exports)${RESET}"
ask "Reports output dir inside the app container (must match compose mount ./reports:/data/reports)" "/data/reports"; REPORTS_EXPORT_DIR="$out"

# --- backups ----------------------------------------------------------------
echo
echo "${BOLD}7. Backups${RESET}"
ask "Backup retention in days" "14"; BACKUP_RETENTION_DAYS="$out"

# --- article-9 encryption -----------------------------------------------------------------
echo
echo "${BOLD}8. AU certificate encryption (ArbZG/Art.9)${RESET}"
warn "Key is generated automatically (openssl rand -hex 32). IMPORTANT: without this key AU PDF uploads cannot be re-read!"

info "Summary"
echo "--- fundamentals --------------------------------------------------"
echo "  APP_DOMAIN         : $APP_DOMAIN"
echo "  KIOSK_DOMAIN       : ${KIOSK_DOMAIN:-<none>}"
echo "  NEXTAUTH_URL       : https://$APP_DOMAIN"
echo "  CSRF origins       : $CSRF_ALLOWED_ORIGINS"
echo "  App name           : $APP_NAME"
echo "--- integrations ----------------------------------------------------"
echo "  SMTP               : ${SMTP_HOST:-<disabled>}"
echo "  Push (VAPID)       : ${PUSH_VAPID_PUBLIC_KEY:+configured}${PUSH_VAPID_PUBLIC_KEY:-<disabled>}"
echo "  OIDC               : $([ "${NEXT_PUBLIC_OIDC_ENABLED:-}" = "true" ] && echo enabled || echo disabled)"
echo "  Reports dir        : $REPORTS_EXPORT_DIR"
echo "---------------------------------------------------------------------"

# --------------------------------------------------------------- write .env ---
info "Writing .env (from .env.example)"
ovr="$(mktemp)"
trap 'rm -f "$ovr"' EXIT
add_ovr() {
  local key="$1" value="$2"
  # .env uses double-quoted values; escape embedded quotes.
  printf '%s|%s\n' "$key" "${value//\"/\\\"}" >> "$ovr"
}
for pair in \
  "APP_DOMAIN|$APP_DOMAIN" \
  "KIOSK_DOMAIN|$KIOSK_DOMAIN" \
  "CSRF_ALLOWED_ORIGINS|$CSRF_ALLOWED_ORIGINS" \
  "APP_NAME|$APP_NAME" \
  "DEFAULT_LOCALE|$DEFAULT_LOCALE" \
  "DEFAULT_TIMEZONE|$DEFAULT_TIMEZONE" \
  "SMTP_HOST|$SMTP_HOST" \
  "SMTP_PORT|$SMTP_PORT" \
  "SMTP_USER|$SMTP_USER" \
  "SMTP_PASS|$SMTP_PASS" \
  "SMTP_FROM|$SMTP_FROM" \
  "SMTP_TLS|$SMTP_TLS" \
  "OIDC_ISSUER|$OIDC_ISSUER" \
  "OIDC_CLIENT_ID|$OIDC_CLIENT_ID" \
  "OIDC_CLIENT_SECRET|$OIDC_CLIENT_SECRET" \
  "NEXT_PUBLIC_OIDC_ENABLED|$NEXT_PUBLIC_OIDC_ENABLED" \
  "PUSH_VAPID_PUBLIC_KEY|$PUSH_VAPID_PUBLIC_KEY" \
  "PUSH_VAPID_PRIVATE_KEY|$PUSH_VAPID_PRIVATE_KEY" \
  "PUSH_VAPID_SUBJECT|$PUSH_VAPID_SUBJECT" \
  "NEXT_PUBLIC_PUSH_VAPID_PUBLIC_KEY|$PUSH_VAPID_PUBLIC_KEY" \
  "NAGER_DATE_DEFAULT_STATE|$NAGER_DATE_DEFAULT_STATE" \
  "REPORTS_EXPORT_DIR|$REPORTS_EXPORT_DIR" \
  "BACKUP_RETENTION_DAYS|$BACKUP_RETENTION_DAYS"
do
  add_ovr "${pair%%|*}" "${pair#*|}"
done

# Replace KEY="..." lines for every override key, keep comments/others as-is.
apply_overrides() {
  local ovrfile="$1" source="$2"
  awk -v ovr="$ovrfile" '
    function leaf(line,   k) {
      sub(/^[[:space:]]*/, "", line)
      sub(/=.*/, "", line)
      return line
    }
    NR==FNR {
      idx = index($0, "|")
      ov[substr($0, 1, idx - 1)] = substr($0, idx + 1)
      next
    }
    {
      k = leaf($0)
      if (k != "" && k in ov) {
        printf "%s=\"%s\"\n", k, ov[k]
      } else {
        print
      }
    }
  ' "$ovrfile" "$source"
}

apply_overrides "$ovr" .env.example > .env.new && mv .env.new .env

# --- secrets ---------------------------------------------------------------
info "Generating secrets with openssl"
sec="$(mktemp)"
printf 'NEXTAUTH_SECRET|%s\n' "$(openssl rand -base64 32)" >> "$sec"
printf 'AU_CERT_ENCRYPTION_KEY|%s\n' "$(openssl rand -hex 32)" >> "$sec"
printf 'BACKUP_ENCRYPTION_PASSPHRASE|%s\n' "$(openssl rand -base64 32)" >> "$sec"
apply_overrides "$sec" .env > .env.new && mv .env.new .env
rm -f "$sec"
chmod 600 .env

info ".env written (contents: chmod 600, not committed to git)."
if [ "${DRY_RUN:-0}" = "1" ]; then
  info "DRY_RUN=1 set — stopping before Docker steps."
  exit 0
fi

# --- stack --------------------------------------------------------------------
command -v docker >/dev/null || die "docker not found on PATH — install docker first."
docker compose version >/dev/null 2>&1 || die "docker compose v2 not available."

command -v node >/dev/null && [ -z "$PUSH_VAPID_PUBLIC_KEY" ] && warn "Push keys skipped — see comment in .env"

# Report output dir on host (bind mount ./reports:/data/reports)
if [ "$REPORTS_EXPORT_DIR" = "/data/reports" ]; then
  info "Creating ./reports (owner 1001:1001 so the app container can write)"
  if [ "$(id -u)" -eq 0 ]; then
    install -d -m 775 -o 1001 -g 1001 ./reports
  else
    sudo install -d -m 775 -o 1001 -g 1001 ./reports 2>/dev/null \
      || { mkdir -p ./reports && chmod 777 ./reports && warn "Created ./reports world-writable — tighten later: chown 1001:1001 app-reports"; }
  fi
fi

info "Bringing the compose stack up (pull + up -d --wait)"
docker compose pull
docker compose up -d --wait

info "Stack is up. Checking health …"
sleep 4
if command -v curl >/dev/null; then
  curl -fsS "https://${APP_DOMAIN}/api/health" >/dev/null && \
    info "App healthy at https://${APP_DOMAIN}" || \
    warn "Health check failed — container logs: docker compose logs app"
else
  info "Open https://${APP_DOMAIN}"
fi

echo
info "Done. First admin login: admin@puku.local / admin123 — CHANGE IT after first sign-in (Profile → Password)."
info "Useful afterwards:"
echo "  · Reports/Automatik: Admin > Verwaltung > Automatisierung (REPORTS_EXPORT_DIR)"
echo "  · DB backups: bash scripts/backup-db.sh (BACKUP_ENCRYPTION_PASSPHRASE from .env)"
echo "  · Retention:   npm run retention:run (host cron recommended)"
