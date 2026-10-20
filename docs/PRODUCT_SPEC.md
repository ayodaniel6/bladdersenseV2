# BladderSense v2: product specification

This repository is the implementation of this spec. Where the spec names a file, that file exists.

**Target user:** adults 45+, mostly men, managing a condition they rarely talk about.
**Scale:** about 100 visitors a day, one maintainer.

---

## Part 1: The discrepancies, and what was decided

### 1. Storage was not persistent

- **Current state.** The web app repo stores users, tokens and tracking data as JSON files through Netlify Functions (`netlify/functions/_helpers/json-store.js`). Its own README says this is fit only for testing. A deployed function's filesystem is read-only, and nothing written to it survives a deploy. The backend repo moved to Postgres on Heroku, and the React app already calls that, so the JSON functions are dead code that still ships.
- **Why it matters.** The diary is the product. If entries can disappear, there is no product.
- **Decision.** One managed **Postgres database on Neon**, with the schema in `migrations/001_init.sql`.
  - Postgres because the data is relational (users → entries → report links). Constraints validate every answer at the database level: `CHECK` on each field, and `UNIQUE (user_id, entry_date)` so a day can't be logged twice.
  - Neon because the free tier covers 100 users many times over. Backups and point-in-time restore are built in. It has a web **Tables** editor, which replaces the admin UI (item 8). It is plain Postgres, so leaving it is a `pg_dump`.
  - SQLite was rejected because PaaS disks are ephemeral. Firebase and Supabase as a backend were rejected because they would bring a second auth system and client-side data rules to audit.

### 2. Two repositories for one product

- **Current state.** Auth is implemented twice:
  - Netlify `register.js`, `request-login-token.js`, `verify-login-token.js` and `verify-registration.js`.
  - Express `authController.js` (814 lines).

  Data access is also implemented twice (`get-tracking.js`/`save-tracking.js` and `trackingController.js`). The two halves are glued together by:
  - a Netlify reverse proxy to Heroku, there only to keep the session cookie first-party on iOS;
  - two hand-written "contract" documents (`backend-requirements.md` and `frontend-integration.md`).
- **Why it matters.** Every change touches two repos and two deploys, and the contract can drift between them. The proxy hack exists only because of the split.
- **Decision.** **One repository, one Node process, one origin.** Express serves `/api/*`, the Doctor Report share links at `/r/:token`, and the built React app. There is one auth system (`server/auth.js`). The diary definition lives once in `shared/diary.js` and is imported by both the browser and the server, so the form, the validation, the Patterns page and the PDF can't drift apart. The CORS config and the proxy are gone. The contract documents are gone too, because the code is now the contract.

### 3. The sign-in flow was fragile

- **Current state.** Registration and sign-in are separate flows, plus a separate verify-registration step. The code is 6 digits and expires after **5 minutes**, which is too short to check email on another device or find it in spam. There is no link option. The React app caches the user in `localStorage` (`gbapp_user`), so the UI can believe someone is signed in after their session is gone. Session persistence on iOS depends on the Netlify proxy.
- **Why it matters.** This audience is the most likely to read email on a different device from the one they're signing in on, to have codes land in spam, and to give up after one failed attempt.
- **Decision.** One passwordless flow that serves both sign-up and sign-in.
  1. **Enter your email** (`/sign-in`). There is one button, "Email me a code", and no separate register step. The response is identical whether or not an account exists, so the form can't be used to check who has an account.
  2. **One email, two ways in.** Each email contains:
     - a **6-digit code**, which is also in the subject line so it shows in the notification;
     - a **"Sign in to BladderSense" button**.

     Both expire after **20 minutes** and work once.
  3. **Same device:** type the code. The field uses `inputmode=numeric` and `autocomplete=one-time-code`, so phones offer to autofill it.
  4. **Different device:** the button signs in *the device it is opened on*. The check-email screen says exactly this, so someone who opened the email on their phone knows to type the code on the laptop instead.
  5. **Mail scanners:** the link opens `/auth/link`, which shows a **Continue** button. Outlook and corporate scanners open links automatically, and must not be able to use up the sign-in before the person does.
  6. **Spam fallback:** the check-email screen names the sender, says to look in Spam, Junk and Promotions, and offers **Send a new code** (after a 30-second cooldown) and **Use a different email**. A refresh keeps the user on this step.
  7. **Failures, each with its own message:**
     - Wrong code: "That code does not match… 4 tries left". After 5 wrong tries the code stops working.
     - Expired: "Ask for a new email below".
     - Used link: "already been used… if you signed in with the code you're already in".
     - Rate limit: 5 emails per address per hour, and 30 requests per IP per hour.
  8. **Session:** an httpOnly, `SameSite=Lax` cookie with a 90-day sliding expiry, stored hashed in Postgres. A user who comes back at least every two months never signs in again. Nothing is stored in `localStorage` except the selected Patterns range.

