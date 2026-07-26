import { getCollection } from './db'
import { getPackWords, getHskLevelSizes } from './words'
import { toWordSnapshot } from '../words-shared'

const DAY_MS = 24 * 60 * 60 * 1000
const MIN_EASE = 1.3
const MAX_INTERVAL_DAYS = 365
const LEARNING_AGAIN_MS = 10 * 60 * 1000
const LEARNING_HARD_MS = 30 * 60 * 1000
const MATURE_INTERVAL_DAYS = 21

/** 'YYYY-MM-DD' for the user's local timezone (tzOffset = minutes east of UTC). */
export function localDay(tzOffsetMinutes = 0, at = new Date()) {
  const shifted = new Date(at.getTime() + tzOffsetMinutes * 60 * 1000)
  return shifted.toISOString().slice(0, 10)
}

function previousDay(dayStr) {
  const d = new Date(`${dayStr}T00:00:00Z`)
  return new Date(d.getTime() - DAY_MS).toISOString().slice(0, 10)
}

/**
 * SM-2 variant (docs/ARCHITECTURE.md §7). Grades: 0 Again, 1 Hard, 2 Good, 3 Easy.
 * Returns the next {state, ease, intervalDays, due, reps, lapses} for a card.
 */
export function nextSchedule(card, grade, now = new Date()) {
  let { state, ease, intervalDays, reps = 0, lapses = 0 } = card
  ease = typeof ease === 'number' ? ease : 2.5
  intervalDays = typeof intervalDays === 'number' ? intervalDays : 0
  reps += 1
  let due

  if (state !== 'review') {
    // new / learning
    if (grade === 0) {
      state = 'learning'
      due = new Date(now.getTime() + LEARNING_AGAIN_MS)
    } else if (grade === 1) {
      state = 'learning'
      due = new Date(now.getTime() + LEARNING_HARD_MS)
    } else {
      state = 'review'
      intervalDays = grade === 3 ? 3 : 1
      due = new Date(now.getTime() + intervalDays * DAY_MS)
    }
  } else if (grade === 0) {
    lapses += 1
    ease = Math.max(MIN_EASE, ease - 0.2)
    state = 'learning'
    intervalDays = 0
    due = new Date(now.getTime() + LEARNING_AGAIN_MS)
  } else {
    if (grade === 1) {
      intervalDays = Math.max(intervalDays * 1.2, intervalDays + 0.5)
      ease = Math.max(MIN_EASE, ease - 0.15)
    } else if (grade === 2) {
      intervalDays = intervalDays * ease
    } else {
      intervalDays = intervalDays * ease * 1.3
      ease += 0.15
    }
    intervalDays = Math.min(MAX_INTERVAL_DAYS, intervalDays)
    due = new Date(now.getTime() + intervalDays * DAY_MS)
  }

  return { state, ease, intervalDays, due, reps, lapses }
}

function publicCard(doc) {
  return {
    wordId: doc.wordId,
    word: doc.word,
    state: doc.state,
    ease: doc.ease,
    intervalDays: doc.intervalDays,
    due: doc.due,
    reps: doc.reps,
    lapses: doc.lapses,
  }
}

/**
 * Records one review: upserts the SRS card, applies scheduling, bumps the
 * per-day review log. `word` snapshot is required the first time a word is seen.
 */
export async function applyReview({ userId, wordId, grade, word = null, tzOffset = 0 }) {
  const cards = await getCollection('srs_cards')
  const now = new Date()

  let card = await cards.findOne({ userId, wordId })
  const isNew = !card
  if (!card) {
    if (!word) return { error: 'word_snapshot_required' }
    card = {
      userId,
      wordId,
      word: toWordSnapshot(word),
      state: 'new',
      ease: 2.5,
      intervalDays: 0,
      reps: 0,
      lapses: 0,
      createdAt: now,
    }
  }

  const sched = nextSchedule(card, grade, now)
  const doc = { ...card, ...sched, updatedAt: now }
  const { _id, ...setDoc } = doc
  await cards.updateOne({ userId, wordId }, { $set: setDoc }, { upsert: true })

  const logs = await getCollection('review_logs')
  const day = localDay(tzOffset, now)
  await logs.updateOne(
    { userId, day },
    {
      $inc: { reviews: 1, correct: grade >= 2 ? 1 : 0, newCards: isNew ? 1 : 0 },
      $set: { updatedAt: now },
    },
    { upsert: true }
  )

  return { card: publicCard(doc) }
}

/**
 * Study queue: due cards first (oldest due first), then unseen words from the
 * requested packs.
 */
