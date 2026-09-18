import fs from 'fs'
import { READING_RANGES, normalizeReaderPreferences, readerPage, validateReadingDocument } from '~/lib/learning/reader-state'
import { makeWordId } from '~/lib/words-shared'
import { splitSpeechText, speakLong } from '~/lib/speech'

test('reader preferences tolerate corrupt or obsolete local storage', () => {
  expect(normalizeReaderPreferences(null)).toEqual({ range: '1-2', pinyin: false, translation: false, language: '', fontSize: 26 })
  expect(normalizeReaderPreferences({ range: '../../secret', fontSize: 999, language: 'xx', pinyin: 'yes' })).toEqual({ range: '1-2', fontSize: 42, language: '', pinyin: false, translation: false })
  expect(normalizeReaderPreferences({ fontSize: NaN }).fontSize).toBe(26)
})

test.each(READING_RANGES)('%s has valid shared content and truthful anchored coverage', (range) => {
  const web = fs.readFileSync(`public/learning/${range}.json`)
  expect(web.equals(fs.readFileSync(`mobile/assets/learning/${range}.json`))).toBe(true)
  const document = validateReadingDocument(JSON.parse(web), range)
  const maxLevel = range === '1-7-9' ? 7 : Number(range.at(-1))
  const seen = new Set()
  for (const passage of document.passages) {
    for (const sentence of passage.sentences) {
      for (const token of sentence.tokens) {
        if (!token.sourceNumber) continue
        const word = document.words[token.wordId]
        expect(makeWordId(word)).toBe(token.wordId)
        expect(word.sourceNumber).toBe(token.sourceNumber)
        expect(word.simplified).toBe(token.text)
        if (word.hsk <= maxLevel) seen.add(token.sourceNumber)
      }
    }
  }
  expect(document.coverage.covered).toBe(seen.size)
  if (seen.size !== document.coverage.total) expect(document.status).toBe('draft')
  expect(readerPage({ revision: 'obsolete', page: 2 }, document)).toBe(0)
  expect(readerPage({ revision: document.revision, page: 99999 }, document)).toBe(document.passages.length - 1)
})

test('invalid document and broken word references are rejected', () => {
  const document = JSON.parse(fs.readFileSync('public/learning/1-2.json'))
  delete document.words[Object.keys(document.words)[0]]
  expect(() => validateReadingDocument(document, '1-2')).toThrow('Invalid reading sentence')
  expect(() => validateReadingDocument({}, '1-2')).toThrow()
})

test('narration splits long sentences without cutting surrogate pairs', () => {
  const text = '你好！' + '𠀀'.repeat(500) + '。再见！'
  const parts = splitSpeechText(text)
  expect(parts.every((part) => Array.from(part).length <= 180)).toBe(true)
  expect(parts.join('')).toBe(text)
})

describe('whole-story speech lifecycle', () => {
  let utterances
  beforeEach(() => {
    utterances = []
    global.window = { speechSynthesis: { cancel: jest.fn(), getVoices: () => [], speak: (utterance) => utterances.push(utterance) } }
    global.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
  })
  afterEach(() => { delete global.window; delete global.SpeechSynthesisUtterance })
  test('speaks sequentially and stops queued content when the view is left', () => {
    const onDone = jest.fn()
    const audio = speakLong('你好。再见。', { onDone })
    expect(utterances.map((utterance) => utterance.text)).toEqual(['你好。'])
    utterances[0].onend()
    expect(utterances.map((utterance) => utterance.text)).toEqual(['你好。', '再见。'])
    audio.stop()
    utterances[1].onend()
    expect(onDone).toHaveBeenCalledTimes(1)
  })
  test('reports missing voices instead of silently skipping the whole text', () => {
    const onError = jest.fn()
    const onDone = jest.fn()
    speakLong('你好。再见。', { onError, onDone })
    utterances[0].onerror({ error: 'voice-unavailable' })
    expect(onError).toHaveBeenCalledWith('voice-unavailable')
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(utterances).toHaveLength(1)
  })
})
