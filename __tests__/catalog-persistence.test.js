import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient, ObjectId } from 'mongodb'
import { getCollection } from '~/lib/server/db'
import { getPackWords, getWordLevel } from '~/lib/server/words'
import { applyReview, getQueue, getSummary, localDay } from '~/lib/server/srs'
import { toWordSnapshot } from '~/lib/words-shared'

jest.mock('~/lib/server/db', () => ({ getCollection: jest.fn() }))
jest.setTimeout(60000)

let mongo, client, db, userId, otherUserId, moved, removed, shared, initial
const collections = ['users', 'decks', 'srs_cards', 'review_logs', 'known_words']
const dump = async () => Object.fromEntries(await Promise.all(collections.map(async (name) =>
  [name, await db.collection(name).find().sort({ _id: 1 }).toArray()]
)))

beforeAll(async () => {
  // Only the connection is substituted; queries run against real, disposable MongoDB.
  mongo = await MongoMemoryServer.create()
  client = await new MongoClient(mongo.getUri('catalog-compatibility-test')).connect()
  db = client.db()
  getCollection.mockImplementation(async (name) => db.collection(name))
  await db.collection('srs_cards').createIndex({ userId: 1, wordId: 1 }, { unique: true })
  const legacy = [1, 2, 3, 4, 5, 6, '7-9'].flatMap((level) => getPackWords(`hsk${level}`, { legacy: true }))
  moved = legacy.find((word) => getWordLevel(word.id) && getWordLevel(word.id) !== word.hsk)
  removed = legacy.find((word) => !getWordLevel(word.id))
  expect(moved).toBeDefined()
  expect(removed).toBeDefined()
  shared = getPackWords('hsk1').find((word) => legacy.some((old) => old.id === word.id) && word.id !== moved.id)
  expect(shared).toBeDefined()
})

afterAll(async () => {
  await client?.close()
  await mongo?.stop()
})

beforeEach(async () => {
  for (const name of collections) await db.collection(name).deleteMany({})
  userId = new ObjectId()
  otherUserId = new ObjectId()
  const due = new Date(Date.now() - 86400000)
  const future = new Date(Date.now() + 86400000)
  const words = [moved, removed, shared]
  await db.collection('users').insertMany([userId, otherUserId].map((_id) => ({
    _id, settings: { language: 'tk', dailyGoal: 30, quizSpeakOnCorrect: true },
  })))
  await db.collection('decks').insertOne({ userId, name: 'My own notes', words: words.map((word) => ({
    ...toWordSnapshot(word), definitions: ['Personal meaning, not the catalog definition'],
  })) })
  await db.collection('known_words').insertOne({ userId, ids: words.map((word) => word.id), updatedAt: due })
  await db.collection('srs_cards').insertMany(words.map((word, index) => ({
    userId, wordId: word.id, word: toWordSnapshot(word), state: 'review',
    due: index === 2 ? future : due, ease: 2.7, intervalDays: 45, reps: 19, lapses: 2, createdAt: due,
  })))
  await db.collection('srs_cards').insertOne({ userId: otherUserId, wordId: shared.id,
    word: toWordSnapshot(shared), state: 'review', due, ease: 2.1, intervalDays: 12, reps: 5, lapses: 1 })
  await db.collection('review_logs').insertOne({ userId, day: localDay(0), reviews: 8, correct: 6, newCards: 1 })
  initial = await dump()
})

test('switching catalog only reclassifies statistics, without changing any user collection', async () => {
  for (const legacy of [true, false, true]) {
    const summary = await getSummary({ userId, legacy, dailyGoal: 30 })
    expect(summary).toMatchObject({ dueCount: 2, todayReviews: 8, todayCorrect: 6, goal: 30, byState: { review: 3 } })
    for (let level = 1; level <= 7; level++) {
      const count = [moved, removed, shared].filter((word) => getWordLevel(word.id, { legacy }) === level).length
      expect(summary.byLevel[level]).toMatchObject({ seen: count, mature: count })
    }
    expect(await dump()).toEqual(initial)
  }
})

test('old due snapshots stay reviewable and already-seen words are never re-enqueued as new', async () => {
  for (const legacy of [false, true]) {
    const queue = await getQueue({ userId, packs: ['hsk1', 'hsk2'], legacy, limit: 500 })
    expect(queue.dueCount).toBe(2)
    const oldCards = queue.cards.filter((card) => !card.isNew)
    expect(new Set(oldCards.map((card) => card.wordId))).toEqual(new Set([moved.id, removed.id]))
    for (const card of oldCards) {
      const original = initial.srs_cards.find((row) => row.userId.equals(userId) && row.wordId === card.wordId)
      expect(card).toMatchObject({ word: original.word, ease: 2.7, intervalDays: 45, reps: 19, lapses: 2 })
    }
    expect(queue.cards.some((card) => card.wordId === shared.id)).toBe(false)
    expect(new Set(queue.cards.map((card) => card.wordId)).size).toBe(queue.cards.length)
    expect(await dump()).toEqual(initial)
  }
})

test('a review updates only the intended card and log, preserving snapshots and other accounts', async () => {
  const original = await db.collection('srs_cards').findOne({ userId, wordId: moved.id })
  await applyReview({ userId, wordId: moved.id, grade: 2,
    word: { ...moved, definitions: ['Changed catalog content'] } })
  const updated = await db.collection('srs_cards').findOne({ userId, wordId: moved.id })
  expect(updated._id).toEqual(original._id)
  expect(updated.word).toEqual(original.word)
  expect(updated.reps).toBe(20)
  expect(updated.intervalDays).toBeGreaterThan(45)
  expect(await db.collection('srs_cards').countDocuments({ userId })).toBe(3)
  const after = await dump()
  for (const name of ['users', 'decks', 'known_words']) expect(after[name]).toEqual(initial[name])
  expect(after.srs_cards.filter((row) => row.userId.equals(otherUserId)))
    .toEqual(initial.srs_cards.filter((row) => row.userId.equals(otherUserId)))
  expect(after.review_logs[0]).toMatchObject({ reviews: 9, correct: 7, newCards: 1 })
})
