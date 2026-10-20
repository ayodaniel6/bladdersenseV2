import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { api } from '../lib/api.js'
import { useSession } from '../lib/session.jsx'
import { useTitle } from '../lib/useTitle.js'

// Landing page for the emailed link. The token is only used when the person
// presses Continue: email security scanners open links automatically, and must
// not be able to spend the sign-in before the person does.
export default function AuthLink() {
  useTitle('Sign in')
  const [params] = useSearchParams()
  const { setUser } = useSession()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function go() {
    setBusy(true)
    setError('')
    try {
      const { user } = await api.verifyLink(params.get('t') || '')
      setUser(user)
      navigate(user.onboarded ? '/today' : '/welcome', { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <h1>Sign in on this device</h1>
      {error ? (
        <div className="notice notice--warning" role="alert">
          <p>{error}</p>
          <Link to="/sign-in" className="btn">Get a new sign-in email</Link>
        </div>
      ) : (
        <div className="card">
          <p>You will stay signed in on this device until you sign out.</p>
          <button className="btn btn--block" onClick={go} disabled={busy}>{busy ? 'Signing in…' : 'Continue'}</button>
        </div>
      )}
    </div>
  )
}
