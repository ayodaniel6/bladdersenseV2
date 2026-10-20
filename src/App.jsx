import { Navigate, Route, Routes, useLocation } from 'react-router'
import { useSession } from './lib/session.jsx'
import Layout from './components/Layout.jsx'
import Landing from './pages/Landing.jsx'
import SignIn from './pages/SignIn.jsx'
import AuthLink from './pages/AuthLink.jsx'
import Welcome from './pages/Welcome.jsx'
import Today from './pages/Today.jsx'
import Patterns from './pages/Patterns.jsx'
import Report from './pages/Report.jsx'
import Settings from './pages/Settings.jsx'
import Guide from './pages/Guide.jsx'
import GuideSection from './pages/GuideSection.jsx'
import Privacy from './pages/Privacy.jsx'

// Signed-in pages. Not signed in: go to sign-in. Signed in but not onboarded:
// go to the three-question welcome first.
function Private({ children, onboarding = false }) {
  const { status, user } = useSession()
  const location = useLocation()
  if (status === 'loading') return null
  if (status === 'out') return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  if (!onboarding && !user.onboarded) return <Navigate to="/welcome" replace />
  return children
}

// The landing page is for visitors; a signed-in user goes straight to Today.
function PublicHome() {
  const { status } = useSession()
  if (status === 'loading') return null
  if (status === 'in') return <Navigate to="/today" replace />
  return <Landing />
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<PublicHome />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/auth/link" element={<AuthLink />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="/guide/:id" element={<GuideSection />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/welcome" element={<Private onboarding><Welcome /></Private>} />
        <Route path="/today" element={<Private><Today /></Private>} />
        <Route path="/patterns" element={<Private><Patterns /></Private>} />
        <Route path="/report" element={<Private><Report /></Private>} />
        <Route path="/settings" element={<Private><Settings /></Private>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
