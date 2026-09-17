# Project overview

Close-up reference for `src/` layout, feature list and operational scripts.
General setup and operations live in [`initial-setup.md`](./initial-setup.md).

## Dev quickstart

All tooling comes from the Nix dev shell (Node 22, Prisma engines,
Playwright browsers, gh CLI, postgres tooling) — no global installs needed.

```bash
nix develop            # or: direnv allow
npm ci
dev-env-init           # .env from .env.example + generated secrets
dev-db start           # local PostgreSQL 16 in ./.dev-db (no Docker)
npm run db:setup       # migrate + seed
npm run dev            # http://localhost:3001
```

Quality gates: `npm run typecheck`, `npm run lint`, `npm test`,
`npm run build`, `npm run format:check`, `npm run test:e2e`
(the e2e run builds and serves a production server on :3100).

Agent-facing conventions live in [`../AGENTS.md`](../AGENTS.md).

## Layout

```
src/
├── app/[locale]/          # localised routes
│   ├── (app)/             # auth-protected pages (dashboard, timesheet, …)
│   │   └── admin/         # admin-only (users, settings, holidays, gdpr)
│   └── login/
├── app/api/               # API routes (auth, time-entries, notifications, …)
├── components/            # UI (shadcn primitives + domain components)
├── lib/                   # pure helpers (auth, db, overtime, datetime, …)
├── i18n/                  # next-intl routing + request config
├── messages/              # de.json, en.json (all user-facing strings)
├── server/                # domain services (all DB access) + context.ts
└── types/                 # type augmentations
prisma/
├── schema.prisma
├── seed.ts
└── migrations/
```

## Features

- Live timer + weekly timesheet (7-day lock window)
- Vacation with approval workflow + balance display
- Sickness reporting with AU certificate upload (encrypted at rest)
- Public holidays (nager.date, NRW default, manual overrides)
- Overtime balance with configurable carryover
- Team calendar ("who is off?")
- Reports (PDF / CSV / Excel), scheduled PDF export automation
- PWA (offline-capable, Web Push notifications)
- NFC kiosk for clocking in/out on the separate kiosk domain
- Admin: user CRUD, working models, year setup, business closures, GDPR

## Scripts

| Command                             | What                    |
| ----------------------------------- | ----------------------- |
| `npm run dev`                       | Dev server (:3001)      |
| `npm run build`                     | Production build        |
| `npm run start`                     | Production server       |
| `npm run typecheck`                 | TypeScript strict       |
| `npm run lint`                      | ESLint                  |
| `npm run prisma:migrate`            | Create a migration      |
| `npm run prisma:deploy`             | Apply migrations (prod) |
| `npm run prisma:seed`               | Run seed                |
| `npm run prisma:studio`             | Prisma Studio           |
| `npm test`                          | Vitest (unit)           |
| `npm run test:e2e`                  | Playwright (e2e, :3100) |
| `npm run test:e2e -- --ui`          | Playwright interactive  |
| `npm run format`                    | Prettier (write)        |
| `npm run format:check`              | Prettier (check)        |
| `dev-db start\|stop\|status\|reset` | Local Postgres cluster  |
| `bash scripts/backup-db.sh`         | Encrypted DB backup     |
| `bash scripts/restore-db.sh <file>` | Restore DB              |
| `bash scripts/first-install.sh`     | Interactive prod setup  |
| `npm run reports:run`               | One-shot report run     |
| `npm run retention:run`             | GDPR retention cleanup  |

## Web Push (VAPID keys)

Push works with a registered service worker and VAPID keys:

```bash
npx web-push generate-vapid-keys
```

Put them into `.env`:

```env
PUSH_VAPID_PUBLIC_KEY="BBbb…"
PUSH_VAPID_PRIVATE_KEY="EEee…"
PUSH_VAPID_SUBJECT="mailto:admin@example.com"
NEXT_PUBLIC_PUSH_VAPID_PUBLIC_KEY="BBbb…"   # same as PUBLIC
```

If push is not wanted, leave the keys empty — the subscribe button is hidden
and the push service stays idle.

## Default credentials (after seed)

- Email: `admin@puku.local`
- Password: `admin123` — change it on first sign-in (Profile → Password).