### 4. The diary had no output

- **Current state.** `Progress.jsx` shows the last 7 days on screen. There is no longer range, no comparison between days, and nothing to export or hand to a clinician.
- **Why it matters.** The clinical value of a bladder diary is the pattern, and the pattern is only useful once it is in front of a doctor.
- **Decision.**
  - **Patterns page.** Appears after 3 logged mornings. Covers 7, 14 or 30 days and shows:
    - three key figures;
    - a bar chart of night-time trips, with unlogged days drawn as dashes, never as zero;
    - plain observations, e.g. "On the 6 mornings after moderate or large evening drinks, you logged 2.3 night-time trips on average. On the other 5 mornings, 0.8."

    The rules (`shared/diary.js`):
    - A comparison only appears with at least 2 mornings on each side.
    - Differences under 0.5 are reported as "about the same".
    - The wording never says "because", "causes" or "diagnosis".
  - **Doctor Report.** A **two-page A4 PDF** generated on the server with PDFKit (`server/report-pdf.js`).
    - **Page 1:** name, year of birth, period, days logged, the date it was generated, the summary figures, the chart, and the patterns written in neutral clinical wording.
    - **Page 2:** the daily log table and every note.
    - **Every page:** a footer saying this is a self-reported diary and not a diagnosis.

    Delivered two ways:
    - **Download PDF.**
    - **Private link** (`/r/<token>`). It opens the PDF for a fixed date range. Anyone holding it can open it, for 30 days, without an account. The user can withdraw it at any time and sees how many times it has been opened. Only a hash of the token is stored. The response carries `noindex` and `no-store`.

### 5. Useful backend features nobody could see

- **Current state.**
  - The backend has an in-process `node-cron` scheduler, daily reminders, weekly and monthly emailed reports, and `/api/reminders` plus `/api/tracking/summary` endpoints. The frontend calls none of them, so users can't turn reminders on or off.
  - `scheduler.js` warns itself that it only fires while the dyno is awake, and would fire twice if two instances ran.
- **Decision.**
  - **Keep and surface the morning reminder.**
    - It is set during onboarding and changed in Settings: on or off, and a time between 6am and 10am.
    - It only goes out if today isn't logged yet.
    - It is sent in the user's own timezone.
  - **Replace the weekly and monthly reports with a Monday summary email.** It says only "You logged 5 of the last 7 days" and links to Patterns. It is on by default and can be turned off in Settings. The old reports put symptom data in email bodies. Email is not a private channel, and subject lines show on lock screens and shared family computers, so **no email carries diary data**. The Doctor Report covers what the monthly report was for.
  - **Delete `node-cron` and the in-process scheduler.** A Render Cron Job runs `npm run cron` hourly. It's idempotent (`last_reminded_on`/`last_weekly_on`), so it can't double-send even when it runs twice.
  - **Delete `/tracking/summary` as an endpoint.** The summary is now `shared/diary.js`, used by the Patterns page and the PDF.

### 6. "Senior-friendly" was asserted, not designed

- **Current state.**
  - The old styles use a 21px base font with 19px for small text and 54px tap targets. Everything is enlarged equally, so nothing stands out.
  - Each section has an emoji icon, cards sit on a light-blue background with drop shadows, and the stylesheet is 1,684 lines.
  - It reads as a large-print accommodation.
- **Decision.** A small, specific design system (Part 2C, implemented in `src/styles/app.css`). The goal is a tool that reads like a well-made clinical document: a calm paper background, an editorial serif for headings, strong contrast, and controls sized for confident use rather than enlarged everywhere.

### 7. The core loop was buried

- **Current state.** After sign-in, the Dashboard lists all 12 guide sections next to the tracking and progress cards. It's a reading app with a diary attached. `Dashboard.jsx` also carries 125 lines of a commented-out earlier version.
- **Decision.**
  - **Today is the home screen.** After sign-in, and on every return visit, the user lands on `/today`: either today's check-in form, or what they logged with a link to Patterns.
  - **Primary navigation is three tabs: Today · Patterns · Report.** That is the loop: log, see the pattern, share.
  - **The guide is secondary.** It's a header link, and it's public, so it works as the trust-builder and search landing page for visitors. Each guide section ends by pointing back to the diary.

