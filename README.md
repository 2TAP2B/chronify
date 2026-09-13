# puku-timetracking

PWA-Zeiterfassungs-Webapp für ~20 Mitarbeiter (Standard: Nordrhein-Westfalen).

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- PostgreSQL 16 + Prisma 6 (driver adapter `@prisma/adapter-pg`)
- Auth.js v5 (Credentials, bcrypt, JWT sessions)
- Tailwind CSS v3 + shadcn/ui
- next-intl (de default, en placeholder)
- @ducanh2912/next-pwa (PWA + offline)
- Docker Compose (app + postgres)

## Schnellstart

### Mit Docker Compose (empfohlen)

```bash
cp .env.example .env
# NEXTAUTH_SECRET erzeugen:
openssl rand -base64 32
# in .env eintragen

docker-compose up --build
```

App: http://localhost:3000
Admin-Login: `admin@puku.local` / `admin123` (nach erstem Seed)

### Lokale Entwicklung (Nix dev shell)

Alle Werkzeuge (Node 22, PostgreSQL 16, Prisma-Engines, Playwright-Browser)
kommen aus dem Nix-Flake — nichts muss global installiert sein.

```bash
nix develop            # oder: direnv allow  (lädt die Shell beim cd automatisch)

npm ci                 # Abhängigkeiten
dev-env-init           # .env aus .env.example + generierte Secrets
dev-db start           # lokale PostgreSQL-16-Instanz in ./.dev-db (kein Docker)
npm run db:setup       # Migrationen + Seed
npm run dev            # Dev-Server auf http://localhost:3001
```

Qualitäts-Gates: `npm run typecheck`, `npm run lint`, `npm test`,
`npm run build`, `npm run format:check` (fixen mit `npm run format`) sowie
`npm run test:e2e` (baut und startet dafür einen Production-Server auf :3100).

`dev-db` kennt `start`, `stop`, `status`, `psql` und `reset`. Details und alle
Konventionen für Agenten: siehe `AGENTS.md`.

### Alternative: Docker für die Datenbank

```bash
docker compose -f docker-compose.dev.yml up -d   # Postgres auf 5433, Mailpit 1025/8025
# DATABASE_URL="postgresql://puku:puku@localhost:5433/puku?schema=public"

cp .env.example .env
npm install
npx prisma migrate dev
npx tsx prisma/seed.ts
npm run dev
```

### Hinweis: NixOS

Auf NixOS fehlen Prisma die vorgefertigten Engine-Binaries für `linux-nixos`.
Die App läuft dank `@prisma/adapter-pg` (driver adapter) zur Laufzeit ohne
Query-Engine-Binary. Im Nix dev shell setzt `pkgs.prisma-engines_6` die
`PRISMA_*_ENGINE*`-Variablen, damit `prisma generate`/`migrate` auch ohne Docker
funktionieren. Außerhalb der Shell (oder in einem anderen Container) die CLI in
Docker ausführen:

```bash
docker run --rm --network host -v "$PWD:/app" \
  -e DATABASE_URL="postgresql://puku:puku@localhost:5432/puku?schema=public" \
  node:20-alpine sh -c "apk add --no-cache libc6-compat openssl && npm ci && npx prisma migrate dev"
```

## Projektstruktur

```
src/
├── app/[locale]/       # lokalisierte Routen
│   ├── (app)/          # auth-geschützt (Dashboard, Stundenzettel, …)
│   │   └── admin/      # admin-only (users, settings, holidays, gdpr)
│   └── login/
├── app/api/            # API-Routen (auth, health, …)
├── components/         # UI (shadcn primitives + eigene)
├── lib/                # auth, db, utils
├── i18n/               # next-intl routing + request config
├── messages/           # de.json, en.json
├── server/             # Services (DB-Zugriff) + context.ts
└── types/              # Type-Augmentations
prisma/
├── schema.prisma
├── seed.ts
└── migrations/
```

## Features

