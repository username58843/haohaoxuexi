import { api } from '~/lib/api-client'
import { kvGet, kvSet, idbAvailable } from './store'

/**
 * Reader dictionary, client side. Fetches /api/v1/dict once (a compact map
 * compiled from the HSK lexicon), caches it in IndexedDB for a week, and
 * exposes a lookup keyed by both simplified and traditional forms.
 *
 * Entry: { pinyin, en, ru, tk, hsk } — see lib/server/dict.js for the wire tuple.
 */

const CACHE_KEY = 'dict-v1'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

let loaded = null // { lookup: Map<string, entry>, maxLen: number }
let loading = null

function build(raw) {
  const lookup = new Map()
  const words = raw.words || {}
  for (const key of Object.keys(words)) {
    const [pinyin, en, ru, tk, hsk] = words[key]
    lookup.set(key, { word: key, pinyin, en, ru, tk, hsk })
  }
  const trad = raw.trad || {}
  for (const t of Object.keys(trad)) {
    const entry = lookup.get(trad[t])
    if (entry && !lookup.has(t)) lookup.set(t, entry)
  }
  // Char-level traditional → simplified map lets the segmenter read
  // traditional-script books through the simplified dictionary.
  const charMap = new Map(Object.entries(raw.tradChars || {}))
  return { lookup, charMap, maxLen: Math.min(raw.maxLen || 4, 8) }
}

export function getLoadedDictionary() {
  return loaded
}

export async function loadDictionary() {
  if (loaded) return loaded
  if (loading) return loading
  loading = (async () => {
    if (idbAvailable()) {
      try {
        const cached = await kvGet(CACHE_KEY)
        if (cached?.value && Date.now() - (cached.savedAt || 0) < CACHE_TTL_MS) {
          loaded = build(cached.value)
          return loaded
        }
      } catch {
        // cache unavailable — fall through to network
      }
    }
    const { data } = await api.get('/dict')
    loaded = build(data)
    if (idbAvailable()) kvSet(CACHE_KEY, data).catch(() => {})
    return loaded
  })()
  try {
    return await loading
  } finally {
    loading = null
  }
}

/** Gloss for the current UI language with graceful fallback. */
export function glossFor(entry, lang) {
  if (!entry) return ''
  if (lang === 'ru') return entry.ru || entry.en || entry.tk || ''
  if (lang === 'tk') return entry.tk || entry.en || entry.ru || ''
  return entry.en || entry.ru || entry.tk || ''
}
