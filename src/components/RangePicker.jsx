import { Segmented } from './Controls.jsx'

export const RANGES = [7, 14, 30].map((d) => ({ value: d, label: `${d} days` }))

export function useStoredRange() {
  const read = () => { try { return Number(localStorage.getItem('bs_range')) || 14 } catch { return 14 } }
  const write = (v) => { try { localStorage.setItem('bs_range', String(v)) } catch { /* private mode */ } }
  return [read, write]
}

export default function RangePicker({ value, onChange }) {
  return <Segmented label="Period" options={RANGES} value={value} onChange={onChange} />
}
