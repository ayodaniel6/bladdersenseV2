// One-time copy of users and diary entries from the v1 backend database.
//
//   V1_DATABASE_URL=postgres://...heroku... npm run import-v1
//
// Safe to re-run: users match on email, entries on (user, date), and v2 rows
// that already exist are left alone. v1 never asked about urgency, leaks or
// caffeine/alcohol, so those are stored as NULL ("not recorded"), not zero.
// Imported users see onboarding once on their next sign-in. Delete this file
// after the import.
import pg from 'pg'
import { pool } from '../server/db.js'

pg.types.setTypeParser(1082, (v) => v)
if (!process.env.V1_DATABASE_URL) throw new Error('Set V1_DATABASE_URL to the v1 database.')
const v1 = new pg.Pool({ connectionString: process.env.V1_DATABASE_URL, ssl: { rejectUnauthorized: false } })

const lower = (v) => String(v).toLowerCase()
const trips = (v) => (v === '3+' ? 3 : Number(v))

const { rows: users } = await v1.query('SELECT id, email, first_name, preferred_name, created_at FROM users WHERE email_verified')
const { rows: entries } = await v1.query('SELECT * FROM tracking_entries')

const idMap = new Map()
for (const u of users) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, first_name, created_at) VALUES ($1, $2, $3)
     ON CONFLICT ((lower(email))) DO UPDATE SET email = users.email
     RETURNING id`,
    [u.email.trim().toLowerCase(), (u.preferred_name || u.first_name || '').slice(0, 60) || null, u.created_at],
  )
  idMap.set(u.id, rows[0].id)
}

let copied = 0
for (const e of entries) {
  const userId = idMap.get(e.user_id)
  if (!userId) continue
  const { rowCount } = await pool.query(
    `INSERT INTO entries (user_id, entry_date, night_trips, urgent, leaks, evening_drinks, caffeine_alcohol, activity, stress, sleep, notes, created_at, updated_at)
     VALUES ($1, $2, $3, NULL, NULL, $4, NULL, $5, $6, $7, $8, $9, $9)
     ON CONFLICT (user_id, entry_date) DO NOTHING`,
    [userId, e.entry_date, trips(e.night_time_urination), lower(e.evening_fluids), lower(e.activity_level),
      Number(e.stress_level), lower(e.sleep_quality), e.notes?.slice(0, 500) || null, e.updated_at],
  )
  copied += rowCount
}

console.log(`Imported ${idMap.size} users and ${copied} entries (of ${entries.length}).`)
await v1.end()
await pool.end()
