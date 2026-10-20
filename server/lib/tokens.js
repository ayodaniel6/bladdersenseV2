import crypto from 'node:crypto'

export const randomToken = () => crypto.randomBytes(32).toString('base64url')

// Six digits, uniform, zero-padded. Digits are easier to read across devices than letters.
export const randomCode = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')

export const hash = (value) => crypto.createHash('sha256').update(value).digest('hex')

export const safeEqual = (a, b) =>
  a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
