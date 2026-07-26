import {
  str,
  email,
  int,
  bool,
  oneOf,
  arr,
  objectBody,
  tzOffset,
  ValidationError,
} from '~/lib/server/validate'

describe('str — NoSQL-injection guard', () => {
  it('rejects operator objects', () => {
    expect(() => str({ $ne: null })).toThrow(ValidationError)
    expect(() => str(['a'])).toThrow(ValidationError)
    expect(() => str(5)).toThrow(ValidationError)
  })

  it('trims and enforces bounds', () => {
    expect(str('  hi  ', { min: 2, max: 5 })).toBe('hi')
    expect(() => str('x', { min: 2 })).toThrow(ValidationError)
    expect(() => str('xxxxxx', { max: 5 })).toThrow(ValidationError)
  })

  it('can preserve exact bytes for passwords', () => {
    expect(str(' p@ss ', { trim: false })).toBe(' p@ss ')
  })
})

describe('email', () => {
  it('lowercases valid addresses', () => {
    expect(email('User@Example.COM')).toBe('user@example.com')
  })

  it('rejects invalid and injected values', () => {
    expect(() => email('not-an-email')).toThrow(ValidationError)
    expect(() => email({ $gt: '' })).toThrow(ValidationError)
  })
})

describe('int / bool / oneOf / arr', () => {
  it('int enforces range and default', () => {
    expect(int('5', { min: 1, max: 10 })).toBe(5)
    expect(int(undefined, { def: 7 })).toBe(7)
    expect(() => int(99, { max: 10 })).toThrow(ValidationError)
    expect(() => int('abc')).toThrow(ValidationError)
    expect(() => int(1.5)).toThrow(ValidationError)
  })

  it('bool is strict', () => {
    expect(bool(true)).toBe(true)
    expect(() => bool('true')).toThrow(ValidationError)
  })

  it('oneOf', () => {
    expect(oneOf('a', ['a', 'b'])).toBe('a')
    expect(() => oneOf('c', ['a', 'b'])).toThrow(ValidationError)
  })

  it('arr caps length', () => {
    expect(arr([1, 2], { max: 2 })).toEqual([1, 2])
    expect(() => arr([1, 2, 3], { max: 2 })).toThrow(ValidationError)
    expect(() => arr('nope')).toThrow(ValidationError)
  })
})

describe('objectBody', () => {
  it('accepts plain objects only', () => {
    expect(objectBody({ a: 1 })).toEqual({ a: 1 })
    expect(() => objectBody(null)).toThrow(ValidationError)
    expect(() => objectBody([1])).toThrow(ValidationError)
    expect(() => objectBody('x')).toThrow(ValidationError)
  })
})

describe('tzOffset', () => {
  it('clamps to real-world range and defaults to 0', () => {
    expect(tzOffset(180)).toBe(180)
    expect(tzOffset(-9999)).toBe(-720)
    expect(tzOffset(9999)).toBe(840)
    expect(tzOffset('garbage')).toBe(0)
  })
})
