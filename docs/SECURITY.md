# Security

Science LMS is hardened for a **school intranet / single-server** deployment. Treat public internet exposure as higher risk and follow the checklist below.

---

## What was hardened

| Control | Implementation |
|---------|----------------|
| Password storage | scrypt hashes (`scrypt$salt$hash`) in `data/lms-db.json`; plaintext migrated on read |
| Password exposure | Stripped from API JSON and browser `localStorage` |
| Session | HMAC-signed httpOnly cookie `lms_session` (`lib/security/session.ts`) |
| API auth | `/api/lms/data` requires a valid session |
| Privilege escalation | Teachers cannot rewrite roles via PUT; user writes gated |
| Login abuse | Per-IP and per-account rate limits |
| Write abuse | PUT rate limit per user/IP |
| Client RBAC | Mutations call `assertCan(...)` |
| Destructive reset | Admin (`settings.manage`) only |
| Idle timeout | Client signs out after 5 minutes idle |
| HTTP headers | CSP, `X-Frame-Options: DENY`, nosniff, Referrer-Policy, Permissions-Policy |
| Secrets in git | `.env*` ignored; `.env.example` allowed |

---

## Threat notes (honest scope)

| Risk | Mitigation / residual |
|------|------------------------|
| Unauthenticated DB dump | Mitigated. API requires session |
| Session cookie theft | Use HTTPS in production (`Secure` cookie flag). SameSite=Strict reduces CSRF |
| Weak demo password | Change immediately; rotate `LMS_SESSION_SECRET` |
| File DB on disk | OS file permissions matter; backup securely |
| XSS | React escaping; CSP; no `dangerouslySetInnerHTML` in app code |
| Horizontal scale | File lock is per process. One writer node only |
| Client-side store | Domain logic in the browser; API still authenticates writes |

This is **not** a substitute for a dedicated identity provider (SSO), WAF, or managed database when serving untrusted networks.

---

## Deployment checklist

1. Set a long random `LMS_SESSION_SECRET` in `.env.local` / host env (≥ 32 chars).
2. For Vercel, also set `DATABASE_URL` to a Neon (or other Postgres) connection string. See [VERCEL.md](./VERCEL.md).
3. Serve only over **HTTPS** (Vercel does this automatically).
4. Change all seeded account passwords.
5. If you still use the local file DB, restrict OS permissions on `data/lms-db.json`.
6. Disable or remove demo "Reset to clean system" on production if not needed.
7. Keep Node/Next updated; run `npm audit` regularly.
8. Back up Neon (or `data/lms-db.json`) on a schedule.
9. Prefer a firewall / VPN for non-Vercel hosts if the LMS is not meant to be public.
10. Review custom roles so teachers never receive `users.manage` / `roles.manage` by mistake.

---

## Session & idle policy

| Policy | Value |
|--------|--------|
| Idle auto-logout (UI) | 5 minutes |
| Absolute cookie lifetime | 8 hours (server) |
| Cookie flags | httpOnly; SameSite=Strict; Secure when `NODE_ENV=production` |

---

## Reporting issues

If you find a vulnerability in this school project, contact the repository owner privately rather than opening a public issue with exploit detail.
