import { createApiHandler, errors, userRateKey, parseObjectId } from '~/lib/server/api'
import { getCollection } from '~/lib/server/db'
import {
  validateNoteContent,
  extractHeadline,
  validateTitle,
  validateTags,
  toNoteMeta,
  toNoteFull,
} from '~/lib/server/notes'

/**
 * GET    /api/v1/notes/[id] — full note incl. content (own-scoped)
 * PUT    — partial update; any of { title, content, notebookId, tags, pinned,
 *          favorite, archived, trashed } (trashed:true stamps deletedAt,
 *          trashed:false restores). Bumps updatedAt. High rate cap: autosave.
 * DELETE — active note → move to trash; trashed note (or ?permanent=1) →
 *          permanent delete.
 */

async function ownNote(req) {
  const _id = parseObjectId(req.query.id)
  const col = await getCollection('notes')
  const doc = await col.findOne({ _id, userId: req.userId })
  if (!doc) throw errors.notFound('Note not found')
  return { col, doc, _id }
}

export default createApiHandler({
  GET: {
    auth: true,
    handler: async (req, res) => {
      const { doc } = await ownNote(req)
      res.status(200).json({ note: toNoteFull(doc) })
    },
  },
  PUT: {
    auth: true,
    rateLimit: { name: 'notes_update', max: 240, windowMs: 60 * 1000, keyFn: userRateKey },
    handler: async (req, res) => {
      const { col, _id } = await ownNote(req)
      const body = req.body || {}
      const set = {}

      if (body.title !== undefined) set.title = validateTitle(body.title)
      if (body.content !== undefined) {
        set.content = validateNoteContent(body.content)
        set.headline = extractHeadline(set.content)
      }
      if (body.tags !== undefined) set.tags = validateTags(body.tags)
      if (body.notebookId !== undefined) {
        if (body.notebookId === null) set.notebookId = null
        else {
          const notebookId = parseObjectId(body.notebookId, 'notebookId')
          const notebooks = await getCollection('notebooks')
          const owned = await notebooks.findOne({ _id: notebookId, userId: req.userId })
          if (!owned) throw errors.notFound('Notebook not found')
          set.notebookId = notebookId
        }
      }
      for (const flag of ['pinned', 'favorite', 'archived']) {
        if (body[flag] !== undefined) {
          if (typeof body[flag] !== 'boolean') throw errors.badRequest(`${flag} must be a boolean`)
          set[flag] = body[flag]
        }
      }
      if (body.trashed !== undefined) {
        if (typeof body.trashed !== 'boolean') throw errors.badRequest('trashed must be a boolean')
        set.trashed = body.trashed
        set.deletedAt = body.trashed ? new Date() : null
        if (body.trashed) set.pinned = false
      }
      if (Object.keys(set).length === 0) throw errors.badRequest('Nothing to update')
      set.updatedAt = new Date()

      const updated = await col.findOneAndUpdate(
        { _id, userId: req.userId },
        { $set: set },
        { returnDocument: 'after', projection: { content: 0 } }
      )
      res.status(200).json({ note: toNoteMeta(updated) })
    },
  },
  DELETE: {
    auth: true,
    rateLimit: { name: 'notes_delete', max: 60, windowMs: 60 * 1000, keyFn: userRateKey },
    handler: async (req, res) => {
      const { col, doc, _id } = await ownNote(req)
      const permanent = req.query.permanent === '1' || doc.trashed
      if (permanent) {
        await col.deleteOne({ _id, userId: req.userId })
        return res.status(200).json({ ok: true, deleted: true })
      }
      await col.updateOne(
        { _id, userId: req.userId },
        { $set: { trashed: true, pinned: false, deletedAt: new Date(), updatedAt: new Date() } }
      )
      res.status(200).json({ ok: true, trashed: true })
    },
  },
})
