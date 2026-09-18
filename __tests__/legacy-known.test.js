import { migrateLegacyLevel, loadLegacyKnownIds } from '~/components/hsk/known-store'
import { api } from '~/lib/api-client'

jest.mock('~/lib/api-client', () => ({ api: { get: jest.fn() } }))

beforeEach(() => {
  const values = new Map()
  global.window = {}
  global.localStorage = { getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
  api.get.mockReset()
})
afterEach(() => { delete global.window; delete global.localStorage })

test('indexed marks can never be applied to reordered HSK 3.0 rows', () => {
  localStorage.setItem('hsk-lexicon-known', JSON.stringify({ 'hsk1-1': true }))
  expect(migrateLegacyLevel(1, [{ id: 'new·x', sourceNumber: 1 }, { id: 'wrong·x', sourceNumber: 2 }])).toBeNull()
  expect(localStorage.getItem('xue_known_migrated')).toBeNull()
  expect(localStorage.getItem('hsk-lexicon-known')).not.toBeNull()
})

test('migration requests frozen legacy order and retains raw marks while offline', async () => {
  localStorage.setItem('hsk-lexicon-known', JSON.stringify({ 'hsk1-1': true }))
  api.get.mockRejectedValueOnce(new Error('offline'))
  expect(await loadLegacyKnownIds(1)).toBeNull()
  expect(localStorage.getItem('xue_known_migrated')).toBeNull()
  api.get.mockResolvedValueOnce({ data: { catalog: 'legacy', items: [{ id: 'first·x' }, { id: 'original·x' }] } })
  expect(await loadLegacyKnownIds(1)).toEqual(['original·x'])
  expect(api.get).toHaveBeenLastCalledWith('/words', { params: { pack: 'hsk1', catalog: 'legacy' } })
})
