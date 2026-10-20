// End-to-end: starts the real server against DATABASE_URL and walks the user
// flow. Skipped when DATABASE_URL is not set. Uses a throwaway email address.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import pg from 'pg'

const DB = process.env.DATABASE_URL
const PORT = 3999
const BASE = `http://localhost:${PORT}`
const EMAIL = `e2e-${Date.now()}@example.com`
let server
let output = ''

const lastEmail = () => {
  const code = [...output.matchAll(/sign-in code: (\d{6})/g)].pop()?.[1]
  const link = [...output.matchAll(/auth\/link\?t=([\w-]+)/g)].pop()?.[1]
  return { code, link }
}

function client() {
  let cookie = ''
  return async (path, { method = 'GET', body } = {}) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(body && { 'Content-Type': 'application/json' }), ...(cookie && { Cookie: cookie }) },
      body: body && JSON.stringify(body),
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0]
    const type = res.headers.get('content-type') || ''
    return { status: res.status, headers: res.headers, data: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) }
  }
}

const entry = (over = {}) => ({
  nightTrips: 2, urgent: 1, leaks: 0, eveningDrinks: 'large', caffeineAlcohol: true,
  activity: 'light', stress: 3, sleep: 'fair', notes: 'Late dinner', ...over,
})

before(async () => {
  if (!DB) return
  server = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(PORT), RESEND_API_KEY: '' } })
  server.stdout.on('data', (d) => (output += d))
  server.stderr.on('data', (d) => (output += d))
  for (let i = 0; i < 50 && !output.includes('listening'); i++) await new Promise((r) => setTimeout(r, 100))
})

after(async () => {
  server?.kill()
  if (!DB) return
  const pool = new pg.Pool({ connectionString: DB })
  await pool.query('DELETE FROM users WHERE email = $1', [EMAIL])
  await pool.query('DELETE FROM login_tokens WHERE email = $1', [EMAIL])
  await pool.end()
})

test('full flow: sign in, onboard, log, patterns, report, share, delete', { skip: !DB }, async () => {
  const phone = client()
  const laptop = client()

  // Sign in on the laptop with the code; a wrong code first.
  assert.equal((await laptop('/api/auth/start', { method: 'POST', body: { email: EMAIL.toUpperCase() } })).status, 200)
  const first = lastEmail()
  const wrong = await laptop('/api/auth/verify-code', { method: 'POST', body: { email: EMAIL, code: first.code === '000000' ? '111111' : '000000' } })
  assert.equal(wrong.status, 400)
  assert.match(wrong.data.error, /4 tries left/)
  const ok = await laptop('/api/auth/verify-code', { method: 'POST', body: { email: EMAIL, code: first.code, timezone: 'Europe/London' } })
  assert.equal(ok.status, 200)
  assert.equal(ok.data.user.onboarded, false)
  assert.equal(ok.data.user.timezone, 'Europe/London')

  // The link from that same email is now spent.
  const spent = await phone('/api/auth/verify-link', { method: 'POST', body: { token: first.link } })
  assert.equal(spent.status, 400)
  assert.match(spent.data.error, /already been used/)

  // A fresh email, opened on the phone: the link signs the phone in.
  await phone('/api/auth/start', { method: 'POST', body: { email: EMAIL } })
  const viaLink = await phone('/api/auth/verify-link', { method: 'POST', body: { token: lastEmail().link } })
  assert.equal(viaLink.status, 200)

  // Onboarding.
  const onboard = await laptop('/api/me', { method: 'PATCH', body: { firstName: 'Tunde', birthYear: 1958, reminderEnabled: true, reminderHour: 7, completeOnboarding: true } })
  assert.equal(onboard.data.user.onboarded, true)
  assert.equal(onboard.data.user.reminderHour, 7)

  // Logging: today and two previous days, validation, no future days.
  const { data: { today } } = await laptop('/api/entries')
  const dayBefore = (n) => new Date(new Date(`${today}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10)
  assert.equal((await laptop(`/api/entries/${today}`, { method: 'PUT', body: entry() })).status, 200)
  assert.equal((await laptop(`/api/entries/${dayBefore(1)}`, { method: 'PUT', body: entry({ nightTrips: 3 }) })).status, 200)
  assert.equal((await laptop(`/api/entries/${dayBefore(2)}`, { method: 'PUT', body: entry({ nightTrips: 0, eveningDrinks: 'none', caffeineAlcohol: false }) })).status, 200)
  assert.equal((await laptop(`/api/entries/${dayBefore(3)}`, { method: 'PUT', body: entry({ nightTrips: 1, eveningDrinks: 'small', caffeineAlcohol: false }) })).status, 200)
  assert.equal((await laptop(`/api/entries/${dayBefore(-1)}`, { method: 'PUT', body: entry() })).status, 400)
  assert.equal((await laptop(`/api/entries/${dayBefore(8)}`, { method: 'PUT', body: entry() })).status, 400)
  assert.equal((await laptop(`/api/entries/${today}`, { method: 'PUT', body: entry({ sleep: 'great' }) })).status, 400)

  // The phone session sees the same diary.
  assert.equal((await phone('/api/entries')).data.entries.length, 4)

  // Patterns.
  const summary = (await laptop('/api/summary?days=7')).data
  assert.equal(summary.ready, true)
  assert.equal(summary.daysLogged, 4)
  assert.ok(summary.observations.some((o) => /after moderate or large evening drinks/.test(o.text)))

  // PDF download.
  const pdf = await laptop('/api/report/pdf?days=14')
  assert.equal(pdf.status, 200)
  assert.equal(pdf.headers.get('content-type'), 'application/pdf')
  assert.equal(pdf.data.subarray(0, 5).toString(), '%PDF-')

  // Share link: opens without a session, then stops working once withdrawn.
  const created = (await laptop('/api/report/links', { method: 'POST', body: { days: 14 } })).data
  const path = new URL(created.url).pathname
  const shared = await client()(path)
  assert.equal(shared.status, 200)
  assert.equal(shared.headers.get('x-robots-tag'), 'noindex, nofollow')
  assert.equal((await laptop('/api/report/links')).data.links[0].viewCount, 1)
  await laptop(`/api/report/links/${created.link.id}`, { method: 'DELETE' })
  assert.equal((await client()(path)).status, 404)

  // Sign out ends only that device's session.
  await phone('/api/auth/sign-out', { method: 'POST' })
  assert.equal((await phone('/api/me')).data.user, null)
  assert.equal((await laptop('/api/me')).data.user.firstName, 'Tunde')

  // Delete account removes everything.
  await laptop('/api/me', { method: 'DELETE' })
  assert.equal((await laptop('/api/me')).data.user, null)
  assert.equal((await laptop('/api/entries')).status, 401)
})

test('rate limit: a sixth email to one address in an hour is refused', { skip: !DB }, async () => {
  const c = client()
  const email = `limit-${Date.now()}@example.com`
  for (let i = 0; i < 5; i++) assert.equal((await c('/api/auth/start', { method: 'POST', body: { email } })).status, 200)
  const sixth = await c('/api/auth/start', { method: 'POST', body: { email } })
  assert.equal(sixth.status, 429)
  const pool = new pg.Pool({ connectionString: DB })
  await pool.query('DELETE FROM login_tokens WHERE email = $1', [email])
  await pool.end()
})
