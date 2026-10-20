// Every call is same-origin and carries the session cookie automatically.
const TIMEOUT_MS = 20_000

async function request(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    // Offline, server down, or no answer within 20 seconds.
    const err = new Error('We could not reach BladderSense. Check your internet connection and try again.')
    err.status = 0
    throw err
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong. Please try again.')
    err.status = res.status
    throw err
  }
  return data
}

export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

export const api = {
  me: () => request('/me'),
  updateMe: (body) => request('/me', { method: 'PATCH', body }),
  deleteMe: () => request('/me', { method: 'DELETE' }),

  startSignIn: (email) => request('/auth/start', { method: 'POST', body: { email } }),
  verifyCode: (email, code) => request('/auth/verify-code', { method: 'POST', body: { email, code, timezone: deviceTimeZone() } }),
  verifyLink: (token) => request('/auth/verify-link', { method: 'POST', body: { token, timezone: deviceTimeZone() } }),
  signOut: () => request('/auth/sign-out', { method: 'POST' }),

  entries: () => request('/entries'),
  saveEntry: (date, entry) => request(`/entries/${date}`, { method: 'PUT', body: entry }),
  summary: (days) => request(`/summary?days=${days}`),

  reportLinks: () => request('/report/links'),
  createReportLink: (days) => request('/report/links', { method: 'POST', body: { days } }),
  revokeReportLink: (id) => request(`/report/links/${id}`, { method: 'DELETE' }),
}

export const reportPdfUrl = (days) => `/api/report/pdf?days=${days}`
