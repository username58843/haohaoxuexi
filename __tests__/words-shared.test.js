import { makeWordId, pinyinKey, toWordSnapshot, isValidWordSnapshot } from '~/lib/words-shared'

describe('pinyinKey', () => {
  it('lowercases and strips whitespace and apostrophes', () => {
    expect(pinyinKey('Bà ba')).toBe('bàba')
    expect(pinyinKey("Xī'ān")).toBe('xīān')
    expect(pinyinKey('  nǐ hǎo  ')).toBe('nǐhǎo')
    expect(pinyinKey('')).toBe('')
    expect(pinyinKey(null)).toBe('')
  })
})

describe('makeWordId', () => {
  it('builds the canonical id (must match Flutter implementation)', () => {
    expect(makeWordId({ simplified: '爱', pinyin: 'ài' })).toBe('爱·ài')
    expect(makeWordId({ simplified: '爸爸', pinyin: 'bà ba' })).toBe('爸爸·bàba')
  })

  it('distinguishes homographs by tone', () => {
    const hao3 = makeWordId({ simplified: '好', pinyin: 'hǎo' })
    const hao4 = makeWordId({ simplified: '好', pinyin: 'hào' })
    expect(hao3).not.toBe(hao4)
  })
})

describe('toWordSnapshot', () => {
  it('keeps only whitelisted fields and clips long strings', () => {
    const snap = toWordSnapshot({
      simplified: '学习',
      traditional: '學習',
      pinyin: 'xué xí',
      definitions: ['to study', 'x'.repeat(500)],
      translations: { en: ['to learn'], ru: ['учиться'], de: ['lernen'] },
      hsk: 1,
      evil: { $gt: '' },
    })
    expect(snap.simplified).toBe('学习')
    expect(snap.definitions[1].length).toBe(200)
    expect(snap.translations.en).toEqual(['to learn'])
    expect(snap.translations.de).toBeUndefined()
    expect(snap.evil).toBeUndefined()
    expect(snap.hsk).toBe(1)
  })

  it('defaults traditional to simplified and drops invalid hsk', () => {
    const snap = toWordSnapshot({ simplified: '猫', pinyin: 'māo', hsk: 99 })
    expect(snap.traditional).toBe('猫')
    expect(snap.hsk).toBeUndefined()
  })
})

describe('isValidWordSnapshot', () => {
  it('accepts a minimal valid word', () => {
    expect(isValidWordSnapshot({ simplified: '猫', pinyin: 'māo' })).toBe(true)
  })

  it('rejects garbage', () => {
    expect(isValidWordSnapshot(null)).toBeFalsy()
    expect(isValidWordSnapshot({})).toBeFalsy()
    expect(isValidWordSnapshot({ simplified: '', pinyin: 'x' })).toBeFalsy()
    expect(isValidWordSnapshot({ simplified: { $ne: null }, pinyin: 'x' })).toBeFalsy()
    expect(isValidWordSnapshot({ simplified: 'x'.repeat(201), pinyin: 'x' })).toBeFalsy()
  })
})
