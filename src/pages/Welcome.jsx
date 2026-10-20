import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api, deviceTimeZone } from '../lib/api.js'
import { useSession } from '../lib/session.jsx'
import { useTitle } from '../lib/useTitle.js'
import { Question, Segmented } from '../components/Controls.jsx'

export const REMINDER_HOURS = [6, 7, 8, 9, 10].map((h) => ({ value: h, label: `${h}am` }))

// Three questions, one screen. Each one is used somewhere the user will see.
export default function Welcome() {
  useTitle('Welcome')
  const { user, setUser } = useSession()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState(user.firstName || '')
  const [birthYear, setBirthYear] = useState(user.birthYear ? String(user.birthYear) : '')
  const [reminder, setReminder] = useState(user.reminderEnabled ? user.reminderHour : 'off')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { user: updated } = await api.updateMe({
        firstName,
        birthYear: birthYear ? Number(birthYear) : null,
        timezone: deviceTimeZone(),
        reminderEnabled: reminder !== 'off',
        ...(reminder !== 'off' && { reminderHour: reminder }),
        completeOnboarding: true,
      })
      setUser(updated)
      navigate('/today', { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div>
        <h1>Welcome</h1>
        <p className="muted">Three questions, then your first entry.</p>
      </div>
      <div className="card">
        <div className="question">
          <label className="question__label" htmlFor="firstName">Your first name</label>
          <span className="question__hint">Used in your emails and at the top of your doctor report.</span>
          <input id="firstName" className="input" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="question">
          <label className="question__label" htmlFor="birthYear">Year of birth (optional)</label>
          <span className="question__hint">Printed on your report so your doctor has your age at a glance. Nothing else uses it.</span>
          <input id="birthYear" className="input" inputMode="numeric" autoComplete="bday-year" maxLength={4} placeholder="For example, 1962"
            value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </div>
        <Question label="Email me a reminder each morning?" hint="Only if you have not logged yet that day. The email never mentions your symptoms.">
          <Segmented label="Reminder time" columns={3} options={[...REMINDER_HOURS, { value: 'off', label: 'No' }]} value={reminder} onChange={setReminder} />
        </Question>
      </div>
      {error && <div className="notice notice--danger" role="alert"><p>{error}</p></div>}
      <button className="btn btn--block" disabled={busy || !firstName.trim()}>{busy ? 'Saving…' : 'Start my diary'}</button>
    </form>
  )
}
