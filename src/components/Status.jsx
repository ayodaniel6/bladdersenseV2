import { useEffect, useState } from 'react'

// Shown while a page waits for its data. The heading appears at once so the
// page never looks empty; the "Loading" line waits 300ms so fast loads don't flicker.
export function Loading({ title }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="stack">
      {title && <h1>{title}</h1>}
      <p className="muted" role="status" aria-live="polite">{show ? 'Loading your diary…' : ' '}</p>
    </div>
  )
}

export function LoadError({ title, message, onRetry }) {
  return (
    <div className="stack">
      {title && <h1>{title}</h1>}
      <div className="notice notice--warning" role="alert">
        <p>{message}</p>
        {onRetry && <button type="button" className="btn" onClick={onRetry}>Try again</button>}
      </div>
    </div>
  )
}
