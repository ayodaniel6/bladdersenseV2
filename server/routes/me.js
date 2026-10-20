import { Router } from 'express'
import { query } from '../db.js'
import { fail } from '../lib/http.js'
import { publicUser } from '../auth.js'
import { isValidTimeZone } from '../../shared/diary.js'

export const meRoutes = Router()

meRoutes.get('/', (req, res) => {
  res.json({ user: publicUser(req.user) })
})

// Shared by onboarding and Settings. Only fields present in the body change.
meRoutes.patch('/', async (req, res) => {
  const b = req.body ?? {}
  const sets = []
  const values = []
  const set = (column, value) => {
    values.push(value)
    sets.push(`${column} = $${values.length}`)
  }

  if ('firstName' in b) {
    const name = typeof b.firstName === 'string' ? b.firstName.trim() : ''
    if (!name || name.length > 60) fail(400, 'Enter a first name (up to 60 characters).')
    set('first_name', name)
  }
  if ('birthYear' in b) {
    const year = b.birthYear === null || b.birthYear === '' ? null : Number(b.birthYear)
    if (year !== null && !(Number.isInteger(year) && year >= 1920 && year <= 2010)) fail(400, 'Enter a year of birth between 1920 and 2010, or leave it blank.')
    set('birth_year', year)
  }
  if ('timezone' in b) {
    if (!isValidTimeZone(b.timezone)) fail(400, 'Unknown timezone.')
    set('timezone', b.timezone)
  }
  if ('reminderEnabled' in b) set('reminder_enabled', Boolean(b.reminderEnabled))
  if ('reminderHour' in b) {
    if (!Number.isInteger(b.reminderHour) || b.reminderHour < 0 || b.reminderHour > 23) fail(400, 'Choose a reminder time.')
    set('reminder_hour', b.reminderHour)
  }
  if ('weeklyEmail' in b) set('weekly_email', Boolean(b.weeklyEmail))
  if (b.completeOnboarding) sets.push('onboarded_at = COALESCE(onboarded_at, NOW())')

  if (!sets.length) return res.json({ user: publicUser(req.user) })
  values.push(req.user.id)
  const { rows } = await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`, values)
  res.json({ user: publicUser(rows[0]) })
})

// Deletes the account and, by cascade, every entry, session and report link.
meRoutes.delete('/', async (req, res) => {
  await query('DELETE FROM users WHERE id = $1', [req.user.id])
  res.clearCookie('bs_session', { path: '/' })
  res.json({ ok: true })
})
