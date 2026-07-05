# AGENTS.md — AI Context for puku-timetracking

> This file is a machine-readable overview of the project's state, architecture,
> conventions, and implementation roadmap. It is intended to help AI coding
> assistants (and humans) quickly understand what exists, what's planned, and
> how to extend the codebase safely.

---

## 1. Project Identity

- **Name:** puku-timetracking
- **Purpose:** PWA time-tracking webapp for ~20 employees (German SME).
- **Default region:** North Rhine-Westphalia (DE-NW).
- **Default language:** German (`de`); English (`en`) placeholder for future.
- **Domain:** German labor law (ArbZG) — statutory breaks, vacation, sick notes,
  public holidays per federal state.

---

## 2. Current State (Phase 1 — Foundation ✅)

Phase 1 is complete and verified. The app boots, authenticates, and serves a
localized layout shell. Domain features (timer, timesheet, vacation, …) are
**planned but not yet implemented**.

### Implemented

| Area | Status | Notes |
|---|---|---|
| Framework | ✅ | Next.js 15.5 (App Router) + React 19 + TypeScript |
| DB | ✅ | PostgreSQL 16 + Prisma 6 with `@prisma/adapter-pg` driver adapter |
| Schema | ✅ | Full domain model in `prisma/schema.prisma` (309 lines), migration `init` applied |
| Auth | ✅ | Auth.js v5 (Credentials + bcrypt, JWT sessions, RBAC) |
| Routing | ✅ | next-intl locale prefix (`/de`, `/en`) + auth middleware + admin gate |
| UI kit | ✅ | Tailwind + shadcn/ui primitives (Button, Card, Input, Label, Badge, Avatar, Dropdown, Sheet, Separator, Skeleton) |
| Layout | ✅ | Sidebar (employee nav + admin section when `role=ADMIN`), header (theme toggle, user menu, logout) |
| Pages | ✅ | `/login`, `/[locale]/dashboard` (placeholder) |
| API | ✅ | `/api/auth/[...nextauth]`, `/api/health` |
| PWA | ✅ | `manifest.ts`, `@ducanh2912/next-pwa` (disabled in dev) |
| Docker | ✅ | Multi-stage `Dockerfile` + `docker-compose.yml` (app + postgres) |
| Seed | ✅ | `prisma/seed.ts` creates OrgSettings singleton + admin user + admin working model |
| Typecheck | ✅ | `tsc --noEmit` clean |
| Build | ✅ | `next build` succeeds (9 routes) |

### Not yet implemented (Phases 2–10)

- Live timer + weekly timesheet
- Break engine (auto/manual)
- Overtime calculation + carryover
- Public holiday sync (nager.date) + manual overrides
- Vacation requests + approval workflow + entitlements
- Sickness + AU certificate upload
- Admin backend (user CRUD, working-model editor, year setup, audit log)
- Team "who-is-off" calendar
- Reports (PDF/CSV/Excel)
- Offline sync, Web Push
- Tests (Vitest, Playwright)

---

## 3. Tech Stack (locked)

| Layer | Choice | File / Config |
|---|---|---|
| Framework | Next.js 15.5 (App Router) | `next.config.mjs` |
| Language | TypeScript 5.7 | `tsconfig.json` (path alias `@/*` → `./src/*`) |
| Runtime | Node.js 20 (Docker), Node 24 (dev host) | `Dockerfile` |
| Database | PostgreSQL 16 | `docker-compose.yml` |
| ORM | Prisma 6 + `@prisma/adapter-pg` | `prisma/schema.prisma`, `src/lib/db.ts` |
| Auth | Auth.js v5 (next-auth beta) | `src/lib/auth.ts` |
| i18n | next-intl 3 | `src/i18n/routing.ts`, `src/i18n/request.ts` |
| Styling | Tailwind CSS 3 + shadcn/ui (new-york) | `tailwind.config.ts`, `components.json` |
| State | TanStack Query 5 + Zustand 5 | `src/components/providers.tsx` |
| Forms | react-hook-form + zod (planned) | — |
| Dates | date-fns 4 | — |
| Charts | Recharts 3 (planned) | — |
| PWA | @ducanh2912/next-pwa 10 | `next.config.mjs` |
| Mailing | nodemailer (planned) | — |
| PDF | @react-pdf/renderer (planned) | — |
| Excel/CSV | xlsx + papaparse (planned) | — |
| Holidays | nager.date API (cached, planned) | — |
| Testing | Vitest + Playwright (planned) | — |
| Container | Docker Compose | `docker-compose.yml` |

