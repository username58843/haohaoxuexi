import fs from 'fs'
import path from 'path'
import { makeWordId } from '../words-shared'
import { getCollection } from './db'

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
    const tk = Array.isArray(raw.translations.tk) ? raw.translations.tk : []
    if (en.length || ru.length || tk.length) {
      word.translations = { en, ru }
      if (tk.length) word.translations.tk = tk
    }
  }
  // One simple example sentence per word: { zh, py?, en?, ru?, tk? }.
  if (raw.example && typeof raw.example === 'object' && typeof raw.example.zh === 'string') {
    const ex = { zh: stripBom(raw.example.zh) }
    for (const key of ['py', 'en', 'ru', 'tk']) {
      if (typeof raw.example[key] === 'string' && raw.example[key].trim()) {
        ex[key] = stripBom(raw.example[key])
      }
    }
    if (ex.zh) word.example = ex
  }
  const hsk = Number.isInteger(raw.hsk) ? raw.hsk : hskLevel
  if (hsk >= 1 && hsk <= 7) word.hsk = hsk
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
    // Dedupe by canonical id: some packs list the same word twice (distinct
    // senses collapse to one id) which would otherwise yield duplicate SRS
    // cards. First occurrence wins.
    const seen = new Set()
    const out = []
    for (const raw of data) {
      const word = normalizeEntry(raw, opts)
      if (!word || seen.has(word.id)) continue
      seen.add(word.id)
      out.push(word)
    }
    return out
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
      ru: norm(
        [
          ...((word.translations || {}).ru || []),
          ...((word.translations || {}).tk || []),
        ].join(' ')
      ),
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

// ---------------------------------------------------------------------------
// Admin pack overrides (textbook packs only)
//
// The 29 textbook packs ship as JSON files, but admins can rename them and
// replace their contents from /admin/packs. Overrides live in the
// `pack_overrides` collection: { packId (unique), title?, words?, updatedAt,
// updatedBy }. The *Resolved variants below merge them in; base functions
// above stay sync/pure (tests, search and HSK progress never see overrides).
// ---------------------------------------------------------------------------

const OVERRIDES_TTL_MS = 30 * 1000
let overridesCache = { at: 0, byId: new Map() }

export function isTextbookPack(id) {
  return TEXTBOOK_PACKS.includes(id)
}

/** Drop the in-process overrides cache (called after every admin write). */
export function invalidatePackOverrides() {
  overridesCache = { at: 0, byId: new Map() }
}

async function getPackOverrides() {
  const now = Date.now()
  if (overridesCache.at > 0 && now - overridesCache.at < OVERRIDES_TTL_MS) {
    return overridesCache.byId
  }
  const col = await getCollection('pack_overrides')
  const docs = await col.find({}).toArray()
  const byId = new Map()
  for (const doc of docs) {
    if (!doc || typeof doc.packId !== 'string') continue
    const entry = { title: null, words: null, updatedAt: doc.updatedAt || null }
    if (typeof doc.title === 'string' && doc.title.trim()) entry.title = doc.title.trim()
    if (Array.isArray(doc.words)) {
      // Same normalize+dedupe pipeline as the pack files, so overridden words
      // get canonical ids and behave identically downstream (SRS, quizzes).
      const seen = new Set()
      const words = []
      for (const raw of doc.words) {
        const word = normalizeEntry(raw)
        if (!word || seen.has(word.id)) continue
        seen.add(word.id)
        words.push(word)
      }
      entry.words = words
    }
    if (entry.title || entry.words) byId.set(doc.packId, entry)
  }
  overridesCache = { at: now, byId }
  return byId
}

/** Registry with admin overrides applied (title/count of textbook packs). */
export async function getPacksResolved() {
  const overrides = await getPackOverrides()
  if (overrides.size === 0) return getPacks()
  return getPacks().map((p) => {
    if (p.group !== 'textbook') return p
    const o = overrides.get(p.id)
    if (!o) return p
    return {
      ...p,
      title: o.title || p.title,
      count: o.words ? o.words.length : p.count,
    }
  })
}

/** Pack words with admin overrides applied (textbook packs only). */
export async function getPackWordsResolved(id) {
  const base = getPackWords(id)
  if (!base || !isTextbookPack(id)) return base
  const overrides = await getPackOverrides()
  const o = overrides.get(id)
  return o?.words ? o.words : base
}

/** Raw override doc for the admin editor (null when none saved). */
export async function getPackOverrideDoc(packId) {
  const col = await getCollection('pack_overrides')
  return col.findOne({ packId })
}

/** Override summaries for the admin pack list (no word payloads). */
export async function getPackOverrideSummaries() {
  const col = await getCollection('pack_overrides')
  return col
    .aggregate([
      {
        $project: {
          _id: 0,
          packId: 1,
          title: 1,
          updatedAt: 1,
          hasWords: { $isArray: '$words' },
        },
      },
    ])
    .toArray()
}
