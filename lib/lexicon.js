import fs from 'fs'
import path from 'path'

const LEVELS = [1, 2, 3, 4, 5, 6]
const WORDS_DIR = path.join(process.cwd(), 'words')

let BY_LEVEL = null
let ALL = null
let INDEX = null

function normalize(s) {
  return String(s || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
}

function normalizeHanzi(s) {
  return String(s || '').replace(/^\uFEFF/, '').trim()
}

function loadLevel(level) {
  const file = path.join(WORDS_DIR, `hsk${level}.json`)
  const raw = fs.readFileSync(file, 'utf8')
  const data = JSON.parse(raw)
  return Array.isArray(data) ? data : []
}

function ensureLoaded() {
  if (BY_LEVEL) return
  BY_LEVEL = {}
  for (const level of LEVELS) {
    BY_LEVEL[level] = loadLevel(level)
  }
}

function getAll() {
  ensureLoaded()
  if (!ALL) {
    ALL = LEVELS.flatMap((level) =>
      (BY_LEVEL[level] || []).map((word, index) => ({
        id: `hsk${level}-${index}`,
        simplified: normalizeHanzi(word.simplified),
        traditional: normalizeHanzi(word.traditional || word.simplified),
        pinyin: word.pinyin || '',
        definitions: word.definitions || [],
        translations: word.translations || {},
        hsk: word.hsk || level,
        strokes: word.strokes,
        radicals: word.radicals,
        source: `HSK ${level}`,
      }))
    )
  }
  return ALL
}

function getIndex() {
  if (!INDEX) {
    INDEX = getAll().map((word) => ({
      word,
      simplified: normalize(word.simplified),
      traditional: normalize(word.traditional),
      pinyin: normalize(word.pinyin).replace(/\s+/g, ''),
      pinyinSpaced: normalize(word.pinyin),
      definitions: normalize((word.definitions || []).join(' ')),
      eng: normalize((word.translations?.en || word.definitions || []).join(' ')),
      rus: normalize((word.translations?.ru || []).join(' ')),
    }))
  }
  return INDEX
}

export function getLexiconStats() {
  ensureLoaded()
  const counts = {}
  for (const level of LEVELS) {
    counts[level] = (BY_LEVEL[level] || []).length
  }
  return {
    total: getAll().length,
    byLevel: counts,
    levels: LEVELS,
  }
}

/**
 * Browse / find HSK vocabulary
 * @param {{ q?: string, level?: number|string|'all', page?: number, limit?: number }} opts
 */
export function queryLexicon(opts = {}) {
  const q = normalize(opts.q || '')
  const levelRaw = opts.level
  const level =
    levelRaw === undefined || levelRaw === null || levelRaw === '' || levelRaw === 'all'
      ? null
      : Number(levelRaw)
  const page = Math.max(1, Number(opts.page) || 1)
  // Allow full HSK dump (5000) for the visualization page
  const limit = Math.min(10000, Math.max(1, Number(opts.limit) || 40))

  let rows = getIndex()

  if (level && LEVELS.includes(level)) {
    rows = rows.filter((r) => r.word.hsk === level)
  }

  if (q) {
    const qNoSpace = q.replace(/\s+/g, '')
    rows = rows
      .map((r) => {
        let score = 0
        if (r.simplified === q || r.traditional === q) score = 100
        else if (r.simplified.startsWith(q) || r.traditional.startsWith(q)) score = 80
        else if (r.simplified.includes(q) || r.traditional.includes(q)) score = 60
        else if (r.pinyin === qNoSpace || r.pinyinSpaced === q) score = 70
        else if (r.pinyin.startsWith(qNoSpace) || r.pinyinSpaced.startsWith(q)) score = 50
        else if (r.pinyin.includes(qNoSpace) || r.pinyinSpaced.includes(q)) score = 35
        else if (r.definitions.includes(q) || r.eng.includes(q) || r.rus.includes(q)) score = 40
        else if (
          r.definitions.split(' ').some((w) => w.startsWith(q)) ||
          r.eng.split(' ').some((w) => w.startsWith(q)) ||
          r.rus.split(' ').some((w) => w.startsWith(q))
        ) {
          score = 30
        }
        return { r, score }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.r.word.hsk - b.r.word.hsk)
      .map((x) => x.r)
  } else {
    rows = rows.slice().sort(
      (a, b) => a.word.hsk - b.word.hsk || a.word.simplified.localeCompare(b.word.simplified, 'zh')
    )
  }

  const total = rows.length
  const start = (page - 1) * limit
  const items = rows.slice(start, start + limit).map((r) => r.word)

  return {
    items,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    stats: getLexiconStats(),
  }
}

export default {
  getLexiconStats,
  queryLexicon,
}
