import { createApiHandler, errors, userRateKey } from '~/lib/server/api'
import { getCollection } from '~/lib/server/db'
import {
  NOTE_LIMITS,
  validateNotebookName,
  validateNotebookDescription,
  toNotebookShape,
} from '~/lib/server/notes'

/**
 * GET  /api/v1/notebooks — list own notebooks (with per-notebook note counts)
 * POST /api/v1/notebooks — create { name, description? } → { notebook }
 */

export default createApiHandler({
  GET: {
    auth: true,
    handler: async (req, res) => {
      const col = await getCollection('notebooks')
      const docs = await col
        .find({ userId: req.userId })
        .sort({ order: 1, name: 1 })
        .limit(NOTE_LIMITS.maxNotebooks)
        .toArray()

      // Per-notebook active-note counts in one aggregation pass.
      const notes = await getCollection('notes')
      const counts = await notes
        .aggregate([
          { $match: { userId: req.userId, trashed: { $ne: true }, notebookId: { $ne: null } } },
          { $group: { _id: '$notebookId', n: { $sum: 1 } } },
        ])
        .toArray()
      const byId = new Map(counts.map((c) => [c._id?.toString(), c.n]))

      res.status(200).json({
        notebooks: docs.map((d) => ({ ...toNotebookShape(d), noteCount: byId.get(d._id.toString()) || 0 })),
      })
    },
  },
  POST: {
    auth: true,
    rateLimit: { name: 'notebooks_create', max: 30, windowMs: 60 * 1000, keyFn: userRateKey },
    handler: async (req, res) => {
      const body = req.body || {}
      const name = validateNotebookName(body.name)
      const description = validateNotebookDescription(body.description)

      const col = await getCollection('notebooks')
      const count = await col.countDocuments({ userId: req.userId })
      if (count >= NOTE_LIMITS.maxNotebooks) {
        throw errors.conflict('limit_reached', `At most ${NOTE_LIMITS.maxNotebooks} notebooks per account`)
      }

      const now = new Date()
      const doc = {
        userId: req.userId,
        name,
        description,
        order: count,
        createdAt: now,
        updatedAt: now,
      }
      const { insertedId } = await col.insertOne(doc)
      res.status(201).json({ notebook: { ...toNotebookShape({ ...doc, _id: insertedId }), noteCount: 0 } })
    },
  },
})
