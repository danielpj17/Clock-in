# iPhone Shortcuts

Two Shortcuts talk to the app's API. You build them once in the **Shortcuts** app.
Open **Settings** in the PWA on your phone first: it shows your exact URL and
`Authorization` header with copy buttons.

You need:

- **App URL**, e.g. `https://clock-in-xxxx.vercel.app` (the production URL, not a preview)
- **Secret**: the `APP_SECRET` you set on Vercel

---

## Shortcuts app UI tips (read first)

- **Typing after a variable**: tap the field just to the right of the blue pill and
  keep typing. `[URL]/api/status` is one pill followed by plain text.
- **Inserting a variable**: with the keyboard open, the bar above it lists variables
  (`Text`, `Contents of URL`, `Provided Input`, `Dictionary Value`...). Tap one to
  insert it. If it is not listed, tap **Select Variable** and then tap the action
  whose output you want.
- **Renaming**: tap a pill, then **Rename**. Rename the URL text to `URL` and the
  secret text to `Secret` so you can tell the two `Text` outputs apart.
- **Headers**: tap **Headers**, then the empty **Key** field, type `Authorization`;
  tap the value field, type `Bearer ` (with a trailing space) and insert `Secret`.
- **POST body**: **Request Body** only appears after you set **Method** to POST and
  tap **Show More**. Choose **JSON**, then **Add new field**, pick **Text**, and set
  key/value.
- **Menu labels**: in **Choose from Menu**, tap the default option names to rename
  them to `Clock in` / `Clock out`. Actions you add while an option is selected
  land inside that branch.
- **Dictionary keys are plain text**: in *Get Dictionary Value*, the **Key** field
  (`status`, `message`, `error`...) is typed as a word, never inserted as a variable.
  The **Dictionary** field is where the variable goes (`Status`, `Result`).
- **`Result`, not `Menu Result`**: after *End Menu*, read `message` from the `Result`
  variable you set inside each branch. `Menu Result` is only the option name you tapped.
- **Capital B in `Bearer`**: the server accepts `bearer` too, but keep it consistent.
- **Test as you go**: tap the play button at the bottom; a red banner shows which
  action failed.

Build the minimal version first (steps 1-8 plus 11-12 below, skipping the
`state` check in the clock-out branch). Once it works, add the rest.

## 1. "Clock": clock in / clock out

What it does: asks *Clock in* or *Clock out*; on clock-out asks what you worked
on; posts to the API; shows a notification with the result and your running
totals (always in decimal hours, e.g. `10.73 hrs`).

The server never lets you clock out unless you were clocked in. If you forgot to
clock in, the Shortcut notices (it checks `/api/status` first) and asks
**"When did you start?"** with a date-time picker, then saves the whole shift in
one step. That is only two extra actions, shown in the clock-out branch below.

### Actions, in order

1. **Text**: paste your App URL (e.g. `https://clock-in-xxxx.vercel.app`).
   Rename the variable to `URL` (tap the output, then *Rename*).
2. **Text**: paste your secret. Rename it `Secret`.
3. **Get Contents of URL**
   - URL: `URL`/api/status  (type the variable, then `/api/status`)
   - Method: **GET**
   - Headers: `Authorization` = `Bearer ` + `Secret`  (note the space after Bearer)
4. **Set Variable** `Status` = *Contents of URL*
5. **Get Dictionary Value**: Key `status` from `Status`.
   (This is the "Clocked in since 9:02 AM (1.33 hrs)" / "Not clocked in" line.)
6. **Choose from Menu**: Prompt = *Dictionary Value* (from step 5). Options:
   **Clock in**, **Clock out**.

   **Clock in** branch:
   7. **Get Contents of URL**
      - URL: `URL`/api/clock
      - Method: **POST**
      - Headers: `Authorization` = `Bearer ` + `Secret`
      - Request Body: **JSON**, add field `action` (Text) = `in`
   8. **Set Variable** `Result` = *Contents of URL*

   **Clock out** branch:
   7. **Ask for Input**: Input Type *Text*, Prompt *What did you work on?*
   8. **Set Variable** `Note` = *Provided Input*
   9. **Get Dictionary Value**: Key `state` from `Status`   (it is the text `in` or `out`)
   10. **If** *Dictionary Value* **is** `out`   (you forgot to clock in)
       - **Ask for Input**: Input Type **Date and Time**, Prompt *You weren't clocked in. When did you start?*
       - **Format Date**: *Provided Input*, Date Format **ISO 8601**, turn on **ISO 8601 Time**
       - **Get Contents of URL**
         - URL: `URL`/api/clock
         - Method: **POST**
         - Headers: `Authorization` = `Bearer ` + `Secret`
         - Request Body: **JSON**: `action` = `out`, `note` = `Note`, `startedAt` = *Formatted Date*
       - **Set Variable** `Result` = *Contents of URL*

       **Otherwise**   (normal clock-out)
       - **Get Contents of URL**
         - URL: `URL`/api/clock
         - Method: **POST**
         - Headers: `Authorization` = `Bearer ` + `Secret`
         - Request Body: **JSON**: `action` = `out`, `note` = `Note`
       - **Set Variable** `Result` = *Contents of URL*

       **End If**

   (End Menu)

