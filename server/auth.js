import { Router } from 'express'
import { query } from './db.js'
import { hash, randomCode, randomToken, safeEqual } from './lib/tokens.js'
import { fail, rateLimit } from './lib/http.js'
import { sendSignIn } from './lib/email.js'
import { isValidTimeZone } from '../shared/diary.js'

const COOKIE = 'bs_session'
const SESSION_DAYS = 90
const RENEW_WHEN_DAYS_LEFT = 60
const TOKEN_MINUTES = 20
const MAX_ATTEMPTS = 5
const MAX_EMAILS_PER_HOUR = 5
const DAY_MS = 86_400_000

const ipLimit = rateLimit({ windowMs: 3_600_000, max: 30 })

export const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  firstName: u.first_name,
  birthYear: u.birth_year,
  timezone: u.timezone,
  reminderEnabled: u.reminder_enabled,
  reminderHour: u.reminder_hour,
  weeklyEmail: u.weekly_email,
  onboarded: Boolean(u.onboarded_at),
})

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

function setSessionCookie(res, token, expires) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  })
}

// Attaches req.user when the session cookie is valid. Sessions slide: a user
// who returns at least every two months is never asked to sign in again.
export async function loadUser(req, res, next) {
  const token = readCookie(req, COOKIE)
  if (!token) return next()
  const { rows } = await query(
    `SELECT s.expires_at AS session_expires_at, u.*
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [hash(token)],
  )
  if (!rows[0]) {
    res.clearCookie(COOKIE, { path: '/' })
    return next()
  }
  req.user = rows[0]
  req.sessionHash = hash(token)
  if (rows[0].session_expires_at - Date.now() < RENEW_WHEN_DAYS_LEFT * DAY_MS) {
    const expires = new Date(Date.now() + SESSION_DAYS * DAY_MS)
    await query('UPDATE sessions SET expires_at = $2 WHERE token_hash = $1', [req.sessionHash, expires])
    await query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [req.user.id])
    setSessionCookie(res, token, expires)
  }
  next()
}

export function requireUser(req, res, next) {
  if (!req.user) fail(401, 'Please sign in.')
  next()
}

const normaliseEmail = (e) => (typeof e === 'string' ? e.trim().toLowerCase() : '')
const looksLikeEmail = (e) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

async function startSession(res, email, timezone) {
  const tz = isValidTimeZone(timezone) ? timezone : 'UTC'
  const { rows } = await query(
    `INSERT INTO users (email, timezone, last_seen_at) VALUES ($1, $2, NOW())
     ON CONFLICT ((lower(email))) DO UPDATE SET last_seen_at = NOW()
     RETURNING *`,
    [email, tz],
  )
  // Any other code or link still in flight for this email stops working.
  await query('UPDATE login_tokens SET used_at = NOW() WHERE lower(email) = $1 AND used_at IS NULL', [email])
  const token = randomToken()
  const expires = new Date(Date.now() + SESSION_DAYS * DAY_MS)
  await query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [hash(token), rows[0].id, expires])
  setSessionCookie(res, token, expires)
  return publicUser(rows[0])
}

export const authRoutes = Router()

// Step 1: one form for sign-up and sign-in. The email holds a code and a link.
authRoutes.post('/start', async (req, res) => {
  const email = normaliseEmail(req.body?.email)
  if (!looksLikeEmail(email)) fail(400, 'Enter a full email address, like name@example.com.')
  if (!ipLimit(req.ip)) fail(429, 'Too many requests from this connection. Try again in an hour.')

  const { rows } = await query(
    `SELECT count(*)::int AS n FROM login_tokens WHERE lower(email) = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [email],
  )
  if (rows[0].n >= MAX_EMAILS_PER_HOUR) {
    fail(429, 'We have sent several emails to this address in the last hour. Use the code in the most recent one, or try again later.')
  }

  const code = randomCode()
  const linkToken = randomToken()
  await query(
    `INSERT INTO login_tokens (email, code_hash, link_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + make_interval(mins => $4))`,
    [email, hash(code), hash(linkToken), TOKEN_MINUTES],
  )
  try {
    await sendSignIn({ to: email, code, linkToken })
  } catch (err) {
    console.error(err)
    fail(502, 'We could not send the email just now. Wait a minute and try again.')
  }
  // Same answer whether or not an account exists.
  res.json({ ok: true, email })
})

// Step 2a: the 6-digit code, typed on the device that asked for it.
authRoutes.post('/verify-code', async (req, res) => {
  const email = normaliseEmail(req.body?.email)
  const code = String(req.body?.code ?? '').replace(/\D/g, '')
  if (code.length !== 6) fail(400, 'The code is 6 digits.')

  const { rows } = await query(
    `SELECT id, code_hash, attempts FROM login_tokens
      WHERE lower(email) = $1 AND used_at IS NULL AND expires_at > NOW() AND attempts < $2
      ORDER BY created_at DESC`,
    [email, MAX_ATTEMPTS],
  )
  if (!rows.length) fail(400, 'This code has expired or been used. Ask for a new email below.')

  const match = rows.find((t) => safeEqual(t.code_hash, hash(code)))
  if (!match) {
    const ids = rows.map((t) => t.id)
    const { rows: after } = await query(
      'UPDATE login_tokens SET attempts = attempts + 1 WHERE id = ANY($1) RETURNING attempts',
      [ids],
    )
    const left = MAX_ATTEMPTS - Math.min(...after.map((t) => t.attempts))
    fail(400, left > 0
      ? `That code does not match. Check the most recent email from BladderSense. ${left} ${left === 1 ? 'try' : 'tries'} left.`
      : 'Too many tries with this code. Ask for a new email below.')
  }

  res.json({ user: await startSession(res, email, req.body?.timezone) })
})

// Step 2b: the emailed link. The browser page shows a "Continue" button that
// posts here, so mail scanners that pre-open links cannot use it up.
authRoutes.post('/verify-link', async (req, res) => {
  const token = String(req.body?.token ?? '')
  const { rows } = await query('SELECT email, used_at, expires_at FROM login_tokens WHERE link_hash = $1', [hash(token)])
  const t = rows[0]
  if (!t) fail(400, 'This link is not valid. Ask for a new sign-in email.')
  if (t.used_at) fail(400, 'This link has already been used. If you signed in with the code, you are already in on that device. Otherwise ask for a new email.')
  if (t.expires_at < new Date()) fail(400, 'This link has expired. Links work for 20 minutes. Ask for a new email.')

  res.json({ user: await startSession(res, t.email, req.body?.timezone) })
})

authRoutes.post('/sign-out', async (req, res) => {
  if (req.sessionHash) await query('DELETE FROM sessions WHERE token_hash = $1', [req.sessionHash])
  res.clearCookie(COOKIE, { path: '/' })
  res.json({ ok: true })
})
