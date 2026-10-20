import PDFDocument from 'pdfkit'
import { activityLabel, addDays, drinksLabel, fmt, formatDate, sleepLabel } from '../shared/diary.js'

// The Doctor Report: one A4 document a clinician can read in two minutes.
// Page 1 is the summary and chart; the daily log and notes follow.

const INK = '#172033'
const MUTED = '#4B5565'
const LINE = '#DAD7CE'
const ACCENT = '#0F6E6A'
const TINT = '#E4F1EF'
const M = 48 // page margin

export function renderReport(summary, user, out) {
  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true, info: { Title: 'Bladder diary report', Author: 'BladderSense' } })
  doc.pipe(out)
  const width = doc.page.width - M * 2

  // ---- header
  doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(10).text('BLADDERSENSE', M, M, { characterSpacing: 1 })
  doc.moveDown(0.3).fillColor(INK).fontSize(22).text('Bladder diary report')
  doc.moveDown(0.2).font('Helvetica').fontSize(11).fillColor(MUTED)
    .text('Recorded by the patient each morning. Each day covers the night before and the 24 hours before waking.')
  doc.moveDown(1)

  const period = `${formatDate(summary.startDate, { day: 'numeric', month: 'short', year: 'numeric' })} to ${formatDate(summary.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}`
  const details = [
    ['Name', user.first_name || 'Not given'],
    ['Year of birth', user.birth_year ? String(user.birth_year) : 'Not given'],
    ['Period', `${period} (${summary.daysInRange} days)`],
    ['Days logged', `${summary.daysLogged} of ${summary.daysInRange}`],
    ['Generated', formatDate(new Date().toISOString().slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })],
  ]
  labelRows(doc, details, width)
  doc.moveDown(1)

  // ---- key figures
  heading(doc, 'Summary')
  const s = summary
  const n = s.daysLogged
  const figures = n
    ? [
        ['Night-time trips', `${fmt(s.nightTrips.avg)} per night on average (range ${s.nightTrips.min} to ${s.nightTrips.max})`],
        ['Sudden, strong urges', s.urgent.daysAnswered ? `${fmt(s.urgent.avg)} per day on average` : 'Not recorded'],
        ['Leaks', !s.leaks.daysAnswered ? 'Not recorded' : s.leaks.total ? `${s.leaks.total} in total, on ${s.leaks.days} of ${s.leaks.daysAnswered} days` : 'None logged'],
        ['Sleep', `Good ${s.sleep.good}, fair ${s.sleep.fair}, poor ${s.sleep.poor} (nights)`],
        ['Evening drinks', `None ${s.drinks.none}, small ${s.drinks.small}, moderate ${s.drinks.moderate}, large ${s.drinks.large}`],
        ['Caffeine or alcohol', s.caffeineAlcohol.daysAnswered ? `On ${s.caffeineAlcohol.evenings} of ${s.caffeineAlcohol.daysAnswered} evenings` : 'Not recorded'],
      ]
    : [['', 'No days were logged in this period.']]
  labelRows(doc, figures, width)
  doc.moveDown(1)

  // ---- chart
  if (n) {
    heading(doc, 'Night-time trips by day')
    chart(doc, s, width)
    doc.moveDown(1)
  }

  // ---- observations
  if (s.observations.length) {
    heading(doc, 'Patterns in the logged days')
    doc.font('Helvetica').fontSize(11).fillColor(INK)
    for (const o of s.observations) {
      doc.text(`•  ${o.text}`, M, doc.y, { width, indent: 0, paragraphGap: 4 })
    }
    doc.moveDown(0.3).fontSize(9.5).fillColor(MUTED)
      .text('Observed associations in self-reported data over a short period. They do not show cause.', { width })
  }

  // ---- daily log
  if (n) {
    doc.addPage()
    heading(doc, 'Daily log')
    table(doc, s, width)
    const withNotes = s.entries.filter((e) => e.notes)
    if (withNotes.length) {
      doc.moveDown(1)
      heading(doc, 'Notes')
      for (const e of withNotes) {
        ensureSpace(doc, 40)
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(formatDate(e.date), M, doc.y, { continued: true })
        doc.font('Helvetica').text(`   ${e.notes}`, { width, paragraphGap: 4 })
      }
    }
  }

  // ---- footer on every page
  const range = doc.bufferedPageRange()
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i)
    const y = doc.page.height - M + 12
    doc.page.margins.bottom = 0
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
      .text('Self-reported diary kept with BladderSense (bladdersense.com). Not a diagnosis.', M, y, { width: width - 60, lineBreak: false })
      .text(`Page ${i + 1} of ${range.count}`, M, y, { width, align: 'right', lineBreak: false })
  }
  doc.end()
}

