# Security notes

Operational security decisions for public deployment (web app exposed to the
internet; kiosk kept LAN-only). Read this before changing auth, rate limits
or the kiosk routes.

## Deployment boundary

- **App domain (`APP_DOMAIN`)** — public-facing. All user/admin features are
  behind Auth.js sessions; unauthenticated requests redirect to `/login`.
- **Kiosk domain (`KIOSK_DOMAIN`)** — LAN-only. The kiosk page and the tap API
  are intentionally unauthenticated (hardware NFC scanner). The middleware
  hard-gates every `/kiosk` page and `/api/kiosk/*` route to the kiosk host —
  requests on the public app domain get a 403 (see `src/middleware.ts`).

## Active protections

| Area           | Measure                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session        | Auth.js v5 JWT, httpOnly cookies; prod sets `AUTH_SECURE_COOKIE=true`; token carries only user id + role                                           |
| Password login | bcrypt compare + `rateLimit` 10/min/IP; can be disabled org-wide (`passwordLoginDisabled`, server-enforced)                                        |
| Password reset | tokens `randomBytes(32)`, 1 h TTL, single-use per email; forgot 5/min, reset 10/min                                                                |
| CSRF           | every mutation requires `Origin` ∈ `CSRF_ALLOWED_ORIGINS` (missing origin rejected)                                                                |
| Headers        | CSP `default-src 'self'`, X-Frame-Options DENY, nosniff, Referrer/Permissions-Policy (next.config.mjs)                                             |
| RBAC           | `requireAdmin` inside admin services (users, settings, working models, year setup, audit log, import, report automation, work overview, test-smtp) |
| Input          | zod schemas on every API route; NFC card ids capped at 20 chars                                                                                    |
| Audit          | `AuditLog` on all admin mutations, kiosk taps, profile changes                                                                                     |

## Accepted trade-offs (explicit owner decisions)

- **Kiosk tap rate limiting removed** (issue #23): operators tap in/out
  repeatedly and fast — throttling broke the workflow. Brute-force exposure
  accepted: card ids are physical NFC payloads, not user-chosen secrets, and
  the kiosk is LAN-only as of the host gate.
- **Kiosk tap stays unauthenticated**: required for stamp-wall hardware.
  Mitigated by the host gate + LAN binding.
- **SMTP test endpoint**: admin-only; the relay cannot be abused from a
  regular account.

## Production checklist (operator)

- Keep `KIOSK_HOST` resolvable only inside the LAN: do NOT create a public
  DNS record for `kiosk.*` (e.g. no Cloudflare record) and/or add a Traefik
  `ClientIP` allowlist middleware on the kiosk router.
- `AUTH_SECURE_COOKIE=true` (compose default) and HTTPS-only via Traefik.
- `NEXTAUTH_SECRET`, `AU_CERT_ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_PASSPHRASE`
  generated via the first-install wizard; never commit `.env`.
- SMTP preference: `.env` (`SMTP_HOST`) wins over dashboard settings — keep
  the secret in the environment when possible.
- Backups: encrypted (AES-256-CBC + PBKDF2) — the `BACKUP_ENCRYPTION_PASSPHRASE`
  is the only key to restore.
