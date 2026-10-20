// The diary definition. Imported by the browser (form, patterns page) and the
// server (validation, PDF, emails), so a field is described exactly once.

export const DRINKS = [
  { value: 'none', label: 'None', hint: 'Nothing, or a few sips' },
  { value: 'small', label: 'Small', hint: 'About 1 cup (150–250 ml)' },
  { value: 'moderate', label: 'Moderate', hint: '1–2 cups (300–500 ml)' },
  { value: 'large', label: 'Large', hint: 'More than 2 cups (over 500 ml)' },
]

export const ACTIVITY = [
  { value: 'none', label: 'None', hint: 'Mostly sitting' },
  { value: 'light', label: 'Light', hint: 'Short walks, light chores' },
  { value: 'moderate', label: 'Moderate', hint: 'Regular walking, active jobs' },
  { value: 'high', label: 'High', hint: 'Exercise or long periods on your feet' },
]

export const STRESS = [
  { value: 1, label: '1', hint: 'Calm' },
  { value: 2, label: '2', hint: '' },
  { value: 3, label: '3', hint: 'Some' },
  { value: 4, label: '4', hint: '' },
  { value: 5, label: '5', hint: 'A lot' },
]

export const SLEEP = [
  { value: 'poor', label: 'Poor' },
  { value: 'fair', label: 'Fair' },
  { value: 'good', label: 'Good' },
]

export const YES_NO = [
  { value: false, label: 'No' },
  { value: true, label: 'Yes' },
]

export const COUNT_FIELDS = {
  nightTrips: { label: 'Times you got up to pass urine last night', short: 'Night trips', max: 15 },
  urgent: { label: 'Sudden, strong urges to go in the last 24 hours', short: 'Urgent', max: 30 },
  leaks: { label: 'Leaks in the last 24 hours, however small', short: 'Leaks', max: 30 },
}

export const NOTES_MAX = 500
export const BACKFILL_DAYS = 7

const labelOf = (options, value) => options.find((o) => o.value === value)?.label ?? ''
export const drinksLabel = (v) => labelOf(DRINKS, v)
export const activityLabel = (v) => labelOf(ACTIVITY, v)
export const sleepLabel = (v) => labelOf(SLEEP, v)

// ---------------------------------------------------------------- dates
// Dates are plain 'YYYY-MM-DD' strings in the user's timezone.

export function localDate(timeZone, at = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
}

export function localHour(timeZone, at = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(at))
}

export function localWeekday(timeZone, at = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'long' }).format(at)
}

export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000)
}

export function formatDate(iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts })
}

export function isValidTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return typeof tz === 'string' && tz.length > 0
  } catch {
    return false
  }
}

// ---------------------------------------------------------------- validation

const inOptions = (options, v) => options.some((o) => o.value === v)

// Returns { entry } or { error } for a diary entry body.
export function validateEntry(body) {
  if (!body || typeof body !== 'object') return { error: 'Missing entry.' }
  const entry = {}
  for (const [key, { short, max }] of Object.entries(COUNT_FIELDS)) {
    const n = body[key]
    if (!Number.isInteger(n) || n < 0 || n > max) return { error: `${short}: enter a number from 0 to ${max}.` }
    entry[key] = n
  }
  if (!inOptions(DRINKS, body.eveningDrinks)) return { error: 'Choose how much you drank in the evening.' }
  if (typeof body.caffeineAlcohol !== 'boolean') return { error: 'Choose whether you had caffeine or alcohol in the evening.' }
  if (!inOptions(ACTIVITY, body.activity)) return { error: 'Choose your activity level.' }
  if (!inOptions(STRESS, body.stress)) return { error: 'Choose a stress level from 1 to 5.' }
  if (!inOptions(SLEEP, body.sleep)) return { error: 'Choose how you slept.' }
  const notes = typeof body.notes === 'string' ? body.notes.trim() : ''
  if (notes.length > NOTES_MAX) return { error: `Notes can be up to ${NOTES_MAX} characters.` }
  Object.assign(entry, {
    eveningDrinks: body.eveningDrinks,
    caffeineAlcohol: body.caffeineAlcohol,
    activity: body.activity,
    stress: body.stress,
    sleep: body.sleep,
    notes: notes || null,
  })
  return { entry }
}

// ---------------------------------------------------------------- summary

export const MIN_DAYS_FOR_PATTERNS = 3
const MIN_GROUP = 2 // never compare against fewer than 2 mornings
const SAME_THRESHOLD = 0.5

const round1 = (n) => Math.round(n * 10) / 10
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
export const fmt = (n) => (Number.isInteger(round1(n)) ? String(round1(n)) : round1(n).toFixed(1))
const mornings = (n) => `${n} ${n === 1 ? 'morning' : 'mornings'}`

