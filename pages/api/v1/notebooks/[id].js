import { createApiHandler, errors, userRateKey, parseObjectId } from '~/lib/server/api'
import { getCollection } from '~/lib/server/db'
import {
  validateNotebookName,
  validateNotebookDescription,
  toNotebookShape,
} from '~/lib/server/notes'

/**
 * PUT    /api/v1/notebooks/[id] — { name?, description?, order? }
 * DELETE — deletes the notebook; its notes are kept and unfiled
 *          (notebookId → null), mirroring Notesnook behaviour.
 */

async function ownNotebook(req) {
  const _id = parseObjectId(req.query.id)
  const col = await getCollection('notebooks')
  const doc = await col.findOne({ _id, userId: req.userId })
  if (!doc) throw errors.notFound('Notebook not found')
  return { col, doc, _id }
}

export default createApiHandler({
  PUT: {
    auth: true,
    rateLimit: { name: 'notebooks_update', max: 60, windowMs: 60 * 1000, keyFn: userRateKey },
    handler: async (req, res) => {
      const { col, _id } = await ownNotebook(req)
      const body = req.body || {}
      const set = {}
      if (body.name !== undefined) set.name = validateNotebookName(body.name)
      if (body.description !== undefined) set.description = validateNotebookDescription(body.description)
      if (body.order !== undefined) {
        if (!Number.isInteger(body.order) || body.order < 0 || body.order > 10000) {
          throw errors.badRequest('order must be an integer 0..10000')
        }
        set.order = body.order
      }
      if (Object.keys(set).length === 0) throw errors.badRequest('Nothing to update')
      set.updatedAt = new Date()

      const updated = await col.findOneAndUpdate(
        { _id, userId: req.userId },
        { $set: set },
        { returnDocument: 'after' }
      )
      res.status(200).json({ notebook: toNotebookShape(updated) })
    },
  },
  DELETE: {
    auth: true,
    rateLimit: { name: 'notebooks_delete', max: 30, windowMs: 60 * 1000, keyFn: userRateKey },
    handler: async (req, res) => {
      const { col, _id } = await ownNotebook(req)
      const notes = await getCollection('notes')
      await notes.updateMany(
        { userId: req.userId, notebookId: _id },
        { $set: { notebookId: null, updatedAt: new Date() } }
      )
      await col.deleteOne({ _id, userId: req.userId })
      res.status(200).json({ ok: true })
    },
  },
})
