# Chronify

Time-tracking PWA for a German SME. Live timer, weekly timesheet, breaks
per ArbZG §4, overtime balancing, vacation workflow, sickness notes,
admin backend, GDPR tooling, reports, NFC kiosk for
clocking in via terminals.

Stack: Next.js 15 (App Router) · React 19 · TypeScript · PostgreSQL 16 +
Prisma 6 · Auth.js v5 · Tailwind + shadcn/ui · next-intl · Vitest +
Playwright. Dev environment is a Nix flake.

Image: `ghcr.io/2tap2b/chronify` (built by GitHub Actions on push to `main`,
tagged on `v*` releases).

> See [`docs/`](./docs) for setup, deployment and operations details —
> start with [`docs/initial-setup.md`](./docs/initial-setup.md).

## TL;DR

```bash
nix develop          # dev shell with node, prisma engines, gh, postgres tooling
dev-env-init         # create .env with generated secrets
dev-db start         # local postgres cluster
npm run db:setup     # migrate + seed (login: admin@puku.local / admin123)
npm run dev          # http://localhost:3001
```

## Production

Runs as a Docker compose stack (App + Postgres behind your reverse proxy).
See [`docs/initial-setup.md`](./docs/initial-setup.md) and the interactive
helper:

```bash
bash scripts/first-install.sh
```

## Workflow

All changes go through GitHub: open an issue, create a branch (`feat/…`,
`fix/…`), open a PR, squash-merge. Direct commits to `main` are not allowed.
Agent-facing conventions live in [`AGENTS.md`](./AGENTS.md).

## Release policy

Base version is **v1.0.0**. **Every new feature ships as its own patch
release `v1.0.x`** (v1.0.1, v1.0.2, …) **until the owner opens the next
minor version (v1.1.0) explicitly**. Bugfixes usually ride along with the
next patch release; critical fixes may cut a patch immediately.

## License

MIT — see [`LICENSE`](./LICENSE).
