import { parseCsvRows } from '~/components/decks/deck-utils'

/**
 * JSON/CSV import + export for the admin textbook-pack editor.
 *
 * Packs carry more than a deck snapshot does — definitions plus per-language
 * translation lists (EN/RU/TK) — so this cannot reuse the deck importer, whose
 * CSV shape stops at `definitions`. Same spirit though: paste or upload, see a
 * parse summary, then apply.
 *
 * The round trip is lossless: `buildPackJson` writes { id, title, words } and
 * `parsePackImport` reads that back (bare arrays and `{ words: [...] }` are
 * accepted too, which is what an LLM asked for "a JSON array of words" tends
 * to produce).
 */

/** Mirrors MAX_WORDS in pages/api/v1/admin/packs/[id].js. */
export const PACK_WORD_CAP = 5000

/** Mirrors MAX_DEF_LINES in the same route. */
const MAX_LINES = 12
const MAX_FIELD = 200

// UTF-8 byte-order mark (U+FEFF) — required by Excel for UTF-8 CSVs.
const BOM = String.fromCharCode(0xfeff)

const CSV_COLUMNS = ['simplified', 'traditional', 'pinyin', 'definitions', 'en', 'ru', 'tk']

/* ------------------------------ export ------------------------------ */

const joinList = (list) => (Array.isArray(list) ? list.join('; ') : '')

/** Editor rows → the stored pack word shape (translations omitted when empty). */
function cleanWord(word) {
  const clip = (value) => String(value == null ? '' : value).trim().slice(0, MAX_FIELD)
  const lines = (value) => {
    const list = Array.isArray(value)
      ? value
      : String(value == null ? '' : value).split(';')
    return list
      .map(clip)
      .filter(Boolean)
      .slice(0, MAX_LINES)
  }

  const simplified = clip(word?.simplified)
  const out = {
    simplified,
    traditional: clip(word?.traditional) || simplified,
    pinyin: clip(word?.pinyin),
    definitions: lines(word?.definitions),
  }
  const en = lines(word?.translations?.en)
  const ru = lines(word?.translations?.ru)
  const tk = lines(word?.translations?.tk)
  if (en.length || ru.length || tk.length) {
    out.translations = {}
    if (en.length) out.translations.en = en
    if (ru.length) out.translations.ru = ru
    if (tk.length) out.translations.tk = tk
  }
  return out
}

export function buildPackJson(words, { id, title } = {}) {
  const payload = {}
  if (id) payload.id = id
  if (title) payload.title = title
  payload.words = (words || []).map(cleanWord)
  return JSON.stringify(payload, null, 2)
}

function csvEscape(value) {
  const s = String(value == null ? '' : value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** UTF-8 CSV with BOM; every multi-value column is joined by `; `. */
export function buildPackCsv(words) {
  const lines = [CSV_COLUMNS.join(',')]
  for (const raw of words || []) {
    const w = cleanWord(raw)
    lines.push(
      [
        csvEscape(w.simplified),
        csvEscape(w.traditional),
        csvEscape(w.pinyin),
        csvEscape(joinList(w.definitions)),
        csvEscape(joinList(w.translations?.en)),
        csvEscape(joinList(w.translations?.ru)),
        csvEscape(joinList(w.translations?.tk)),
      ].join(',')
    )
  }
  return BOM + lines.join('\r\n') + '\r\n'
}

/* ------------------------------ import ------------------------------ */

const HEADER_ALIASES = {
  simplified: ['simplified', 'hanzi', 'word', '汉字', 'слово'],
  traditional: ['traditional', 'trad', '繁体'],
  pinyin: ['pinyin', 'py', 'пиньинь', '拼音'],
  definitions: ['definitions', 'definition', 'meanings', 'meaning', 'def', '释义'],
  en: ['en', 'english', 'eng'],
  ru: ['ru', 'russian', 'rus', 'русский', 'перевод'],
  tk: ['tk', 'turkmen', 'tkm', 'türkmen'],
}

function findColumn(header, names) {
  for (const name of names) {
    const i = header.indexOf(name)
    if (i !== -1) return i
  }
  return -1
}

/**
 * CSV rows → raw word objects. A header row is detected by the key column
 * appearing under any of its aliases; without one, the canonical column order
 * (simplified, traditional, pinyin, definitions, en, ru, tk) is assumed.
 */
function csvRowsToObjects(rows) {
  if (rows.length === 0) return []
  const header = rows[0].map((c) => c.trim().toLowerCase())
  const hasHeader = HEADER_ALIASES.simplified.some((n) => header.includes(n))

  let idx = { simplified: 0, traditional: 1, pinyin: 2, definitions: 3, en: 4, ru: 5, tk: 6 }
  let dataRows = rows
  if (hasHeader) {
    idx = {}
    for (const key of CSV_COLUMNS) idx[key] = findColumn(header, HEADER_ALIASES[key])
    dataRows = rows.slice(1)
  }

  const pick = (row, i) => (i >= 0 && i < row.length ? row[i] : '')
  return dataRows.map((row) => ({
    simplified: pick(row, idx.simplified),
    traditional: pick(row, idx.traditional),
    pinyin: pick(row, idx.pinyin),
    definitions: pick(row, idx.definitions),
    translations: {
      en: pick(row, idx.en),
      ru: pick(row, idx.ru),
      tk: pick(row, idx.tk),
    },
  }))
}

function hasMeaning(word) {
  return Boolean(
    word.definitions.length ||
      word.translations?.en?.length ||
      word.translations?.ru?.length ||
      word.translations?.tk?.length
  )
}

function collectWords(items) {
  const words = []
  let invalid = 0
  let noMeaning = 0
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      invalid += 1
      continue
    }
    const word = cleanWord(item)
    if (!word.simplified) {
      invalid += 1
      continue
    }
    // The API rejects the whole pack if any word has no meaning line, so those
    // rows are dropped here and reported instead of failing the save.
    if (!hasMeaning(word)) {
      noMeaning += 1
      continue
    }
    words.push(word)
  }
  return { rows: items.length, words, invalid, noMeaning }
}

/**
 * Parses pasted/uploaded text into pack words.
 * Returns { rows, words, invalid, noMeaning, title? } or
 * { error: 'empty'|'bad_json'|'not_array'|'no_words' }.
 */
export function parsePackImport(raw) {
  const text = String(raw || '')
    .replace(new RegExp('^' + BOM), '')
    .trim()
  if (!text) return { error: 'empty' }

  if (text.startsWith('[') || text.startsWith('{')) {
    let data
    try {
      data = JSON.parse(text)
    } catch {
      return { error: 'bad_json' }
    }
    const arr = Array.isArray(data)
      ? data
      : data && Array.isArray(data.words)
        ? data.words
        : null
    if (!arr) return { error: 'not_array' }
    const result = collectWords(arr)
    const title =
      !Array.isArray(data) && typeof data?.title === 'string' && data.title.trim()
        ? data.title.trim().slice(0, 80)
        : null
    return title ? { ...result, title } : result
  }

  const rows = parseCsvRows(text)
  if (rows.length === 0) return { error: 'no_words' }
  return collectWords(csvRowsToObjects(rows))
}
