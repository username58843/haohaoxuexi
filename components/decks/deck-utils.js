import { toWordSnapshot } from '~/lib/words-shared'

/**
 * Shared helpers for the decks pages: id/link helpers, JSON + CSV export
 * builders and the import parser (JSON array of snapshots or CSV with
 * header detection). Pure functions — no React, easy to reason about.
 */

export const DECK_WORD_CAP = 2000

// UTF-8 byte-order mark (U+FEFF) — required by Excel for UTF-8 CSVs.
const BOM = String.fromCharCode(0xfeff)

export function deckIdOf(deck) {
  return String((deck && (deck.id || deck._id)) || '')
}

export function deckStudyHref(deckId) {
  return `/learn/session?mode=quiz&sources=deck:${encodeURIComponent(deckId)}&count=0&qmodes=cp,ct`
}

/* ------------------------------ export ------------------------------ */

export function safeFileName(name) {
  const cleaned = String(name || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
  return cleaned || 'deck'
}

export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function buildDeckJson(words) {
  return JSON.stringify(words || [], null, 2)
}

function csvEscape(value) {
  const s = String(value == null ? '' : value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** UTF-8 CSV with BOM; definitions joined by `;`. */
export function buildDeckCsv(words) {
  const lines = ['simplified,traditional,pinyin,definitions']
  for (const w of words || []) {
    lines.push(
      [
        csvEscape(w.simplified),
        csvEscape(w.traditional || ''),
        csvEscape(w.pinyin || ''),
        csvEscape((w.definitions || []).join(';')),
      ].join(',')
    )
  }
  return BOM + lines.join('\r\n') + '\r\n'
}

/* ------------------------------ import ------------------------------ */

/** Minimal RFC-4180-ish CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsvRows(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false

  const pushCell = () => {
    row.push(cell)
    cell = ''
  }
  const pushRow = () => {
    pushCell()
    if (row.length > 1 || row[0].trim() !== '') rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      pushCell()
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      pushRow()
    } else {
      cell += ch
    }
  }
  pushRow()
  return rows
}

function findColumn(headerCells, names) {
  for (const name of names) {
    const i = headerCells.indexOf(name)
    if (i !== -1) return i
  }
  return -1
}

function csvRowsToObjects(rows) {
  if (rows.length === 0) return []
  const first = rows[0].map((c) => c.trim().toLowerCase())
  const hasHeader = first.includes('simplified')

  let idx = { simplified: 0, traditional: 1, pinyin: 2, definitions: 3 }
  let dataRows = rows
  if (hasHeader) {
    idx = {
      simplified: findColumn(first, ['simplified', 'hanzi', 'word']),
      traditional: findColumn(first, ['traditional']),
      pinyin: findColumn(first, ['pinyin']),
      definitions: findColumn(first, ['definitions', 'definition', 'meanings', 'meaning']),
    }
    dataRows = rows.slice(1)
  }

  const pick = (row, i) => (i >= 0 && i < row.length ? row[i] : '')
  return dataRows.map((row) => ({
    simplified: pick(row, idx.simplified).trim(),
    traditional: pick(row, idx.traditional).trim(),
    pinyin: pick(row, idx.pinyin).trim(),
    definitions: pick(row, idx.definitions)
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean),
  }))
}

function collectWords(items) {
  const words = []
  let invalid = 0
  for (const item of items) {
    if (
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      typeof item.simplified === 'string' &&
      item.simplified.trim()
    ) {
      const candidate = { ...item }
      if (typeof candidate.definitions === 'string') {
        candidate.definitions = candidate.definitions
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean)
      }
      if (typeof candidate.pinyin !== 'string') {
        candidate.pinyin = candidate.pinyin == null ? '' : String(candidate.pinyin)
      }
      words.push(toWordSnapshot(candidate))
    } else {
      invalid += 1
    }
  }
  if (words.length === 0 && invalid === 0) return { error: 'no_words' }
  return { rows: items.length, words, invalid }
}

/**
 * Parses pasted/uploaded text into word snapshots.
 * Returns { rows, words, invalid } or { error: 'empty'|'bad_json'|'not_array'|'no_words' }.
 */
export function parseImportText(raw) {
  const text = String(raw || '').replace(new RegExp('^' + BOM), '').trim()
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
    return collectWords(arr)
  }

  const rows = parseCsvRows(text)
  if (rows.length === 0) return { error: 'no_words' }
  return collectWords(csvRowsToObjects(rows))
}
