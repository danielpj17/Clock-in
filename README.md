# Clock In

A personal time tracker for 1099 work:

- **iPhone Shortcut** clocks you in/out with one tap and asks what you worked on.
- **PWA** (Next.js on Vercel) shows a weekly calendar of shifts, pay-period totals, and
  a formatted timesheet you can paste straight into Google Sheets, share, or download as Excel/CSV.
- **Reminder** automation nudges you on the last day of each pay period.
- Runs entirely on free tiers (Vercel Hobby + Neon Postgres).

```
iPhone Shortcut --POST /api/clock--> Next.js API routes --> Neon Postgres
iPhone Shortcut --GET  /api/period-> (weekly automation -> notification)
PWA on the phone -------------------> same API, same secret
```

## Docs

- [docs/deploy.md](docs/deploy.md): Vercel + Neon setup (about 10 minutes)
- [docs/shortcut.md](docs/shortcut.md): building the two Shortcuts, plus the API cheat sheet

## Develop

```bash
npm install
cp .env.example .env.local      # set APP_SECRET; leave DATABASE_URL out to use the embedded dev DB
npm run dev                     # http://localhost:3000/#secret=<APP_SECRET>
npm test                        # period / hours / report unit tests
npm run lint && npm run typecheck
```

Scripts: `db:push` (apply schema to `DATABASE_URL`), `db:studio` (browse data),
`icons` (regenerate PWA icons from `scripts/icons.mjs`).

## Layout

```
src/app/            pages (/, /report, /settings) + manifest
src/app/api/        clock, status, shifts, period, report, settings routes
src/components/     WeekGrid, ShiftSheet, ClockButton, ReportView, SettingsView, SecretGate
src/lib/            dates (tz-aware), periods, hours, report serializers, auth, data access
src/db/             Drizzle schema + client (Neon in prod, PGlite locally)
drizzle/            generated SQL migrations
public/sw.js        minimal service worker (installable, offline shell)
docs/               deploy + shortcut guides
```

## How hours are counted

- A shift belongs to the calendar day it **started** on, in your configured time zone.
  An overnight shift is drawn across two columns but counted once, on its start date.
- Pay periods are `periodAnchor + k * periodLengthDays`; change either in Settings.
- Hours are always shown as decimals to two places (`10.73 hrs`), never as hours/minutes.
- The server refuses a second clock-in while one is open, and refuses a clock-out with
  none open unless the request includes `startedAt` (the Shortcut asks "When did you
  start?" in that case and back-fills the missed clock-in). Forgotten clock-outs get a
  warning banner in the app after 16 hours; tap it to fix the time.