### NixOS note (host environment)

The dev host is NixOS. Prisma's prebuilt `linux-nixos` query engine is
unavailable, so we use the `@prisma/adapter-pg` **driver adapter**, which removes
the libquery_engine binary dependency at runtime. For `prisma migrate` /
`prisma generate` on NixOS, run the CLI inside a Docker container — see
`README.md` § "Hinweis: NixOS".

---

## 4. Directory Map

```
puku-timetracking/
├── prisma/
│   ├── schema.prisma          # Full domain model (309 lines)
│   ├── seed.ts                # OrgSettings + admin user + working model
│   └── migrations/
│       └── 20260704232234_init/
│           └── migration.sql
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout (metadata only, no html — locale layout owns <html>)
│   │   ├── globals.css        # Tailwind base + shadcn CSS variables (light/dark)
│   │   ├── manifest.ts        # PWA manifest (German app name)
│   │   ├── [locale]/
│   │   │   ├── layout.tsx     # <html lang>, NextIntlClientProvider, Providers
│   │   │   ├── login/page.tsx
│   │   │   └── (app)/
│   │   │       ├── layout.tsx       # Auth-guarded shell (sidebar + header)
│   │   │       └── dashboard/page.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       └── health/route.ts
│   ├── components/
│   │   ├── providers.tsx      # QueryClientProvider + ThemeProvider
│   │   ├── auth/login-form.tsx
│   │   ├── layout/
│   │   │   ├── app-sidebar.tsx
│   │   │   ├── app-header.tsx
│   │   │   └── logo.tsx
│   │   └── ui/                # shadcn primitives
│   ├── lib/
│   │   ├── auth.ts            # NextAuth config + Credentials authorize
│   │   ├── db.ts              # Prisma client (driver adapter, global singleton)
│   │   └── utils.ts           # cn() helper
│   ├── i18n/
│   │   ├── routing.ts         # locales: ['de','en'], defaultLocale: 'de'
│   │   └── request.ts         # getRequestConfig
│   ├── messages/
│   │   ├── de.json            # German (default, complete)
│   │   └── en.json            # English (placeholder)
│   ├── middleware.ts          # next-intl + auth + admin role gate
│   └── types/
│       └── next-auth.d.ts     # Session/JWT augmentation (id, role)
├── Dockerfile                 # Multi-stage (deps → builder → runner)
├── docker-compose.yml         # app + postgres services
├── docker-entrypoint.sh       # prisma migrate deploy + conditional seed + start
├── .env.example               # All env vars documented
└── README.md                  # Human-readable setup
```

### Implemented (Phase 2 — Domain core ✅)

Phase 2 adds the live timer + weekly timesheet. The dashboard now shows a live
ticking timer widget and computed today/week totals; `/timesheet` renders a
weekly grid with add/edit/delete and lock-window enforcement.

