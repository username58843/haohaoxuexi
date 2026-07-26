import fs from 'fs'
import path from 'path'
import { makeWordId } from '../words-shared'

const WORDS_DIR = path.join(process.cwd(), 'words')
const HSK_LEVELS = [1, 2, 3, 4, 5, 6]

/** Textbook packs shipped as JSON files (id === file basename). */
const TEXTBOOK_PACKS = [
  'Z1', 'Z1_5', 'Z2', 'Z3', 'Z4_TX', 'z4_5tx', 'Z6',
  'Y1', 'Y2', 'Y3', 'Y13_3', 'Y14_1', 'Y14_2', 'Y15_1',
  'T1', 'T6', 'T8', 'T9',
  'ttx345', 'ttx6_7', 'TTX89', 'TTX1615', 'ZTX8', 'ZTX17', 'ZTX122', 'ZTX2440',
  'P2', 'tk', 'tluy',
]

let cache = null // { packs: Map<id, Word[]>, registry: [...], searchIndex: [...] }

function stripBom(s) {
  return String(s || '').replace(/^﻿/, '').trim()
}

function normalizeEntry(raw, { hskLevel = null } = {}) {
  if (!raw || typeof raw !== 'object') return null

  const simplified = stripBom(raw.simplified)
  const pinyin = stripBom(raw.pinyin)
  if (!simplified) return null

  const word = {
    simplified,
    traditional: stripBom(raw.traditional || simplified),
    pinyin,
    definitions: Array.isArray(raw.definitions)
      ? raw.definitions.map((d) => stripBom(d)).filter(Boolean)
      : [],
  }
  if (raw.translations && typeof raw.translations === 'object') {
    const en = Array.isArray(raw.translations.en) ? raw.translations.en : []
    const ru = Array.isArray(raw.translations.ru) ? raw.translations.ru : []
    if (en.length || ru.length) word.translations = { en, ru }
  }
  const hsk = Number.isInteger(raw.hsk) ? raw.hsk : hskLevel
  if (hsk >= 1 && hsk <= 6) word.hsk = hsk
  if (Number.isInteger(raw.strokes)) word.strokes = raw.strokes
  if (typeof raw.radicals === 'string' && raw.radicals) word.radicals = raw.radicals
  word.id = makeWordId(word)
  return word
}

function loadPackFile(id, opts) {
  const file = path.join(WORDS_DIR, `${id}.json`)
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!Array.isArray(data)) return []
    return data.map((e) => normalizeEntry(e, opts)).filter(Boolean)
  } catch (err) {
    console.error(`words: failed to load pack ${id}:`, err.message)
    return []
  }
}

function ensureLoaded() {
  if (cache) return cache
  const packs = new Map()
  const registry = []

  for (const level of HSK_LEVELS) {
    const id = `hsk${level}`
    const words = loadPackFile(id, { hskLevel: level })
    packs.set(id, words)
    registry.push({ id, title: `HSK ${level}`, group: 'hsk', count: words.length })
  }
  for (const id of TEXTBOOK_PACKS) {
    const words = loadPackFile(id)
    if (words.length === 0) continue
    packs.set(id, words)
    registry.push({ id, title: id, group: 'textbook', count: words.length })
  }

  // Search index over HSK packs only (the canonical lexicon).
  const norm = (s) => stripBom(s).toLowerCase()
  const searchIndex = HSK_LEVELS.flatMap((level) =>
    packs.get(`hsk${level}`).map((word) => ({
      word,
      simplified: norm(word.simplified),
      traditional: norm(word.traditional),
      pinyinFlat: norm(word.pinyin).replace(/\s+/g, ''),
      pinyinSpaced: norm(word.pinyin),
      en: norm([...(word.definitions || []), ...((word.translations || {}).en || [])].join(' ')),
      ru: norm(((word.translations || {}).ru || []).join(' ')),
    }))
  )

  cache = { packs, registry, searchIndex }
  return cache
}

export function getPacks() {
  return ensureLoaded().registry
}

export function getPackWords(id) {
  if (typeof id !== 'string') return null
  return ensureLoaded().packs.get(id) || null
}

export function getHskLevelSizes() {
  const sizes = {}
  for (const level of HSK_LEVELS) {
    sizes[level] = getPackWords(`hsk${level}`)?.length || 0
  }
  return sizes
}

export function searchWords({ q = '', level = null, page = 1, limit = 40 } = {}) {
  const { searchIndex } = ensureLoaded()
  const query = stripBom(q).toLowerCase()
  const lvl = level && HSK_LEVELS.includes(Number(level)) ? Number(level) : null
  const safePage = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 40))

  let rows = lvl ? searchIndex.filter((r) => r.word.hsk === lvl) : searchIndex

  if (query) {
    const qFlat = query.replace(/\s+/g, '')
    rows = rows
      .map((r) => {
        let score = 0
        if (r.simplified === query || r.traditional === query) score = 100
        else if (r.simplified.startsWith(query) || r.traditional.startsWith(query)) score = 80
        else if (r.pinyinFlat === qFlat || r.pinyinSpaced === query) score = 70
        else if (r.simplified.includes(query) || r.traditional.includes(query)) score = 60
        else if (r.pinyinFlat.startsWith(qFlat)) score = 50
        else if (r.en.includes(query) || r.ru.includes(query)) score = 40
        else if (r.pinyinFlat.includes(qFlat)) score = 30
        return { r, score }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || (a.r.word.hsk || 9) - (b.r.word.hsk || 9))
      .map((x) => x.r)
  }

  const total = rows.length
  const start = (safePage - 1) * safeLimit
  return {
    items: rows.slice(start, start + safeLimit).map((r) => r.word),
    total,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil(total / safeLimit)),
  }
}

/** Find one word by canonical id across all packs (HSK first). */
export function findWordById(wordId) {
  if (typeof wordId !== 'string' || !wordId) return null
  const { packs, registry } = ensureLoaded()
  for (const { id } of registry) {
    const hit = packs.get(id)?.find((w) => w.id === wordId)
    if (hit) return hit
  }
  return null
}
