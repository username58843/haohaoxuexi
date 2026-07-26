import { createApiHandler, errors } from '~/lib/server/api'
import { getCollection } from '~/lib/server/db'
import { objectBody, str, optArr } from '~/lib/server/validate'
import { toWordSnapshot, isValidWordSnapshot } from '~/lib/words-shared'

const MAX_DECKS = 50
const MAX_WORDS = 2000

export function publicDeck(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    words: doc.words || [],
    order: doc.order || 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export function validateWords(raw) {
  const words = []
  for (const w of raw) {
    if (!isValidWordSnapshot(w)) {
      throw errors.badRequest('Invalid word in deck: each word needs simplified and pinyin strings')
    }
    words.push(toWordSnapshot(w))
  }
  return words
}

export default createApiHandler({
  GET: {
    auth: true,
    handler: async (req, res) => {
      const decks = await getCollection('decks')
      const docs = await decks
        .find({ userId: req.userId })
        .sort({ order: 1, createdAt: -1 })
        .toArray()
      res.status(200).json({ decks: docs.map(publicDeck) })
    },
  },
  POST: {
    auth: true,
    handler: async (req, res) => {
      const body = objectBody(req.body)
      const name = str(body.name, { field: 'name', min: 1, max: 80 })
      const rawWords = optArr(body.words, { field: 'words', max: MAX_WORDS }) || []
      const words = validateWords(rawWords)

      const decks = await getCollection('decks')
      const count = await decks.countDocuments({ userId: req.userId })
      if (count >= MAX_DECKS) {
        throw errors.conflict('deck_limit', `You can have at most ${MAX_DECKS} decks`)
      }

      const now = new Date()
      const doc = {
        userId: req.userId,
        name,
        words,
        order: count,
        createdAt: now,
        updatedAt: now,
      }
      const result = await decks.insertOne(doc)
      res.status(201).json({ deck: publicDeck({ ...doc, _id: result.insertedId }) })
    },
  },
})
