/**
 * Shared word helpers — safe for both server and client bundles.
 * The canonical word id must be identical everywhere (web, API, Flutter):
 *   wordId = simplified + '·' + pinyin.toLowerCase() with all whitespace
 *            and apostrophes removed (tone marks kept).
 */

export function pinyinKey(pinyin) {
  return String(pinyin || '')
    .toLowerCase()
    .replace(/[\s'’ʼ]+/g, '')
}

export function makeWordId(word) {
  const simplified = String(word?.simplified || '').trim()
  return `${simplified}·${pinyinKey(word?.pinyin)}`
}

/** Validated, minimal snapshot stored in decks and srs_cards. */
export function toWordSnapshot(word) {
  const clip = (s) => String(s || '').slice(0, 200)
  const clipArr = (a, n = 12) =>
    Array.isArray(a) ? a.slice(0, n).map(clip).filter(Boolean) : []

  const snap = {
    simplified: clip(word.simplified).trim(),
    traditional: clip(word.traditional || word.simplified).trim(),
    pinyin: clip(word.pinyin).trim(),
    definitions: clipArr(word.definitions),
  }
  const en = clipArr(word?.translations?.en)
  const ru = clipArr(word?.translations?.ru)
  const tk = clipArr(word?.translations?.tk)
  if (en.length || ru.length || tk.length) {
    snap.translations = {}
    if (en.length) snap.translations.en = en
    if (ru.length) snap.translations.ru = ru
    if (tk.length) snap.translations.tk = tk
  }
  // Example sentence rides along so review flashcards can show it.
  if (word?.example && typeof word.example === 'object' && word.example.zh) {
    const ex = { zh: clip(word.example.zh).trim() }
    for (const key of ['py', 'en', 'ru', 'tk']) {
      const v = word.example[key]
      if (typeof v === 'string' && v.trim()) ex[key] = clip(v).trim()
    }
    if (ex.zh) snap.example = ex
  }
  // hsk 7 = the combined HSK 3.0 band 7–9 pack.
  if (Number.isInteger(word.hsk) && word.hsk >= 1 && word.hsk <= 7) snap.hsk = word.hsk
  return snap
}

export function isValidWordSnapshot(w) {
  return (
    w &&
    typeof w === 'object' &&
    typeof w.simplified === 'string' &&
    w.simplified.trim().length > 0 &&
    w.simplified.length <= 200 &&
    typeof w.pinyin === 'string' &&
    w.pinyin.length <= 200
  )
}