function heading(doc, text) {
  ensureSpace(doc, 60)
  doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text(text, M, doc.y)
  doc.moveDown(0.4)
}

function labelRows(doc, rows, width) {
  doc.fontSize(11)
  for (const [label, value] of rows) {
    const y = doc.y
    doc.font('Helvetica').fillColor(MUTED).text(label, M, y, { width: 130 })
    doc.font('Helvetica').fillColor(INK).text(value, M + 140, y, { width: width - 140 })
    doc.moveDown(0.25)
  }
}

function ensureSpace(doc, h) {
  if (doc.y + h > doc.page.height - M - 20) doc.addPage()
}

function chart(doc, s, width) {
  const byDate = new Map(s.entries.map((e) => [e.date, e]))
  const h = 120
  ensureSpace(doc, h + 40)
  const top = doc.y
  const max = Math.max(4, s.nightTrips.max)
  const left = M + 24
  const plotW = width - 24
  const slot = plotW / s.daysInRange
  const barW = Math.min(18, slot * 0.6)

  doc.font('Helvetica').fontSize(8).fillColor(MUTED)
  for (let v = 0; v <= max; v += max > 8 ? 2 : 1) {
    const y = top + h - (v / max) * h
    doc.moveTo(left, y).lineTo(left + plotW, y).lineWidth(0.5).strokeColor(LINE).stroke()
    doc.text(String(v), M, y - 4, { width: 18, align: 'right' })
  }
  for (let i = 0; i < s.daysInRange; i++) {
    const date = addDays(s.startDate, i)
    const x = left + i * slot + (slot - barW) / 2
    const e = byDate.get(date)
    if (e) {
      const bh = Math.max((e.nightTrips / max) * h, e.nightTrips === 0 ? 0 : 2)
      doc.rect(x, top + h - bh, barW, bh).fill(ACCENT)
      if (e.nightTrips === 0) doc.rect(x, top + h - 1.5, barW, 1.5).fill(ACCENT)
    } else {
      doc.fillColor(MUTED).text('–', x, top + h - 10, { width: barW, align: 'center' })
    }
    const every = s.daysInRange > 14 ? 3 : 1
    if (i % every === 0 || i === s.daysInRange - 1) {
      doc.fillColor(MUTED).fontSize(7.5).text(formatDate(date, { day: 'numeric', month: 'short' }), x - 10, top + h + 4, { width: barW + 20, align: 'center' })
    }
  }
  doc.y = top + h + 20
  doc.fillColor(MUTED).fontSize(8.5).text('A dash means the day was not logged.', M, doc.y)
}

const orDash = (v) => (v === null || v === undefined ? '–' : String(v))

function table(doc, s, width) {
  const cols = [
    ['Date', 78, (e) => formatDate(e.date)],
    ['Night trips', 46, (e) => String(e.nightTrips)],
    ['Urges', 40, (e) => orDash(e.urgent)],
    ['Leaks', 38, (e) => orDash(e.leaks)],
    ['Evening drinks', 64, (e) => drinksLabel(e.eveningDrinks)],
    ['Caffeine / alcohol', 56, (e) => (e.caffeineAlcohol === null ? '–' : e.caffeineAlcohol ? 'Yes' : 'No')],
    ['Activity', 62, (e) => activityLabel(e.activity)],
    ['Stress (1–5)', 48, (e) => String(e.stress)],
    ['Sleep', 52, (e) => sleepLabel(e.sleep)],
  ]
  const rowH = 20
  const drawHeader = () => {
    const y = doc.y
    doc.rect(M, y, width, 28).fill(TINT)
    let x = M + 4
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INK)
    for (const [label, w] of cols) {
      doc.text(label, x, y + 4, { width: w - 6 })
      x += w
    }
    doc.y = y + 28
  }
  drawHeader()
  for (const e of s.entries) {
    if (doc.y + rowH > doc.page.height - M - 20) {
      doc.addPage()
      drawHeader()
    }
    const y = doc.y
    let x = M + 4
    doc.font('Helvetica').fontSize(9.5).fillColor(INK)
    for (const [, w, value] of cols) {
      doc.text(value(e), x, y + 5, { width: w - 6, lineBreak: false })
      x += w
    }
    doc.moveTo(M, y + rowH).lineTo(M + width, y + rowH).lineWidth(0.5).strokeColor(LINE).stroke()
    doc.y = y + rowH
  }
}
