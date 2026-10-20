import { Link } from 'react-router'
import { useTitle } from '../lib/useTitle.js'

const SAMPLE = [3, 2, 3, 1, 2, 1, 1]

export default function Landing() {
  useTitle(null)
  return (
    <div className="stack">
      <section className="hero">
        <h1>A bladder diary your doctor can actually use.</h1>
        <p className="lede">
          Each morning, answer eight quick questions about last night and yesterday. BladderSense shows you what goes with
          better and worse nights, and turns your diary into a clear report to take to your appointment.
        </p>
        <div className="btn-row">
          <Link to="/sign-in" className="btn">Start your diary</Link>
          <Link to="/guide" className="btn btn--secondary">Read the guide first</Link>
        </div>
        <p className="small muted" style={{ marginTop: 'var(--s3)' }}>Free. No password, no app to install.</p>
      </section>

      <section className="card">
        <h2>How it works</h2>
        <ol className="steps">
          <li>
            <div>
              <h3>Log each morning, in under a minute</h3>
              <p className="muted">Night-time trips, urges, leaks, evening drinks, sleep. Tap, don't type.</p>
            </div>
          </li>
          <li>
            <div>
              <h3>See your pattern after three mornings</h3>
              <p className="muted">For example, how your nights compare after a large evening drink.</p>
            </div>
          </li>
          <li>
            <div>
              <h3>Share a two-page report</h3>
              <p className="muted">Download a PDF, or send your doctor a private link that expires in 30 days.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="card sample" aria-label="Example of a pattern summary">
        <p className="group-title" style={{ marginBottom: 0 }}>Example</p>
        <p style={{ marginBottom: 0 }}><strong>Night-time trips, last 7 days</strong></p>
        <div className="sample__bars" aria-hidden="true">
          {SAMPLE.map((v, i) => <span key={i} style={{ height: `${(v / 3) * 100}%` }} />)}
        </div>
        <p style={{ marginBottom: 0 }}>
          On the 3 mornings after moderate or large evening drinks, you logged 2.7 night-time trips on average. On the
          other 4 mornings, 1.3.
        </p>
      </section>

      <section>
        <h2>Private by design</h2>
        <ul>
          <li>No adverts and no tracking scripts.</li>
          <li>Your diary is never sold or shared. Only you decide who sees a report.</li>
          <li>Emails never mention your symptoms.</li>
          <li>Delete your account and everything in it with one button.</li>
        </ul>
        <p className="small muted">
          BladderSense records what you tell it. It does not diagnose or treat anything. If you notice blood in your
          urine, pain, or you suddenly cannot pass urine, contact a doctor straight away.
        </p>
      </section>
    </div>
  )
}