### 8. The admin dashboard was unnecessary scope

- **Current state.** There are two admin UIs for the same API:
  - `public/admin/` in the backend (about 1,300 lines);
  - `Admin.jsx` and `AdminUser.jsx` in the React app (about 800 lines).

  Around them sit `ADMIN_EMAILS` syncing at startup, a `make-admin` script, an `is_admin` column and six admin endpoints. That is an always-on, internet-facing way to read every user's health data, guarded by a boolean column.
- **Decision.** **Deleted, not migrated.** There is no admin code, no admin role and no admin endpoints. The maintainer uses **Neon's console**:
  - the **Tables** editor to look up or fix a row;
  - the **SQL editor** for the counts in `README.md` (users, activation, the launch metric).

  Neon access is protected by the maintainer's own account and 2FA, not by application code. Deleting a user on request is one `DELETE FROM users WHERE email = …`, which cascades.

---

## Part 2: The product

### A. Architecture

#### Folder structure (one repository, one package)

```
bladdersense/
├── shared/diary.js          # The diary: fields, options, validation, dates, summary + observations.
│                            # Imported by both browser and server.
├── server/
│   ├── index.js             # Express: /api, /r/:token, static React build, SPA fallback
│   ├── db.js                # pg Pool from DATABASE_URL
│   ├── auth.js              # code + link sign-in, sessions, requireUser
│   ├── report-pdf.js        # the Doctor Report (PDFKit)
│   ├── routes/              # me.js, entries.js, report.js
│   └── lib/                 # email.js (Resend), tokens.js, http.js
├── src/                     # React app
│   ├── pages/               # Landing, SignIn, AuthLink, Welcome, Today, Patterns, Report,
│   │                        # Settings, Guide, GuideSection, Privacy
│   ├── components/          # Layout, Controls (Question/Segmented/Stepper), NightChart, RangePicker
│   ├── content/guide.js     # the 12 guide sections (content kept from v1, emoji removed)
│   ├── lib/                 # api.js, session.jsx, useTitle.js
│   └── styles/app.css       # the design system
├── migrations/001_init.sql  # whole schema; later changes are 002_*.sql
├── scripts/                 # migrate.js, cron.js, import-v1.js (one-time)
├── test/                    # diary.test.js (logic), api.test.js (end-to-end against Postgres)
├── docs/PRODUCT_SPEC.md     # this file
└── render.yaml              # hosting, as code
```

#### Stack

| Piece | Choice | Why, at 100 visitors a day with one maintainer |
|---|---|---|
| Frontend | React 19 + Vite + React Router | Ported from v1, so not a rewrite. It's a client-rendered app behind a login, so SSR frameworks (Next.js and similar) would add a runtime and a deploy target for nothing. |
| Backend | Express 5 on Node 22, plain SQL via `pg` | Kept from v1 but reduced from about 6.7k lines to about 1k. With 6 tables and about 15 endpoints, an ORM or a BaaS adds more to learn than it saves. |
| Database | Neon Postgres (free tier) | Persistent, backed up, has a table editor, no lock-in. See Part 1, item 1. |
| Auth | Built in: email code + link, DB sessions | It's about 200 lines in `server/auth.js`. Auth0 or Clerk would add per-user cost, a third party holding health-app identities, and an extra screen for this audience. |
| Email | Resend (HTTP API, no SDK) | Sign-in depends on email arriving. Gmail SMTP with an app password (v1) gets rate-limited and lands in spam. Resend's free tier covers 3,000 emails a month. Postmark is an equivalent drop-in. |
| PDF | PDFKit on the server | Pure JS with no headless browser, so the PDF is identical on every device. Browser "Save as PDF" was rejected because it varies by device and is one step too many for this audience. |
| Fonts | Source Sans 3 and Source Serif 4, self-hosted via Fontsource | No Google Fonts request, so no third party learns who visits a bladder-health site. |
| Hosting | Render: one Starter web service (about $7/month) + one Cron Job (about $1/month) | Always on, so there are no cold starts when someone clicks a sign-in link. Deploys on every push. The config is in `render.yaml`. |

#### Deliberately not used