- Live-Timer + wöchentlicher Stundenzettel (7-Tage-Sperrfenster)
- Urlaub mit Genehmigungsworkflow + Resturlaubsanzeige
- Krankheit mit AU-Bescheinigung-Upload
- Feiertage (nager.date, NRW-Standard, manuelle Überschreibungen)
- Überstundenbilanz mit konfigurierbarem Übertrag
- Teamkalender (Wer ist abwesend?)
- Berichte (PDF/CSV/Excel)
- PWA (offline-fähig, Push-Benachrichtigungen)
- Verwaltung: Benutzer-CRUD, Arbeitszeitmodelle, Jahreseinstellungen

## Skripte

| Befehl                              | Beschreibung              |
| ----------------------------------- | ------------------------- |
| `npm run dev`                       | Dev-Server                |
| `npm run build`                     | Production-Build          |
| `npm run start`                     | Production-Server         |
| `npm run typecheck`                 | TypeScript prüfen         |
| `npm run lint`                      | ESLint                    |
| `npm run prisma:migrate`            | Migration erzeugen        |
| `npm run prisma:deploy`             | Migration anwenden (prod) |
| `npm run prisma:seed`               | Seed ausführen            |
| `npm run prisma:studio`             | Prisma Studio             |
| `npm test`                          | Vitest                    |
| `npm run test:e2e`                  | Playwright                |
| `npm run test:e2e -- --ui`          | Playwright interaktiv     |
| `npm run format`                    | Prettier (schreibt)       |
| `npm run format:check`              | Prettier (prüft)          |
| `dev-db start\|stop\|status\|reset` | Lokale Postgres-Instanz   |
| `bash scripts/backup-db.sh`         | DB-Backup erstellen       |
| `bash scripts/restore-db.sh <file>` | DB wiederherstellen       |

## Push-Benachrichtigungen (VAPID-Keys)

Web Push ermöglicht Benachrichtigungen auch bei geschlossenem Browser (Timer-Erinnerungen,
Urlaubs-Genehmigungen, Krankmeldungen). Dazu werden VAPID-Keys benötigt:

```bash
npx web-push generate-vapid-keys
```

Ausgabe in `.env` eintragen:

```env
PUSH_VAPID_PUBLIC_KEY="BBbb…"
PUSH_VAPID_PRIVATE_KEY="EEee…"
PUSH_VAPID_SUBJECT="mailto:admin@example.com"
NEXT_PUBLIC_PUSH_VAPID_PUBLIC_KEY="BBbb…"   # gleicher Wert wie PUBLIC
```

**Wenn keine Push-Benachrichtigungen gewünscht sind**, können die Keys leer bleiben.
Der Subscribe-Button im Benutzer-Menü wird dann ausgeblendet und der Push-Dienst
initialisiert sich nicht.

## Standard-Anmeldedaten (nach Seed)

- Email: `admin@puku.local`
- Passwort: `admin123`

## Produktion-Deployment

### Voraussetzungen

- Docker 24+ und Docker Compose v2
- Ein Server mit mindestens 1 GB RAM, 10 GB Festplatte
- Eine Domain mit DNS-Eintrag auf den Server
- (Optional) Reverse Proxy mit TLS (nginx, Caddy, Traefik)

### 1. Repository klonen

```bash
git clone <repo-url> /opt/puku
cd /opt/puku
```

### 2. `.env` konfigurieren

```bash
cp .env.example .env
# Alle Werte setzen, insbesondere:
#   NEXTAUTH_SECRET=$(openssl rand -base64 32)
#   DATABASE_URL=postgresql://puku:<sicheres-passwort>@db:5432/puku?schema=public
#   PUSH_VAPID_PUBLIC_KEY / PUSH_VAPID_PRIVATE_KEY (npx web-push generate-vapid-keys)
#   NEXT_PUBLIC_PUSH_VAPID_PUBLIC_KEY = gleicher Wert wie PUSH_VAPID_PUBLIC_KEY
#   CSRF_ALLOWED_ORIGINS="https://puku.example.com"
#   PUSH_VAPID_SUBJECT="mailto:admin@example.com"
```

### 3. Mit Docker Compose starten

```bash
docker compose up -d --build
```

Das `docker-entrypoint.sh` führt automatisch aus:

1. `prisma migrate deploy` (Migrationen anwenden)
2. Bedingtes Seeding (wenn die DB leer ist)
3. `next start` (Production-Server auf Port 3000)

