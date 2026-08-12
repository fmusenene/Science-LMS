# Deploy on Vercel (free) with Neon

The app needs a **shared database** so teachers and admins stay in sync. On Vercel that cannot be a local file. Use free **Neon Postgres** instead.

Local development still works without Neon: if `DATABASE_URL` is missing, the app uses `data/lms-db.json` on disk.

---

## 1. Create a free Neon database

1. Sign up at [https://neon.tech](https://neon.tech) (free tier is enough).
2. Create a project (region close to your users).
3. Copy the connection string (**pooled** / serverless URL is fine).  
   It looks like:  
   `postgresql://USER:PASSWORD@HOST/neondb?sslmode=require`

You can also add Neon from the [Vercel Marketplace](https://vercel.com/marketplace) and it will inject `DATABASE_URL` for you.

---

## 2. Deploy to Vercel

1. Push this repo to GitHub (already done if you use Science-LMS).
2. Go to [https://vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. Framework: **Next.js** (auto-detected).
4. Add environment variables:

| Name | Value |
|------|--------|
| `DATABASE_URL` | Neon connection string |
| `LMS_SESSION_SECRET` | Long random string (32+ characters) |

5. Deploy.

On first API request the app creates the `lms_data` table and seeds demo users if the table is empty.

---

## 3. Demo logins after deploy

| Email | Password |
|-------|----------|
| `admin@school.ac` | `password` |
| `attendant@school.ac` | `password` |
| `teacher@school.ac` | `password` |

Change these after you go live.

---

## 4. Local testing against Neon (optional)

In `.env.local`:

```env
LMS_SESSION_SECRET=your-long-local-secret-at-least-32-chars
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
```

Then:

```bash
npm run dev
```

Omit `DATABASE_URL` to keep using the local file database.

---

## 5. How storage works

| Environment | Storage |
|-------------|---------|
| No `DATABASE_URL` | `data/lms-db.json` (local only) |
| `DATABASE_URL` set | Neon table `lms_data` (one JSON document, shared) |

Writes use optimistic locking on `revision` so concurrent teacher/admin saves on Vercel do not overwrite each other silently.

---

## 6. Checklist

- [ ] Neon project created  
- [ ] `DATABASE_URL` set in Vercel  
- [ ] `LMS_SESSION_SECRET` set in Vercel  
- [ ] Deploy succeeded  
- [ ] Sign in as teacher and admin on the live URL and confirm the same requisition appears for both  
- [ ] Change demo passwords  

---

## Limits (free tiers)

- Vercel hobby: fine for a school demo / light use  
- Neon free: storage and compute limits apply; enough for this LMS document store  

If the project grows large, you can later split JSON into normal SQL tables without changing the UI much.