- **No native app.** A morning check-in works in a mobile browser. App-store review, two codebases and an install step all cost more than they return at 100 users.
- **No microservices or separate admin service.** Everything is one process.
- **No message queue (BullMQ, SQS) and no Redis.** About 100 reminder emails an hour is a loop. A session lookup is one indexed query.
- **No AI or chatbot.** Generated health advice is a liability. Observations come from fixed, testable rules.
- **No analytics SDKs or tracking pixels.** The launch metric comes from the database (Part 2D).
- **No serverless functions, Docker or Kubernetes.** The PaaS builds from `package.json`.
- **No ORM, GraphQL or tRPC.**
- **No second host, CDN or reverse proxy.** One origin removes the iOS cookie problem at its source.

#### Deployment

- **Web service (Render).**
  - Build: `npm ci --include=dev && npm run build`.
  - Before each deploy: `npm run migrate`.
  - Start: `npm start`.
  - Health check: `GET /api/health`, which queries the database.
  - Express serves the API, `/r/:token` and the React build from the same origin, so the browser never makes a cross-origin call.
- **Cron Job (Render).** `npm run cron` at minute 5 of every hour.
- **Database (Neon).** The connection string goes in `DATABASE_URL`, with `sslmode=require`.
- **Environment variables.** Set once in a Render environment group (`bladdersense`) shared by the web service and the cron job:
  - `DATABASE_URL`
  - `RESEND_API_KEY`
  - `EMAIL_FROM`
  - `APP_URL`
  - `NODE_ENV=production`

  Locally they live in `.env`, which is git-ignored. `.env.example` lists them. Without `RESEND_API_KEY`, emails print to the console.
- **Domain.** Point `bladdersense.com` at the Render service, and verify the domain in Resend (SPF/DKIM) so sign-in emails reach the inbox.

### B. User flow, first visit to Doctor Report

1. **Landing (`/`), before any account exists.**
   - A one-sentence promise: "A bladder diary your doctor can actually use."
   - What happens: answer eight quick questions each morning, see what goes with better nights, take a report to your appointment.
   - Two buttons: **Start your diary** and **Read the guide first**.
   - Three numbered steps, an example pattern card, and four privacy promises (no ads, no tracking, emails never mention symptoms, delete everything with one button).
   - A plain line on when to see a doctor straight away.
   - The guide and the privacy page are readable without an account.
2. **Sign up / sign in.** The exact flow is in Part 1, item 3. The person sees, in order:
   1. the email field;
   2. "Check your email", with the code field and the help box;
   3. Today or Welcome.

   Failure messages say what happened and what to do next.
3. **Onboarding (`/welcome`).** One screen with three questions, each used somewhere the user will see:
   - **First name** (required). Used in the greeting, the emails, and the report header, so the doctor knows whose diary it is.
   - **Year of birth** (optional). Printed on the report, because age frames every bladder symptom clinically. Nothing else uses it.
   - **Morning reminder email** (6am to 10am, or No). It's the most effective way to keep someone logging.

   The timezone is taken from the device without asking, and decides what "today" means and when reminders go out. Nothing is asked about diagnosis, medication or conditions: it isn't needed, and asking would put people off.
4. **Daily logging (`/today`).** This is the home screen. One check-in each morning covers last night and the 24 hours before, so the evening factors and the night they affected sit in the same entry.

   | Group | Question | Control |
   |---|---|---|
   | Last night | How many times did you get up to pass urine? | Stepper, 0–15 |
   | Last night | How did you sleep? | Segmented: Poor / Fair / Good |
   | Last 24 hours | Sudden, strong urges to go | Stepper, 0–30 |
   | Last 24 hours | Leaks, however small | Stepper, 0–30 |
   | Yesterday | How much did you drink after 6pm? | Segmented 2×2, with a cup or ml hint on each option |
   | Yesterday | Any caffeine or alcohol after 6pm? | Segmented: No / Yes |
   | Yesterday | How active were you? | Segmented 2×2, with a hint on each option |
   | Yesterday | How stressed did you feel? | Segmented 1–5, ends labelled Calm and A lot |
   | — | Anything else worth noting? (optional) | Text, 500 characters |

   - The fields map to the guide's four areas (fluids, sleep, activity, stress), plus the three symptoms a clinician asks about.
   - **Expected time:** under 45 seconds, about 8 taps.
   - **Save:** all eight answers are required, and notes are optional. The page confirms with "Saved. You have logged 4 of the last 14 days. See your patterns." Before day 3 it says instead "Log N more mornings and your patterns will appear." The form then becomes a read-only summary with a **Change this entry** button.
   - A 7-day strip lets the user log or fix any of the last 7 days. Future days and anything older than 7 days are refused.
