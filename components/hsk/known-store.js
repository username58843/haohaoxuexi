import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '~/lib/api-client'

/**
 * "Known words" store for the HSK lexicon browser and word map.
 *
 * Local format:  'xue_known_v2:<userId>'  →  { [wordId]: true }  (offline cache)
 *                'xue_known_v2'           →  the signed-out (guest) bucket
 * Server:        GET/PUT/DELETE /api/v1/words/known  (per-account, syncs web ⇄ Android)
 *
 * The local cache is scoped per account. It used to be one shared bucket, which
 * leaked marks across accounts on the same browser: the bucket outlived logout
 * and account deletion (it is localStorage, so clearing cookies did nothing),
 * and the login merge then pushed those ids up to whichever account signed in
 * next. Keys now carry the user id, state is re-read whenever the signed-in
 * account changes, and the guest bucket is *consumed* (merged once, then
 * deleted) so a second account can never inherit it.
 *
 * Sync model (see useKnownWords):
 *  - toggles apply instantly to local state + localStorage;
 *  - each toggle is queued as a delta in 'xue_known_pending_v1:<userId>' and
 *    flushed (debounced) as PUT { add, remove } — deltas survive reloads, so
 *    offline changes sync on the next visit;
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

/** Storage keys are per-account; the bare keys are the guest (signed-out) bucket. */
const knownKeyFor = (userId) => (userId ? `${KNOWN_KEY}:${userId}` : KNOWN_KEY)
const pendingKeyFor = (userId) => (userId ? `${PENDING_KEY}:${userId}` : PENDING_KEY)

function safeParse(json, fallback) {
  try {
    const value = JSON.parse(json)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback
  } catch {
    return fallback
  }
}

export function readKnown(userId = null) {
  if (typeof window === 'undefined') return {}
  return safeParse(localStorage.getItem(knownKeyFor(userId)), {})
}

export function writeKnown(userId, map) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(knownKeyFor(userId), JSON.stringify(map))
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
  // v1 saved positions, not identities. Never resolve them against the new list.
  if (words.some((word) => word.sourceNumber != null)) return null

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

export async function loadLegacyKnownIds(level) {
  if (typeof window === 'undefined' || !ALL_LEVELS.includes(level)) return null
  try {
    if (!localStorage.getItem(LEGACY_KEY)) return null
    const migrated = safeParse(localStorage.getItem(MIGRATED_KEY), {})
    if (migrated[level]) return null
    const { data } = await api.get('/words', { params: { pack: `hsk${level}`, catalog: 'legacy' } })
    if (data.catalog !== 'legacy') return null
    return migrateLegacyLevel(level, data.items)
  } catch {
    // Retain the source marks for an offline retry; browsing need not fail.
    return null
  }
}

// ---------------------------------------------------------------------------
// Server sync
// ---------------------------------------------------------------------------

function readPending(userId) {
  if (typeof window === 'undefined') return { add: {}, remove: {} }
  const raw = safeParse(localStorage.getItem(pendingKeyFor(userId)), {})
  return {
    add: raw.add && typeof raw.add === 'object' ? raw.add : {},
    remove: raw.remove && typeof raw.remove === 'object' ? raw.remove : {},
  }
}

function writePending(userId, pending) {
  if (typeof window === 'undefined') return
  try {
    if (!Object.keys(pending.add).length && !Object.keys(pending.remove).length) {
      localStorage.removeItem(pendingKeyFor(userId))
    } else {
      localStorage.setItem(pendingKeyFor(userId), JSON.stringify(pending))
    }
  } catch {
    /* private mode — deltas stay in memory for this session */
  }
}

/** Queue one toggle as a pending delta. Idempotent for a given (id, on). */
function queuePending(userId, id, on) {
  const pending = readPending(userId)
  if (on) {
    pending.add[id] = true
    delete pending.remove[id]
  } else {
    pending.remove[id] = true
    delete pending.add[id]
  }
  writePending(userId, pending)
}

