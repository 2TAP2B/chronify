# AGENTS.md — Chronify (puku-timetracking)

Operational contract for AI agents working in this repo. Read this first; it is
the source of truth for commands, conventions, and definition of done.

## 1. Project overview

Chronify is a PWA time-tracking webapp for a German SME (~20 employees):
live timer, weekly timesheet, breaks per ArbZG §4, overtime balances, vacation
workflow, sickness/AU certificates, admin backend, GDPR tooling, reports, PWA.
German is the default locale (`de`), English (`en`) is a placeholder.
Production runs as a Docker image; this repo is also the dev environment.

## 2. Tech stack

| Layer        | Choice                                                                          |
| ------------ | ------------------------------------------------------------------------------- |
| Framework    | Next.js 15.5 (App Router) + React 19 + TypeScript 5.7 (strict)                  |
| Runtime / PM | Node.js 22 + npm (`package-lock.json` is authoritative)                         |
| DB           | PostgreSQL 16 + Prisma 6 with `@prisma/adapter-pg` (driver adapter)             |
| Auth         | Auth.js v5 (Credentials/bcrypt + OIDC), JWT sessions, RBAC (`EMPLOYEE`/`ADMIN`) |
| UI           | Tailwind CSS 3 + shadcn/ui ("new-york") + lucide-react                          |
| i18n         | next-intl 3, locale-prefixed routes (`/de`, `/en`)                              |
| State        | TanStack Query 5 + Zustand 5                                                    |
| Tests        | Vitest 3 (unit, `src/**/*.test.ts`) + Playwright (e2e, `e2e/`)                  |
| Dev env      | Nix flake (`flake.nix`) + direnv, local PostgreSQL via `dev-db`                 |

## 3. Commands

All tooling comes from the Nix dev shell — never assume global installs.

```bash
nix develop            # enter the dev shell (or: direnv allow, then cd)
npm ci                 # install dependencies (package-lock.json)
dev-env-init           # create .env from .env.example, generate secrets
dev-db start           # local PostgreSQL 16 cluster in ./.dev-db (no Docker)
npm run db:setup       # prisma migrate deploy + seed (must run after dev-db start)
npm run dev            # dev server on :3001 (seeded login: admin@puku.local / admin123 at /de/login)
```

Quality gates (run all of these before declaring work done):

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # next lint (existing <img> warnings are acceptable)
npm test               # vitest run (unit tests, no DB required)
npm run build          # next build (catches RSC/client-boundary errors)
npm run format:check   # prettier --check .   (fix with: npm run format)
npm run test:e2e       # playwright: builds + starts a prod server on :3100
```

`dev-db` subcommands: `start` (idempotent), `stop`, `status`, `psql`, `reset`;
`reset` wipes the cluster — re-run `dev-db start && npm run db:setup` afterwards.
`test:e2e` needs a running, seeded DB (`dev-db start && npm run db:setup`). It
builds and serves its own production server on port 3100 (override with `PORT`)
and never reuses a server already running, so a dev server can't leak into the
specs; stop `npm run dev` while it runs (both write `.next`). Set
`E2E_BASE_URL=http://…` to test an already-running deployment instead (skips the
build/serve step).

Other useful scripts: `npm run prisma:studio`, `npm run prisma:migrate`,
`npm run db:push` (dev only), `npm run retention:dry-run`,
`npm run migrate:au-encryption`, `bash scripts/backup-db.sh`.

## 4. Layout & where code goes

```
src/app/[locale]/(app)/…      authenticated pages (dashboard, timesheet, vacation, …)
src/app/[locale]/(app)/admin/ admin-only pages (users, settings, holidays, gdpr)
src/app/api/<resource>/route.ts  thin route handlers: auth + zod + service call
src/components/<feature>/     feature UI ("use client" where interactive)
src/components/ui/            vendored shadcn primitives — see §6
src/lib/                      pure helpers (overtime, vacation, holidays, datetime, arbzg)
src/lib/validations/          zod schemas shared by client and server
src/server/services/          domain logic, all DB access, no HTTP concerns
src/server/context.ts         requireUser(), getUserContext(), getOrgSettings(), audit()
src/stores/                   Zustand stores; src/messages/{de,en}.json = translations
prisma/schema.prisma          data model; prisma/migrations/ is append-only
e2e/                          Playwright specs + fixtures (login, timer, vacation, admin)
```

## 5. Conventions

- **Imports:** always the `@/*` alias (`@/lib/db`, `@/server/services/...`).
- **Server vs client:** server components by default; add `"use client"` only for
  interactivity. Data access stays in `src/server/services/` — never call Prisma
  from a client component.
