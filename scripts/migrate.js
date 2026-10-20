// Applies migrations/*.sql in filename order, each once, each in a transaction.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from '../server/db.js'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations')
const client = await pool.connect()
try {
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())')
  const done = new Set((await client.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename))
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue
    console.log(`Applying ${file}`)
    await client.query('BEGIN')
    try {
      await client.query(fs.readFileSync(path.join(dir, file), 'utf8'))
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    }
  }
  console.log('Migrations up to date.')
} finally {
  client.release()
  await pool.end()
}
