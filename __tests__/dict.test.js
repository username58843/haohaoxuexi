import { getDictionary } from '~/lib/server/dict'

describe('reader dictionary (compiled from word packs)', () => {
  const parsed = JSON.parse(getDictionary().body)

  it('compiles once and reports a stable etag', () => {
    const a = getDictionary()
    const b = getDictionary()
    expect(a.etag).toBe(b.etag)
    expect(a.etag).toMatch(/^"dict-[0-9a-f]{16}"$/)
  })

  it('contains a healthy share of the lexicon', () => {
    expect(Object.keys(parsed.words).length).toBeGreaterThan(5000)
    expect(parsed.v).toBe(1)
    expect(parsed.maxLen).toBeGreaterThanOrEqual(2)
    expect(parsed.maxLen).toBeLessThanOrEqual(6)
  })

  it('entry tuple carries pinyin + at least one gloss and the HSK level', () => {
    const entry = parsed.words['爱']
    expect(entry).toBeDefined()
    const [pinyin, en, ru, tk, hsk] = entry
    expect(pinyin.length).toBeGreaterThan(0)
    expect(en.length + ru.length + tk.length).toBeGreaterThan(0)
    expect(hsk).toBe(1)
  })

  it('maps traditional variants to simplified headwords', () => {
    // HSK packs ship traditional === simplified, so aliases come from the
    // textbook packs (e.g. 龍 → 龙 in P2). The char-level table must be
    // healthy enough to read traditional-script classics.
    expect(parsed.trad['龍']).toBe('龙')
    expect(Object.keys(parsed.tradChars).length).toBeGreaterThan(300)
    expect(parsed.tradChars['龍']).toBe('龙')
  })

  it('skips over-long phrase keys', () => {
    for (const key of Object.keys(parsed.words).slice(0, 2000)) {
      expect(key.length).toBeLessThanOrEqual(6)
    }
  })
})
