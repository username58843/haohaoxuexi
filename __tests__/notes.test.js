import {
  NOTE_LIMITS,
  validateNoteContent,
  extractHeadline,
  validateTitle,
  validateTags,
  validateNotebookName,
} from '~/lib/server/notes'
import { ValidationError } from '~/lib/server/validate'

const doc = (...paragraphs) => ({
  type: 'doc',
  content: paragraphs.map((text) => ({
    type: 'paragraph',
    content: text ? [{ type: 'text', text }] : [],
  })),
})

describe('validateNoteContent', () => {
  it('accepts null (empty note)', () => {
    expect(validateNoteContent(null)).toBeNull()
  })

  it('accepts a normal TipTap doc', () => {
    const d = doc('你好世界')
    expect(validateNoteContent(d)).toBe(d)
  })

  it('rejects non-doc roots', () => {
    expect(() => validateNoteContent({ type: 'paragraph' })).toThrow(ValidationError)
    expect(() => validateNoteContent([1, 2])).toThrow(ValidationError)
    expect(() => validateNoteContent('text')).toThrow(ValidationError)
  })

  it('rejects Mongo operator keys anywhere in the tree', () => {
    const evil = doc('hi')
    evil.content[0].attrs = { $set: { hacked: true } }
    expect(() => validateNoteContent(evil)).toThrow(ValidationError)

    const dotted = doc('hi')
    dotted.content[0].attrs = { 'a.b': 1 }
    expect(() => validateNoteContent(dotted)).toThrow(ValidationError)
  })

  it('rejects oversized content', () => {
    const big = doc('汉'.repeat(NOTE_LIMITS.contentBytes / 3 + 10))
    expect(() => validateNoteContent(big)).toThrow(ValidationError)
  })
})

describe('extractHeadline', () => {
  it('joins block text with spaces and trims to the cap', () => {
    const h = extractHeadline(doc('第一段', '第二段'))
    expect(h).toBe('第一段 第二段')
  })

  it('caps at headlineLen characters', () => {
    const h = extractHeadline(doc('a'.repeat(1000)))
    expect(h.length).toBeLessThanOrEqual(NOTE_LIMITS.headlineLen)
  })

  it('returns empty string for null content', () => {
    expect(extractHeadline(null)).toBe('')
  })
})

describe('validateTitle / validateTags / validateNotebookName', () => {
  it('clips long titles', () => {
    expect(validateTitle('x'.repeat(500)).length).toBe(NOTE_LIMITS.titleLen)
    expect(validateTitle(null)).toBe('')
    expect(() => validateTitle(42)).toThrow(ValidationError)
  })

  it('dedupes and normalizes tags', () => {
    expect(validateTags(['#HSK3', 'hsk3 ', 'grammar'])).toEqual(['HSK3', 'grammar'])
    expect(validateTags(null)).toEqual([])
    expect(() => validateTags('nope')).toThrow(ValidationError)
    expect(() => validateTags([1])).toThrow(ValidationError)
  })

  it('caps tags at maxTags', () => {
    const many = Array.from({ length: 40 }, (_, i) => `tag${i}`)
    expect(validateTags(many).length).toBe(NOTE_LIMITS.maxTags)
  })

  it('requires a notebook name', () => {
    expect(validateNotebookName('  Учёба  ')).toBe('Учёба')
    expect(() => validateNotebookName('')).toThrow(ValidationError)
    expect(() => validateNotebookName('x'.repeat(100))).toThrow(ValidationError)
  })
})