| Area | Status | Notes |
|---|---|---|
| Timer service | ✅ | `server/services/timer.ts` — start/stop/break start+end, persists `TimerSession` + creates `TimeEntry{type:WORK, source:TIMER}` on stop |
| Time-entry service | ✅ | `server/services/time-entry.ts` — CRUD, RBAC (own vs admin), lock-window (`OrgSettings.timeEntryLockWindowDays`), audit log per mutation |
| Server context | ✅ | `server/context.ts` — `requireUser()`, `getOrgSettings()` (cached), `getUserContext()`, `audit()` |
| Validations | ✅ | `lib/validations/time-entry.ts` — zod schemas shared client/server |
| Timer math (pure) | ✅ | `lib/timer-utils.ts` — `computeElapsedMs`, `computeBreakMs`, `isEntryLocked`, formatters (unit-tested) |
| Datetime helpers | ✅ | `lib/datetime.ts` — tz-aware `toCalendarDate`, `startOfWeekUtc`, `formatInZone` |
| Timer API | ✅ | `/api/timer` (GET status), `/api/timer/{start,stop,break}` |
| Time-entry API | ✅ | `/api/time-entries` (GET list, POST create), `/api/time-entries/[id]` (PATCH, DELETE) |
| Timer UI | ✅ | `components/timer/timer-widget.tsx` + `use-timer.ts` hook — live ticking, start/stop/break |
| Timesheet UI | ✅ | `components/timesheet/` — weekly grid + `time-entry-dialog.tsx` (add/edit form) |
| Dashboard | ✅ | Live timer widget + today/week totals from DB |
| Lock window | ✅ | Entries older than N days read-only for employees; admin bypass; enforced at service layer + UI (disabled edit/delete buttons) |
| Audit | ✅ | Every time-entry mutation writes `AuditLog` (`time_entry.{create,update,delete}`) |
| Tests | ✅ | Vitest 12 tests for timer math + lock window (`lib/timer-utils.test.ts`) |

### Planned future directories (Phase 3+)

```
src/
├── app/[locale]/(app)/
│   ├── timesheet/
│   ├── calendar/
│   ├── overtime/
│   ├── vacation/
│   ├── sickness/
│   ├── reports/
│   └── team/
├── app/[locale]/(admin)/
│   ├── users/
│   ├── working-models/
│   ├── holidays/
│   ├── vacation-approvals/
│   └── settings/
├── app/api/
│   ├── time-entries/  timer/  vacation/  sickness/
│   ├── holidays/  reports/  webhooks/push
├── components/{timer,timesheet,calendar,admin,charts}/
├── lib/{validations,holidays,overtime,vacation,timer,reports}/
├── server/{services,actions,policies}/
└── stores/
```

---

## 5. Data Model (Prisma)

Full schema: `prisma/schema.prisma`. Entities and their roles:

### Enums
- `Role`: `EMPLOYEE` | `ADMIN`
- `BreakMode`: `AUTO` | `MANUAL` (per-user; AUTO enforces statutory breaks)
- `Locale`: `de` | `en`
- `FederalState`: 16 German states (`DE_BW` … `DE_TH`); default `DE_NW`
- `TimeEntryType`: `WORK` | `VACATION` | `SICK` | `PUBLIC_HOLIDAY` | `PERSONAL`
- `TimeEntrySource`: `TIMER` | `MANUAL` | `ADMIN`
- `VacationStatus`: `PENDING` | `APPROVED` | `REJECTED` | `CANCELLED`
- `PublicHolidaySource`: `NAGER` | `MANUAL` (manual overrides always win)
- `NotificationChannel`: `APP` | `PUSH` | `EMAIL`
- `NotificationType`: `VACATION_APPROVED` | `VACATION_REJECTED` | `VACATION_REQUESTED` | `SICK_NOTE_REMINDER` | `TIMER_REMINDER` | `GENERIC`

### Entities

