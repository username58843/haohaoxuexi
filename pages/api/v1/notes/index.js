import { createApiHandler, errors, userRateKey, parseObjectId } from '~/lib/server/api'
import { getCollection } from '~/lib/server/db'
import {
  NOTE_LIMITS,
  validateNoteContent,
  extractHeadline,
  validateTitle,
  validateTags,
  toNoteMeta,
  toNoteFull,
} from '~/lib/server/notes'

/**
 * GET  /api/v1/notes — list note metadata (no content payloads)
 *   ?view=notes|favorites|archive|trash (default notes = active)
 *   &notebook=<id> &tag=<string> &q=<search in title/headline>
 * POST /api/v1/notes — create { title?, content?, notebookId?, tags? } → { note }
 *
 * Trash retention: listing lazily purges trashed notes older than 30 days.
 */

const VIEWS = new Set(['notes', 'favorites', 'archive', 'trash', 'all'])

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default createApiHandler({
  GET: {
    auth: true,
    handler: async (req, res) => {
      const col = await getCollection('notes')

      // Lazy trash purge — cheap indexed delete, keeps the contract simple.
      const cutoff = new Date(Date.now() - NOTE_LIMITS.trashRetentionDays * 86400 * 1000)
      col.deleteMany({ userId: req.userId, trashed: true, deletedAt: { $lt: cutoff } }).catch(() => {})

      const view = VIEWS.has(req.query.view) ? req.query.view : 'notes'
      const filter = { userId: req.userId }
      if (view === 'trash') filter.trashed = true
      else {
        filter.trashed = { $ne: true }
        if (view === 'archive') filter.archived = true
        else if (view === 'favorites') {
          filter.favorite = true
          filter.archived = { $ne: true }
        } else if (view === 'notes') filter.archived = { $ne: true }
      }
      if (typeof req.query.notebook === 'string' && req.query.notebook) {
        filter.notebookId = parseObjectId(req.query.notebook, 'notebook')
      }
      if (typeof req.query.tag === 'string' && req.query.tag.trim()) {
        const tag = req.query.tag.trim().slice(0, NOTE_LIMITS.tagLen)
        filter.tags = { $elemMatch: { $regex: `^${escapeRegex(tag)}$`, $options: 'i' } }
      }
      if (typeof req.query.q === 'string' && req.query.q.trim()) {
        const q = escapeRegex(req.query.q.trim().slice(0, 80))
        filter.$or = [
          { title: { $regex: q, $options: 'i' } },
          { headline: { $regex: q, $options: 'i' } },
        ]
      }

      const docs = await col
        .find(filter, { projection: { content: 0 } })
        .sort({ pinned: -1, updatedAt: -1 })
        .limit(2000)
        .toArray()
      res.status(200).json({ notes: docs.map(toNoteMeta) })
    },
  },
  POST: {
    auth: true,
    rateLimit: { name: 'notes_create', max: 60, windowMs: 60 * 1000, keyFn: userRateKey },
    handler: async (req, res) => {
      const body = req.body || {}
      const title = validateTitle(body.title)
      const content = validateNoteContent(body.content)
      const tags = validateTags(body.tags)
      let notebookId = null
      if (body.notebookId != null) {
        notebookId = parseObjectId(body.notebookId, 'notebookId')
        const notebooks = await getCollection('notebooks')
        const owned = await notebooks.findOne({ _id: notebookId, userId: req.userId })
        if (!owned) throw errors.notFound('Notebook not found')
      }

      const col = await getCollection('notes')
      const count = await col.countDocuments({ userId: req.userId })
      if (count >= NOTE_LIMITS.maxNotes) {
        throw errors.conflict('limit_reached', `At most ${NOTE_LIMITS.maxNotes} notes per account`)
      }

      const now = new Date()
      const doc = {
        userId: req.userId,
        title,
        content,
        headline: extractHeadline(content),
        notebookId,
        tags,
        pinned: false,
        favorite: false,
        archived: false,
        trashed: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      }
      const { insertedId } = await col.insertOne(doc)
      res.status(201).json({ note: toNoteFull({ ...doc, _id: insertedId }) })
    },
  },
})
