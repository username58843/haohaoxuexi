import crypto from 'crypto'
import { getPacks, getPackWords } from './words'

/**
 * Reader dictionary — a compact hanzi → gloss lookup compiled from the shipped
 * word packs, used by the Books reader for hover/tap word translations.
 *
 * Format (JSON, cached in-process; clients cache it in IndexedDB):
 *   {
 *     v: 1,
 *     maxLen: 6,                     // longest key, for the segmenter
 *     words: { "爱": ["ài", "to love; affection", "любовь; любить", "söýmek; söýgi", 1], ... }
 *     trad:  { "龍": "龙", ... }      // traditional → simplified word aliases
 *     tradChars: { "學": "学", ... }  // char-level trad → simp (for reading
 *                                    // traditional-script books)
 *   }
 * Entry tuple: [pinyin, en, ru, tk, hsk] — empty string when a language is
 * missing, hsk 0 when the word is not in an HSK list.
 *
 * NOTE: HSK packs ship `traditional === simplified` (see ARCHITECTURE §5), so
 * word-level aliases and the char table come from the textbook packs, whose
 * traditional fields are real. Char pairs are extracted from equal-length
 * simplified/traditional word pairs (hanzi align 1:1 in that case).
 *
 * HSK packs win over textbook packs (lower level first — the most basic sense
 * of a duplicated headword is the one a reader wants). Multi-sense entries are
 * clipped to the first three glosses. Keys longer than MAX_KEY_LEN are skipped:
 * they are phrases, not dictionary words, and would only slow the segmenter.
 */

const MAX_KEY_LEN = 6
const MAX_GLOSSES = 3
const CYRILLIC_RE = /[Ѐ-ӿ]/

const compiled = new Map()

function joinGlosses(list) {
  if (!Array.isArray(list)) return ''
  return list
    .slice(0, MAX_GLOSSES)
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join('; ')
    .slice(0, 160)
}

function entryFor(word) {
  const t = word.translations || {}
  let en = joinGlosses(t.en)
  let ru = joinGlosses(t.ru)
  const tk = joinGlosses(t.tk)
  // Textbook packs carry language-untagged `definitions` — detect the script.
  if (!en && !ru && Array.isArray(word.definitions) && word.definitions.length) {
    const joined = joinGlosses(word.definitions)
    if (CYRILLIC_RE.test(joined)) ru = joined
    else en = joined
  }
  if (!en && !ru && !tk) return null
  const hsk = Number.isInteger(word.hsk) && word.hsk >= 1 && word.hsk <= 7 ? word.hsk : 0
  return [String(word.pinyin || '').trim(), en, ru, tk, hsk]
}

function compile(options) {
  const words = {}
  const trad = {}
  const tradChars = {}
  let maxLen = 1

  // HSK packs first (hsk1 → hsk7-9), then textbook packs; first entry wins.
  const registry = getPacks(options)
  const ordered = [
    ...registry.filter((p) => p.group === 'hsk'),
    ...registry.filter((p) => p.group !== 'hsk'),
  ]
  for (const pack of ordered) {
    for (const word of getPackWords(pack.id, options) || []) {
      const key = word.simplified
      if (!key || key.length > MAX_KEY_LEN) continue

      // Harvest traditional data from every pack (even duplicate headwords).
      const tr = word.traditional
      if (tr && tr !== key) {
        if (tr.length <= MAX_KEY_LEN && !trad[tr]) trad[tr] = key
        if (tr.length === key.length) {
          for (let i = 0; i < key.length; i++) {
            if (tr[i] !== key[i] && !tradChars[tr[i]]) tradChars[tr[i]] = key[i]
          }
        }
      }

      if (words[key]) continue
      const entry = entryFor(word)
      if (!entry) continue
      words[key] = entry
      if (key.length > maxLen) maxLen = key.length
    }
  }

  const body = JSON.stringify({ v: 1, maxLen, words, trad, tradChars })
  const etag = `"dict-${crypto.createHash('sha1').update(body).digest('hex').slice(0, 16)}"`
  return { body, etag, count: Object.keys(words).length }
}

export function getDictionary({ legacy = false } = {}) {
  if (!compiled.has(legacy)) compiled.set(legacy, compile({ legacy }))
  return compiled.get(legacy)
}
