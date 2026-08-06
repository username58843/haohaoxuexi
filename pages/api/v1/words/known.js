import { createApiHandler, userRateKey } from '~/lib/server/api'
import { objectBody, optArr, str, ValidationError } from '~/lib/server/validate'
import { getCollection } from '~/lib/server/db'

/**
 * Per-account "known words" set (the word-map mastery overlay), synced between
 * web and Android. One document per user in `known_words`:
 *   { userId (unique), ids: [wordId], updatedAt }
 *
 * GET  → { ids, updatedAt } — the full set.
 * PUT  → { add?: [wordId], remove?: [wordId] } — delta merge. Clients keep the
 *        set locally (localStorage / SharedPreferences), apply toggles
 *        optimistically and push debounced deltas; on login they merge the
 *        server set with local state. Deltas commute, so two devices editing
 *        offline converge without clobbering each other (unlike full-set PUTs).
 *
 * Canonical word ids (`simplified·pinyinKey`, ARCHITECTURE.md §5) are opaque
 * strings here — unknown ids are harmless and simply never match a word.
 */

const MAX_DELTA = 2000 // ids per PUT
const MAX_IDS = 30000 // stored per user (HSK 1–6 + 7–9 ≈ 11k)
const MAX_ID_LEN = 80

function idList(value, field) {
  const list = optArr(value, { field, max: MAX_DELTA }) || []
  const out = []
  const seen = new Set()
  for (const raw of list) {
    const id = str(raw, { field, min: 1, max: MAX_ID_LEN })
    if (!seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

export default createApiHandler({
  GET: {
    auth: true,
    handler: async (req, res) => {
      const col = await getCollection('known_words')
      const doc = await col.findOne({ userId: req.userId })
      res.status(200).json({
        ids: Array.isArray(doc?.ids) ? doc.ids : [],
        updatedAt: doc?.updatedAt || null,
      })
    },
  },
  PUT: {
    auth: true,
    rateLimit: { name: 'known_put', max: 120, windowMs: 60 * 1000, keyFn: userRateKey },
    handler: async (req, res) => {
      const body = objectBody(req.body)
      const add = idList(body.add, 'add')
      const remove = idList(body.remove, 'remove')
      if (!add.length && !remove.length) {
        throw new ValidationError('add or remove is required')
      }

      const col = await getCollection('known_words')
      // Single atomic pipeline update: (ids − remove) ∪ add, capped at MAX_IDS.
      // With upsert, the filter's equality field (userId) seeds the new doc.
      await col.updateOne(
        { userId: req.userId },
        [
          {
            $set: {
              ids: {
                $slice: [
                  {
                    $setUnion: [
                      { $setDifference: [{ $ifNull: ['$ids', []] }, remove] },
                      add,
                    ],
                  },
                  MAX_IDS,
                ],
              },
              updatedAt: '$$NOW',
            },
          },
        ],
        { upsert: true }
      )

      res.status(200).json({ ok: true })
    },
  },
})
