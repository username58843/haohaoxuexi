export const READING_RANGES = ['1-2', '1-3', '1-4', '1-5', '1-6', '1-7-9']
export const READING_LANGUAGES = { en: 'English', ru: 'Русский', tk: 'Türkmençe' }
export const READER_DEFAULTS = { range: '1-2', pinyin: false, translation: false, language: '', fontSize: 26 }

export function normalizeReaderPreferences(raw) {
  const value = raw && typeof raw === 'object' ? raw : {}
  return {
    range: READING_RANGES.includes(value.range) ? value.range : READER_DEFAULTS.range,
    pinyin: value.pinyin === true,
    translation: value.translation === true,
    language: Object.hasOwn(READING_LANGUAGES, value.language) ? value.language : '',
    fontSize: Number.isFinite(value.fontSize) ? Math.max(18, Math.min(42, Math.round(value.fontSize))) : 26,
  }
}

export function readerPage(raw, document) {
  if (raw?.revision !== document.revision || !Number.isInteger(raw?.page)) return 0
  return Math.max(0, Math.min(document.passages.length - 1, raw.page))
}

export function validateReadingDocument(document, range) {
  if (document?.schemaVersion !== 1 || document.id !== range || typeof document.revision !== 'string' ||
      !Array.isArray(document.passages) || !document.passages.length || !document.words ||
      !Number.isInteger(document.coverage?.covered) || !Number.isInteger(document.coverage?.total) ||
      document.coverage.total <= 0 || document.coverage.covered < 0 || document.coverage.covered > document.coverage.total) {
    throw new Error('Invalid reading document')
  }
  for (const passage of document.passages) {
    if (!Array.isArray(passage.sentences) || !passage.sentences.length) throw new Error('Empty passage')
    for (const sentence of passage.sentences) {
      if (!Array.isArray(sentence.tokens) || sentence.tokens.map((token) => token.text).join('') !== sentence.zh ||
          !['en', 'ru', 'tk'].every((lang) => typeof sentence[lang] === 'string' && sentence[lang].trim()) ||
          sentence.tokens.some((token) => token.wordId && !document.words[token.wordId])) {
        throw new Error('Invalid reading sentence')
      }
    }
  }
  return document
}
