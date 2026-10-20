# BladderSense

A private bladder diary. Users check in each morning in under a minute, see their patterns after three days, and give their doctor a two-page report.

One repository, one Node process, one Postgres database. What it is and why it's built this way: [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md).

```
shared/      the diary definition, used by browser and server
server/      Express API, sign-in, Doctor Report PDF
src/         React app
migrations/  SQL schema
scripts/     migrate, hourly cron, one-time v1 import
test/        logic tests + end-to-end API test
```

## Run it locally

Step-by-step guide for Windows and Mac, including a free database: [`docs/RUN_LOCALLY.md`](docs/RUN_LOCALLY.md). Short version:

```bash
npm install
cp .env.example .env        # put your Postgres connection string in DATABASE_URL
npm run migrate             # create the tables
npm run seed-demo           # optional: demo@bladdersense.local with 13 days of entries
npm run local               # build and serve on http://localhost:3000
```

With no `RESEND_API_KEY` set, emails (including the sign-in code) print in the terminal.

When changing code, use two terminals for live reload: `npm run dev:server` (API on :3000) and `npm run dev:client` (app on http://localhost:5173; set `APP_URL=http://localhost:5173` in `.env`).

```bash
npm test                    # logic tests; the end-to-end test also runs when DATABASE_URL is set
```

## Deploy

1. **Neon.** Create a project and copy the connection string (it includes `sslmode=require`).
2. **Resend.** Add and verify `bladdersense.com` (SPF and DKIM records), then create an API key.
3. **Render.** Choose New → Blueprint and select this repo. `render.yaml` creates the web service, the hourly cron job and the `bladdersense` environment group. Fill in `DATABASE_URL` and `RESEND_API_KEY` there.
4. **Domain.** Add `bladdersense.com` to the web service and point DNS at it. Keep `APP_URL` equal to the public URL, because email links and report links are built from it.

Every push to `main` builds the app, runs `npm run migrate`, then restarts. Schema changes go in a new `migrations/002_*.sql` file. Never edit `001_init.sql` after launch.

### Moving v1 data across (once)

```bash
V1_DATABASE_URL=<heroku postgres url> npm run import-v1
```

This copies verified v1 users and their tracking entries. v1 never asked about urgency, leaks or caffeine, so those are stored as "not recorded". The import is safe to re-run. Delete `scripts/import-v1.js` afterwards.

## Operating it (there is no admin UI)

Use the Neon console. The **Tables** view looks up or edits rows; the **SQL Editor** runs the queries below.

```sql
-- Sign-ups and activity
SELECT count(*) AS users,
       count(*) FILTER (WHERE created_at > now() - interval '7 days') AS new_this_week
FROM users;

-- Launch metric: logged on 3+ separate days in the first 7, and made a report in the first 14
SELECT count(*) AS signups,
       count(*) FILTER (WHERE logged_days >= 3 AND reported) AS activated,
       round(100.0 * count(*) FILTER (WHERE logged_days >= 3 AND reported) / nullif(count(*), 0), 1) AS pct
FROM (
  SELECT u.id,
         (SELECT count(*) FROM entries e
           WHERE e.user_id = u.id
             AND e.entry_date BETWEEN u.created_at::date AND u.created_at::date + 6) AS logged_days,
         EXISTS (SELECT 1 FROM report_exports r
                  WHERE r.user_id = u.id AND r.created_at < u.created_at + interval '14 days') AS reported
  FROM users u
  WHERE u.created_at < now() - interval '14 days'   -- only users whose window has closed
) t;

-- Someone asks for their account to be deleted (cascades to entries, sessions, links)
DELETE FROM users WHERE lower(email) = lower('person@example.com');
```

Cron output (reminders and weekly emails sent) appears in the `bladdersense-cron` logs on Render.
