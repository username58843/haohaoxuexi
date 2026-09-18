import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import { compileStory, hasEditorialReview } from '../lib/learning/story-compiler.js'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
const source = read('data/hsk/source.json')
const editorial = read('data/hsk/editorial.json')
const overrides = read('data/hsk/editorial-overrides.json')
const beginnerGlosses = new Map()
for (const line of fs.readFileSync(path.join(root, 'data/hsk/beginner-glosses.psv'), 'utf8').trim().split('\n').slice(1)) {
  const [number, en, ru, tk, extra] = line.split('|')
  const id = Number(number)
  if (!Number.isInteger(id) || id < 1 || id > 500 || beginnerGlosses.has(id) || extra !== undefined || ![en, ru, tk].every((value) => value?.trim())) {
    throw new Error(`Invalid beginner editorial row: ${number}`)
  }
  beginnerGlosses.set(id, { en: [en], ru: [ru], tk: [tk] })
}
if (beginnerGlosses.size !== 500) throw new Error('Beginner editorial must cover every source row 1–500')
const authoredGlosses = new Map(beginnerGlosses)
const sourceByNumber = new Map(source.entries.map((entry) => [entry.number, entry]))
const glossDirectory = path.join(root, 'data/hsk/glosses')
for (const file of fs.readdirSync(glossDirectory).filter((name) => name.endsWith('.psv')).sort()) {
  const lines = fs.readFileSync(path.join(glossDirectory, file), 'utf8').trim().split('\n')
  if (lines.shift() !== 'number|headword|en|ru|tk') throw new Error(`Invalid gloss header: ${file}`)
  for (const line of lines) {
    const [number, headword, en, ru, tk, extra] = line.split('|')
    const id = Number(number)
    const entry = sourceByNumber.get(id)
    if (!entry || entry.headword !== headword || authoredGlosses.has(id) || extra !== undefined ||
        ![en, ru, tk].every((value) => value?.trim())) throw new Error(`Invalid authored gloss: ${file}:${number}`)
    authoredGlosses.set(id, { en: [en.trim()], ru: [ru.trim()], tk: [tk.trim()] })
  }
}
const packs = new Map([1, 2, 3, 4, 5, 6, 7].map((level) => [level, []]))
const coverage = { version: '2026-07', total: 0, levels: {}, status: 'editorial-review-required' }
const identities = new Set()

if (editorial.sourceVersion !== source.metadata.version) throw new Error('Editorial source version mismatch')
for (const entry of source.entries) {
  const edited = { ...editorial.entries[entry.number], ...overrides[entry.number] }
  if (edited.simplified && edited.simplified !== entry.simplified) throw new Error(`Override mismatch: ${entry.number}`)
  const translations = authoredGlosses.get(entry.number) || edited.translations || {}
  const word = {
    simplified: entry.simplified,
    traditional: edited.traditional || entry.simplified,
    pinyin: entry.pinyin,
    definitions: translations.en || [],
    translations,
    hsk: entry.level,
    sourceNumber: entry.number,
    sourceLabel: entry.headword,
    sourceLevels: entry.levelLabel,
    partOfSpeech: entry.partOfSpeech,
  }
  // The source lists 横/héng twice without a homograph number (4148, 7058).
  const sense = entry.number === 7058 ? 2 : entry.sense
  if (sense > 1) word.sense = sense
  if (edited.idPinyin && edited.idPinyin !== entry.pinyin) word.idPinyin = edited.idPinyin
  if (edited.example) word.example = edited.example
  const key = `${word.simplified}·${(word.idPinyin || word.pinyin).toLowerCase().replace(/[\s'’ʼ]+/g, '')}${word.sense ? `~${word.sense}` : ''}`
  if (identities.has(key)) throw new Error(`Duplicate lexeme identity: ${entry.number} ${key}`)
  identities.add(key)
  packs.get(entry.level).push(word)
  const counts = coverage.levels[entry.level] ||= { total: 0, en: 0, ru: 0, tk: 0, authoredGlosses: 0, examples: 0, completeExamples: 0 }
  counts.total++
  if (authoredGlosses.has(entry.number)) counts.authoredGlosses++
  coverage.total++
  for (const lang of ['en', 'ru', 'tk']) if (translations[lang]?.length) counts[lang]++
}

// Compile from the authored story, never from a previous build's example cache.
const allWords = [...packs.values()].flat()
const { examples } = compileStory(read('data/learning/story.json'), allWords)
for (const word of allWords) {
  if (examples[word.sourceNumber]) word.example = examples[word.sourceNumber]
  const counts = coverage.levels[word.hsk]
  if (word.example?.zh) counts.examples++
  if (['zh', 'py', 'en', 'ru', 'tk'].every((lang) => word.example?.[lang]?.trim())) counts.completeExamples++
}
coverage.contentSha256 = crypto.createHash('sha256').update(JSON.stringify(allWords)).digest('hex')
if (hasEditorialReview(editorial.review, coverage.contentSha256)) {
  coverage.status = 'reviewed'
}
fs.writeFileSync(path.join(root, 'data/learning/story-examples.json'), JSON.stringify(examples, null, 2) + '\n')
for (const [level, words] of packs) {
  if (words.length !== source.metadata.counts[level]) throw new Error(`Wrong HSK ${level} count`)
  const name = `hsk${level === 7 ? '7-9' : level}.json`
  const json = JSON.stringify(words) + '\n'
  for (const directory of ['words', 'mobile/assets/words']) {
    fs.writeFileSync(path.join(root, directory, name), json)
  }
}
fs.writeFileSync(path.join(root, 'data/hsk/coverage.json'), JSON.stringify(coverage, null, 2) + '\n')
console.log(JSON.stringify(coverage, null, 2))
if (process.argv.includes('--strict') && (coverage.status !== 'reviewed' || Object.values(coverage.levels).some((level) =>
  ['en', 'ru', 'tk', 'completeExamples'].some((key) => level[key] !== level.total)))) {
  console.error('Editorial release blocked: translations/examples are incomplete or not reviewed for this content revision.')
  process.exitCode = 1
}
