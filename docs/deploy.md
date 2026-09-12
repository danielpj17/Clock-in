# Deploying (free)

Everything runs on free tiers: **Vercel Hobby** for the app and API, **Neon Free**
for Postgres, and the built-in **Shortcuts** app on your iPhone.

## 1. Push the repo to GitHub

```bash
git add -A
git commit -m "Clock-in time tracker"
gh repo create clock-in --private --source=. --push   # or create it on github.com and push
```

## 2. Create the Vercel project

1. vercel.com > **Add New... > Project** > import the GitHub repo.
2. Framework preset: **Next.js** (auto-detected). Leave build settings alone.
3. Before deploying, open **Environment Variables** and add
   `APP_SECRET` = a long random string, e.g. from:
   ```bash
   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
   ```
   Keep it somewhere safe; you will type it into the phone once.
4. Deploy. (The first deploy will run but the API returns 500 until the
   database exists; that's expected.)

## 3. Add the Neon database

1. Vercel project > **Storage** tab > **Create Database** > **Neon** (Postgres).
2. Plan: **Free**. Region: pick the one closest to you.
3. Connect it to the project (all environments). Vercel injects `DATABASE_URL`
   (and a few `POSTGRES_*` aliases) automatically.

If you created the Neon project directly on neon.tech instead, add its
connection string as `DATABASE_URL` in Vercel's Environment Variables.

## 4. Create the tables

From your computer, one time:

```bash
npm install
npx vercel link            # pick the project you just created
npx vercel env pull .env.local
npm run db:push            # creates the shifts + settings tables in Neon
```

(`db:push` reads `DATABASE_URL` from `.env.local`.) If you ever change
`src/db/schema.ts`, run `npm run db:push` again.

Then **Redeploy** from the Vercel dashboard (Deployments > ... > Redeploy) so the
functions pick up `DATABASE_URL`.

## 5. Verify

```bash
curl -H "Authorization: Bearer <APP_SECRET>" https://<your-app>.vercel.app/api/status
```

You should get `{"ok":true,"open":null,...}`.

## 6. Install the PWA on your iPhone

1. Open `https://<your-app>.vercel.app` in **Safari** (it must be Safari for
   Add to Home Screen to create a real app).
2. Enter the secret on the lock screen.
   Tip: you can also open
   `https://<your-app>.vercel.app/#secret=<APP_SECRET>`; the secret is read from
   the URL fragment (never sent to the server) and stored in the browser.
3. Share button > **Add to Home Screen**.
4. Open **Settings** in the app: set your pay-period start date, hourly rate,
   and time zone. The Shortcut setup section shows the URL/header to copy.

## 7. Build the Shortcuts

See [shortcut.md](./shortcut.md).

---

## Notes

- **Use the production URL** in the Shortcut. Preview deployments are protected
  by Vercel authentication and will reject API calls.
- **Neon Free scales to zero.** The first request after a few minutes idle takes
  0.5-1 s while it wakes up; the Shortcut just waits. Everything else is instant.
- **Backups:** the report page's CSV button, or `/api/report?format=csv` for any
  period, is your export. Neon Free also keeps point-in-time restore history.
- **Local development** needs no database: with `DATABASE_URL` unset, the app
  uses an embedded Postgres (PGlite) stored in `./.pglite`. Run `npm run dev`, then
  open `http://localhost:3000/#secret=<APP_SECRET from .env.local>`.
- **Vercel Hobby** is for personal, non-commercial projects; a personal
  timesheet is fine.
