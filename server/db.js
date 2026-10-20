import pg from 'pg'

// Return DATE columns as 'YYYY-MM-DD' strings, not JS Dates shifted by the server timezone.
pg.types.setTypeParser(1082, (v) => v)

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
}

// Neon (and most hosts) put sslmode=require in the URL; pg honours it.
// Keep idle connections for 4 minutes: opening a new one to a remote database
// costs several round trips, and pg's default (10 seconds) meant nearly every
// click after a pause paid that cost. Give up connecting after 10 seconds
// rather than leaving a page waiting.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 240_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
})

// A dropped idle connection (e.g. the database restarted) must not crash the server.
pool.on('error', (err) => console.error('Database connection dropped:', err.message))

export const query = (text, params) => pool.query(text, params)
