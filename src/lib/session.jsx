import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api.js'

// The server's session cookie is the only source of truth. Nothing about the
// user is kept in localStorage.
const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null })

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.me()
      setState(user ? { status: 'in', user } : { status: 'out', user: null })
    } catch {
      setState({ status: 'out', user: null })
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = {
    ...state,
    setUser: (user) => setState({ status: user ? 'in' : 'out', user }),
    refresh,
  }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export const useSession = () => useContext(SessionContext)
