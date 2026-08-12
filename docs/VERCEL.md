# Deploy on Vercel (free) with Neon

The app needs a **shared database** so teachers and admins stay in sync. On Vercel that cannot be a local file. Use free **Neon Postgres** instead.

Local development still works without Neon: if `DATABASE_URL` is missing, the app uses `data/lms-db.json` on disk.

---

## 1. Create a free Neon database

1. Sign up at [https://neon.tech](https://neon.tech) (free tier is enough).
2. Create a project (region close to your users).
3. Copy the connection string (**pooled** URL is best for Vercel).  
   Prefer a string like:  
   `postgresql://USER:PASSWORD@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require`

If Neon adds `&channel_binding=require`, you can leave it; the app strips that automatically. Keeping `sslmode=require` is enough.

---

## 2. Deploy to Vercel

1. Push this repo to GitHub.
2. Go to [https://vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. Framework: **Next.js** (auto-detected).
4. Add environment variables **before or after** deploy:

| Name | Value |
|------|--------|
| `DATABASE_URL` | Neon connection string |
| `LMS_SESSION_SECRET` | Long random string (32+ characters) |

Important:

- Names must be exactly `DATABASE_URL` and `LMS_SESSION_SECRET`
- Enable **Production** (and Preview if you want)
- After saving env vars, open **Deployments** → ⋯ on the latest → **Redeploy**

5. Wait for deploy to finish, then open the `.vercel.app` URL.

On first successful sign-in the app creates the `lms_data` table and seeds demo users.

---

## 3. If sign-in says "Sign-in failed"

Open this in your browser (replace with your site):

`https://YOUR-APP.vercel.app/api/lms/health`

You want JSON like:

```json
{ "ok": true, "hasDatabaseUrl": true, "hasSessionSecret": true, "database": "neon", "databaseOk": true }
```

| Result | Fix |
|--------|-----|
| `hasDatabaseUrl: false` | Add `DATABASE_URL`, then **Redeploy** |
| `hasSessionSecret: false` | Add `LMS_SESSION_SECRET`, then **Redeploy** |
| `database: "error"` | Wrong Neon URL/password; copy a fresh pooled string from Neon and Redeploy |
| Page works but login fails with old toast | Hard refresh after redeploy |

Password for demo accounts is: `password`

---

## 4. Demo logins after deploy

| Email | Password |
|-------|----------|
| `admin@school.ac` | `password` |
| `attendant@school.ac` | `password` |
| `teacher@school.ac` | `password` |

Change these after you go live.

---

## 5. Local testing against Neon (optional)

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

## 6. How storage works

| Environment | Storage |
|-------------|---------|
| No `DATABASE_URL` (local only) | `data/lms-db.json` |
| `DATABASE_URL` set | Neon table `lms_data` |
| Vercel without `DATABASE_URL` | Error (file DB is not allowed on Vercel) |

---

## 7. Checklist

- [ ] Neon project created
- [ ] `DATABASE_URL` set in Vercel (Production)
- [ ] `LMS_SESSION_SECRET` set in Vercel (Production)
- [ ] **Redeploy** after saving env vars
- [ ] `/api/lms/health` shows `ok: true`
- [ ] Teacher and admin see the same requisition on the live URL
- [ ] Change demo passwords
