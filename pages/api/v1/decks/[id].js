import { createApiHandler, errors, parseObjectId } from '~/lib/server/api'
import { getCollection } from '~/lib/server/db'
import { objectBody, optStr, optArr, int } from '~/lib/server/validate'
import { publicDeck, validateWords } from './index'

const MAX_WORDS = 2000

async function findOwnDeck(req) {
  const deckId = parseObjectId(req.query.id, 'deck id')
  const decks = await getCollection('decks')
  const doc = await decks.findOne({ _id: deckId, userId: req.userId })
  if (!doc) throw errors.notFound('Deck not found')
  return { decks, doc, deckId }
}

export default createApiHandler({
  GET: {
    auth: true,
    handler: async (req, res) => {
      const { doc } = await findOwnDeck(req)
      res.status(200).json({ deck: publicDeck(doc) })
    },
  },
  PUT: {
    auth: true,
    handler: async (req, res) => {
      const body = objectBody(req.body)
      const { decks, doc, deckId } = await findOwnDeck(req)

      const set = { updatedAt: new Date() }
      const name = optStr(body.name, { field: 'name', min: 1, max: 80 })
      if (name !== undefined) set.name = name
      const rawWords = optArr(body.words, { field: 'words', max: MAX_WORDS })
      if (rawWords !== undefined) set.words = validateWords(rawWords)
      if (body.order !== undefined) {
        set.order = int(body.order, { field: 'order', min: 0, max: 10000 })
      }

      await decks.updateOne({ _id: deckId, userId: req.userId }, { $set: set })
      res.status(200).json({ deck: publicDeck({ ...doc, ...set }) })
    },
  },
  DELETE: {
    auth: true,
    handler: async (req, res) => {
      const { decks, deckId } = await findOwnDeck(req)
      await decks.deleteOne({ _id: deckId, userId: req.userId })
      res.status(200).json({ ok: true })
    },
  },
})
