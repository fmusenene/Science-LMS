# Science LMS | Laboratory Management System

School software for science labs: inventory, practical requisitions, lab bookings, stock reservation, and session logging.

**Repository:** [github.com/fmusenene/Science-LMS](https://github.com/fmusenene/Science-LMS)

---

## Table of contents

1. [Overview](#overview)
2. [Features](#features)
3. [Tech stack](#tech-stack)
4. [Quick start](#quick-start)
5. [Demo accounts](#demo-accounts)
6. [User roles](#user-roles)
7. [Requisition workflow](#requisition-workflow)
8. [Project structure](#project-structure)
9. [Further documentation](#further-documentation)
10. [Scripts](#scripts)
11. [License / notes](#license--notes)

---

## Overview

Science LMS helps a school science department:

- Book laboratories without double booking rooms or over allocating stock
- Submit practical requisitions for apparatus, chemicals and reagents, with conflict checks
- Approve and reserve stock before the lesson
- Prepare labs, run sessions, and record what was used or broken afterward
- Manage users, roles, timetable periods, and an audit trail

Data is stored in a shared JSON database file on the server (`data/lms-db.json`) so teachers and admins see the same requisitions when `npm run dev` or `npm start` is running. Sign in uses httpOnly session cookies and scrypt hashed passwords.

---

## Features

| Area | What you get |
|------|----------------|
| **Auth** | Email/password sign-in, signed session cookie, rate-limited login |
| **Idle logout** | Automatic sign-out after **5 minutes** without interaction |
| **Requisitions** | Draft → submit → approve/reject → prepare → session → complete / not done |
| **Conflict checks** | Same lab/period clashes and overlapping stock demands |
| **Inventory** | Apparatus (returnable), chemicals & reagents (consumable), stock adjustments |
| **Schedule** | Timetable view across labs and periods |
| **Notifications** | In-app bell for pending approvals and status changes |
| **RBAC** | Admin-managed roles and fine-grained permissions |
| **Audit log** | Key actions recorded for accountability |
| **Theming** | Light / dark toggle |
| **Responsive UI** | Mobile drawer nav, card layouts on small screens |

---

## Tech stack

- **Next.js** 16 (App Router) + **React** 19 + **TypeScript**
- **Tailwind CSS** 4 + **shadcn/ui** components
- **Node.js** API routes (file-backed DB)
- **next-themes**, **sonner** toasts, **lucide-react** icons

---

## Quick start

### Requirements

- Node.js 20+ recommended
- npm (or pnpm / yarn)

### Install & run

```bash
git clone https://github.com/fmusenene/Science-LMS.git
cd Science-LMS
npm install
cp .env.example .env.local
# Edit .env.local and set a long random LMS_SESSION_SECRET
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production build

```bash
npm run build
npm start
```

### Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `LMS_SESSION_SECRET` | Yes (production / Vercel) | Secret used to sign session cookies (≥ 32 characters). |
| `DATABASE_URL` | Yes on Vercel | Neon (or Postgres) connection string for shared sync. Optional locally. |

> `.env.local` is gitignored. Never commit real secrets.  
> Without `DATABASE_URL`, local dev uses `data/lms-db.json` (also gitignored).  
> See [docs/VERCEL.md](docs/VERCEL.md) for free Vercel + Neon setup.

---

## Demo accounts

On a fresh database, these accounts are seeded (password: `password`):

| Role | Email |
|------|--------|
| Administrator | `admin@school.ac` |
| Lab attendant | `attendant@school.ac` |
| Teacher | `teacher@school.ac` |

Change passwords after first login in a real deployment (**Settings → profile**, or **Users** as admin).

---

## User roles

### Administrator

Full access: users, roles, settings, inventory, labs, approve requisitions, audit log, system reset.

### Lab attendant

Operational store access: review/approve queue, prepare labs, complete sessions, manage inventory and schedule. No user/role administration.

### Teacher

Create and track **own** requisitions, view schedule, catalogue, and labs (read-focused).

Custom roles can be created under **Roles & Permissions**.

---

## Requisition workflow

```text
draft → submitted → approved → prepared → in_progress → completed
                 ↘ rejected
                 ↘ cancelled
                                    ↘ not_done
```

1. **Teacher** creates a requisition (lab, period, class, line items) and submits  
2. System checks **lab** and **stock** conflicts  
3. **Admin / attendant** approves (reserves stock) or rejects  
4. Attendant marks **prepared**, then **starts** the session  
5. Session is **completed** (stock reconciliation / breakages) or marked **not done**

---

## Project structure

```text
app/
  page.tsx                 # Sign-in
  (portal)/                # Authenticated pages (dashboard, requisitions, …)
  api/lms/
    auth/login|logout|session
    data/                  # Protected shared database GET/PUT
components/
  lms/                     # App shell, auth gate, notifications, idle logout
  ui/                      # Design-system primitives
lib/
  lms-store.tsx            # Client state + domain actions
  lms-persistence.ts       # Browser storage + API client
  server-db.ts             # File DB read/write/merge
  scheduling.ts            # Conflicts, slots, formatting
  permissions.ts           # Permission catalogue & role defaults
  security/                # Passwords, sessions, rate limit, sanitise
data/                      # Runtime DB (lms-db.json), not committed
docs/                      # Extended documentation
```

---

## Further documentation

| Document | Contents |
|----------|----------|
| [docs/USER-GUIDE.md](docs/USER-GUIDE.md) | Step-by-step use for Admin, Teacher, Attendant |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data model, sync |
| [docs/API.md](docs/API.md) | HTTP API reference |
| [docs/SECURITY.md](docs/SECURITY.md) | Auth, hardening, deployment checklist |
| [docs/VERCEL.md](docs/VERCEL.md) | Free Vercel + Neon Postgres hosting |

### Host on Vercel (free)

Local file storage does not work on Vercel. Set a free Neon `DATABASE_URL` plus `LMS_SESSION_SECRET`, then deploy. Full steps: [docs/VERCEL.md](docs/VERCEL.md).

Without `DATABASE_URL`, `npm run dev` still uses `data/lms-db.json` on your machine.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (Turbopack) |
| `npm run dev:webpack` | Development server (Webpack) |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run lint` | ESLint |

---

## License / notes

Private school project repository.  
This is a **school deployment-oriented demo**: one Node process + shared file DB is suitable for a lab intranet. For multi-server / public internet production, move the store to a real database and place the app behind HTTPS with a strong `LMS_SESSION_SECRET`.