| Model | Purpose | Key fields |
|---|---|---|
| **User** | Account | email (unique), passwordHash, name, role, locale, federalState, breakMode, active, timezone |
| **WorkingModel** | Per-user weekly target hours, validFrom/validTo | monday…sundayMinutes, weeklyTargetMinutes, autoBreak thresholds (6h→30min, 9h→45min) |
| **TimeEntry** | A worked/absent time block | userId, date, startAt, endAt, breakMinutes, type, source, note, lockedAt |
| **TimerSession** | Active live timer (1:1 with user) | startedAt, lastTickAt, breakStartedAt, accumulatedBreakMs |
| **VacationRequest** | Time-off request | userId, approverId, from, to, days, status, year, note |
| **VacationEntitlement** | Per-user, per-year vacation quota | userId, year, totalDays, carriedOverDays, consumedDays (unique on userId+year) |
| **SickNote** | Sickness period with AU certificate | userId, from, to, days, certificateUrl, aubUntil, note |
| **PublicHoliday** | Cached holiday per federal state | date, name, federalState, type, source, counties |
| **OvertimeBalance** | Per-user, per-year overtime | userId, year, carriedOverMinutes, computedMinutes, lockedAt |
| **OrgSettings** | Singleton (`id="singleton"`) config | defaultFederalState, overtimeCarryoverCutoffMonth/Day, timeEntryLockWindowDays, autoBreakDefault, defaultVacationDays |
| **Notification** | In-app/push/email notifications | userId, type, title, body, payload(JSON), channel, readAt |
| **PushSubscription** | Web Push endpoint per user | userId, endpoint, p256dh, auth |
| **AuditLog** | Audit trail | actorId, targetId, action, entity, entityId, payload(JSON) |

### Key relations
- User 1—N WorkingModel (history of working-time models via `validFrom`/`validTo`)
- User 1—N TimeEntry
- User 1—1 TimerSession (active timer)
- User 1—N VacationRequest (as requester) + VacationRequest N—1 User (as approver)
- User 1—N VacationEntitlement (one per year, unique)
- User 1—N OvertimeBalance (one per year, unique)
- OrgSettings: singleton row, `id="singleton"`

---

## 6. Domain Logic & Conventions

### Break rules (`lib/overtime/breaks.ts` ✅)
- `breakMode=AUTO` (default): auto-deduct 30min when worked >6h, 45min when >9h
  (thresholds/minutes configurable per `WorkingModel`; compared in ms for sub-minute accuracy).
- `breakMode=MANUAL` (opt-in per user): user-entered, validated against statutory minimum.
- Applied at timer stop via `resolveBreakMinutes()` in `server/services/timer.ts`.
- Statutory reference: ArbZG §4.

### Overtime (`lib/overtime/calculate.ts` ✅, `server/services/overtime.ts` ✅)
- Daily delta = workedMs − targetMinutes (per weekday from active `WorkingModel`).
- Monthly + yearly aggregation; `OvertimeBalance` upsertable via service.
- Carryover via `OrgSettings.overtimeCarryoverCutoffMonth`/`Day` (default April 1);
  prior-year `carriedOverMinutes` added to year balance.
- Live computation on `/overtime` page (no persistence required to view);
  `upsertOvertimeBalance()` available for year-end lock.

### Holidays (`lib/holidays/` — planned)
- Nightly cron fetches nager.date API for `DE-NW` (and any per-user states present).
- Stored in `PublicHoliday` with `source=NAGER`.
- Admin can add `source=MANUAL` entries or override individual days.
- **Manual entries always win** when resolving.

