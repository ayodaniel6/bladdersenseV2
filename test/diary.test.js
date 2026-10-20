import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, localDate, summarise, validateEntry } from '../shared/diary.js'

const day = (date, over = {}) => ({
  date, nightTrips: 1, urgent: 1, leaks: 0, eveningDrinks: 'small', caffeineAlcohol: false,
  activity: 'light', stress: 2, sleep: 'good', notes: null, ...over,
})

test('validateEntry accepts a complete entry and trims notes', () => {
  const { entry, error } = validateEntry({ ...day('x'), notes: '  late meal  ' })
  assert.equal(error, undefined)
  assert.equal(entry.notes, 'late meal')
})

test('validateEntry rejects missing answers and out-of-range counts', () => {
  assert.match(validateEntry({ ...day('x'), sleep: undefined }).error, /slept/)
  assert.match(validateEntry({ ...day('x'), nightTrips: 16 }).error, /0 to 15/)
  assert.match(validateEntry({ ...day('x'), caffeineAlcohol: 'yes' }).error, /caffeine/)
})

test('patterns stay hidden until three days are logged', () => {
  const s = summarise([day('2026-10-01'), day('2026-10-02')], '2026-10-01', '2026-10-14')
  assert.equal(s.ready, false)
  assert.equal(s.observations.length, 0)
  assert.equal(s.daysInRange, 14)
})

test('evening drinks comparison is observational and needs two mornings each side', () => {
  const entries = [
    day('2026-10-01', { eveningDrinks: 'large', nightTrips: 3 }),
    day('2026-10-02', { eveningDrinks: 'moderate', nightTrips: 2 }),
    day('2026-10-03', { nightTrips: 1 }),
    day('2026-10-04', { nightTrips: 0 }),
  ]
  const s = summarise(entries, '2026-10-01', '2026-10-07')
  assert.equal(s.nightTrips.avg, 1.5)
  const text = s.observations.map((o) => o.text).join('\n')
  assert.match(text, /On the 2 mornings after moderate or large evening drinks, you logged 2\.5 night-time trips on average\. On the other 2 mornings, 0\.5\./)
  assert.doesNotMatch(text, /cause|because|diagnos/i)
})

test('small differences are reported as about the same', () => {
  const entries = ['01', '02', '03', '04'].map((d, i) => day(`2026-10-${d}`, { caffeineAlcohol: i < 2, nightTrips: 1 }))
  const s = summarise(entries, '2026-10-01', '2026-10-07')
  assert.ok(s.observations.some((o) => o.tone === 'neutral' && /about the same/.test(o.text)))
})

test('v1 days without urgent/leaks/caffeine are left out of those figures, not counted as zero', () => {
  const entries = [
    day('2026-10-01', { urgent: null, leaks: null, caffeineAlcohol: null }),
    day('2026-10-02', { urgent: 4, leaks: 2 }),
    day('2026-10-03', { urgent: 2, leaks: 0 }),
  ]
  const s = summarise(entries, '2026-10-01', '2026-10-03')
  assert.equal(s.urgent.avg, 3)
  assert.deepEqual(s.leaks, { total: 2, days: 1, daysAnswered: 2 })
  assert.equal(s.caffeineAlcohol.daysAnswered, 2)
})

test('date helpers', () => {
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(localDate('Pacific/Auckland', new Date('2026-10-20T12:00:00Z')), '2026-10-21')
})
