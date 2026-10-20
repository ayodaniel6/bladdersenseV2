import { useId } from 'react'

// A question: label, optional hint, and its control. Rendered as a fieldset
// so screen readers announce the question with every option.
export function Question({ label, hint, children }) {
  return (
    <fieldset className="question">
      <legend className="question__label">{label}</legend>
      {hint && <span className="question__hint">{hint}</span>}
      {children}
    </fieldset>
  )
}

// All options visible, one tap to choose. Four options with hints lay out as
// a grid (2×2 on a phone) so each hint stays readable.
export function Segmented({ options, value, onChange, grid = false, columns, label }) {
  const style = columns ? { gridAutoFlow: 'row', gridTemplateColumns: `repeat(${columns}, 1fr)` } : undefined
  return (
    <div className={`segmented${grid ? ' segmented--grid' : ''}`} style={style} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className="segment"
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {grid && o.hint && <small>{o.hint}</small>}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ value, onChange, max, label }) {
  const id = useId()
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0} aria-label="One fewer">−</button>
      <output id={id} aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="One more">+</button>
    </div>
  )
}
