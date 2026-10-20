import { useTitle } from '../lib/useTitle.js'

export default function Privacy() {
  useTitle('Privacy')
  return (
    <div className="stack prose">
      <h1>Privacy</h1>
      <p className="lede">Your diary is about your health. We treat it that way.</p>
      <h3>What we keep</h3>
      <ul>
        <li>Your email address, first name, and year of birth if you give it.</li>
        <li>The diary entries you save.</li>
        <li>The report links you create, and how many times each was opened.</li>
      </ul>
      <h3>What we do not do</h3>
      <ul>
        <li>No adverts, no analytics or tracking scripts, no third-party fonts.</li>
        <li>We never sell or share your data. A report is seen only by people you give the PDF or link to.</li>
        <li>Emails never contain your diary or symptoms.</li>
      </ul>
      <h3>Who processes it</h3>
      <ul>
        <li>The database is hosted by Neon (Postgres), and the app by Render.</li>
        <li>Sign-in and reminder emails are sent by Resend.</li>
      </ul>
      <h3>Your control</h3>
      <ul>
        <li>Withdraw any report link on the Report page.</li>
        <li>Delete your account in Settings. That removes every entry and link immediately.</li>
      </ul>
      <p className="muted">BladderSense records what you tell it. It is not a medical device and does not diagnose or treat any condition.</p>
    </div>
  )
}