11. **Get Dictionary Value**: Key `error` from `Result`
12. **If** *Dictionary Value* **has any value**
    - **Show Alert**: *Dictionary Value* (title "Clock")

    **Otherwise**
    - **Get Dictionary Value**: Key `message` from `Result`
    - **Show Notification**: *Dictionary Value*

    **End If**

Name the Shortcut **Clock**. Turn **off** "Show When Run" on the Get Contents actions
if you want it silent.

Simpler variant: skip steps 9-10 and always send the normal clock-out. If you
weren't clocked in you get the alert "You're not clocked in..." and you can add
the shift from the app (+ Add shift) instead.

### Make it one tap

- **Home Screen icon**: Shortcut, then the share icon, then *Add to Home Screen*.
- **Action Button** (iPhone 15 Pro and later): Settings > Action Button > Shortcut > *Clock*.
- **Back Tap**: Settings > Accessibility > Touch > Back Tap > Double Tap > *Clock*.
- **Lock Screen / Home Screen widget**: add a Shortcuts widget and pick *Clock*.

### Testing

Run it twice: the first run should say "Clocked in at ...", the second should ask
for a note and say "Clocked out at ... 0.02 hrs this shift ...". Open the PWA: the
shift is on today's column. Run it a third time and pick *Clock out*: it asks
"When did you start?", and after you pick a time it says "Saved 9:00 AM - 12:00 PM
· 3.00 hrs this shift".

---

## 2. "Timesheet Reminder": every-other-week nudge

iOS automations can only repeat daily/weekly/monthly, so this one runs **weekly**
and asks the server whether today is the last day of a pay period. It only
bothers you when it is, and it tells you your total hours.

### Shortcut actions

1. **Text**: App URL (`URL`)
2. **Text**: secret (`Secret`)
3. **Get Contents of URL**
   - URL: `URL`/api/period
   - Method: **GET**
   - Headers: `Authorization` = `Bearer ` + `Secret`
4. **Get Dictionary Value**: Key `isLastDay`
5. **If** *Dictionary Value* **is** `1`  (booleans compare as 1 / 0 here; if that
   doesn't match on your iOS version, use Key `daysRemaining` **is** `0` instead)
   - **Get Dictionary Value**: Key `message` from *Contents of URL*
   - **Show Notification**: *Dictionary Value*
   - **Get Dictionary Value**: Key `reportUrl`
   - **Open URLs**: *Dictionary Value*   (optional, opens the report)

   **End If**

Name it **Timesheet Reminder**.

### Automation

Shortcuts app > **Automation** tab > **+** > **Time of Day**:

- Time: e.g. **4:00 PM**
- Repeat: **Weekly**, on the weekday your pay period ends (the Settings page shows
  "Periods end on Sundays/Fridays/...").
- **Run Immediately** (not "Run After Confirmation"), and turn **Notify When Run** off
- Shortcut: **Timesheet Reminder**

Optional: a second automation the next morning (e.g. 9:00 AM) that shows
`message` unconditionally. On the day after a period ends it reads
"Pay period ...: 0.0h so far, 13 days left", which is a gentle "did you submit?".

### Fallback

If you'd rather not build this one: Reminders app > new reminder "Submit
timesheet" > Repeat > **Custom** > every **2 weeks** on the period-end day.

---

## API cheat sheet

All requests need `Authorization: Bearer <APP_SECRET>` (or `?token=<APP_SECRET>`).

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/status` | none | `open`, `state` (`in`/`out`), `status`, `todayHours`, `periodHours`, `periodPay`, `settings` |
| POST | `/api/clock` | `{ "action": "in" }` or `{ "action": "out", "note": "..." }`; optional `"at": ISO` (defaults to now) and, on clock-out with nothing open, `"startedAt": ISO` to back-fill the missed clock-in | `message`, `shift`, `backfilled`, totals; or `{ "error": "...", "code": "not_clocked_in" }` with 409 |
| GET | `/api/period` | `?date=YYYY-MM-DD` (default today) | `start`, `end`, `isLastDay`, `daysRemaining`, `totalHours`, `pay`, `message`, `reportUrl` |
| GET | `/api/report` | `?start=YYYY-MM-DD&format=json` / `tsv` / `csv` / `text` | the report |
| GET | `/api/shifts` | `?from=ISO&to=ISO` | `shifts[]` |
| POST | `/api/shifts` | `{ clockIn, clockOut, note }` | `shift` |
| PATCH | `/api/shifts/:id` | any of `clockIn`, `clockOut` (null = still open), `note` | `shift` |
| DELETE | `/api/shifts/:id` | none | `{ ok, id }` |
| GET / PUT | `/api/settings` | `periodAnchor`, `periodLengthDays`, `hourlyRate`, `timezone`, `dayStartHour`, `dayEndHour` | `settings` |

Handy: bookmark `https://<app>/api/report?format=text&token=<secret>` on your
laptop for a plain-text copy of the current period.
