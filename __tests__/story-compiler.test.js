import fs from 'node:fs'
import { compileStory, storyCoverage, hasEditorialReview } from '../lib/learning/story-compiler'

const load = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const story = load('data/learning/story.json')
const words = [1, 2, 3, 4, 5, 6, '7-9'].flatMap((level) => load(`words/hsk${level}.json`))

test('editorial approval cannot survive a content change or an empty reviewer list', () => {
  const review = { status: 'reviewed', contentSha256: 'revision-a', reviewers: ['Editor'] }
  expect(hasEditorialReview(review, 'revision-a')).toBe(true)
  expect(hasEditorialReview(review, 'revision-b')).toBe(false)
  expect(hasEditorialReview({ status: 'reviewed' }, 'revision-a')).toBe(false)
  expect(hasEditorialReview({ ...review, reviewers: ['  '] }, 'revision-a')).toBe(false)
  expect(hasEditorialReview({ ...review, status: 'draft' }, 'revision-a')).toBe(false)
})

test('the beginner story uses all 500 anchored entries, without higher-level words', () => {
  const compiled = compileStory(story, words)
  const report = storyCoverage(compiled.passages, words, 2)
  expect(report.coverage).toMatchObject({ covered: 500, total: 500, outside: 0, complete: false })
  expect(report.missing).toEqual([])
  expect(report.outside).toEqual([])
  const beginner = compileStory({ ...story, passages: story.passages.filter((passage) => passage.level <= 2) }, words)
  expect(Object.keys(beginner.examples)).toHaveLength(500)
  for (const word of words.filter((word) => word.hsk <= 2)) {
    expect(word.example).toEqual(compiled.examples[word.sourceNumber])
    for (const lang of ['zh', 'py', 'en', 'ru', 'tk']) expect(word.example[lang].trim()).not.toBe('')
  }
})

test('fresh examples come from the current authored text, not an earlier build', () => {
  const edited = structuredClone(story)
  edited.passages[0].sentences[0].ru = 'Новая редакция предложения.'
  expect(compileStory(edited, words).examples[94].ru).toBe('Новая редакция предложения.')
})

test('the HSK 1–3 story covers all 1,000 source entries using only its level vocabulary', () => {
  const compiled = compileStory(story, words)
  const report = storyCoverage(compiled.passages, words, 3)
  expect(report.coverage).toMatchObject({ covered: 1000, total: 1000, outside: 0, complete: false })
  expect(report.missing).toEqual([])
  expect(report.outside).toEqual([])
  for (const word of words.filter((word) => word.hsk <= 3)) {
    expect(word.example).toEqual(compiled.examples[word.sourceNumber])
    for (const lang of ['zh', 'py', 'en', 'ru', 'tk']) expect(word.example[lang].trim()).not.toBe('')
  }
})

test('extra dictionary words cannot silently count as in-range vocabulary', () => {
  const edited = structuredClone(story)
  edited.extraWords = { 小白: { pinyin: 'Xiǎobái', translations: { en: ['Xiaobai'], ru: ['Сяобай'], tk: ['Sýaobaý'] } } }
  edited.passages[0].sentences[0].tokens += ' 小白 。'
  const report = storyCoverage(compileStory(edited, words).passages, words, 2, true)
  expect(report.coverage).toMatchObject({ covered: 500, outside: 1, complete: false })
  expect(report.outside).toContain('extra:小白')
})

test('source anchors must identify the exact homograph', () => {
  const edited = structuredClone(story)
  edited.passages[0].sentences[0].tokens = '花 。'
  expect(() => compileStory(edited, words)).toThrow('Disambiguate 花')
  edited.passages[0].sentences[0].tokens = '花@1 。'
  expect(() => compileStory(edited, words)).toThrow('Invalid source anchor')
})

test.each(['title', 'translation', 'token', 'passage-id'])('rejects malformed authored %s', (field) => {
  const edited = structuredClone(story)
  if (field === 'title') delete edited.passages[0].title.tk
  if (field === 'translation') edited.passages[0].sentences[0].tk = ' '
  if (field === 'token') edited.passages[0].sentences[0].tokens += ' 不在词表里的字符串'
  if (field === 'passage-id') edited.passages[1].id = edited.passages[0].id
  expect(() => compileStory(edited, words)).toThrow()
})

test.each([[3, 500], [4, 1000]])('every HSK %i authored gloss has the original headword and all three translations', (level, count) => {
  const source = new Map(load('data/hsk/source.json').entries.map((entry) => [entry.number, entry]))
  const built = new Map(words.map((word) => [word.sourceNumber, word]))
  const lines = fs.readFileSync(`data/hsk/glosses/hsk${level}.psv`, 'utf8').trim().split('\n').slice(1)
  expect(lines).toHaveLength(count)
  const seen = new Set()
  for (const line of lines) {
    const [number, headword, en, ru, tk] = line.split('|')
    const id = Number(number)
    expect(source.get(id)).toMatchObject({ level, headword })
    expect(seen.has(id)).toBe(false)
    seen.add(id)
    expect(built.get(id).translations).toEqual({ en: [en], ru: [ru], tk: [tk] })
  }
  for (const id of [554, 630, 661, 683, 693, 695, 785, 790, 823, 834, 918, 955, 976, 981]) {
    expect(built.get(id).translations.en.join(' ')).not.toMatch(/surname|variant of/i)
  }
})
