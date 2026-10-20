// Run once an hour by the host's cron (Render Cron Job: `npm run cron`).
// Each user is checked in their own timezone, so "8am" means their 8am.
//
//   Morning reminder: at the user's reminder hour, if today is not logged yet.
//   Weekly email:     Mondays at the reminder hour, a count of days logged
//                     with a link to Patterns. No diary data in either email.
//
// last_reminded_on / last_weekly_on make a re-run in the same hour harmless.
import { pool, query } from '../server/db.js'
import { sendReminder, sendWeekly } from '../server/lib/email.js'
import { addDays, localDate, localHour, localWeekday } from '../shared/diary.js'

const now = new Date()
const { rows: users } = await query(
  'SELECT id, email, first_name, timezone, reminder_enabled, reminder_hour, weekly_email, last_reminded_on, last_weekly_on FROM users WHERE onboarded_at IS NOT NULL',
)

let reminders = 0
let weekly = 0
for (const u of users) {
  try {
    if (localHour(u.timezone, now) !== u.reminder_hour) continue
    const today = localDate(u.timezone, now)

    if (u.reminder_enabled && u.last_reminded_on !== today) {
      const { rowCount } = await query('SELECT 1 FROM entries WHERE user_id = $1 AND entry_date = $2', [u.id, today])
      if (!rowCount) {
        await sendReminder({ to: u.email, firstName: u.first_name })
        reminders++
      }
      await query('UPDATE users SET last_reminded_on = $2 WHERE id = $1', [u.id, today])
    }

    if (u.weekly_email && localWeekday(u.timezone, now) === 'Monday' && u.last_weekly_on !== today) {
      const { rows } = await query(
        'SELECT count(*)::int AS n FROM entries WHERE user_id = $1 AND entry_date BETWEEN $2 AND $3',
        [u.id, addDays(today, -7), addDays(today, -1)],
      )
      if (rows[0].n > 0) {
        await sendWeekly({ to: u.email, firstName: u.first_name, daysLogged: rows[0].n })
        weekly++
      }
      await query('UPDATE users SET last_weekly_on = $2 WHERE id = $1', [u.id, today])
    }
  } catch (err) {
    console.error(`cron: user ${u.id} failed`, err)
  }
}

// Housekeeping: expired sign-in tokens and sessions.
await query(`DELETE FROM login_tokens WHERE expires_at < NOW() - INTERVAL '1 day'`)
await query('DELETE FROM sessions WHERE expires_at < NOW()')

console.log(`cron: ${reminders} reminders, ${weekly} weekly emails, ${users.length} users checked`)
await pool.end()
