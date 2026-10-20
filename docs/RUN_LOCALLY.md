# Run BladderSense on your own computer

About 15 minutes the first time. Works on Windows and Mac.

You need three things:

| What | Why |
|---|---|
| **Node.js** | Runs the app. |
| **Git** | Downloads the code from GitHub. |
| **A database** | Stores accounts and diary entries. We use a free one from **Neon**, a company that hosts Postgres databases online, so nothing extra is installed on your computer. |

No emails are sent locally. The sign-in code is printed in the terminal window instead.

---

## 1. Install Node.js and Git (once)

- **Node.js**
  1. Go to https://nodejs.org and download the **LTS** version (22 or newer).
  2. Install it, accepting the default options.
- **Git**
  - Windows: https://git-scm.com/download/win, then install with the default options.
  - Mac: open **Terminal** and run `git --version`. If it isn't installed, the Mac offers to install it. Click **Install**.

To check that both worked, open a terminal:

- Windows: press Start, type **PowerShell**, and open it.
- Mac: press Cmd+Space, type **Terminal**, and open it.

Then run:

```
node --version
git --version
```

Each should print a version number. Node should be `v22` or higher.

## 2. Create a free database on Neon (once)

1. Go to https://neon.tech and click **Sign up**. Signing in with GitHub or Google is quickest.
2. Create a project. Any name works, for example `bladdersense`. Pick the region nearest to you and leave everything else as it is.
3. On the project dashboard, click **Connect**. Copy the **connection string**. It looks like this:
   ```
   postgresql://neondb_owner:AbC123xyz@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
   Keep this private. It's the password to your database.

## 3. Download the code

In the terminal:

```
git clone https://github.com/ayodaniel6/bladdersenseV2.git
cd bladdersenseV2
npm install
```

`npm install` takes a minute and downloads the libraries the app uses.

## 4. Tell the app where the database is

Make your settings file from the example:

- Windows (PowerShell): `copy .env.example .env`
- Mac: `cp .env.example .env`

Open `.env` in any text editor:

- Windows: `notepad .env`
- Mac: `open -e .env`

Replace the `DATABASE_URL=` line with your Neon connection string:

```
DATABASE_URL=postgresql://neondb_owner:AbC123xyz@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

Leave everything else as it is, and save.

## 5. Create the tables, and a demo account

```
npm run migrate
npm run seed-demo
```

- The first command prints `Applying 001_init.sql` and then `Migrations up to date.`
- The second creates the account **demo@bladdersense.local** with 13 days of diary entries, so the Patterns and Report pages have something to show straight away. Today is left empty so you can try the check-in yourself. Running it again resets the demo account.

## 6. Start the app

```
npm run local
```

Wait for `BladderSense listening on http://localhost:3000`, then open **http://localhost:3000** in your browser.

Leave this terminal window open. Closing it, or pressing Ctrl+C, stops the app.

## 7. Sign in

1. Click **Sign in** and enter `demo@bladdersense.local`, or your own email for a brand-new empty account.
2. Click **Email me a code**.
3. Look at the **terminal window**. You'll see:
   ```
   --- email to demo@bladdersense.local ---
   Subject: Your sign-in code: 482913
   ```
4. Type those 6 digits into the browser.

The terminal also shows the email's sign-in link (`http://localhost:3000/auth/link?t=...`). Paste it into the browser to try the "Continue" link flow instead.

---

## What to try

| Area | Try this |
|---|---|
| **First-time visitor** | Open the site in a private/incognito window: landing page, guide, privacy page. |
| **New account** | Sign in with any made-up email, e.g. `me@test.local`. You get the 3-question Welcome screen, then an empty Today page. |
| **Sign-in errors** | Type a wrong code (it counts your remaining tries). Press **Send a new code** (30-second wait). Use **Use a different email**. |
| **Today** | Log today's check-in. Press Save before answering everything to see the message. Edit an earlier day from the 7-day strip. |
| **Patterns** | As the demo user: switch 7/14/30 days, read the chart and the "What your diary shows" sentences. |
| **Report** | **Download PDF** opens the two-page doctor report. **Create a link**, then paste the link into a private window: it opens with no login. **Withdraw** it and reload: the link stops working. |
| **Settings** | Change the reminder time, sign out, delete an account. |

### See it as a phone user would

- **In your desktop browser:** press **F12** (Mac: Cmd+Option+I), then click the phone/tablet icon at the top of the panel to switch to a phone-sized screen.
- **On your actual phone:** connect it to the same Wi-Fi as your computer and find your computer's address. On Windows, run `ipconfig` and look for "IPv4 Address", e.g. `192.168.1.23`. On a Mac, go to System Settings → Wi-Fi → Details. Then on the phone open `http://192.168.1.23:3000`, using your own number. If it doesn't load, your firewall is blocking it; allow Node.js when Windows asks.

### Look inside the database

In the Neon dashboard, open **Tables**. You'll see `users`, `entries`, `report_links` and the rest, with every row you just created. This is also how you'd look things up once the app is live, because there's no separate admin screen.

---

## If something goes wrong

| You see | Do this |
|---|---|
| `DATABASE_URL is not set` | The `.env` file is missing or wasn't saved. Check it's in the `bladdersenseV2` folder and named exactly `.env` (Windows sometimes saves it as `.env.txt`). |
| `password authentication failed` or `getaddrinfo ENOTFOUND` | The connection string was copied wrongly. Copy it again from Neon → Connect. |
| `EADDRINUSE: address already in use :::3000` | The app is already running in another terminal. Close that one, or in `.env` set `PORT=3001` and `APP_URL=http://localhost:3001`, then open http://localhost:3001. |
| `npm: command not found` / `'npm' is not recognized` | Node.js isn't installed, or the terminal was opened before installing. Close the terminal and open a new one. |
| The page loads but sign-in says "Something went wrong" | Look at the terminal for the error message and send it to me. |

## Getting updates

When the code changes on GitHub:

```
git pull
npm install
npm run migrate
npm run local
```