/**
 * Reads the guest bucket and deletes it, so words marked before signing in are
 * adopted by exactly one account. Without the delete, every future account on
 * this browser would inherit the same set (the original cross-account leak).
 */
function takeGuestKnown() {
  if (typeof window === 'undefined') return {}
  const guest = safeParse(localStorage.getItem(KNOWN_KEY), {})
  try {
    localStorage.removeItem(KNOWN_KEY)
    localStorage.removeItem(PENDING_KEY)
  } catch {
    /* best effort */
  }
  return guest
}

/**
 * The shared known-words state with server sync. Pass the authed `user`
 * (from useAuth); sync activates when it is present.
 *
 * Returns { known, toggleKnown, addKnownIds, clearKnown }:
 *  - known: { [wordId]: true }
 *  - toggleKnown(wordIdOrWord): optimistic flip + debounced server delta
 *  - addKnownIds(ids): bulk merge (legacy migration) + server push
 *  - clearKnown(): wipe the set for this account, locally and on the server
 */
export function useKnownWords(user) {
  const userId = user?.id || null
  const [known, setKnown] = useState(() => readKnown(null))
  // The account the in-memory state belongs to; `null` = guest.
  const [scope, setScope] = useState(null)
  const scopeRef = useRef(null)
  const flushTimerRef = useRef(null)
  const flushingRef = useRef(false)
  const syncedForRef = useRef(null)

  // Re-point the store when the signed-in account changes: state adjusted
  // during render (the documented alternative to a reset effect), so one
  // account's marks are never written into another account's bucket.
  if (scope !== userId) {
    setScope(userId)
    setKnown(readKnown(userId))
  }
  // Deliberate render-phase sync, paired with the render-phase setScope()
  // above (see comment).
  // eslint-disable-next-line react-hooks/refs
  scopeRef.current = userId

  // Persist locally on every change (mount-time write rewrites what was read).
  useEffect(() => {
    writeKnown(scope, known)
  }, [scope, known])

  const flush = useCallback(async () => {
    if (flushingRef.current) return
    const owner = scopeRef.current
    if (!owner) return // guest — deltas stay queued until an account signs in
    const pending = readPending(owner)
    const add = Object.keys(pending.add)
    const remove = Object.keys(pending.remove)
    if (!add.length && !remove.length) return
    flushingRef.current = true
    try {
      await api.put('/words/known', { add, remove })
      // Clear exactly what was sent — deltas queued mid-flight stay pending.
      const after = readPending(owner)
      for (const id of add) delete after.add[id]
      for (const id of remove) delete after.remove[id]
      writePending(owner, after)
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

  // On login: merge the server set with this account's local state (union),
  // adopt-and-consume anything marked while signed out, push local-only ids up
  // and flush deltas queued while offline. Runs once per user id.
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
        const pending = readPending(userId)
        // Guest marks are claimed only once the account is known, and the
        // guest bucket is deleted in the process.
        const merged = { ...readKnown(userId), ...takeGuestKnown() }
        for (const id of serverIds) {
          // A locally-queued removal wins over the (stale) server copy.
          if (!pending.remove[id]) merged[id] = true
        }
        for (const id of Object.keys(merged)) {
          if (!serverIds.has(id)) pending.add[id] = true
        }
        writePending(userId, pending)
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
        queuePending(scopeRef.current, id, on)
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
            queuePending(scopeRef.current, id, true)
            changed = true
          }
        }
        return changed ? next : prev
      })
      scheduleFlush()
    },
    [scheduleFlush]
  )

  /**
   * Wipes the set for the signed-in account (local cache, queued deltas and
   * the server document). Powers the "reset known words" action in settings —
   * the escape hatch for accounts that inherited another account's marks
   * before the per-account scoping above existed.
   */
  const clearKnown = useCallback(async () => {
    const owner = scopeRef.current
    clearTimeout(flushTimerRef.current)
    writePending(owner, { add: {}, remove: {} })
    setKnown({})
    if (!owner) return true
    try {
      await api.delete('/words/known')
      return true
    } catch {
      return false
    }
  }, [])

  return { known, toggleKnown, addKnownIds, clearKnown }
}
