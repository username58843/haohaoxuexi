/**
 * Client-side study statistics (localStorage).
 * Survives reloads; optional sync to /api/user/stats later.
 */

const STATS_KEY = 'xue_study_stats_v1'
const RECENT_KEY = 'xue_recent_decks_v1'
const GOAL_KEY = 'xue_daily_goal'
const KNOWN_KEY = 'hsk-lexicon-known'
const LAST_CONFIG_KEY = 'xue_last_learn_config'

const defaultStats = () => ({
  version: 1,
  totalAnswered: 0,
  totalCorrect: 0,
  totalSessions: 0,
  totalMinutes: 0,
  streak: 0,
  bestStreak: 0,
  lastStudyDate: null, // YYYY-MM-DD local
  byDay: {}, // { '2026-07-16': { answered, correct, sessions } }
  recentMistakes: [], // [{ simplified, pinyin, definitions, at }]
  lastSession: null,
})

export function todayKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function yesterdayKey() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return todayKey(d)
}

export function loadStats() {
  if (typeof window === 'undefined') return defaultStats()
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (!raw) return defaultStats()
    return { ...defaultStats(), ...JSON.parse(raw) }
  } catch {
    return defaultStats()
  }
}

export function saveStats(stats) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  } catch {
    // quota
  }
}

export function getDailyGoal() {
  if (typeof window === 'undefined') return 20
  try {
    const n = Number(localStorage.getItem(GOAL_KEY))
    return Number.isFinite(n) && n > 0 ? n : 20
  } catch {
    return 20
  }
}

export function setDailyGoal(n) {
  if (typeof window === 'undefined') return
  const v = Math.max(5, Math.min(500, Number(n) || 20))
  localStorage.setItem(GOAL_KEY, String(v))
  return v
}

/**
 * Record a finished study session.
 * @param {{ correct: number, wrong: number, mistakes?: array, durationSec?: number, source?: string }} session
 */
export function recordSession(session) {
  const {
    correct = 0,
    wrong = 0,
    mistakes = [],
    durationSec = 0,
    source = 'learn',
  } = session || {}

  const answered = correct + wrong
  if (answered <= 0 && mistakes.length === 0) return loadStats()

  const stats = loadStats()
  const day = todayKey()

  stats.totalAnswered += answered
  stats.totalCorrect += correct
  stats.totalSessions += 1
  stats.totalMinutes += Math.round((durationSec || 0) / 60)

  if (!stats.byDay[day]) {
    stats.byDay[day] = { answered: 0, correct: 0, sessions: 0 }
  }
  stats.byDay[day].answered += answered
  stats.byDay[day].correct += correct
  stats.byDay[day].sessions += 1

  // Streak
  if (stats.lastStudyDate === day) {
    // same day — keep streak
  } else if (stats.lastStudyDate === yesterdayKey()) {
    stats.streak = (stats.streak || 0) + 1
  } else {
    stats.streak = 1
  }
  stats.lastStudyDate = day
  stats.bestStreak = Math.max(stats.bestStreak || 0, stats.streak || 0)

  // Mistakes (unique-ish, newest first, max 40)
  const nextMistakes = [...(stats.recentMistakes || [])]
  for (const m of mistakes) {
    const q = m?.question || m
    if (!q?.simplified) continue
    const entry = {
      simplified: q.simplified,
      traditional: q.traditional || q.simplified,
      pinyin: q.pinyin || '',
      definitions: q.definitions || [],
      at: new Date().toISOString(),
    }
    const filtered = nextMistakes.filter((x) => x.simplified !== entry.simplified)
    filtered.unshift(entry)
    nextMistakes.length = 0
    nextMistakes.push(...filtered)
  }
  stats.recentMistakes = nextMistakes.slice(0, 40)

  stats.lastSession = {
    correct,
    wrong,
    answered,
    accuracy: answered ? Math.round((correct / answered) * 100) : 0,
    durationSec,
    source,
    at: new Date().toISOString(),
  }

  saveStats(stats)
  try {
    syncStatsToServer()
  } catch {
    // ignore
  }
  return stats
}

export function getTodayProgress() {
  const stats = loadStats()
  const day = stats.byDay[todayKey()] || { answered: 0, correct: 0, sessions: 0 }
  const goal = getDailyGoal()
  return {
    answered: day.answered || 0,
    correct: day.correct || 0,
    sessions: day.sessions || 0,
    goal,
    percent: Math.min(100, Math.round(((day.answered || 0) / goal) * 100)),
    streak: stats.streak || 0,
    bestStreak: stats.bestStreak || 0,
    accuracy:
      stats.totalAnswered > 0
        ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100)
        : 0,
    totalSessions: stats.totalSessions || 0,
    totalAnswered: stats.totalAnswered || 0,
    recentMistakes: stats.recentMistakes || [],
    lastSession: stats.lastSession,
  }
}

export function getWeekActivity() {
  const stats = loadStats()
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = todayKey(d)
    const row = stats.byDay[key] || { answered: 0, correct: 0 }
    days.push({
      key,
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      answered: row.answered || 0,
      correct: row.correct || 0,
    })
  }
  return days
}

export function pushRecentDeck(deck) {
  if (typeof window === 'undefined' || !deck) return
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    const next = [
      { ...deck, at: Date.now() },
      ...list.filter((d) => d.id !== deck.id),
    ].slice(0, 8)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

export function loadRecentDecks() {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') || []
  } catch {
    return []
  }
}

export function loadKnownMap() {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(KNOWN_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

export function countKnown() {
  const map = loadKnownMap()
  return Object.keys(map).filter((k) => map[k]).length
}

/** Best-effort sync of summary stats to server (non-blocking). */
export function syncStatsToServer() {
  if (typeof window === 'undefined') return
  try {
    const stats = loadStats()
    const payload = {
      totalAnswered: stats.totalAnswered,
      totalCorrect: stats.totalCorrect,
      totalSessions: stats.totalSessions,
      streak: stats.streak,
      bestStreak: stats.bestStreak,
      lastStudyDate: stats.lastStudyDate,
    }
    fetch('/api/user/stats', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ stats: payload }),
    }).catch(() => {})
  } catch {
    // ignore
  }
}

export function exportKnownAsJson() {
  const map = loadKnownMap()
  return JSON.stringify(
    Object.entries(map)
      .filter(([, v]) => v)
      .map(([id]) => id),
    null,
    2
  )
}

export function saveLastConfig(config) {
  if (typeof window === 'undefined' || !config) return
  try {
    localStorage.setItem(LAST_CONFIG_KEY, JSON.stringify(config))
  } catch {
    // ignore
  }
}

export function loadLastConfig() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LAST_CONFIG_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export { STATS_KEY, RECENT_KEY, GOAL_KEY, KNOWN_KEY, LAST_CONFIG_KEY }
