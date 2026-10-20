import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../lib/api.js'
import { useTitle } from '../lib/useTitle.js'
import RangePicker, { useStoredRange } from '../components/RangePicker.jsx'
import NightChart from '../components/NightChart.jsx'
import { LoadError, Loading } from '../components/Status.jsx'
import { MIN_DAYS_FOR_PATTERNS, PATTERNS_DISCLAIMER, fmt } from '../../shared/diary.js'

export default function Patterns() {
  useTitle('Patterns')
  const [readRange, writeRange] = useStoredRange()
  const [days, setDays] = useState(readRange)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  function load() {
    setError('')
    api.summary(days).then(setSummary).catch((err) => setError(err.message))
  }

  useEffect(() => {
    writeRange(days)
    load()
  }, [days])

  if (error) return <LoadError title="Your patterns" message={error} onRetry={load} />
  if (!summary) return <Loading title="Your patterns" />
  const s = summary

  return (
    <div className="stack">
      <div>
        <h1>Your patterns</h1>
        <p className="muted">{s.daysLogged} of the last {s.daysInRange} days logged.</p>
      </div>
      <RangePicker value={days} onChange={setDays} />

      {!s.ready ? (
        <div className="card card--tint">
          <h2>Your patterns appear after {MIN_DAYS_FOR_PATTERNS} mornings</h2>
          <p>
            You have logged {s.daysLogged} {s.daysLogged === 1 ? 'morning' : 'mornings'} in this period.
            {' '}{MIN_DAYS_FOR_PATTERNS - s.daysLogged} more and this page fills in.
          </p>
          <Link to="/today" className="btn">Log today</Link>
        </div>
      ) : (
        <>
          <div className="figures">
            <div className="figure">
              <div className="figure__value">{fmt(s.nightTrips.avg)}</div>
              <div className="figure__label">night-time trips, average per night</div>
            </div>
            <div className="figure">
              <div className="figure__value">{s.urgent.daysAnswered ? fmt(s.urgent.avg) : '–'}</div>
              <div className="figure__label">sudden urges, average per day</div>
            </div>
            <div className="figure">
              <div className="figure__value">{s.leaks.daysAnswered ? s.leaks.days : '–'}</div>
              <div className="figure__label">{s.leaks.days === 1 ? 'day' : 'days'} with a leak</div>
            </div>
          </div>

          <section className="card">
            <h2>Night-time trips by day</h2>
            <NightChart summary={s} />
            <p className="small muted" style={{ marginTop: 'var(--s3)' }}>A grey dash means the day was not logged.</p>
          </section>

          <section className="card">
            <h2>What your diary shows</h2>
            {s.observations.length ? (
              <ul className="observations">
                {s.observations.map((o, i) => <li key={i}>{o.text}</li>)}
              </ul>
            ) : (
              <p>Nothing stands out yet. Comparisons appear once you have at least two mornings on each side, for example two after a large evening drink and two without.</p>
            )}
            <p className="small muted" style={{ marginTop: 'var(--s4)' }}>{PATTERNS_DISCLAIMER}</p>
          </section>

          <section className="card card--tint">
            <h2>Take this to your appointment</h2>
            <p>Your doctor or nurse can read the report in two minutes: these figures, the chart and every day you logged.</p>
            <Link to="/report" className="btn">Create your doctor report</Link>
          </section>
        </>
      )}
    </div>
  )
}