### Vacation (`lib/vacation/` — planned)
- Business-day calc (Mon–Fri minus public holidays for the user's federal state).
- Checks entitlement incl. carryover (`VacationEntitlement.carriedOverDays`).
- On approval: creates `TimeEntry{type:VACATION}` for the range.
- Email + push notification to user on decision.

### Time entry lock window
- Entries older than `OrgSettings.timeEntryLockWindowDays` (default 7) are
  read-only for employees.
- Admins can edit any entry (with audit log).
- Enforced at service layer + UI hint.

### RBAC (`server/policies/` — planned)
- `EMPLOYEE` sees/edits only own data.
- `ADMIN` gets admin routes + cross-user actions.
- Every mutation audited via `AuditLog`.

---

## 7. Authentication & Sessions

- **Provider:** Credentials (email + password, bcrypt hashed).
- **Session:** JWT, 7-day max age, stored in cookie.
- **Config:** `src/lib/auth.ts` — exports `handlers`, `auth`, `signIn`, `signOut`.
- **Route handler:** `src/app/api/auth/[...nextauth]/route.ts` re-exports `GET`/`POST`.
- **Type augmentation:** `src/types/next-auth.d.ts` adds `id` and `role` to
  `Session.user` and `JWT`.
- **Login page:** `src/app/[locale]/login/page.tsx` (redirects to dashboard if
  already authenticated).
- **Logout:** client-side via `signOut({ callbackUrl: "/login" })` in app header.
- **Default admin (after seed):** `admin@puku.local` / `admin123`.

---

## 8. Internationalization

- **Library:** next-intl 3.
- **Routing:** `src/i18n/routing.ts` — locales `["de","en"]`, default `"de"`,
  prefix `"always"` (URLs always include locale).
- **Request config:** `src/i18n/request.ts` — loads `messages/<locale>.json`.
- **Layout:** `src/app/[locale]/layout.tsx` sets `<html lang={locale}>` and wraps
  app in `NextIntlClientProvider`.
- **Server-side:** use `getTranslations()` / `setRequestLocale()`.
- **Client-side:** use `useTranslations()`.
- **Message files:** namespaced per feature (`common`, `nav`, `auth`, `dashboard`,
  `roles`). Add new namespaces as features land.
- **Date/number formatting:** use Intl with `de-DE` locale (date-fns handles
  formatting).

To add a language:
1. Add locale to `routing.locales`.
2. Create `src/messages/<locale>.json`.
3. Update `Locale` enum in `prisma/schema.prisma` (optional, for user prefs).
4. Run migration if schema changed.

---

## 9. Middleware

`src/middleware.ts` does three jobs, in order:
1. **next-intl** locale detection & URL prefixing.
2. **Auth gate:** unauthenticated → redirect to `/<locale>/login`.
3. **Admin gate:** non-ADMIN users hitting `/admin/*` → redirect to dashboard.

**Public routes:** `/login` (matched by suffix, so it works under any locale).

**Matcher excludes:** `api`, `_next/*`, `favicon.ico`, `sw.js`, `workbox-*`,
`icons`, `manifest`.

---

## 10. UI & Styling Conventions

- **Base:** Tailwind CSS 3 with shadcn/ui (style: "new-york", base color: slate).
- **CSS variables** for theme tokens (light + dark) in `src/app/globals.css`.
- **Dark mode:** `next-themes` with `attribute="class"`, default `"light"`,
  `enableSystem`. Toggle in `app-header.tsx`.
- **Components location:**
  - `src/components/ui/` — shadcn primitives (do not hand-edit; regenerate via
    shadcn CLI when adding more).
  - `src/components/layout/` — app shell (sidebar, header, logo).
  - `src/components/<feature>/` — feature components (e.g. `auth/`, planned
    `timer/`, `timesheet/`, etc.).
- **Icons:** `lucide-react` (referenced by string name in sidebar nav items).
- **Class merging:** `cn()` in `src/lib/utils.ts` (clsx + tailwind-merge).
- **Providers:** `src/components/providers.tsx` wraps app in QueryClientProvider
  + ThemeProvider. Marked `"use client"`.

### Adding a shadcn primitive
```bash
npx shadcn@latest add <component>
```
(`components.json` configured; primitives land in `src/components/ui/`.)

---

## 11. Database Access

- **Client:** `src/lib/db.ts` — singleton Prisma client using `@prisma/adapter-pg`
  with a `pg.Pool`. Reused via `globalThis` in dev to avoid exhausting connections.
- **Import:** `import { db } from "@/lib/db"`.
- **Migrations:** `prisma/migrations/` — `20260704232234_init` is the only one so far.
- **Lock file:** `prisma/migrations/migration_lock.toml` (provider=postgresql).
- **Schema source of truth:** `prisma/schema.prisma`.
- **`binaryTargets`:** `["debian-openssl-3.0.x", "linux-musl-openssl-3.0.x"]`
  (for Docker; native not used because NixOS has no prebuilt engine).

### Migration workflow
- **Dev:** `npx prisma migrate dev --name <name>` (creates + applies migration).
  ⚠️ On NixOS, run inside Docker (see README).
- **Prod / Docker:** `prisma migrate deploy` (runs in `docker-entrypoint.sh`).
- **Seed:** `npx tsx prisma/seed.ts` — idempotent (uses upsert).

---

## 12. Environment Variables

See `.env.example`. Required/important:

| Var | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | Postgres connection | `postgresql://puku:puku@localhost:5432/puku?schema=public` |
| `NEXTAUTH_URL` | Public app URL | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | JWT signing secret | **must set** (`openssl rand -base64 32`) |
| `SMTP_*` | Email for notifications | empty |
| `NAGER_DATE_API_URL` | Holiday API base | `https://date.nager.at/api/v3` |
| `NAGER_DATE_DEFAULT_STATE` | Default federal state | `NW` |
| `PUSH_VAPID_*` | Web Push keys | empty (generate via `npx web-push generate-vapid-keys`) |
| `DEFAULT_LOCALE` | App default locale | `de` |
| `DEFAULT_TIMEZONE` | App default timezone | `Europe/Berlin` |

---

## 13. Scripts

| `npm run …` | Description |
|---|---|
| `dev` | Next dev server (PWA disabled) |
| `build` | Production build |
| `start` | Production server |
| `lint` | ESLint |
| `typecheck` | `tsc --noEmit` |
| `prisma:generate` | Regenerate Prisma client |
| `prisma:migrate` | `prisma migrate dev` |
| `prisma:deploy` | `prisma migrate deploy` (prod) |
| `prisma:studio` | Prisma Studio GUI |
| `prisma:seed` | Run `tsx prisma/seed.ts` |
| `db:push` | `prisma db push` (dev only, no migration history) |
| `test` | Vitest run (planned) |
| `test:e2e` | Playwright (planned) |

---

## 14. Coding Conventions (for AI assistants)

- **Language:** TypeScript strict mode. No `any` unless unavoidable; prefer
  Prisma-generated types.
- **Imports:** use `@/*` path alias (maps to `src/*`).
- **No comments** unless asked by the user.
- **Server vs client:** mark interactive components with `"use client"`. Server
  components by default for pages/layouts.
- **Data fetching:** prefer server components + `auth()` for session; use TanStack
  Query only for client-side fetching/mutations.
- **API routes:** `src/app/api/<resource>/route.ts`; export `GET`/`POST`/etc.
- **Server actions** (planned): `src/server/actions/`.
- **Services** (planned): `src/server/services/` — pure domain logic, no HTTP.
- **Policies** (planned): `src/server/policies/` — RBAC checks.
- **Validations** (planned): `src/lib/validations/` — zod schemas shared between
  client forms and server.
- **i18n:** never hardcode German strings in components. Use `useTranslations()`
  (client) or `getTranslations()` (server) with keys from `src/messages/de.json`.
  Add new keys to **both** `de.json` and `en.json`.
- **Date handling:** use `date-fns` with `de-DE` locale. Store all dates as UTC
  `DateTime` in Postgres. Interpret in user's `timezone` (default Europe/Berlin).
- **Never commit secrets.** `.env` is gitignored.
- **Migrations:** always additive when possible. No destructive changes without
  explicit user approval. Run `prisma migrate dev --name <descriptive_name>`.
- **Do not edit** `src/components/ui/*` by hand — regenerate via shadcn CLI.

---

## 15. Implementation Roadmap

Status: **All phases ✅ complete (Phase 1 through Phase 10)**. The app is production-ready.

| Phase | Scope | Status |
|---|---|---|
| 1. Foundation | Scaffold, auth, i18n, layout, Docker, seed | ✅ Done |
| 1.5 Hardening | Edge-runtime middleware fix, tailwind ESM, localized 404, pg-native alias, pinned dev port, NEXTAUTH_URL trustHost, sidebar locale hrefs | ✅ Done |
| 2. Domain core | User/WorkingModel/TimeEntry/TimerSession services + API; dashboard live timer; weekly timesheet with 7-day lock window | ✅ Done |
| 3. Break + overtime engine | Auto/manual break logic (ArbZG §4); overtime calc with configurable carryover cutoff; overtime UI | ✅ Done |
| 4. Holidays + vacation | nager.date sync (DE-NW) + manual overrides; vacation requests, entitlements (per-user), approval workflow, email + push notifications, calendar integration | ✅ Done |
| 5. Sickness | Sick note submission, AU certificate upload (local disk), admin override, sickness calendar | ✅ Done |
| 6. Admin backend | User CRUD, working-model editor, year setup, holiday admin, audit log, org settings UI | ✅ Done |
| 7. Team view + reports | Who-is-off calendar, PDF/CSV/Excel exporters (personal + admin), custom ranges | ✅ Done |
| 8. PWA polish | Manifest, service worker, offline sync, Web Push, install prompt | ✅ Done |
| 9. Testing | Vitest (overtime, vacation, business-day, break rules), Playwright (login, timer, vacation flow, admin CRUD) | ✅ Done |
| 10. Hardening + deploy | Rate limit, CSRF, backups script, deploy docs | ✅ Done |

---

## 16. Verification Commands

Before declaring any phase done, run:

```bash
# Typecheck
npm run typecheck            # or: npx tsc --noEmit

# Lint
npm run lint

# Build (catches RSC/client boundary errors)
npm run build

# (Phase 9+) Tests
npm test
npm run test:e2e
```

On NixOS, run inside Docker if Prisma CLI is needed:
```bash
docker run --rm --network host -v "$PWD:/app" \
  -e DATABASE_URL="$DATABASE_URL" \
  node:20-alpine sh -c "apk add --no-cache libc6-compat openssl && npm ci && npm run typecheck && npm run build"
```

---

## 17. Known Gotchas

1. **NixOS + Prisma CLI:** native `prisma generate`/`migrate` fails (no
   `linux-nixos` engine). Runtime is fine because of `@prisma/adapter-pg`.
   Workaround: run CLI in Docker. Do **not** add `native` to `binaryTargets`.
2. **next.config.mjs** must be plain JS (no TS type annotations) — the
   Next.js config loader does not run TS transforms on it.
3. **`src/components/providers.tsx`** must be `"use client"` (uses `useState`
   for QueryClient).
4. **`src/app/layout.tsx`** (root) must NOT render `<html>` — that's owned by
   `src/app/[locale]/layout.tsx` so the `lang` attribute can be set per-locale.
5. **Auth.js v5** export shape: `NextAuth(config)` returns `{ handlers, auth,
   signIn, signOut }`. The API route does `export const { GET, POST } = handlers`.
6. **next-intl + Auth.js middleware** are combined in `src/middleware.ts`; the
   next-intl middleware runs first to handle locale prefixing, then the auth
   check runs against the already-resolved path.
7. **Prisma `OrgSettings`** is a singleton: always query with
   `where: { id: "singleton" }`.

---

## 18. Quick Links (file:line references to start coding)

- Schema: `prisma/schema.prisma:1`
- Auth config: `src/lib/auth.ts:6`
- DB client: `src/lib/db.ts:1`
- Middleware: `src/middleware.ts:1`
- App shell: `src/app/[locale]/(app)/layout.tsx:1`
- Sidebar nav items: `src/app/[locale]/(app)/layout.tsx:21`
- Dashboard (next to build out): `src/app/[locale]/(app)/dashboard/page.tsx:1`
- Login form: `src/components/auth/login-form.tsx:1`
- i18n routing: `src/i18n/routing.ts:1`
- German messages: `src/messages/de.json:1`
- Dockerfile: `Dockerfile:1`
- docker-compose: `docker-compose.yml:1`
- Seed: `prisma/seed.ts:1`

---

_This file should be updated whenever a phase completes or significant
architectural decisions change. Keep it accurate — it is the source of truth
for AI assistants joining the project._