- **Route handlers:** validate input with a `src/lib/validations/*` zod schema,
  resolve the actor via `requireUser()`, delegate to a service, write an
  `AuditLog` entry for mutations.
- **Types:** no `any`; prefer Prisma-generated types. Keep `strict` clean.
- **Dates:** store UTC `DateTime`; interpret in the user's timezone with helpers
  from `@/lib/datetime` (`toCalendarDate`, `formatInZone`, `zonedTimeToUtc`).
  Never use the host timezone implicitly — tests must pass under any `TZ`.
- **i18n:** no hardcoded user-facing strings. Add keys to **both** `de.json` and
  `en.json`; use `useTranslations()` (client) / `getTranslations()` (server).
- **Styling:** Tailwind utilities + `cn()`; theme tokens from CSS variables.
- **Migrations:** additive by default (`npm run prisma:migrate -- --name <name>`);
  never rewrite an applied migration; destructive changes need human approval.
- **Tests:** Vitest for pure logic (`src/lib/**`), Playwright for user flows.
  E2E specs must be deterministic: clean up seeded state in `e2e/global-setup.ts`,
  and prefer accessible role/name locators over CSS selectors.

## 6. Generated & vendored files

- `src/components/ui/**` — shadcn primitives. Do not hand-edit; add/refresh with
  `npx shadcn@latest add <component>` and then run `npm run format`.
- `node_modules/@prisma/client`, `.next/`, `public/sw.js`, `public/workbox-*.js` —
  generated by `prisma generate` / `next build`. Never edit.
- Prettier owns formatting: run `npm run format` on files you touch; never
  hand-align or reflow code for style reasons.

## 7. Security boundaries

- Secrets live only in `.env` (gitignored; template in `.env.example`):
  `NEXTAUTH_SECRET`, `AU_CERT_ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_PASSPHRASE`,
  SMTP, VAPID, OIDC. Never commit or print real values; never commit `.env`.
- GDPR-relevant (Art. 9) data: sickness records and AU certificates, plus
  encryption (`src/lib/file-crypto.ts`) and retention
  (`scripts/retention-cleanup.ts`) — changes there need human review.
- Auth/session (`src/lib/auth.ts`, `src/middleware.ts`), CSRF (`src/lib/csrf.ts`),
  rate limiting (`src/lib/rate-limit.ts`), RBAC checks in services, backups, and
  anything touching `AuditLog` require human review.
- Do not weaken or remove existing security controls (`checkMaxDailyHours`, lock
  windows, admin gates) to make a test pass — fix the code, or report it.

## 8. Definition of done

A task is done only when all of the following hold:

1. `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all pass.
2. `npm run format:check` passes for touched files.
3. Behaviour was exercised for real: unit test, e2e spec, or a manual run of the
   affected flow (`npm run dev` + browser) — not just "it compiles".
4. Schema changes ship with a migration and a `prisma generate` run.
5. User-facing text exists in `de.json` **and** `en.json`.
6. Existing callers of changed exports were found and updated (use
   `tsc`, `lsp references`, or a repo-wide search — no leftover dead paths).

## 9. Verification & subagent quality pass

1. Self-verification: run the gates in §8 and state the exact commands and results.
2. Quality pass: before yielding non-trivial work, spawn one subagent
   (`task` tool) with this brief:
   - Review only the changed files (diff) — no repo-wide refactors.
   - Look for bugs, unhandled edge cases, missing tests, logging gaps, naming
     inconsistencies, dead code, TODOs, and small QoL improvements.
   - Apply trivial fixes directly (formatting, typos, obvious null checks — obey
     §6/§7); report everything else as a short list with file:line references.
3. Incorporate the report; if you reject a suggestion, say why in one line.

## 10. Known gotchas

- **NixOS + Prisma CLI:** the shell provides `PRISMA_{SCHEMA,QUERY}_ENGINE*` from
  `pkgs.prisma-engines_6`; outside it `prisma generate` fails on `linux-nixos`.
- **Ports:** dev 3001, e2e prod server 3100, `dev-db` 5432, compose dev Postgres
  5433 (+ Mailpit 1025/8025), production containers 3000.
- **next.config.mjs** is plain JS (no TS syntax) and must stay that way.
- **`src/app/layout.tsx`** must not render `<html>`; the locale layout owns it.
- **`OrgSettings`** is a singleton — always query `where: { id: "singleton" }`.
- **`tsx` scripts** run outside Next, so the `server-only` guard needs
  `--tsconfig tsconfig.scripts.json` (aliased to an empty module like Vitest
  does) — that is why the `retention:*` / `migrate:au-encryption` npm scripts
  exist; use them instead of raw `tsx`.
