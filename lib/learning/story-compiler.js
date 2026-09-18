import { makeWordId } from '../words-shared.js'

const LANGUAGES = ['zh', 'en', 'ru', 'tk']

export function hasEditorialReview(review, contentSha256) {
  return review?.status === 'reviewed' && review.contentSha256 === contentSha256 &&
    Array.isArray(review.reviewers) && review.reviewers.some((name) => typeof name === 'string' && name.trim())
}

export function compileStory(story, words) {
  const byNumber = new Map(words.map((word) => [word.sourceNumber, word]))
  const byText = new Map()
  for (const word of words) {
    if (!byText.has(word.simplified)) byText.set(word.simplified, [])
    byText.get(word.simplified).push(word)
  }
  const dictionary = Object.create(null)
  const examples = Object.create(null)
  const extras = story.extraWords || {}
  const passageIds = new Set()
  const unresolved = new Set()
  const validTitle = (title) => LANGUAGES.every((lang) => typeof title?.[lang] === 'string' && title[lang].trim())
  if (!story.id || !validTitle(story.title) || !Array.isArray(story.passages) || !story.passages.length) {
    throw new Error('Invalid story metadata')
  }
  const passages = story.passages.map((passage) => {
    if (!passage.id || passageIds.has(passage.id)) throw new Error(`Invalid passage ID: ${passage.id}`)
    passageIds.add(passage.id)
    if (![2, 3, 4, 5, 6, 7].includes(passage.level) || !validTitle(passage.title) ||
        !Array.isArray(passage.sentences) || !passage.sentences.length) throw new Error(`Invalid passage: ${passage.id}`)
    const sentences = passage.sentences.map((sentence) => {
      for (const lang of ['tokens', 'en', 'ru', 'tk']) {
        if (typeof sentence[lang] !== 'string' || !sentence[lang].trim()) throw new Error(`Missing ${lang}: ${passage.id}`)
      }
      const tokens = sentence.tokens.trim().split(/\s+/u).map((raw) => {
        const match = /^(.+)@(\d+)$/.exec(raw)
        const text = match ? match[1] : raw
        const candidates = byText.get(text) || []
        const inRange = candidates.filter((word) => word.hsk <= passage.level)
        if (!match && inRange.length > 1) throw new Error(`Disambiguate ${text}: ${inRange.map((word) => word.sourceNumber)}`)
        const word = match ? byNumber.get(Number(match[2])) : inRange[0] || candidates[0]
        if (match && word?.simplified !== text) throw new Error(`Invalid source anchor: ${raw}`)
        if (word) {
          const wordId = makeWordId(word)
          dictionary[wordId] = word
          return { text, pinyin: word.pinyin.split('/')[0], wordId, sourceNumber: word.sourceNumber }
        }
        if (Object.hasOwn(extras, text)) {
          const entry = extras[text]
          if (!entry.pinyin || !['en', 'ru', 'tk'].every((lang) => entry.translations?.[lang]?.length)) {
            throw new Error(`Incomplete extra word: ${text}`)
          }
          const wordId = `extra:${text}`
          dictionary[wordId] = { simplified: text, traditional: text, ...entry, definitions: entry.translations.en }
          return { text, pinyin: entry.pinyin, wordId }
        }
        if (/\p{Script=Han}/u.test(text)) unresolved.add(text)
        return { text, pinyin: '' }
      })
      const zh = tokens.map((token) => token.text).join('')
      const py = tokens.map((token) => token.pinyin || token.text).join(' ')
      const translations = Object.fromEntries(['en', 'ru', 'tk'].map((lang) => [lang, sentence[lang].trim()]))
      for (const token of tokens) {
        if (token.sourceNumber && !examples[token.sourceNumber]) examples[token.sourceNumber] = { zh, py, ...translations }
      }
      return { zh, tokens, ...translations }
    })
    return { id: passage.id, level: passage.level, title: passage.title, sentences }
  })
  if (unresolved.size) throw new Error(`Unsegmented/unknown words (supply reviewed extraWords): ${[...unresolved].join(' / ')}`)
  return { passages, dictionary, examples }
}

export function storyCoverage(passages, words, level, reviewed = false) {
  const used = new Set()
  const extraWords = new Set()
  for (const passage of passages) {
    if (passage.level > level) continue
    for (const sentence of passage.sentences) for (const token of sentence.tokens) {
      if (token.sourceNumber) used.add(token.sourceNumber)
      else if (token.wordId) extraWords.add(token.wordId)
    }
  }
  const expected = words.filter((word) => word.hsk <= level)
  const missing = expected.filter((word) => !used.has(word.sourceNumber))
  const outside = [...words.filter((word) => word.hsk > level && used.has(word.sourceNumber)).map((word) => word.sourceNumber), ...extraWords]
  const coverage = { covered: expected.length - missing.length, total: expected.length, outside: outside.length,
    complete: missing.length === 0 && outside.length === 0 && reviewed }
  return { coverage, missing: missing.map((word) => ({ number: word.sourceNumber, word: word.simplified })), outside }
}
