import { nextSchedule, computeStreak, localDay } from '~/lib/server/srs'

const NOW = new Date('2026-07-27T12:00:00Z')
const MIN = 60 * 1000
const DAY = 24 * 60 * MIN

function fresh() {
  return { state: 'new', ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 }
}

describe('nextSchedule (SM-2 variant)', () => {
  it('new + Again stays learning, due in 10 minutes', () => {
    const s = nextSchedule(fresh(), 0, NOW)
    expect(s.state).toBe('learning')
    expect(s.due.getTime()).toBe(NOW.getTime() + 10 * MIN)
    expect(s.reps).toBe(1)
  })

  it('new + Good graduates to review at 1 day', () => {
    const s = nextSchedule(fresh(), 2, NOW)
    expect(s.state).toBe('review')
    expect(s.intervalDays).toBe(1)
    expect(s.due.getTime()).toBe(NOW.getTime() + DAY)
  })

  it('new + Easy graduates at 3 days', () => {
    const s = nextSchedule(fresh(), 3, NOW)
    expect(s.intervalDays).toBe(3)
  })

  it('review + Good multiplies interval by ease', () => {
    const card = { state: 'review', ease: 2.5, intervalDays: 10, reps: 5, lapses: 0 }
    const s = nextSchedule(card, 2, NOW)
    expect(s.intervalDays).toBe(25)
    expect(s.ease).toBe(2.5)
  })

  it('review + Again lapses back to learning and reduces ease', () => {
    const card = { state: 'review', ease: 2.5, intervalDays: 10, reps: 5, lapses: 0 }
    const s = nextSchedule(card, 0, NOW)
    expect(s.state).toBe('learning')
    expect(s.lapses).toBe(1)
    expect(s.ease).toBeCloseTo(2.3)
    expect(s.due.getTime()).toBe(NOW.getTime() + 10 * MIN)
  })

  it('review + Hard grows slowly and decays ease', () => {
    const card = { state: 'review', ease: 2.5, intervalDays: 1, reps: 3, lapses: 0 }
    const s = nextSchedule(card, 1, NOW)
    expect(s.intervalDays).toBeCloseTo(1.5) // max(1*1.2, 1+0.5)
    expect(s.ease).toBeCloseTo(2.35)
  })

  it('ease never drops below 1.3', () => {
    let card = { state: 'review', ease: 1.35, intervalDays: 5, reps: 9, lapses: 3 }
    const s = nextSchedule(card, 0, NOW)
    expect(s.ease).toBe(1.3)
  })

  it('interval caps at 365 days', () => {
    const card = { state: 'review', ease: 2.5, intervalDays: 300, reps: 20, lapses: 0 }
    const s = nextSchedule(card, 3, NOW)
    expect(s.intervalDays).toBe(365)
  })
})

describe('localDay', () => {
  it('shifts by timezone offset', () => {
    const at = new Date('2026-07-27T22:30:00Z')
    expect(localDay(0, at)).toBe('2026-07-27')
    expect(localDay(180, at)).toBe('2026-07-28') // UTC+3
    expect(localDay(-600, at)).toBe('2026-07-27') // UTC-10
  })
})

describe('computeStreak', () => {
  const rows = (days) => days.map((day) => ({ day, reviews: 1 }))

  it('counts consecutive days ending today', () => {
    const r = computeStreak(rows(['2026-07-25', '2026-07-26', '2026-07-27']), '2026-07-27', '2026-07-26')
    expect(r.streak).toBe(3)
    expect(r.bestStreak).toBe(3)
  })

  it('keeps streak alive if today has no reviews yet', () => {
    const r = computeStreak(rows(['2026-07-25', '2026-07-26']), '2026-07-27', '2026-07-26')
    expect(r.streak).toBe(2)
  })

  it('breaks after a missed day', () => {
    const r = computeStreak(rows(['2026-07-24', '2026-07-25']), '2026-07-27', '2026-07-26')
    expect(r.streak).toBe(0)
    expect(r.bestStreak).toBe(2)
  })

  it('handles empty history', () => {
    const r = computeStreak([], '2026-07-27', '2026-07-26')
    expect(r.streak).toBe(0)
    expect(r.bestStreak).toBe(0)
  })

  it('ignores zero-review days', () => {
    const r = computeStreak(
      [{ day: '2026-07-26', reviews: 0 }, { day: '2026-07-27', reviews: 2 }],
      '2026-07-27',
      '2026-07-26'
    )
    expect(r.streak).toBe(1)
  })
})
