/**
 * Chinese text segmentation for the reader — greedy longest-match against the
 * loaded dictionary (the classic maximum-matching approach: simple, fast, and
 * exactly right for a *reading aid*, where every dictionary hit must be a real
 * dictionary headword).
 *
 * Output tokens:
 *   { t: '中国', d: entry }  — dictionary word (hover/tap target)
 *   { t: '们' }              — Han character(s) without an entry
 *   { t: ', hello ' }        — non-Han run (punctuation, latin, spaces)
 */

const HAN_RE = /[㐀-鿿豈-﫿]/

export function isHan(ch) {
  return HAN_RE.test(ch)
}

/**
 * segmentText(text, dict) → token array.
 * dict: { lookup: Map, maxLen: number } from dict-client. When dict is null
 * the text comes back as a single plain token (reader still works).
 */
export function segmentText(text, dict) {
  const s = String(text || '')
  if (!s) return []
  if (!dict || !dict.lookup || dict.lookup.size === 0) return [{ t: s }]

  const { lookup, charMap, maxLen } = dict

  // Direct lookup first; when the text is in traditional script, retry with
  // a char-level trad → simp conversion of the candidate.
  const find = (candidate) => {
    const hit = lookup.get(candidate)
    if (hit || !charMap || charMap.size === 0) return hit || null
    let converted = ''
    let changed = false
    for (const ch of candidate) {
      const simp = charMap.get(ch)
      if (simp) {
        converted += simp
        changed = true
      } else {
        converted += ch
      }
    }
    return changed ? lookup.get(converted) || null : null
  }
  const tokens = []
  let plainStart = -1
  let i = 0

  const flushPlain = (end) => {
    if (plainStart >= 0) {
      tokens.push({ t: s.slice(plainStart, end) })
      plainStart = -1
    }
  }

  while (i < s.length) {
    const ch = s[i]
    if (!isHan(ch)) {
      if (plainStart < 0) plainStart = i
      i += 1
      continue
    }
    flushPlain(i)

    // Greedy longest match, bounded by the dictionary's longest key.
    let matched = null
    const limit = Math.min(maxLen, s.length - i)
    for (let len = limit; len >= 1; len--) {
      const candidate = s.substr(i, len)
      // A candidate must be pure Han — stop shrinking through mixed runs.
      if (len > 1 && !isHan(candidate[len - 1])) continue
      const entry = find(candidate)
      if (entry) {
        matched = { t: candidate, d: entry }
        break
      }
    }
    if (matched) {
      tokens.push(matched)
      i += matched.t.length
    } else {
      tokens.push({ t: ch })
      i += 1
    }
  }
  flushPlain(s.length)
  return tokens
}

/** The sentence around index `at` — for "translate this sentence". */
export function sentenceAround(text, at) {
  const s = String(text || '')
  if (!s) return ''
  const BOUNDARY = /[。！？；…\n!?;]/
  let start = at
  while (start > 0 && !BOUNDARY.test(s[start - 1])) start -= 1
  let end = at
  while (end < s.length && !BOUNDARY.test(s[end])) end += 1
  if (end < s.length) end += 1 // include the closing punctuation
  return s.slice(start, end).trim()
}
