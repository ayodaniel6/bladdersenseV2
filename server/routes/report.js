import { Router } from 'express'
import { query } from '../db.js'
import { fail } from '../lib/http.js'
import { hash, randomToken } from '../lib/tokens.js'
import { renderReport } from '../report-pdf.js'
import { entriesBetween, rangeFor } from './entries.js'
import { summarise } from '../../shared/diary.js'

const LINK_DAYS = 30

async function streamPdf(res, user, startDate, endDate, disposition) {
  const summary = summarise(await entriesBetween(user.id, startDate, endDate), startDate, endDate, { voice: 'report' })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `${disposition}; filename="bladder-diary-${startDate}-to-${endDate}.pdf"`)
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  renderReport(summary, user, res)
}

export const reportRoutes = Router()

reportRoutes.get('/pdf', async (req, res) => {
  const { days, startDate, endDate } = rangeFor(req.user, req.query.days)
  await query(`INSERT INTO report_exports (user_id, kind, days) VALUES ($1, 'download', $2)`, [req.user.id, days])
  await streamPdf(res, req.user, startDate, endDate, 'attachment')
})

const linkView = (r) => ({
  id: r.id,
  startDate: r.start_date,
  endDate: r.end_date,
  expiresAt: r.expires_at,
  viewCount: r.view_count,
  lastViewedAt: r.last_viewed_at,
  createdAt: r.created_at,
})

reportRoutes.get('/links', async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM report_links WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC`,
    [req.user.id],
  )
  res.json({ links: rows.map(linkView) })
})

// The full URL is returned once, at creation. Only its hash is stored, so a
// lost link is revoked and replaced, never looked up.
reportRoutes.post('/links', async (req, res) => {
  const { days, startDate, endDate } = rangeFor(req.user, req.body?.days)
  const token = randomToken()
  const { rows } = await query(
    `INSERT INTO report_links (user_id, token_hash, start_date, end_date, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + make_interval(days => $5)) RETURNING *`,
    [req.user.id, hash(token), startDate, endDate, LINK_DAYS],
  )
  await query(`INSERT INTO report_exports (user_id, kind, days) VALUES ($1, 'link', $2)`, [req.user.id, days])
  const base = process.env.APP_URL || `${req.protocol}://${req.get('host')}`
  res.json({ link: linkView(rows[0]), url: `${base}/r/${token}` })
})

reportRoutes.delete('/links/:id', async (req, res) => {
  await query('UPDATE report_links SET revoked_at = NOW() WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
  res.json({ ok: true })
})

// Public: whoever holds the link sees the PDF for its fixed date range. No
// account, no login, nothing else of the user's is reachable from it.
export async function sharedReport(req, res) {
  const { rows } = await query(
    `UPDATE report_links SET view_count = view_count + 1, last_viewed_at = NOW()
      WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
      RETURNING user_id, start_date, end_date`,
    [hash(req.params.token)],
  )
  if (!rows[0]) {
    res.status(404).setHeader('X-Robots-Tag', 'noindex')
    return res.type('text/plain').send('This report link has expired or been withdrawn. Ask the patient for a new link.')
  }
  const { rows: users } = await query('SELECT * FROM users WHERE id = $1', [rows[0].user_id])
  if (!users[0]) fail(404, 'Not found.')
  await streamPdf(res, users[0], rows[0].start_date, rows[0].end_date, 'inline')
}
