import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api, deviceTimeZone } from '../lib/api.js'
import { useSession } from '../lib/session.jsx'
import { useTitle } from '../lib/useTitle.js'
import { Question, Segmented } from '../components/Controls.jsx'
import { REMINDER_HOURS } from './Welcome.jsx'

const ON_OFF = [{ value: true, label: 'On' }, { value: false, label: 'Off' }]

export default function Settings() {
  useTitle('Settings')
  const { user, setUser } = useSession()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState(user.firstName || '')
  const [birthYear, setBirthYear] = useState(user.birthYear ? String(user.birthYear) : '')
  const [message, setMessage] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const device = deviceTimeZone()

  async function update(body, done = 'Saved.') {
    setMessage(null)
    try {
      const { user: updated } = await api.updateMe(body)
      setUser(updated)
      setMessage({ tone: 'success', text: done })
    } catch (err) {
      setMessage({ tone: 'danger', text: err.message })
    }
  }

  async function signOut() {
    await api.signOut()
    setUser(null)
    navigate('/', { replace: true })
  }

  async function deleteAccount() {
    await api.deleteMe()
    setUser(null)
    navigate('/', { replace: true })
  }

  return (
    <div className="stack">
      <h1>Settings</h1>
      {message && <div className={`notice notice--${message.tone}`} role="status"><p>{message.text}</p></div>}

      <form className="card" onSubmit={(e) => { e.preventDefault(); update({ firstName, birthYear: birthYear ? Number(birthYear) : null }) }}>
        <h2>About you</h2>
        <div className="question">
          <label className="question__label" htmlFor="firstName">First name</label>
          <input id="firstName" className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="question">
          <label className="question__label" htmlFor="birthYear">Year of birth (optional)</label>
          <input id="birthYear" className="input" inputMode="numeric" maxLength={4} value={birthYear}
            onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </div>
        <button className="btn" style={{ marginTop: 'var(--s5)' }}>Save</button>
        <p className="small muted" style={{ marginTop: 'var(--s4)' }}>Signed in as {user.email}.</p>
      </form>

      <section className="card">
        <h2>Emails</h2>
        <Question label="Morning reminder" hint="Sent only on days you have not logged yet.">
          <Segmented label="Morning reminder" options={ON_OFF} value={user.reminderEnabled} onChange={(v) => update({ reminderEnabled: v })} />
        </Question>
        {user.reminderEnabled && (
          <Question label="Reminder time">
            <Segmented label="Reminder time" columns={5} options={REMINDER_HOURS} value={user.reminderHour} onChange={(v) => update({ reminderHour: v })} />
          </Question>
        )}
        <Question label="Monday summary" hint="How many days you logged last week, with a link to your patterns. No symptoms in the email.">
          <Segmented label="Monday summary" options={ON_OFF} value={user.weeklyEmail} onChange={(v) => update({ weeklyEmail: v })} />
        </Question>
        <p className="small muted" style={{ marginTop: 'var(--s4)' }}>
          Times are in {user.timezone.replace(/_/g, ' ')}.{' '}
          {device !== user.timezone && (
            <button type="button" className="btn btn--text small" onClick={() => update({ timezone: device }, 'Timezone updated.')}>
              Use this device's timezone ({device.replace(/_/g, ' ')})
            </button>
          )}
        </p>
      </section>

      <section className="card">
        <h2>Account</h2>
        <button type="button" className="btn btn--secondary btn--block" onClick={signOut}>Sign out</button>
        <hr className="divider" />
        {!confirmDelete ? (
          <button type="button" className="btn btn--text" onClick={() => setConfirmDelete(true)}>Delete my account</button>
        ) : (
          <div className="notice notice--danger">
            <p>This permanently deletes your account, every diary entry and every report link. It can not be undone.</p>
            <div className="btn-row">
              <button type="button" className="btn btn--danger" onClick={deleteAccount}>Delete everything</button>
              <button type="button" className="btn btn--text" onClick={() => setConfirmDelete(false)}>Keep my account</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
