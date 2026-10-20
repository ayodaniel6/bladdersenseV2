import { useEffect, useRef, useState } from 'react'
import { addDays, formatDate } from '../../shared/diary.js'

// Night-time trips per day across the selected range. A missing day is drawn
// as a short dash on the baseline so gaps are visible, never read as zero.
export default function NightChart({ summary }) {
  // Drawn at its real pixel width, so axis labels stay 14px instead of
  // shrinking with the screen.
  const box = useRef(null)
  const [W, setW] = useState(600)
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])

  const { startDate, daysInRange, entries } = summary
  const byDate = new Map(entries.map((e) => [e.date, e]))
  const max = Math.max(4, ...entries.map((e) => e.nightTrips))
  const H = 220
  const left = 28
  const bottom = 30
  const plotH = H - bottom - 8
  const slot = (W - left) / daysInRange
  const barW = Math.min(28, slot * 0.62)
  // Roughly one date label per 64px, so labels never collide.
  const labelEvery = Math.max(1, Math.ceil(daysInRange / Math.floor((W - left) / 64)))
  const ticks = []
  for (let v = 0; v <= max; v += max > 8 ? 2 : 1) ticks.push(v)

  const described = entries.map((e) => `${formatDate(e.date)}: ${e.nightTrips}`).join('; ')

  return (
    <div ref={box}>
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Night-time trips by day. ${described || 'No days logged.'}`}>
      {ticks.map((v) => {
        const y = 8 + plotH - (v / max) * plotH
        return (
          <g key={v}>
            <line x1={left} x2={W} y1={y} y2={y} stroke="var(--line)" />
            <text x={left - 8} y={y + 4} textAnchor="end">{v}</text>
          </g>
        )
      })}
      {Array.from({ length: daysInRange }, (_, i) => {
        const date = addDays(startDate, i)
        const e = byDate.get(date)
        const x = left + i * slot + (slot - barW) / 2
        const h = e ? Math.max((e.nightTrips / max) * plotH, 3) : 0
        return (
          <g key={date}>
            {e ? (
              <rect x={x} y={8 + plotH - h} width={barW} height={h} rx="3" fill="var(--accent)" />
            ) : (
              <line x1={x + barW * 0.2} x2={x + barW * 0.8} y1={8 + plotH - 2} y2={8 + plotH - 2} stroke="var(--control-line)" strokeWidth="2" />
            )}
            {(daysInRange - 1 - i) % labelEvery === 0 && (
              <text x={i === daysInRange - 1 ? x + barW : x + barW / 2} y={H - 6} textAnchor={i === daysInRange - 1 ? 'end' : 'middle'}>{formatDate(date, { day: 'numeric', month: 'short' })}</text>
            )}
          </g>
        )
      })}
    </svg>
    </div>
  )
}
