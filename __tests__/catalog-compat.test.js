import fs from 'fs'
import { getPackWords, getHskLevelSizes, getWordLevel } from '~/lib/server/words'
import { makeWordId, toWordSnapshot } from '~/lib/words-shared'
import { HSK_CATALOG_VERSION, isLegacyCatalogRequest } from '~/lib/hsk-catalog'

const levels = [1, 2, 3, 4, 5, 6, 7]
const packId = (level) => `hsk${level === 7 ? '7-9' : level}`

describe('HSK 3.0 production compatibility', () => {
  test('new catalogue has exactly 11,000 source rows, including homographs', () => {
    expect(getHskLevelSizes()).toEqual({ 1: 300, 2: 200, 3: 500, 4: 1000, 5: 1600, 6: 1800, 7: 5600 })
    const words = levels.flatMap((level) => getPackWords(packId(level)))
    expect(new Set(words.map((word) => word.id)).size).toBe(11000)
    expect(words.map((word) => word.sourceNumber)).toEqual(Array.from({ length: 11000 }, (_, index) => index + 1))
    expect(words.find((word) => word.sourceNumber === 8873).simplified).toContain('赛')
  })

  test('old clients and unknown catalogue versions keep the old packs', () => {
    for (const catalog of [undefined, 'legacy', 'unknown', [HSK_CATALOG_VERSION]]) {
      expect(isLegacyCatalogRequest({ query: { catalog } })).toBe(true)
    }
    expect(isLegacyCatalogRequest({ query: { catalog: HSK_CATALOG_VERSION } })).toBe(false)
    for (const level of levels) {
      const raw = JSON.parse(fs.readFileSync(`words/legacy/${packId(level)}.json`, 'utf8'))
      const expectedIds = [...new Set(raw.map(makeWordId))]
      expect(getPackWords(packId(level), { legacy: true }).map((word) => word.id)).toEqual(expectedIds)
    }
  })

  test('all snapshots round-trip canonical identity, old and new', () => {
    for (const legacy of [true, false]) {
      for (const level of levels) {
        for (const word of getPackWords(packId(level), { legacy })) {
          expect(makeWordId(toWordSnapshot(word))).toBe(word.id)
          expect(getWordLevel(word.id, { legacy })).toBeGreaterThan(0)
        }
      }
    }
    const old = { simplified: '谁', pinyin: 'shéi', definitions: ['who'] }
    expect(makeWordId({ ...old, pinyin: 'shéi/shuí', idPinyin: 'shéi' })).toBe(makeWordId(old))
    expect(makeWordId({ ...old, sense: 2 })).not.toBe(makeWordId(old))
  })

  test('web and bundled Android packs are byte-identical', () => {
    for (const level of levels) {
      const file = `${packId(level)}.json`
      expect(fs.readFileSync(`words/${file}`).equals(fs.readFileSync(`mobile/assets/words/${file}`))).toBe(true)
    }
  })
})
