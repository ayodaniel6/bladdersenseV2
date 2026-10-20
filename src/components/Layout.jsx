import { NavLink, Link, useLocation } from 'react-router'
import { useEffect } from 'react'
import { useSession } from '../lib/session.jsx'

const APP_PATHS = ['/today', '/patterns', '/report', '/settings']

export default function Layout({ children }) {
  const { status, user } = useSession()
  const { pathname } = useLocation()
  const signedIn = status === 'in' && user.onboarded
  const showTabs = signedIn && (APP_PATHS.includes(pathname) || pathname.startsWith('/guide'))

  useEffect(() => window.scrollTo(0, 0), [pathname])

  return (
    <>
      <header className="header">
        <div className="header__bar">
          <Link to={signedIn ? '/today' : '/'} className="brand">
            <img src="/logo-192.png" alt="" width="36" height="36" />
            <span>BladderSense</span>
          </Link>
          <nav className="header__links" aria-label="Site">
            <NavLink to="/guide">Guide</NavLink>
            {signedIn ? <NavLink to="/settings">Settings</NavLink> : status === 'out' && pathname !== '/sign-in' && <NavLink to="/sign-in">Sign in</NavLink>}
          </nav>
        </div>
        {showTabs && (
          <nav className="tabs" aria-label="Diary">
            <NavLink to="/today">Today</NavLink>
            <NavLink to="/patterns">Patterns</NavLink>
            <NavLink to="/report">Report</NavLink>
          </nav>
        )}
      </header>
      <main className="page">{children}</main>
      <footer className="footer">
        <Link to="/guide">The guide</Link>
        <Link to="/privacy">Privacy</Link>
        <span>Not a substitute for medical advice.</span>
        <span>Built by Jidoka Technologies.</span>
      </footer>
    </>
  )
}