export async function getQueue({ userId, packs = [], limit = 20 }) {
  const cards = await getCollection('srs_cards')
  const now = new Date()
  const safeLimit = Math.min(100, Math.max(1, limit))

  const due = await cards
    .find({ userId, due: { $lte: now } })
    .sort({ due: 1 })
    .limit(safeLimit)
    .toArray()

  const queue = due.map((c) => ({ ...publicCard(c), isNew: false }))

  if (queue.length < safeLimit && packs.length > 0) {
    const seenIds = new Set(
      (await cards.find({ userId }).project({ wordId: 1 }).toArray()).map((c) => c.wordId)
    )
    outer: for (const packId of packs) {
      const words = getPackWords(packId) || []
      for (const word of words) {
        if (seenIds.has(word.id)) continue
        // Guard against the same canonical id appearing twice in this batch
        // (duplicate senses within a pack, or overlap between selected packs).
        seenIds.add(word.id)
        queue.push({
          wordId: word.id,
          word,
          state: 'new',
          ease: 2.5,
          intervalDays: 0,
          due: now,
          reps: 0,
          lapses: 0,
          isNew: true,
        })
        if (queue.length >= safeLimit) break outer
      }
    }
  }

  const dueCount = await cards.countDocuments({ userId, due: { $lte: now } })
  return { cards: queue, dueCount, newCount: queue.filter((c) => c.isNew).length }
}

export function computeStreak(dayRows, today, yesterday) {
  const daysWithReviews = new Set(dayRows.filter((r) => r.reviews > 0).map((r) => r.day))
  let streak = 0
  let cursor = daysWithReviews.has(today) ? today : daysWithReviews.has(yesterday) ? yesterday : null
  while (cursor && daysWithReviews.has(cursor)) {
    streak += 1
    cursor = previousDay(cursor)
  }

  // Best streak across the whole history.
  const sorted = [...daysWithReviews].sort()
  let best = 0
  let run = 0
  let prev = null
  for (const day of sorted) {
    run = prev && previousDay(day) === prev ? run + 1 : 1
    best = Math.max(best, run)
    prev = day
  }
  return { streak, bestStreak: Math.max(best, streak) }
}

export async function getSummary({ userId, tzOffset = 0, dailyGoal = 20 }) {
  const cards = await getCollection('srs_cards')
  const logs = await getCollection('review_logs')
  const now = new Date()
  const today = localDay(tzOffset, now)
  const yesterday = previousDay(today)

  const [dueCount, byStateAgg, byLevelAgg, dayRows] = await Promise.all([
    cards.countDocuments({ userId, due: { $lte: now } }),
    cards.aggregate([
      { $match: { userId } },
      { $group: { _id: '$state', n: { $sum: 1 } } },
    ]).toArray(),
    cards.aggregate([
      { $match: { userId, 'word.hsk': { $gte: 1, $lte: 6 } } },
      {
        $group: {
          _id: '$word.hsk',
          seen: { $sum: 1 },
          mature: {
            $sum: {
              $cond: [{ $gte: ['$intervalDays', MATURE_INTERVAL_DAYS] }, 1, 0],
            },
          },
        },
      },
    ]).toArray(),
    logs.find({ userId }).project({ day: 1, reviews: 1 }).toArray(),
  ])

  const byState = { new: 0, learning: 0, review: 0 }
  for (const row of byStateAgg) byState[row._id] = row.n

  const sizes = getHskLevelSizes()
  const byLevel = {}
  for (let level = 1; level <= 6; level++) {
    const row = byLevelAgg.find((r) => r._id === level)
    byLevel[level] = { total: sizes[level], seen: row?.seen || 0, mature: row?.mature || 0 }
  }

  const todayRow = await logs.findOne({ userId, day: today })
  const { streak, bestStreak } = computeStreak(dayRows, today, yesterday)

  return {
    dueCount,
    todayReviews: todayRow?.reviews || 0,
    todayCorrect: todayRow?.correct || 0,
    streak,
    bestStreak,
    goal: dailyGoal,
    byState,
    byLevel,
  }
}

export async function getActivity({ userId, days = 42, tzOffset = 0 }) {
  const logs = await getCollection('review_logs')
  const safeDays = Math.min(365, Math.max(1, days))
  const today = localDay(tzOffset)

  const result = []
  let cursor = today
  for (let i = 0; i < safeDays; i++) {
    result.push(cursor)
    cursor = previousDay(cursor)
  }
  result.reverse()

  const rows = await logs
    .find({ userId, day: { $gte: result[0], $lte: today } })
    .toArray()
  const byDay = new Map(rows.map((r) => [r.day, r]))

  return {
    days: result.map((day) => ({
      day,
      reviews: byDay.get(day)?.reviews || 0,
      correct: byDay.get(day)?.correct || 0,
    })),
  }
}
