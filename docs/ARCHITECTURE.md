# Architecture

## High-level design

```text
┌─────────────────────┐     cookie session      ┌──────────────────────────┐
│  Browser (React)    │ ◄──────────────────────► │  Next.js API (Node)      │
│  LmsProvider store  │   GET/PUT /api/lms/data  │  lib/server-db.ts        │
│  localStorage cache │   POST /api/lms/auth/*   │  data/lms-db.json        │
└─────────────────────┘                          └──────────────────────────┘
```

- **UI + domain actions** live in the client store (`lib/lms-store.tsx`).  
- **Source of truth** for multi-user sync is the server file `data/lms-db.json`.  
- **Auth** is enforced on the API; the UI also gates routes and actions with permissions.

This fits a **single-school / single-server** deployment (lab PC or small VPS). It is not a horizontally scaled multi-region design.

---

## Major modules

| Module | Responsibility |
|--------|----------------|
| `lib/lms-store.tsx` | In-memory LMS state, mutations, permission checks, login/logout wiring |
| `lib/lms-persistence.ts` | Partitioned `localStorage`, BroadcastChannel tab sync, fetch/push helpers |
| `lib/lms-merge.ts` | Merge requisitions/notifications/core so concurrent edits are not lost |
| `lib/server-db.ts` | Atomic file read/write queue, seed-on-missing, merge-and-save |
| `lib/scheduling.ts` | Periods, overlap detection, conflict issues, formatters |
| `lib/permissions.ts` | Permission IDs, catalogues, default role sets, route gates |
| `lib/security/*` | Password hashing, session tokens, rate limits, secret stripping |
| `components/lms/app-shell.tsx` | Chrome, nav prefetch, idle logout mount |
| `components/lms/auth-gate.tsx` | Redirect unsigned / unauthorized portal routes |

---

## Data model (summary)

Stored as one `LmsData` document:

- `roles`, `users` (passwords hashed on disk)  
- `labs`, `items`, `movements`  
- `requisitions`, `sessions`, `breakages`  
- `notifications`, `audit`  
- `settings` (school name, periods, subjects, forms, not-done reasons)  
- `revision` — monotonic counter used in merge / sync  

### Requisition statuses

`draft` → `submitted` → `approved` → `prepared` → `in_progress` → `completed`  
Also: `rejected`, `cancelled`, `not_done`.

### Inventory categories

- **apparatus** — returnable  
- **chemical** / **reagent** — consumable (deducted on completion)

---

## Sync strategy

1. **Boot (signed in):** `GET /api/lms/auth/session` restores cookie session + stripped data.  
2. **Boot (signed out):** local seed/branding only; **no** unauthenticated push.  
3. **While signed in:** poll / focus refresh pulls server data; pushes only when this browser has local-only requisitions.  
4. **Mutations:** update memory + `localStorage` partitions; push to server with credentials.  
5. **Merge:** `mergeLmsData` prefers richer / higher-status requisitions and keeps notification `read` flags sensible.  
6. **Tabs:** `BroadcastChannel` shares updates in the same browser profile.

Passwords are **never** kept in browser storage or API JSON responses (blanked / stripped).

---

## Auth flow

1. `POST /api/lms/auth/login` verifies email + password (scrypt).  
2. Sets `lms_session` httpOnly cookie (HMAC-signed payload: user id, role id, expiry).  
3. Client receives user id + secret-stripped dataset.  
4. Subsequent `GET`/`PUT /api/lms/data` require a valid cookie.  
5. `POST /api/lms/auth/logout` clears the cookie.  
6. Client idle timer (5 minutes) calls logout and redirects home.

Absolute session lifetime is also capped server-side (see `lib/security/session.ts`).

---

## Permission enforcement

1. **Route gate** — `AuthGate` + `APP_ROUTE_GATES`  
2. **Nav filter** — hide links the role cannot use  
3. **Action guards** — `assertCan(...)` inside store mutations  
4. **API guards** — authenticated; non-admins cannot rewrite `roles`; `users` writes limited without `users.manage`

UI hiding alone is not trusted; API + mutation checks are the real controls for this architecture.

---

## UI composition

```text
RootLayout → Providers (Theme + LmsProvider + Toaster)
  /                 Login page
  /(portal)/*       AuthGate → AppShell → page
```

Portal `loading.tsx` keeps a skeleton inside the shell during navigations.

---

## Extending the system

- **New permission:** add to `PERMISSION_IDS` + catalogue; assign on roles; gate UI/API.  
- **New page:** add under `app/(portal)/…`, register route gate if needed.  
- **Replace file DB:** swap `lib/server-db.ts` for Postgres/SQLite while keeping the same `LmsData` shape initially.
