import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../lib/api.js'
import { useSession } from '../lib/session.jsx'
import { useTitle } from '../lib/useTitle.js'

const PENDING = 'bs_pending_email' // survives a refresh while the user checks their email
const RESEND_SECONDS = 30
const store = {
  get: () => { try { return sessionStorage.getItem(PENDING) || '' } catch { return '' } },
  set: (v) => { try { v ? sessionStorage.setItem(PENDING, v) : sessionStorage.removeItem(PENDING) } catch { /* private mode */ } },
}

export default function SignIn() {
  useTitle('Sign in')
  const { status, user, setUser } = useSession()
  const navigate = useNavigate()
  const [email, setEmail] = useState(store.get())
  const [sentTo, setSentTo] = useState(store.get())
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (status === 'in') navigate(user.onboarded ? '/today' : '/welcome', { replace: true })
  }, [status, user, navigate])

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait(wait - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  async function send(e) {
    e?.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { email: normalised } = await api.startSignIn(email)
      store.set(normalised)
      setSentTo(normalised)
      setCode('')
      setWait(RESEND_SECONDS)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function verify(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { user } = await api.verifyCode(sentTo, code)
      store.set('')
      setUser(user)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  function differentEmail() {
    store.set('')
    setSentTo('')
    setError('')
  }

  if (!sentTo) {
    return (
      <div className="stack">
        <div>
          <h1>Sign in or start your diary</h1>
          <p className="muted">Enter your email. We will send you a 6-digit code. There is no password to remember.</p>
        </div>
        <form className="card" onSubmit={send} noValidate>
          <label className="question__label" htmlFor="email">Email address</label>
          <input id="email" className="input" type="email" inputMode="email" autoComplete="email" autoCapitalize="none"
            spellCheck="false" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {error && <div className="notice notice--danger" role="alert" style={{ marginTop: 'var(--s4)' }}><p>{error}</p></div>}
          <button className="btn btn--block" style={{ marginTop: 'var(--s5)' }} disabled={busy || !email}>
            {busy ? 'Sending…' : 'Email me a code'}
          </button>
        </form>
        <p className="small muted">New to BladderSense? The same step creates your diary.</p>
      </div>
    )
  }

  return (
    <div className="stack">
      <div>
        <h1>Check your email</h1>
        <p>We sent a 6-digit code to <strong>{sentTo}</strong>.</p>
      </div>
      <form className="card" onSubmit={verify} noValidate>
        <label className="question__label" htmlFor="code">Type the code</label>
        <span className="question__hint">It works for 20 minutes.</span>
        <input id="code" className="input input--code" inputMode="numeric" autoComplete="one-time-code" maxLength={7}
          pattern="[0-9 ]*" value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))} autoFocus />
        {error && <div className="notice notice--danger" role="alert" style={{ marginTop: 'var(--s4)' }}><p>{error}</p></div>}
        <button className="btn btn--block" style={{ marginTop: 'var(--s5)' }} disabled={busy || code.length !== 6}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
      </form>

      <div className="notice notice--neutral">
        <h3>Can't find it?</h3>
        <ul style={{ margin: '0 0 var(--s3)' }}>
          <li>Look in your <strong>Spam</strong>, <strong>Junk</strong> or <strong>Promotions</strong> folder. It comes from BladderSense, hello@bladdersense.com.</li>
          <li>It can take a minute to arrive.</li>
          <li>Opened it on another phone or computer? The button in the email signs you in on <em>that</em> device. To sign in here, type the code above.</li>
        </ul>
        <div className="btn-row">
          <button type="button" className="btn btn--secondary" onClick={send} disabled={busy || wait > 0}>
            {wait > 0 ? `Send again in ${wait}s` : 'Send a new code'}
          </button>
          <button type="button" className="btn btn--text" onClick={differentEmail}>Use a different email</button>
        </div>
      </div>
    </div>
  )
}
