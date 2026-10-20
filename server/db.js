import pg from 'pg'

// Return DATE columns as 'YYYY-MM-DD' strings, not JS Dates shifted by the server timezone.
pg.types.setTypeParser(1082, (v) => v)

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
}

// Neon (and most hosts) put sslmode=require in the URL; pg honours it.
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 })

export const query = (text, params) => pool.query(text, params)
