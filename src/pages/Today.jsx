import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../lib/api.js'
import { useSession } from '../lib/session.jsx'
import { useTitle } from '../lib/useTitle.js'
import { Question, Segmented, Stepper } from '../components/Controls.jsx'
import {
  ACTIVITY, BACKFILL_DAYS, COUNT_FIELDS, DRINKS, MIN_DAYS_FOR_PATTERNS, NOTES_MAX, SLEEP, STRESS, YES_NO,
  activityLabel, addDays, drinksLabel, formatDate, sleepLabel,
} from '../../shared/diary.js'

const blank = () => ({
  nightTrips: 0, urgent: 0, leaks: 0,
  eveningDrinks: null, caffeineAlcohol: null, activity: null, stress: null, sleep: null, notes: '',
})

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

const REQUIRED = ['eveningDrinks', 'caffeineAlcohol', 'activity', 'stress', 'sleep']

// The home screen after sign-in: today's check-in, or what was logged.
export default function Today() {
  useTitle('Today')
  const { user } = useSession()
  const [today, setToday] = useState(null)
  const [entries, setEntries] = useState(new Map())
  const [date, setDate] = useState(null)
  const [form, setForm] = useState(blank())
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.entries().then(({ today, entries }) => {
      setToday(today)
      setEntries(new Map(entries.map((e) => [e.date, e])))
      selectDay(today, new Map(entries.map((e) => [e.date, e])))
    }).catch((err) => setError(err.message))
  }, [])

  function selectDay(d, map = entries) {
    const existing = map.get(d)
    setDate(d)
    // Days imported from v1 have no urgent/leaks answer; editing one asks for them.
    setForm(existing ? { ...existing, urgent: existing.urgent ?? 0, leaks: existing.leaks ?? 0, notes: existing.notes || '' } : blank())
    setEditing(!existing)
    setSaved(false)
    setError('')
  }

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))
  const missing = REQUIRED.filter((k) => form[k] === null || form[k] === undefined)

  const loggedRecently = useMemo(() => {
    if (!today) return 0
    const from = addDays(today, -13)
    return [...entries.keys()].filter((d) => d >= from && d <= today).length
  }, [entries, today])

  async function save(e) {
    e.preventDefault()
    if (missing.length) {
      setError('Answer every question before saving. Notes are optional.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { entry } = await api.saveEntry(date, form)
      const next = new Map(entries).set(date, entry)
      setEntries(next)
      setForm({ ...entry, notes: entry.notes || '' })
      setEditing(false)
      setSaved(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!today) return error ? <div className="notice notice--danger"><p>{error}</p></div> : null

  const isToday = date === today
  const days = Array.from({ length: BACKFILL_DAYS }, (_, i) => addDays(today, i - (BACKFILL_DAYS - 1)))
  const entry = entries.get(date)

  return (
    <div className="stack">
      <div>
        <h1>{isToday ? `${greeting()}${user.firstName ? `, ${user.firstName}` : ''}` : formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
        <p className="muted">{isToday ? formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' }) : 'Logging a past morning.'}</p>
      </div>

      <div className="days" role="group" aria-label="Choose a day">
        {days.map((d) => (
          <button key={d} type="button" className="day" aria-pressed={d === date} onClick={() => selectDay(d)}
            aria-label={`${d === today ? 'Today' : formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}${entries.has(d) ? ', logged' : ', not logged'}`}>
            <span>{d === today ? 'Today' : formatDate(d, { weekday: 'short' })}</span>
            <span className="day__num">{formatDate(d, { day: 'numeric' })}</span>
            <span className="day__mark" aria-hidden="true">{entries.has(d) ? '✓' : ''}</span>
          </button>
        ))}
      </div>

      {saved && (
        <div className="notice notice--success" role="status">
          <h3>Saved.</h3>
          <p>
            You have logged {loggedRecently} of the last 14 days.{' '}
            {loggedRecently >= MIN_DAYS_FOR_PATTERNS
              ? <Link to="/patterns">See your patterns</Link>
              : `Log ${MIN_DAYS_FOR_PATTERNS - loggedRecently} more ${MIN_DAYS_FOR_PATTERNS - loggedRecently === 1 ? 'morning' : 'mornings'} and your patterns will appear.`}
          </p>
        </div>
      )}

      {!editing && entry ? (
        <div className="card">
          <h2>{isToday ? 'Today is logged' : 'Logged'}</h2>
          <dl className="summary-list">
            <dt>Night-time trips</dt><dd>{entry.nightTrips}</dd>
            <dt>Sleep</dt><dd>{sleepLabel(entry.sleep)}</dd>
            <dt>Urgent moments</dt><dd>{entry.urgent ?? 'Not recorded'}</dd>
            <dt>Leaks</dt><dd>{entry.leaks ?? 'Not recorded'}</dd>
            <dt>Evening drinks</dt><dd>{drinksLabel(entry.eveningDrinks)}</dd>
            <dt>Caffeine or alcohol</dt><dd>{entry.caffeineAlcohol === null ? 'Not recorded' : entry.caffeineAlcohol ? 'Yes' : 'No'}</dd>
            <dt>Activity</dt><dd>{activityLabel(entry.activity)}</dd>
            <dt>Stress</dt><dd>{entry.stress} of 5</dd>
            {entry.notes && <><dt>Notes</dt><dd style={{ fontWeight: 400 }}>{entry.notes}</dd></>}
          </dl>
          <button type="button" className="btn btn--secondary" style={{ marginTop: 'var(--s5)' }} onClick={() => setEditing(true)}>Change this entry</button>
        </div>
      ) : (
        <form onSubmit={save} noValidate className="stack">
          <section className="card">
            <h2 className="group-title">Last night</h2>
            <Question label="How many times did you get up to pass urine?">
              <Stepper label={COUNT_FIELDS.nightTrips.label} value={form.nightTrips} max={COUNT_FIELDS.nightTrips.max} onChange={set('nightTrips')} />
            </Question>
            <Question label="How did you sleep?">
              <Segmented label="Sleep" options={SLEEP} value={form.sleep} onChange={set('sleep')} />
            </Question>
          </section>

          <section className="card">
            <h2 className="group-title">The last 24 hours</h2>
            <Question label="Sudden, strong urges to go" hint="The kind that makes you hurry.">
              <Stepper label={COUNT_FIELDS.urgent.label} value={form.urgent ?? 0} max={COUNT_FIELDS.urgent.max} onChange={set('urgent')} />
            </Question>
            <Question label="Leaks, however small">
              <Stepper label={COUNT_FIELDS.leaks.label} value={form.leaks ?? 0} max={COUNT_FIELDS.leaks.max} onChange={set('leaks')} />
            </Question>
          </section>

          <section className="card">
            <h2 className="group-title">Yesterday</h2>
            <Question label="How much did you drink after 6pm?" hint="Any drink, including water, tea and soup.">
              <Segmented label="Evening drinks" grid options={DRINKS} value={form.eveningDrinks} onChange={set('eveningDrinks')} />
            </Question>
            <Question label="Any caffeine or alcohol after 6pm?" hint="Coffee, tea, cola, energy drinks, beer, wine or spirits.">
              <Segmented label="Caffeine or alcohol" options={YES_NO} value={form.caffeineAlcohol} onChange={set('caffeineAlcohol')} />
            </Question>
            <Question label="How active were you?">
              <Segmented label="Activity" grid options={ACTIVITY} value={form.activity} onChange={set('activity')} />
            </Question>
            <Question label="How stressed did you feel?">
              <Segmented label="Stress from 1, calm, to 5, a lot" options={STRESS} value={form.stress} onChange={set('stress')} />
              <div className="scale-ends" aria-hidden="true"><span>1 Calm</span><span>5 A lot</span></div>
            </Question>
          </section>

          <section className="card">
            <div className="question">
              <label className="question__label" htmlFor="notes">Anything else worth noting? (optional)</label>
              <span className="question__hint">For example, a new medicine, a late meal or a long journey.</span>
              <textarea id="notes" className="input" maxLength={NOTES_MAX} value={form.notes} onChange={(e) => set('notes')(e.target.value)} />
            </div>
          </section>

          {error && <div className="notice notice--danger" role="alert"><p>{error}</p></div>}
          <button className="btn btn--block" disabled={busy}>{busy ? 'Saving…' : entry ? 'Save changes' : 'Save entry'}</button>
          {entry && <button type="button" className="btn btn--text" onClick={() => selectDay(date)}>Cancel</button>}
        </form>
      )}
    </div>
  )
}