// Compare a measure between entries that match a condition and those that
// don't. Phrased as what was logged, never as a cause. voice 'you' is for the
// person's own screen; 'report' is the neutral wording of the Doctor Report.
function compare(entries, test, measure, { when, whenReport = when, otherwise, what }, voice) {
  const yes = entries.filter(test)
  const no = entries.filter((e) => !test(e))
  if (yes.length < MIN_GROUP || no.length < MIN_GROUP) return null
  const a = avg(yes.map(measure))
  const b = avg(no.map(measure))
  const diff = a - b
  if (Math.abs(diff) < SAME_THRESHOLD) {
    return {
      tone: 'neutral',
      text: `${capital(what)} were about the same ${voice === 'report' ? whenReport : when} (${fmt(a)}) as ${otherwise} (${fmt(b)}).`,
    }
  }
  return {
    tone: diff > 0 ? 'higher' : 'lower',
    text: voice === 'report'
      ? `${capital(whenReport)} (${mornings(yes.length)}): ${fmt(a)} ${what} on average, against ${fmt(b)} on the other ${mornings(no.length)}.`
      : `On the ${mornings(yes.length)} ${when}, you logged ${fmt(a)} ${what} on average. On the other ${mornings(no.length)}, ${fmt(b)}.`,
  }
}

const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// entries: [{ date, nightTrips, urgent, leaks, eveningDrinks, caffeineAlcohol, activity, stress, sleep, notes }]
export function summarise(entries, startDate, endDate, { voice = 'you' } = {}) {
  const inRange = entries
    .filter((e) => e.date >= startDate && e.date <= endDate)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  const daysInRange = daysBetween(startDate, endDate) + 1
  const n = inRange.length
  const trips = inRange.map((e) => e.nightTrips)

  // Days imported from v1 have no urgent/leaks/caffeine answer (null).
  const known = (key) => inRange.filter((e) => e[key] !== null && e[key] !== undefined)
  const withUrgent = known('urgent')
  const withLeaks = known('leaks')
  const withCaffeine = known('caffeineAlcohol')

  const summary = {
    startDate,
    endDate,
    daysInRange,
    daysLogged: n,
    ready: n >= MIN_DAYS_FOR_PATTERNS,
    entries: inRange,
    nightTrips: { avg: round1(avg(trips)), min: n ? Math.min(...trips) : 0, max: n ? Math.max(...trips) : 0 },
    urgent: { avg: round1(avg(withUrgent.map((e) => e.urgent))), daysAnswered: withUrgent.length },
    leaks: { total: withLeaks.reduce((t, e) => t + e.leaks, 0), days: withLeaks.filter((e) => e.leaks > 0).length, daysAnswered: withLeaks.length },
    sleep: Object.fromEntries(SLEEP.map((s) => [s.value, inRange.filter((e) => e.sleep === s.value).length])),
    drinks: Object.fromEntries(DRINKS.map((d) => [d.value, inRange.filter((e) => e.eveningDrinks === d.value).length])),
    caffeineAlcohol: { evenings: withCaffeine.filter((e) => e.caffeineAlcohol).length, daysAnswered: withCaffeine.length },
    observations: [],
  }

  if (!summary.ready) return summary

  const obs = [
    compare(inRange, (e) => e.eveningDrinks === 'moderate' || e.eveningDrinks === 'large', (e) => e.nightTrips, {
      when: 'after moderate or large evening drinks',
      otherwise: 'after none or small',
      what: 'night-time trips',
    }, voice),
    compare(withCaffeine, (e) => e.caffeineAlcohol, (e) => e.nightTrips, {
      when: 'after caffeine or alcohol in the evening',
      otherwise: 'without',
      what: 'night-time trips',
    }, voice),
    compare(inRange, (e) => e.sleep === 'poor', (e) => e.nightTrips, {
      when: 'when you slept poorly',
      whenReport: 'on nights of poor sleep',
      otherwise: 'on fair or good nights',
      what: 'night-time trips',
    }, voice),
    compare(withUrgent, (e) => e.stress >= 4, (e) => e.urgent, {
      when: 'after a day with stress at 4 or 5',
      otherwise: 'after calmer days',
      what: 'urgent moments',
    }, voice),
    compare(inRange, (e) => e.activity === 'moderate' || e.activity === 'high', (e) => e.nightTrips, {
      when: 'after a moderately or very active day',
      otherwise: 'after less active days',
      what: 'night-time trips',
    }, voice),
  ]

  // Change over time: the later half of the logged mornings against the earlier half.
  if (n >= 6) {
    const half = Math.floor(n / 2)
    const early = avg(trips.slice(0, half))
    const late = avg(trips.slice(n - half))
    const diff = late - early
    const steady = Math.abs(diff) < SAME_THRESHOLD
    const your = voice === 'report' ? 'the' : 'your'
    obs.unshift({
      tone: steady ? 'neutral' : diff > 0 ? 'higher' : 'lower',
      text: steady
        ? `Night-time trips have been steady: ${fmt(early)} on average in ${your} earlier ${mornings(half)}, ${fmt(late)} in ${your} latest ${mornings(half)}.`
        : voice === 'report'
          ? `Latest ${mornings(half)}: ${fmt(late)} night-time trips on average, against ${fmt(early)} in the earlier ${mornings(half)}.`
          : `Your latest ${mornings(half)} averaged ${fmt(late)} night-time trips, compared with ${fmt(early)} in the earlier ${mornings(half)}.`,
    })
  }

  summary.observations = obs.filter(Boolean)
  return summary
}

export const PATTERNS_DISCLAIMER =
  'These are patterns in what you logged, not a diagnosis. A small number of days can show differences by chance. Share them with your doctor or nurse.'
