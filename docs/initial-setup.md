# Chronify — Initial Setup & Operations Guide

This document covers everything required to deploy, configure, and operate Chronify in production.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Quick Start (Production)](#2-quick-start-production)
3. [Environment Variables](#3-environment-variables)
4. [Docker Compose Configuration](#4-docker-compose-configuration)
5. [Traefik & DNS](#5-traefik--dns)
6. [First Login & Admin Setup](#6-first-login--admin-setup)
7. [OIDC / Single Sign-On (Pocket-ID)](#7-oidc--single-sign-on-pocket-id)
8. [Email (SMTP)](#8-email-smtp)
9. [Push Notifications (VAPID)](#9-push-notifications-vapid)
10. [AU Certificate Encryption](#10-au-certificate-encryption)
11. [Backups](#11-backups)
12. [Restore](#12-restore)
13. [GDPR / Data Retention](#13-gdpr--data-retention)
14. [Kiosk Subdomain](#14-kiosk-subdomain)
15. [Updates](#15-updates)
16. [Local Development](#16-local-development)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. Prerequisites

- **Docker** 24+ and **Docker Compose** v2
- A server with at least 1 GB RAM, 10 GB disk
- A domain with DNS control (two subdomains: app + kiosk)
- **Traefik** as reverse proxy (already configured via compose labels)
  - Entrypoint `websecure` (port 443) must exist
  - TLS cert resolver `cloudflare` must be configured in Traefik
  - An external Docker network named `frontend` must exist

### Create the Traefik network (one-time)

```bash
docker network create frontend
```

---

## 2. Quick Start (Production)

```bash
# 1. Clone the repo
git clone <repo-url> /opt/chronify
cd /opt/chronify

# 2. Copy environment config
cp .env.example .env

# 3. Generate required secrets
openssl rand -base64 32  # → NEXTAUTH_SECRET
openssl rand -base64 32  # → BACKUP_ENCRYPTION_PASSPHRASE
openssl rand -hex 32     # → AU_CERT_ENCRYPTION_KEY

# 4. Edit .env (see section 3)
nano .env

# 5. Start
docker compose up -d
```

The app automatically:

1. Runs Prisma database migrations (`prisma migrate deploy`)
2. Seeds the database if empty (creates admin user + org settings)
3. Starts Next.js on port 3000

Verify: `curl https://<your-app-domain>/api/health` → `{"status":"ok"}`

---

## 3. Environment Variables

All variables live in `.env` (gitignored). The compose file reads them via `${VAR}` interpolation.

### Required

| Variable                       | Description                                         | How to generate           |
| ------------------------------ | --------------------------------------------------- | ------------------------- |
| `NEXTAUTH_SECRET`              | JWT signing secret for Auth.js sessions             | `openssl rand -base64 32` |
| `APP_DOMAIN`                   | Main app domain (e.g. `chronify.example.com`)       | Your DNS record           |
| `KIOSK_DOMAIN`                 | Kiosk subdomain (e.g. `kiosk.chronify.example.com`) | Your DNS record           |
| `BACKUP_ENCRYPTION_PASSPHRASE` | OpenSSL passphrase for encrypted backups            | `openssl rand -base64 32` |
| `AU_CERT_ENCRYPTION_KEY`       | AES-256 key for encrypting sick note certificates   | `openssl rand -hex 32`    |

### Optional (with defaults)

| Variable                | Default         | Description                                                        |
| ----------------------- | --------------- | ------------------------------------------------------------------ |
| `AUTH_SECURE_COOKIE`    | `true`          | Set `__Secure-` prefix on auth cookies (keep `true` in production) |
| `AUTH_DEBUG`            | (empty)         | Set to `true` for verbose Auth.js/OIDC logging                     |
| `DEFAULT_LOCALE`        | `de`            | App default locale (`de` or `en`)                                  |
| `DEFAULT_TIMEZONE`      | `Europe/Berlin` | Fallback timezone for users without one set                        |
| `BACKUP_RETENTION_DAYS` | `14`            | Days to keep backup files before pruning                           |

### Email (optional — features disabled if empty)

| Variable    | Default                | Description          |
| ----------- | ---------------------- | -------------------- |
| `SMTP_HOST` | (empty)                | SMTP server hostname |
| `SMTP_PORT` | `587`                  | SMTP port            |
| `SMTP_USER` | (empty)                | SMTP username        |
| `SMTP_PASS` | (empty)                | SMTP password        |
| `SMTP_FROM` | `chronify@example.com` | From address         |
| `SMTP_TLS`  | `true`                 | Use TLS              |

If `SMTP_HOST` is empty, emails are logged to console instead of sent. Used for: password reset, vacation approvals/rejections, sick note reminders, welcome emails.

### OIDC / Single Sign-On (optional)

| Variable             | Default               | Description              |
| -------------------- | --------------------- | ------------------------ |
| `OIDC_ISSUER`        | `https://idp.sohn.uk` | OIDC provider issuer URL |
| `OIDC_CLIENT_ID`     | (empty)               | OAuth client ID          |
| `OIDC_CLIENT_SECRET` | (empty)               | OAuth client secret      |

`NEXT_PUBLIC_OIDC_ENABLED` is baked into the Docker image as `true` at build time (see Dockerfile line 24). If you don't use OIDC, the login button still appears but will fail — to fully disable, rebuild with `NEXT_PUBLIC_OIDC_ENABLED=""`.

### Push Notifications (optional)

| Variable                            | Description                                         |
| ----------------------------------- | --------------------------------------------------- |
| `PUSH_VAPID_PUBLIC_KEY`             | VAPID public key                                    |
| `PUSH_VAPID_PRIVATE_KEY`            | VAPID private key                                   |
| `PUSH_VAPID_SUBJECT`                | Sender identifier (e.g. `mailto:admin@example.com`) |
| `NEXT_PUBLIC_PUSH_VAPID_PUBLIC_KEY` | Same public key, exposed to browser                 |

Generate with: `npx web-push generate-vapid-keys`

If empty, the push subscription button is hidden in the UI and the push service does not initialize. The app works fine without push — notifications appear in-app only.

### Public Holidays

| Variable                    | Default                        | Description                                    |
| --------------------------- | ------------------------------ | ---------------------------------------------- |
| `NAGER_DATE_API_URL`        | `https://date.nager.at/api/v3` | Holiday API base URL                           |
| `NAGER_DATE_DEFAULT_REGION` | `DE`                           | Country code                                   |
| `NAGER_DATE_DEFAULT_STATE`  | `NW`                           | Default federal state (North Rhine-Westphalia) |

Holidays are fetched per federal state. Admin can sync holidays from the admin panel.

---

## 4. Docker Compose Configuration

The production setup uses `compose.yaml` with two services:

```
┌─────────────┐       ┌──────────────┐
│   Traefik    │──────│   app (3000)  │
│  (external)  │      └──────┬───────┘
└─────────────┘             │
                     ┌──────┴───────┐
                     │  db (5432)   │
                     │  postgres:16 │
                     └──────────────┘
```

- **`db`**: PostgreSQL 16 Alpine, data in `prod-db-data` volume, health-checked
- **`app`**: Chronify Next.js, connects to both `frontend` (Traefik) and `internal` (DB) networks

The app image is pulled from `git.steltner.cloud/2tap2b/time-track-v3:latest`. To build locally instead, change the `image:` line to `build: .`.

---

## 5. Traefik & DNS

### DNS Records

Create two A records pointing to your server:

```
chronify.example.com        → <server IP>
kiosk.chronify.example.com  → <server IP>
```

### Traefik Requirements

Your Traefik instance must have:

- Entrypoint `websecure` on port 443
- TLS certificate resolver named `cloudflare`
- External Docker network `frontend` (created once with `docker network create frontend`)

The compose labels configure two routers:

- `chroify` → matches `Host(<APP_DOMAIN>)` → main app
- `kiosk` → matches `Host(<KIOSK_DOMAIN>)` → same app service (kiosk middleware redirects to `/de/kiosk`)

Both routers share the same backend service (port 3000). To change domains, edit only `.env`:

```env
APP_DOMAIN=new-domain.com
KIOSK_DOMAIN=kiosk.new-domain.com
```

Then `docker compose up -d`. No code changes needed.

---

## 6. First Login & Admin Setup

After the first `docker compose up`, the entrypoint seeds the database with:

- **OrgSettings** singleton (default config)
- **Admin user**: `admin@puku.local` / `admin123`
- **Default working model** (40h/week, Mon–Fri)

### Post-seed steps

1. Log in with `admin@puku.local` / `admin123`
2. Go to **Profile → Change password** (or you'll be prompted)
3. Go to **Admin → Users** and create real employee accounts
4. Go to **Admin → Settings** and configure:
   - App name, logo, login branding
   - Default federal state
   - Lock window (days employees can edit past entries)
   - Vacation defaults
5. Go to **Admin → Holidays** and sync public holidays for the current year
6. Go to **Admin → DSGVO** and configure:
   - Retention periods (working time, sick notes, audit logs)
   - Imprint data (name, address, email, phone) — shown on `/imprint`
   - Privacy policy URL — linked from login page

---

## 7. OIDC / Single Sign-On (Pocket-ID)

Chronify supports OIDC login via [Pocket-ID](https://github.com/pocket-id/pocket-id) or any OIDC provider.

### Setup

1. In your OIDC provider, create a new client:
   - **Redirect URI**: `https://<APP_DOMAIN>/api/auth/callback/pocket-id`
   - **Scopes**: `openid profile email`
2. In `.env`:
   ```env
   OIDC_ISSUER="https://your-idp.example.com"
   OIDC_CLIENT_ID="your-client-id"
   OIDC_CLIENT_SECRET="your-client-secret"
   ```
3. Restart: `docker compose up -d`

Users can now sign in with either credentials (email/password) or the OIDC button. On first OIDC login, the user is linked to an existing account by email, or a new account is created.

### Disable OIDC

The `NEXT_PUBLIC_OIDC_ENABLED` flag is set at **build time** in the Dockerfile. To disable, rebuild:

```dockerfile
ENV NEXT_PUBLIC_OIDC_ENABLED=""
```

---

## 8. Email (SMTP)

Email is used for:

- Password reset links
- Vacation request notifications (to admins)
- Vacation approved/rejected (to employee)
- Sick note reminders (AU certificate missing after 3 days)
- Welcome email (new user created by admin)

### Setup

```env
SMTP_HOST="smtp.your-provider.com"
SMTP_PORT="587"
SMTP_USER="your-user"
SMTP_PASS="your-password"
SMTP_FROM="chronify@your-company.com"
SMTP_TLS="true"
```

### Testing without a real SMTP server (development)

Use Mailpit (included in `docker-compose.dev.yml`):

```env
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_TLS="false"
SMTP_USER=""
SMTP_PASS=""
```

Web UI: `http://localhost:8025`

---

## 9. Push Notifications (VAPID)

Push notifications allow the app to send alerts to the browser even when the PWA is closed. Used for timer reminders and vacation/sick notifications.

### Setup

```bash
npx web-push generate-vapid-keys
```

Add to `.env`:

```env
PUSH_VAPID_PUBLIC_KEY="<public key>"
PUSH_VAPID_PRIVATE_KEY="<private key>"
PUSH_VAPID_SUBJECT="mailto:admin@your-company.com"
NEXT_PUBLIC_PUSH_VAPID_PUBLIC_KEY="<same public key>"
```

**Without push keys:** The subscribe/unsubscribe button is hidden in the user menu. In-app notifications (the bell icon) still work — only browser push is disabled.

---

## 10. AU Certificate Encryption

Sick note certificates (AU-Bescheinigungen) are health data under Art. 9 GDPR. They are stored encrypted on disk using AES-256-GCM.

### Setup

```bash
openssl rand -hex 32
# → e.g. "a1b2c3d4e5f6..."
```

```env
AU_CERT_ENCRYPTION_KEY="a1b2c3d4e5f6..."
```

**Important:**

- Do NOT lose this key — encrypted files cannot be recovered without it
- Do NOT change this key after files are encrypted
- New uploads are automatically encrypted
- Files are stored in `data/au-certificates/` (inside the container)

### Migrating existing unencrypted files

If you already have uploaded certificates before setting the encryption key, run this **once**:

```bash
docker exec chronify-app npm run migrate:au-encryption
```

This reads all existing certificate files, encrypts them, and overwrites the originals. If no certificates exist yet, skip this step.

---

## 11. Backups

Backups are encrypted with OpenSSL AES-256-CBC + PBKDF2.

### Setup

```bash
openssl rand -base64 32
# → e.g. "K7m2Rf8sQ3hN1zB6vY4cW9pX2dL5jT0a"
```

```env
BACKUP_ENCRYPTION_PASSPHRASE="K7m2Rf8sQ3hN1zB6vY4cW9pX2dL5jT0a"
BACKUP_RETENTION_DAYS="14"
```

**Keep the passphrase safe** — without it, backups cannot be restored. Store it in a password manager or offline location.

### Manual backup

```bash
docker exec chronify-app bash -c '
  DATABASE_URL="postgresql://puku:puku@db:5432/puku?schema=public" \
  BACKUP_ENCRYPTION_PASSPHRASE="'$BACKUP_ENCRYPTION_PASSPHRASE'" \
  bash scripts/backup-db.sh /backups
'
```

Or from the host (if `psql`/`pg_dump` are installed):

```bash
source .env
bash scripts/backup-db.sh ./backups
```

### Automated backup (cron)

```bash
# /etc/cron.d/chronify-backup
0 2 * * * root cd /opt/chronify && source .env && bash scripts/backup-db.sh ./backups >> /var/log/chronify-backup.log 2>&1
```

- Backups land in `/opt/chronify/backups/`
- Retention: 14 days (configurable via `BACKUP_RETENTION_DAYS`)
- Files are named: `chronify-backup-YYYYMMDD-HHMMSS.sql.gz.enc`

### Offsite storage

For disaster recovery, copy encrypted backup files to an offsite location:

- Encrypted S3 bucket
- External server via rsync
- USB drive

The files are encrypted — they can be stored anywhere without exposing data.

---

## 12. Restore

```bash
source .env
bash scripts/restore-db.sh backups/chronify-backup-YYYYMMDD-HHMMSS.sql.gz.enc
```

You will be prompted to type `CONFIRM` — this **overwrites the entire database**.

The script:

1. Drops the existing `public` schema
2. Decrypts the backup with OpenSSL
3. Restores via `pg_restore`

**Note:** Restore requires both `DATABASE_URL` and `BACKUP_ENCRYPTION_PASSPHRASE` to be set.

---

## 13. GDPR / Data Retention

### Retention Configuration

Configurable via **Admin → DSGVO**:

| Setting                | Default   | Legal basis               |
| ---------------------- | --------- | ------------------------- |
| Working time retention | 2 years   | ArbZG §16                 |
| Sick note retention    | 12 months | Art. 9 GDPR (health data) |
| Audit log retention    | 6 months  | Security purposes         |

### Automated cleanup (cron)

```bash
# /etc/cron.d/chronify-retention
0 3 * * 0 root docker exec chronify-app tsx scripts/retention-cleanup.ts >> /var/log/chronify-retention.log 2>&1
```

Runs weekly on Sunday at 03:00. Deletes data older than the configured retention periods.

### Dry run (preview without deleting)

```bash
docker exec chronify-app tsx scripts/retention-cleanup.ts --dry-run
```

### Manual cleanup (via Admin UI)

1. Go to **Admin → DSGVO**
2. Click **Preview (Dry Run)** to see what would be deleted
3. Click **Run cleanup** and confirm

### What gets deleted

| Data type         | Retention                      | Action                                             |
| ----------------- | ------------------------------ | -------------------------------------------------- |
| Time entries      | `retentionYears` (2)           | Deleted                                            |
| Vacation requests | `retentionYears` (2)           | Deleted                                            |
| Sick notes        | `sickNoteRetentionMonths` (12) | Deleted + certificate files removed                |
| Audit logs        | `auditLogRetentionMonths` (6)  | Deleted                                            |
| Notifications     | 90 days                        | Deleted                                            |
| Inactive users    | `retentionYears` (2)           | Anonymized (name, email, NFC card, password wiped) |

### User anonymization (employee departure)

When an employee leaves:

1. Admin → Users → Deactivate the user
2. Admin → DSGVO → Anonymize section → Click the trash icon next to the user
3. Confirm the dialog

This:

- Sets name to "Gelöscht", clears first/last name, email, NFC card ID, password hash
- Deletes their notifications, push subscriptions, timer sessions
- Deletes their AU certificate files
- **Keeps** their time entries (anonymized, for statistics)

### GDPR data export (Art. 15/20)

Users can download all their personal data:

- **Profile → My data → Export my data**
- Downloads a JSON file with: profile, working models, time entries, vacation requests, sick notes (metadata only, not certificate files), overtime balances, notifications, audit logs
- API: `GET /api/gdpr/export`
- Each export is logged in the audit trail

### Privacy policy & imprint

- `/privacy` — Public privacy policy page (renders from OrgSettings)
- `/imprint` — Public imprint page (renders from OrgSettings)
- Configure content via **Admin → DSGDO → Imprint & Privacy** section
- Login page footer links to both pages

---

## 14. Kiosk Subdomain

The kiosk is a public, fullscreen PWA for NFC-based time tracking at a terminal.

### How it works

- `kiosk.chronify.example.com` routes to the **same** Docker container via Traefik
- The middleware detects the kiosk host and redirects all traffic to `/de/kiosk`
- No authentication required — users tap NFC cards to start/stop timers
- Separate PWA manifest with `display: fullscreen` and its own scope

### Setup

1. DNS: `kiosk.chronify.example.com` → server IP (same as app)
2. `.env`: `KIOSK_DOMAIN="kiosk.chronify.example.com"`
3. Traefik labels in `compose.yaml` handle routing automatically
4. Open `https://kiosk.chronify.example.com` on a tablet/terminal
5. Install as PWA (fullscreen) for kiosk mode

### NFC cards

1. Assign NFC card IDs to users: **Admin → Users → Edit → NFC Card ID**
2. The card ID is the text content written to the NFC tag (NDEF text record)
3. Tap the card against the device to start/stop the timer
4. Manual entry fallback available if NFC is not supported

---

## 15. Updates

```bash
cd /opt/chronify
git pull
docker compose pull          # pull new image
docker compose up -d         # restart with new image
```

The entrypoint automatically runs `prisma migrate deploy` on startup, applying any new database migrations.

### Check health after update

```bash
curl https://<APP_DOMAIN>/api/health
# → {"status":"ok"}
```

### View logs

```bash
docker compose logs -f app
```

---

## 16. Local Development

### Prerequisites

- Node.js 20+ (Node 24 works too)
- Docker (for PostgreSQL + Mailpit)

### Setup

```bash
# Start dev database + Mailpit
docker compose -f docker-compose.dev.yml up -d

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database (creates admin user)
npx tsx prisma/seed.ts

# Start dev server (port 3001, PWA disabled in dev)
npm run dev
```

### Dev services

| Service            | Port | Purpose                                    |
| ------------------ | ---- | ------------------------------------------ |
| Next.js dev server | 3001 | App                                        |
| PostgreSQL         | 5433 | Database (mapped to 5432 inside container) |
| Mailpit SMTP       | 1025 | Catch-all email                            |
| Mailpit Web UI     | 8025 | View caught emails                         |

### Dev environment

Create `.env` for local dev:

```env
DATABASE_URL="postgresql://puku:puku@localhost:5433/puku?schema=public"
NEXTAUTH_SECRET="dev-secret-not-secure"
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_TLS="false"
AU_CERT_ENCRYPTION_KEY=""  # optional in dev, encryption still works if set
```

### Useful commands

| Command                  | Description              |
| ------------------------ | ------------------------ |
| `npm run dev`            | Start dev server         |
| `npm run build`          | Production build         |
| `npm run typecheck`      | TypeScript check         |
| `npm run lint`           | ESLint                   |
| `npm run prisma:studio`  | Prisma Studio (DB GUI)   |
| `npm run prisma:migrate` | Create + apply migration |
| `npm run prisma:seed`    | Re-seed database         |
| `npm test`               | Run Vitest tests         |
| `npm run test:e2e`       | Run Playwright E2E tests |

---

## 17. Troubleshooting

### Docker build fails with `npm ci` peer dependency error

The `Dockerfile` uses `--omit=peer` to avoid conflicts. If you still see errors, ensure `package-lock.json` is in sync:

```bash
npm install
docker compose build --no-cache
```

### Database migration errors

```bash
# Check migration status
docker exec chronify-app npx prisma migrate status

# Run migrations manually
docker exec chronify-app npx prisma migrate deploy
```

### Auth / login not working

- Ensure `NEXTAUTH_SECRET` is set in `.env`
- Check `AUTH_SECURE_COOKIE=true` (requires HTTPS)
- Set `AUTH_DEBUG=true` for verbose logging
- Verify `NEXTAUTH_URL` matches your domain (set in compose.yaml from `${APP_DOMAIN}`)

### Kiosk not working

- Verify `KIOSK_DOMAIN` DNS record points to the server
- Check `KIOSK_HOST` env var is set in the container: `docker exec chronify-app printenv KIOSK_HOST`
- The kiosk page is at `https://<KIOSK_DOMAIN>/de/kiosk`
- NFC requires HTTPS and Chrome on Android (or Safari on iOS 16+)

### Email not sending

- Check SMTP settings in `.env`
- If `SMTP_HOST` is empty, emails go to console log only
- Test with Mailpit in dev: `http://localhost:8025`
- Check logs: `docker compose logs app | grep -i mail`

### Certificate decryption fails

If you see errors when downloading AU certificates:

- `AU_CERT_ENCRYPTION_KEY` must be exactly 64 hex characters (32 bytes)
- The key must match the one used when the file was encrypted
- If the key was changed, old files cannot be decrypted — they must be re-uploaded

### Backup restore fails

- Ensure `BACKUP_ENCRYPTION_PASSPHRASE` matches the one used for backup
- The passphrase is in `.env` — if lost, backups are unrecoverable
- Check that `pg_restore` is available: `which pg_restore`