5. **Pattern summary (`/patterns`), after 3+ mornings.**
   - **Before 3 mornings:** "Your patterns appear after 3 mornings. You have logged 2…" and a Log today button.
   - **After 3 mornings:**
     - three figures: night-time trips per night, sudden urges per day, and days with a leak;
     - the nightly chart;
     - "What your diary shows": up to six observations covering evening drinks, caffeine or alcohol, poor sleep, high stress (against urges), activity, and change over time once 6+ mornings are logged;
     - the line "These are patterns in what you logged, not a diagnosis. A small number of days can show differences by chance. Share them with your doctor or nurse.";
     - a closing card: **Create your doctor report**.
6. **Doctor Report (`/report`).**
   1. The user chooses 7, 14 or 30 days and sees "11 of 14 days logged, 7 Oct to 20 Oct".
   2. **Download PDF** produces the two-page document described in Part 1, item 4.
   3. **Create a link** shows the URL once, with **Copy link** and **Email it** (which opens the user's own email app with the link filled in). The user pastes it into their GP surgery's online form or an email.
   4. **Active links** lists each link's period, its open count and its expiry, with a **Withdraw** button.

   Who can access it: the user, and anyone they give the PDF or link to. The link exposes that one report and nothing else, and dies after 30 days or when withdrawn.
7. **Return visit.** The session cookie lasts 90 days and slides, so a returning user lands straight on **Today**:
   - **Not yet logged:** the check-in form under "Good morning, Tunde".
   - **Already logged:** today's summary.

   Signed-in users are redirected from `/` to Today. A morning reminder brings them in at their chosen hour.

### C. Design system (`src/styles/app.css`)

**Typography**

- **Body:** Source Sans 3. It has a large x-height and open letterforms, and its 1, l and I are clearly distinct, which matters in a numbers-heavy diary. Numbers use tabular figures so columns line up.
- **Headings and key figures:** Source Serif 4. An editorial serif signals "trusted health publication", not "app for older people".
- **Sizes:**

  | Use | Size | Weight |
  |---|---|---|
  | Body | 18px | |
  | Hints, labels, captions | 16px (the minimum; nothing is smaller) | |
  | Questions, h3 | 21px | semibold |
  | h2 | 26px | |
  | h1 | 34px (30px on phones) | |
  | Key figures and stepper numbers | 40px | |

- **Line height:** 1.6 for body text, 1.25 for headings.
- **Why 18 and not v1's 21:** 18px body text is comfortable at arm's length for 45+ eyes. Hierarchy comes from size steps and weight, not from making everything bigger.

**Colour** (contrast against the background it sits on)

| Token | Hex | Use |
|---|---|---|
| Background | `#F6F5F1` | Warm paper. Calmer than clinical white, with less glare. |
| Surface | `#FFFFFF` | Cards, inputs |
| Primary text | `#172033` | 14.9:1 |
| Secondary text | `#4B5565` | 6.9:1 |
| Line | `#DAD7CE` | Card borders and dividers (decorative) |
| Control border | `#8C877B` | Anything pressable, 3.6:1 (non-text minimum is 3:1) |
| Accent | `#0F6E6A` | Deep teal from the logo. Buttons, selections, links. 6.1:1 with white. |
| Accent strong / tint | `#0B5552` / `#E4F1EF` | Hover / highlighted cards |
| Success | `#2E6B3B` on `#E6F2E8` | Saved, logged |
| Warning | `#8A5300` on `#FCF1DC` | Expired link, attention |
| Neutral | `#5E6878` on `#EEF0F3` | Help boxes, guide tips |
| Danger | `#A23B2C` on `#F9E7E4` | Errors, account deletion |
| Focus | `#163C7A` | Brand navy, 3px focus ring, distinct from the accent |

There's no red or green for "good" and "bad" days. Symptoms aren't scored, so the palette doesn't judge them.

**Spacing and layout**

- **Spacing:** a 4px-based scale of 4, 8, 12, 16, 24, 32, 48 and 64.
- **Width:** a single column, at most 640px wide, with 16px side margins.
- **Cards:** 1px border, 12px radius, 24px padding, **no shadows**. Borders hold up on low-contrast screens and in print.
- **Grouping:** questions are grouped by time (Last night / The last 24 hours / Yesterday) under small uppercase teal labels.

**Controls**

| Size or control | Where and why |
|---|---|
| 48px | Minimum for anything pressable |
| 56px | Primary buttons, stepper buttons and segments |
| **Stepper** (− 0 +) | For counts. One tap per trip, the number shows at 40px, no keyboard needed. |
| **Segmented control** | For every choice. All options are visible and one tap selects. Options with hints lay out 2×2 on a phone so the hint stays readable. |
| **No dropdowns** | They hide the options, take two taps and give small targets. |
| **No sliders** | They're imprecise for older hands. |
| **No toggle switches** | Their state is ambiguous; On/Off uses a segmented control instead. |

Selected options fill with teal and white text, which reads clearly without relying on colour alone.

**Copy tone: three rules**

1. **Plain words, adult to adult.** "Times you got up to pass urine", not "nocturia episodes". Never "senior", "elderly" or "older adult" in the interface. No exclamation marks, emoji, streaks or cheerleading.
2. **Observe, never diagnose.** Say "you logged", "on average" and "about the same". Never "because", "causes", "improve your…" or "you have…". The disclaimer stays next to every pattern.
3. **Every message says what to do next.** Errors name the fix ("Ask for a new email below"). Empty states name the step ("Log 2 more mornings").

**Removed from the v1 UI, and why**

- Emoji section icons. They read as juvenile in a health tool.
- The light-blue page background and card drop shadows.
- The 21px-everywhere type scale.
- The guide list on the dashboard.
- Separate Register, Verify-registration and Sign-in pages.
- The Profile page. Its fields moved to Settings.
- The "category key" panels under every field. The hints now sit inside the options.
- Both admin UIs.
- The `/architecture` page.
- 5.3 MB of duplicate logo PNGs. They're now 30 KB in total.

### D. Launch scope

**Ships at launch (nothing else):**

1. Landing page, public guide (12 sections) and privacy page.
2. Passwordless sign-in: email code + link, 20-minute expiry, cross-device and spam guidance, rate limits, 90-day sliding sessions.
3. One-screen onboarding: first name, year of birth, morning reminder.
4. The morning check-in: 8 questions plus notes, with editing for the last 7 days.
5. Patterns: 7, 14 or 30 days, three figures, the nightly chart, rule-based observations.
6. Doctor Report: PDF download, plus 30-day revocable share links with open counts.
7. Morning reminder and Monday summary emails, both containing no diary data, via an hourly cron.
8. Settings: name, year of birth, reminder time, email preferences, timezone, sign out, delete account.
9. A one-time import of v1 users and entries (`npm run import-v1`).

**Deferred, and why:**

1. **CSV export.** The PDF is what a doctor uses. Add CSV if a user asks for raw data.
2. **Per-page prerendering of guide pages for search.** The landing page carries the meta tags. Port v1's prerender script if search traffic matters after launch.
3. **Bladder volume and frequency charts (measuring jug diary).** This is the clinical gold standard, but too heavy for a daily habit at launch. Offer it as an optional 3-day mode if doctors ask for it.
4. **SMS or push reminders.** Email is already there for sign-in. Push needs an installed PWA, and SMS costs money for every message.
5. **Multiple languages.**
6. **Native apps** (see Part 2A).
7. **Clinician accounts or dashboards.** The share link is the clinician interface.
8. **Medication tracking.** The notes field covers it until there's evidence it's needed.

**The single launch metric**

> **The share of new sign-ups who log on at least 3 separate days within their first 7 days, and generate one Doctor Report (download or link) within their first 14 days.**

Launch succeeds if **25% of the first 100 sign-ups** reach it. It measures the whole loop (log, see pattern, share) and nothing upstream of it. The query is in `README.md`.

---

## What this product is

BladderSense is a private online bladder diary for adults over 45, mostly men, who are dealing with night-time trips to the toilet, urgency or leaks. Each morning the person answers eight quick questions on their phone or computer, which takes under a minute, with no password and no app to install. After a few days it shows them, in plain language, what tends to go with better and worse nights, such as late drinks, caffeine, stress or poor sleep. When they see their doctor, they can hand over a clear two-page report, or send a private link, so the conversation starts from facts instead of memory. It does not diagnose or give medical advice, it shows no adverts, and it never shares anyone's information. It is built to be run by one person for about $10 a month.
