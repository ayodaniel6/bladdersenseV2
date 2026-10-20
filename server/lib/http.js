// Express 5 forwards rejected promises to the error handler, so routes can be
// plain async functions. HttpError carries a status and a message safe to show.
export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export const fail = (status, message) => {
  throw new HttpError(status, message)
}

// Small fixed-window limiter. One instance, so memory is the right store.
export function rateLimit({ windowMs, max }) {
  const hits = new Map()
  setInterval(() => hits.clear(), windowMs).unref()
  return (key) => {
    const n = (hits.get(key) ?? 0) + 1
    hits.set(key, n)
    return n <= max
  }
}