### 4. Reverse Proxy (Beispiel: Caddy)

```Caddyfile
puku.example.com {
    reverse_proxy localhost:3000
}
```

Caddy stellt automatisch TLS-Zertifikate aus (Let's Encrypt).

### 5. Backups einrichten (Cron)

```bash
# /etc/cron.d/puku-backup
0 2 * * * root cd /opt/puku && DATABASE_URL="postgresql://puku:PASS@localhost:5433/puku" bash scripts/backup-db.sh >> /var/log/puku-backup.log 2>&1
```

- Backups landen in `/opt/puku/backups/`
- Standard-Aufbewahrung: 14 Tage (`BACKUP_RETENTION_DAYS`)
- **Verschlüsselt** mit OpenSSL AES-256-CBC + PBKDF2
- Wiederherstellung: `bash scripts/restore-db.sh backups/chronify-backup-YYYYMMDD-HHMMSS.sql.gz.enc`

#### Backup-Passphrase einrichten (einmalig)

```bash
# Starke Passphrase generieren
openssl rand -base64 32
# → In .env eintragen:
# BACKUP_ENCRYPTION_PASSPHRASE="K7m2Rf8sQ3hN1zB6vY4cW9pX2dL5jT0a"
```

### DSGVO / Datenschutz

#### Verschlüsselung

- **Backups**: OpenSSL AES-256-CBC + PBKDF2 (Passphrase in `.env`)
- **AU-Zertifikate**: AES-256-GCM Verschlüsselung at rest (Art. 9 DSGVO)
  - Schlüssel generieren: `openssl rand -hex 32`
  - In `.env`: `AU_CERT_ENCRYPTION_KEY="<hex-key>"`
  - Bestehende Dateien migrieren: `npm run migrate:au-encryption`

#### Datenlöschung (Retention)

Konfigurierbar über Admin-DSGVO-Seite (`/admin/gdpr`):

- Arbeitszeitdaten: 2 Jahre (ArbZG §16)
- Krankmeldungen: 12 Monate (Art. 9 DSGVO)
- Audit-Logs: 6 Monate

Automatische Löschung per Cron:

```bash
# /etc/cron.d/chronify-retention
0 3 * * 0 root docker exec chronify-app npm run retention:run >> /var/log/chronify-retention.log 2>&1
```

Dry-Run (zeigt was gelöscht würde, ohne zu löschen):

```bash
docker exec chronify-app npm run retention:dry-run
```

#### DSGVO-Export (Art. 15/20)

- Profil → "Meine Daten" → JSON-Export aller persönlichen Daten
- API: `GET /api/gdpr/export`

#### Mitarbeiter-Anonymisierung

Bei Mitarbeiteraustritt:

1. Mitarbeiter deaktivieren (Admin → Users)
2. Admin → DSGVO → Anonymisieren
3. Alle personenbezogenen Daten werden gelöscht (name, email, NFC-Karte, Passwort)
4. Arbeitszeitdaten bleiben anonymisiert erhalten (Statistik)

#### Datenschutz & Impressum

- `/privacy` — Datenschutzerklärung (öffentlich)
- `/imprint` — Impressum (öffentlich)
- Inhalt konfigurierbar über Admin → DSGVO → Einstellungen

### 6. Updates

```bash
cd /opt/puku
git pull
docker compose up -d --build
# Migrationen werden automatisch im Entry-point ausgeführt
```

### 7. Health-Check

```bash
curl http://localhost:3000/api/health
# → {"status":"ok"}
```

### Sicherheitshinweise

- **`NEXTAUTH_SECRET`** muss ein starkes, zufälliges Geheimnis sein.
- **`admin123`** (Standard-Seed-Passwort) nach dem ersten Login im Admin-Bereich ändern.
- **`CSRF_ALLOWED_ORIGINS`** in Produktion auf die echte Domain setzen.
- **Rate-Limiting**: Login-Versuche sind auf 10/Minute pro IP+Email begrenzt; Mutationen auf 60/Minute.
- **VAPID-Keys** nicht in das Repository committen (nur in `.env`).
- **Backups** verschlüsseln oder auf einen offsite-Speicherort kopieren.
