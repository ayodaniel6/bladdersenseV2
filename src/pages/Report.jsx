import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api, reportPdfUrl } from '../lib/api.js'
import { useTitle } from '../lib/useTitle.js'
import RangePicker, { useStoredRange } from '../components/RangePicker.jsx'
import { formatDate } from '../../shared/diary.js'

const long = (iso) => formatDate(iso.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })

export default function Report() {
  useTitle('Doctor report')
  const [readRange, writeRange] = useStoredRange()
  const [days, setDays] = useState(readRange)
  const [summary, setSummary] = useState(null)
  const [links, setLinks] = useState([])
  const [created, setCreated] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    writeRange(days)
    api.summary(days).then(setSummary).catch((err) => setError(err.message))
  }, [days])

  useEffect(() => {
    api.reportLinks().then(({ links }) => setLinks(links)).catch(() => {})
  }, [])

  async function createLink() {
    setBusy(true)
    setError('')
    try {
      const { link, url } = await api.createReportLink(days)
      setCreated(url)
      setCopied(false)
      setLinks((l) => [link, ...l])
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(created)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  async function revoke(id) {
    await api.revokeReportLink(id)
    setLinks((l) => l.filter((x) => x.id !== id))
  }

  const empty = summary && summary.daysLogged === 0
  const mailto = created && `mailto:?subject=${encodeURIComponent('My bladder diary')}&body=${encodeURIComponent(`Here is my bladder diary report:\n\n${created}\n\nThe link works for 30 days.`)}`

  return (
    <div className="stack">
      <div>
        <h1>Doctor report</h1>
        <p className="muted">A two-page PDF: who and when, the key figures, a chart of your nights, the patterns, and every day you logged with your notes.</p>
      </div>

      <RangePicker value={days} onChange={(d) => { setDays(d); setCreated(null) }} />

      {!summary && !error && <p className="muted" role="status">Loading your diary…</p>}
      {summary && (
        <p>
          <strong>{summary.daysLogged} of {summary.daysInRange} days logged</strong>, {long(summary.startDate)} to {long(summary.endDate)}.
          {summary.daysLogged > 0 && summary.daysLogged < 3 && ' A few more days will make the report more useful.'}
        </p>
      )}

      {!summary ? null : empty ? (
        <div className="notice notice--neutral">
          <p>There is nothing to report for this period yet.</p>
          <Link to="/today" className="btn">Log today</Link>
        </div>
      ) : (
        <>
          <section className="card">
            <h2>Download</h2>
            <p>Print it, or bring it on your phone.</p>
            <a className="btn btn--block" href={reportPdfUrl(days)} download>Download PDF</a>
          </section>

          <section className="card">
            <h2>Send a link to your doctor</h2>
            <p>Anyone with the link can open this one report for 30 days. It shows nothing else from your account, and you can withdraw it at any time.</p>
            {created ? (
              <div className="stack">
                <label className="question__label" htmlFor="link">Your link</label>
                <input id="link" className="input" readOnly value={created} onFocus={(e) => e.target.select()} />
                <div className="btn-row">
                  <button type="button" className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
                  <a className="btn btn--secondary" href={mailto}>Email it</a>
                </div>
                <p className="small muted">Paste it into your surgery's online form or an email. We only show the full link once.</p>
              </div>
            ) : (
              <button type="button" className="btn btn--secondary btn--block" onClick={createLink} disabled={busy}>
                {busy ? 'Creating…' : 'Create a link'}
              </button>
            )}
          </section>
        </>
      )}

      {error && <div className="notice notice--danger" role="alert"><p>{error}</p></div>}

      {links.length > 0 && (
        <section>
          <h2>Active links</h2>
          <ul className="link-list">
            {links.map((l) => (
              <li key={l.id}>
                <div>
                  <strong>{long(l.startDate)} to {long(l.endDate)}</strong>
                  <div className="small muted">
                    Opened {l.viewCount} {l.viewCount === 1 ? 'time' : 'times'} · works until {long(l.expiresAt)}
                  </div>
                </div>
                <button type="button" className="btn btn--secondary" onClick={() => revoke(l.id)}>Withdraw</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
