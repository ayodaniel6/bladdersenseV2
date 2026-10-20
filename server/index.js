import express from 'express'
import helmet from 'helmet'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { query } from './db.js'
import { HttpError } from './lib/http.js'
import { authRoutes, loadUser, requireUser } from './auth.js'
import { meRoutes } from './routes/me.js'
import { entryRoutes, summaryRoute } from './routes/entries.js'
import { reportRoutes, sharedReport } from './routes/report.js'

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const app = express()

app.set('trust proxy', 1) // one hop: the host's load balancer
app.use(helmet())
app.use(express.json({ limit: '20kb' }))
app.use(loadUser)

// ---- API
const api = express.Router()
api.get('/health', async (req, res) => {
  await query('SELECT 1')
  res.json({ ok: true })
})
api.use('/auth', authRoutes)
// Signed out is a normal state for the app's first request, not an error.
api.get('/me', (req, res, next) => (req.user ? next() : res.json({ user: null })))
api.use('/me', requireUser, meRoutes)
api.use('/entries', requireUser, entryRoutes)
api.get('/summary', requireUser, summaryRoute)
api.use('/report', requireUser, reportRoutes)
api.use((req, res) => res.status(404).json({ error: 'Not found.' }))
app.use('/api', api)

// ---- Doctor Report share links
app.get('/r/:token', sharedReport)

// ---- The React app (built by `npm run build`)
app.use(express.static(dist, { index: false, maxAge: '1y', immutable: true }))
app.get('/{*path}', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache')
  res.sendFile(path.join(dist, 'index.html'))
})

app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request.' })
  console.error(err)
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' })
})

const port = Number(process.env.PORT) || 3000
app.listen(port, () => console.log(`BladderSense listening on http://localhost:${port}`))
