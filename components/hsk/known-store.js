import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '~/lib/api-client'

/**
 * "Known words" store for the HSK lexicon browser and word map.
 *
 * Local format:  'xue_known_v2'  →  { [wordId]: true }  (offline cache)
 * Server:        GET/PUT /api/v1/words/known  (per-account, syncs web ⇄ Android)
 *
 * Sync model (see useKnownWords):
 *  - toggles apply instantly to local state + localStorage;
 *  - each toggle is queued as a delta in 'xue_known_pending_v1' and flushed
 *    (debounced) as PUT { add, remove } — deltas survive reloads, so offline
 *    changes sync on the next visit;
 *  - on login the server set is merged in (union), and local-only ids are
 *    pushed up, so pre-sync/offline progress is never lost.
 *
 * Legacy v1 format: 'hsk-lexicon-known'  →  { 'hskN-<index>': true } where
 * <index> is the position of the word inside the hskN pack file. Indices can
 * only be resolved to canonical word ids once that pack has been fetched, so
 * migration happens level-by-level as packs load. Migrated levels are tracked
 * in 'xue_known_migrated'; once all 6 levels are done the legacy key is removed.
 */

const KNOWN_KEY = 'xue_known_v2'
const PENDING_KEY = 'xue_known_pending_v1'
const LEGACY_KEY = 'hsk-lexicon-known'
const MIGRATED_KEY = 'xue_known_migrated'
const ALL_LEVELS = [1, 2, 3, 4, 5, 6]
const FLUSH_DELAY_MS = 800

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

// ---------------------------------------------------------------------------
// Server sync
// ---------------------------------------------------------------------------

function readPending() {
  if (typeof window === 'undefined') return { add: {}, remove: {} }
  const raw = safeParse(localStorage.getItem(PENDING_KEY), {})
  return {
    add: raw.add && typeof raw.add === 'object' ? raw.add : {},
    remove: raw.remove && typeof raw.remove === 'object' ? raw.remove : {},
  }
}

function writePending(pending) {
  if (typeof window === 'undefined') return
  try {
    if (!Object.keys(pending.add).length && !Object.keys(pending.remove).length) {
      localStorage.removeItem(PENDING_KEY)
    } else {
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
    }
  } catch {
    /* private mode — deltas stay in memory for this session */
  }
}

/** Queue one toggle as a pending delta. Idempotent for a given (id, on). */
function queuePending(id, on) {
  const pending = readPending()
  if (on) {
    pending.add[id] = true
    delete pending.remove[id]
  } else {
    pending.remove[id] = true
    delete pending.add[id]
  }
  writePending(pending)
}

/**
 * The shared known-words state with server sync. Pass the authed `user`
 * (from useAuth); sync activates when it is present.
 *
 * Returns { known, toggleKnown, addKnownIds }:
 *  - known: { [wordId]: true }
 *  - toggleKnown(wordIdOrWord): optimistic flip + debounced server delta
 *  - addKnownIds(ids): bulk merge (legacy migration) + server push
 */
export function useKnownWords(user) {
  const [known, setKnown] = useState(() => readKnown())
  const flushTimerRef = useRef(null)
  const flushingRef = useRef(false)
  const syncedForRef = useRef(null)

  // Persist locally on every change (mount-time write rewrites what was read).
  useEffect(() => {
    writeKnown(known)
  }, [known])

  const flush = useCallback(async () => {
    if (flushingRef.current) return
    const pending = readPending()
    const add = Object.keys(pending.add)
    const remove = Object.keys(pending.remove)
    if (!add.length && !remove.length) return
    flushingRef.current = true
    try {
      await api.put('/words/known', { add, remove })
      // Clear exactly what was sent — deltas queued mid-flight stay pending.
      const after = readPending()
      for (const id of add) delete after.add[id]
      for (const id of remove) delete after.remove[id]
      writePending(after)
    } catch {
      /* offline / signed out — deltas stay queued for the next flush */
    } finally {
      flushingRef.current = false
    }
  }, [])

  const scheduleFlush = useCallback(() => {
    clearTimeout(flushTimerRef.current)
    flushTimerRef.current = setTimeout(flush, FLUSH_DELAY_MS)
  }, [flush])

  useEffect(() => () => clearTimeout(flushTimerRef.current), [])

  // On login: merge the server set with local state (union), push local-only
  // ids up, and flush any deltas queued while offline. Runs once per user id.
  const userId = user?.id
  useEffect(() => {
    if (!userId) {
      syncedForRef.current = null
      return undefined
    }
    if (syncedForRef.current === userId) return undefined
    syncedForRef.current = userId
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/words/known')
        if (cancelled) return
        const serverIds = new Set(Array.isArray(data?.ids) ? data.ids : [])
        const local = readKnown()
        const pending = readPending()
        const merged = { ...local }
        for (const id of serverIds) {
          // A locally-queued removal wins over the (stale) server copy.
          if (!pending.remove[id]) merged[id] = true
        }
        for (const id of Object.keys(local)) {
          if (!serverIds.has(id)) pending.add[id] = true
        }
        writePending(pending)
        setKnown(merged)
        flush()
      } catch {
        // Transient failure — allow a retry on the next mount/login.
        if (syncedForRef.current === userId) syncedForRef.current = null
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, flush])

  const toggleKnown = useCallback(
    (wordOrId) => {
      const id =
        typeof wordOrId === 'string' ? wordOrId : (wordOrId && wordOrId.id) || null
      if (!id) return
      setKnown((prev) => {
        const on = !prev[id]
        // Side effect inside the updater is deliberate and safe: for a given
        // `prev` the queued delta is deterministic and idempotent, so React's
        // dev-mode double-invoke queues the exact same operation twice.
        queuePending(id, on)
        const next = { ...prev }
        if (on) next[id] = true
        else delete next[id]
        return next
      })
      scheduleFlush()
    },
    [scheduleFlush]
  )

  const addKnownIds = useCallback(
    (ids) => {
      if (!Array.isArray(ids) || ids.length === 0) return
      setKnown((prev) => {
        let changed = false
        const next = { ...prev }
        for (const id of ids) {
          if (id && !next[id]) {
            next[id] = true
            queuePending(id, true)
            changed = true
          }
        }
        return changed ? next : prev
      })
      scheduleFlush()
    },
    [scheduleFlush]
  )

  return { known, toggleKnown, addKnownIds }
}
