/**
 * localStorage-backed "known words" map for the HSK lexicon browser.
 *
 * Current format:  'xue_known_v2'  →  { [wordId]: true }
 *
 * Legacy v1 format: 'hsk-lexicon-known'  →  { 'hskN-<index>': true } where
 * <index> is the position of the word inside the hskN pack file. Indices can
 * only be resolved to canonical word ids once that pack has been fetched, so
 * migration happens level-by-level as packs load. Migrated levels are tracked
 * in 'xue_known_migrated'; once all 6 levels are done the legacy key is removed.
 */

const KNOWN_KEY = 'xue_known_v2'
const LEGACY_KEY = 'hsk-lexicon-known'
const MIGRATED_KEY = 'xue_known_migrated'
const ALL_LEVELS = [1, 2, 3, 4, 5, 6]

function safeParse(json, fallback) {
  try {
    const value = JSON.parse(json)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback
  } catch {
    return fallback
  }
}

export function readKnown() {
  if (typeof window === 'undefined') return {}
  return safeParse(localStorage.getItem(KNOWN_KEY), {})
}

export function writeKnown(map) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KNOWN_KEY, JSON.stringify(map))
  } catch {
    /* private mode / quota — known map stays in memory for the session */
  }
}

/**
 * One-time per-level migration of the legacy known map. Call after fetching a
 * level's pack (words in file order, each carrying a canonical `.id`).
 * Returns an array of word ids to merge into the known map (possibly empty),
 * or null when there is nothing to migrate for this level.
 */
export function migrateLegacyLevel(level, words) {
  if (typeof window === 'undefined') return null
  if (!ALL_LEVELS.includes(level) || !Array.isArray(words)) return null

  const legacyRaw = localStorage.getItem(LEGACY_KEY)
  if (!legacyRaw) return null

  const migrated = safeParse(localStorage.getItem(MIGRATED_KEY), {})
  if (migrated[level]) return null

  const legacy = safeParse(legacyRaw, {})
  const prefix = `hsk${level}-`
  const ids = []
  for (const key of Object.keys(legacy)) {
    if (!legacy[key] || !key.startsWith(prefix)) continue
    const index = Number(key.slice(prefix.length))
    const word = Number.isInteger(index) && index >= 0 ? words[index] : null
    if (word && word.id) ids.push(word.id)
  }

  migrated[level] = true
  try {
    localStorage.setItem(MIGRATED_KEY, JSON.stringify(migrated))
    if (ALL_LEVELS.every((lvl) => migrated[lvl])) {
      localStorage.removeItem(LEGACY_KEY)
      localStorage.removeItem(MIGRATED_KEY)
    }
  } catch {
    /* best effort */
  }
  return ids
}
