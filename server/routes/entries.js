import { Router } from 'express'
import { query } from '../db.js'
import { fail } from '../lib/http.js'
import { BACKFILL_DAYS, addDays, localDate, summarise, validateEntry } from '../../shared/diary.js'

export const rowToEntry = (r) => ({
  date: r.entry_date,
  nightTrips: r.night_trips,
  urgent: r.urgent,
  leaks: r.leaks,
  eveningDrinks: r.evening_drinks,
  caffeineAlcohol: r.caffeine_alcohol,
  activity: r.activity,
  stress: r.stress,
  sleep: r.sleep,
  notes: r.notes,
})

export async function entriesBetween(userId, startDate, endDate) {
  const { rows } = await query(
    'SELECT * FROM entries WHERE user_id = $1 AND entry_date BETWEEN $2 AND $3 ORDER BY entry_date',
    [userId, startDate, endDate],
  )
  return rows.map(rowToEntry)
}

export const ALLOWED_RANGES = [7, 14, 30]

export function rangeFor(user, days) {
  const n = ALLOWED_RANGES.includes(Number(days)) ? Number(days) : 14
  const endDate = localDate(user.timezone)
  return { days: n, startDate: addDays(endDate, -(n - 1)), endDate }
}

const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))

export const entryRoutes = Router()

// The last 30 days of entries plus today's date in the user's timezone, so the
// browser never has to guess which day "today" is.
entryRoutes.get('/', async (req, res) => {
  const today = localDate(req.user.timezone)
  const entries = await entriesBetween(req.user.id, addDays(today, -29), today)
  res.json({ today, entries })
})

entryRoutes.put('/:date', async (req, res) => {
  const { date } = req.params
  const today = localDate(req.user.timezone)
  if (!isIsoDate(date)) fail(400, 'Invalid date.')
  if (date > today) fail(400, 'You can not log a day that has not happened yet.')
  if (date < addDays(today, -(BACKFILL_DAYS - 1))) fail(400, `You can log or change the last ${BACKFILL_DAYS} days only.`)

  const { entry, error } = validateEntry(req.body)
  if (error) fail(400, error)

  const { rows } = await query(
    `INSERT INTO entries (user_id, entry_date, night_trips, urgent, leaks, evening_drinks, caffeine_alcohol, activity, stress, sleep, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (user_id, entry_date) DO UPDATE SET
       night_trips = EXCLUDED.night_trips, urgent = EXCLUDED.urgent, leaks = EXCLUDED.leaks,
       evening_drinks = EXCLUDED.evening_drinks, caffeine_alcohol = EXCLUDED.caffeine_alcohol,
       activity = EXCLUDED.activity, stress = EXCLUDED.stress, sleep = EXCLUDED.sleep,
       notes = EXCLUDED.notes, updated_at = NOW()
     RETURNING *`,
    [req.user.id, date, entry.nightTrips, entry.urgent, entry.leaks, entry.eveningDrinks,
      entry.caffeineAlcohol, entry.activity, entry.stress, entry.sleep, entry.notes],
  )
  res.json({ entry: rowToEntry(rows[0]) })
})

entryRoutes.delete('/:date', async (req, res) => {
  await query('DELETE FROM entries WHERE user_id = $1 AND entry_date = $2', [req.user.id, req.params.date])
  res.json({ ok: true })
})

export const summaryRoute = async (req, res) => {
  const { days, startDate, endDate } = rangeFor(req.user, req.query.days)
  const entries = await entriesBetween(req.user.id, startDate, endDate)
  res.json({ days, ...summarise(entries, startDate, endDate) })
}
