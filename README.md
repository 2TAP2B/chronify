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

### Lokale Entwicklung

```bash
# Postgres starten
docker run -d --name puku-db -e POSTGRES_USER=puku -e POSTGRES_PASSWORD=puku -e POSTGRES_DB=puku -p 5432:5432 postgres:16-alpine

# Env anlegen
cp .env.example .env
# DATABASE_URL="postgresql://puku:puku@localhost:5432/puku?schema=public"

# Abhängigkeiten
npm install

# Prisma (Hinweis für NixOS: prisma CLI in Docker ausführen, siehe unten)
npx prisma migrate dev
npx tsx prisma/seed.ts

# Dev-Server
npm run dev
```

### Hinweis: NixOS

Auf NixOS fehlen Prisma die vorgefertigten Engine-Binaries für `linux-nixos`.
Die App läuft dank `@prisma/adapter-pg` (driver adapter) zur Laufzeit ohne
Query-Engine-Binary. Für `prisma migrate`/`prisma generate` empfiehlt sich die
Ausführung in Docker:

```bash
docker build -f Dockerfile -t puku-helper .
# oder mit einem temporären Image:
docker run --rm --network host -v "$PWD:/app" \
  -e DATABASE_URL="postgresql://puku:puku@localhost:5432/puku?schema=public" \
  node:20-alpine sh -c "apk add --no-cache libc6-compat openssl && npm ci && npx prisma migrate dev"
```

## Projektstruktur

```
src/
├── app/[locale]/       # lokalisierte Routen
│   ├── (app)/          # auth-geschützt (Dashboard, Stundenzettel, …)
│   ├── (admin)/        # admin-only (folgt)
│   └── login/
├── app/api/            # API-Routen (auth, health, …)
├── components/         # UI (shadcn primitives + eigene)
├── lib/                # auth, db, utils
├── i18n/               # next-intl routing + request config
├── messages/           # de.json, en.json
└── types/              # Type-Augmentations
prisma/
├── schema.prisma
├── seed.ts
└── migrations/
```

## Features (v1-Plan)

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

| Befehl | Beschreibung |
|---|---|
| `npm run dev` | Dev-Server |
| `npm run build` | Production-Build |
| `npm run start` | Production-Server |
| `npm run typecheck` | TypeScript prüfen |
| `npm run lint` | ESLint |
| `npm run prisma:migrate` | Migration erzeugen |
| `npm run prisma:deploy` | Migration anwenden (prod) |
| `npm run prisma:seed` | Seed ausführen |
| `npm run prisma:studio` | Prisma Studio |
| `npm test` | Vitest |
| `npm run test:e2e` | Playwright |

## Standard-Anmeldedaten (nach Seed)

- Email: `admin@puku.local`
- Passwort: `admin123`
