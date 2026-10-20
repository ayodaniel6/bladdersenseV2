// Local testing only: creates (or resets) a demo account with 13 days of
// varied diary entries, so Patterns and the Doctor Report have something to
// show. Today is left empty so you can try the check-in yourself.
//
//   npm run seed-demo        then sign in as demo@bladdersense.local
//                            (the sign-in code prints in the server terminal)
import { pool, query } from '../server/db.js'
import { addDays, localDate } from '../shared/diary.js'

if (process.env.NODE_ENV === 'production') throw new Error('seed-demo is for local testing only.')

const EMAIL = 'demo@bladdersense.local'
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
const today = localDate(tz)

// [night trips, urges, leaks, drinks, caffeine/alcohol, activity, stress, sleep, notes]
const days = [
  [3, 2, 1, 'large', true, 'none', 4, 'poor', 'Late dinner with friends'],
  [2, 1, 0, 'moderate', true, 'light', 3, 'fair', null],
  [3, 3, 1, 'large', true, 'light', 5, 'poor', 'Started new blood pressure tablet'],
  [1, 0, 0, 'small', false, 'moderate', 2, 'good', null],
  [2, 1, 0, 'moderate', false, 'moderate', 2, 'fair', null],
  [1, 1, 0, 'none', false, 'high', 1, 'good', 'Long walk in the afternoon'],
  [1, 0, 0, 'small', false, 'moderate', 2, 'good', null],
  [0, 0, 0, 'none', false, 'high', 1, 'good', null],
  [2, 2, 1, 'large', true, 'light', 4, 'poor', 'Long drive, coffee late'],
  [3, 2, 0, 'large', true, 'none', 3, 'fair', null],
  [1, 1, 0, 'small', false, 'moderate', 2, 'good', null],
  [2, 1, 0, 'moderate', false, 'light', 3, 'fair', null],
  [1, 0, 0, 'small', false, 'moderate', 2, 'good', null],
]

await query('DELETE FROM users WHERE lower(email) = $1', [EMAIL])
const { rows: [user] } = await query(
  `INSERT INTO users (email, first_name, birth_year, timezone, onboarded_at) VALUES ($1, 'Demo', 1960, $2, NOW()) RETURNING id`,
  [EMAIL, tz],
)
for (const [i, d] of days.entries()) {
  await query(
    `INSERT INTO entries (user_id, entry_date, night_trips, urgent, leaks, evening_drinks, caffeine_alcohol, activity, stress, sleep, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [user.id, addDays(today, -(days.length - i)), ...d],
  )
}
console.log(`Demo account ready: ${EMAIL} with ${days.length} days of entries (today left empty).`)
await pool.end()
