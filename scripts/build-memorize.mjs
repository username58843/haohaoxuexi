import fs from 'node:fs'
import crypto from 'node:crypto'
import { compileStory, storyCoverage, hasEditorialReview } from '../lib/learning/story-compiler.js'

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const story = read('data/learning/story.json')
const words = [1, 2, 3, 4, 5, 6, '7-9'].flatMap((level) => read(`words/hsk${level}.json`))
const { passages, dictionary } = compileStory(story, words)
const reports = {}
for (const level of [2, 3, 4, 5, 6, 7]) {
  const id = `1-${level === 7 ? '7-9' : level}`
  const selected = passages.filter((passage) => passage.level <= level)
  const usedIds = new Set(selected.flatMap((passage) => passage.sentences.flatMap((sentence) => sentence.tokens.map((token) => token.wordId).filter(Boolean))))
  const content = { storyId: story.id, title: story.title, passages: selected,
    words: Object.fromEntries([...usedIds].map((key) => [key, dictionary[key]])) }
  const contentSha256 = crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex')
  const { coverage, missing, outside } = storyCoverage(selected, words, level,
    hasEditorialReview(story.reviews?.[id], contentSha256))
  const payload = { schemaVersion: 1, id, storyId: story.id, status: coverage.complete ? 'complete' : 'draft',
    ...content, coverage, contentSha256 }
  payload.revision = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16)
  const json = JSON.stringify(payload) + '\n'
  for (const dir of ['public/learning', 'mobile/assets/learning']) {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(`${dir}/${id}.json`, json)
  }
  reports[id] = { ...coverage, contentSha256, missing, outside }
  console.log(`HSK ${id}: ${coverage.covered}/${coverage.total}; ${outside.length} outside; ${payload.status}`)
}
fs.writeFileSync('data/learning/coverage.json', JSON.stringify(reports, null, 2) + '\n')
if (process.argv.includes('--strict') && Object.values(reports).some((report) => !report.complete)) {
  console.error('Editorial release blocked: not all cumulative stories are reviewed with full anchored coverage.')
  process.exitCode = 1
}
