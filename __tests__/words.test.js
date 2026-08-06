import { getPackWords, getPacks, searchWords, getHskLevelSizes } from '~/lib/server/words'

describe('word packs', () => {
  it('exposes HSK 1-6, band 7-9 plus textbook packs', () => {
    const packs = getPacks()
    const ids = packs.map((p) => p.id)
    expect(ids).toEqual(
      expect.arrayContaining(['hsk1', 'hsk2', 'hsk3', 'hsk4', 'hsk5', 'hsk6', 'hsk7-9'])
    )
    const band = packs.find((p) => p.id === 'hsk7-9')
    expect(band.group).toBe('hsk')
    expect(band.count).toBeGreaterThan(5000)
    expect(packs.length).toBeGreaterThan(30)
  })

  it('loads a substantial HSK1 pack', () => {
    const words = getPackWords('hsk1')
    expect(words.length).toBeGreaterThan(100)
    expect(words[0]).toHaveProperty('id')
    expect(words[0].id).toContain('·')
  })

  it('has NO duplicate canonical ids within any pack (queue dedup relies on this)', () => {
    for (const { id } of getPacks()) {
      const words = getPackWords(id)
      const ids = words.map((w) => w.id)
      const unique = new Set(ids)
      expect(unique.size).toBe(ids.length)
    }
  })

  it('reports level sizes matching pack lengths', () => {
    const sizes = getHskLevelSizes()
    expect(sizes[1]).toBe(getPackWords('hsk1').length)
    expect(Object.keys(sizes)).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('search finds 爱 by hanzi', () => {
    const res = searchWords({ q: '爱' })
    expect(res.items.some((w) => w.simplified === '爱')).toBe(true)
  })

  it('search finds words by pinyin prefix', () => {
    const res = searchWords({ q: 'ni', limit: 100 })
    expect(res.items.length).toBeGreaterThan(0)
  })
})
