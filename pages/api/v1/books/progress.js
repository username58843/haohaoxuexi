import { createApiHandler, errors, userRateKey } from '~/lib/server/api'
import { getCollection } from '~/lib/server/db'

/**
 * Reading-progress sync for the Books reader.
 * Book files live on the client (IndexedDB) — only the tiny position record
 * syncs between devices, keyed by a client-chosen stable bookId.
 *
 * GET    → { items: [{ bookId, title, chapter, offset, percent, bookmarks, updatedAt }] }
 * PUT    → upsert one record { bookId, title?, chapter, offset, percent, bookmarks? }
 * DELETE → { bookId } removes the record
 */

const MAX_BOOKS = 200
const MAX_BOOKMARKS = 100

function validBookId(v) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= 120
}

function cleanBookmarks(list) {
  if (!Array.isArray(list)) return []
  return list.slice(0, MAX_BOOKMARKS).flatMap((b) => {
    if (!b || typeof b !== 'object') return []
    const chapter = Number.isInteger(b.chapter) && b.chapter >= 0 ? b.chapter : 0
    const offset = typeof b.offset === 'number' && b.offset >= 0 && b.offset <= 1 ? b.offset : 0
    const note = typeof b.note === 'string' ? b.note.slice(0, 200) : ''
    const createdAt = typeof b.createdAt === 'number' ? b.createdAt : Date.now()
    return [{ chapter, offset, note, createdAt }]
  })
}

const shape = (doc) => ({
  bookId: doc.bookId,
  title: doc.title || '',
  chapter: doc.chapter,
  offset: doc.offset,
  percent: doc.percent,
  bookmarks: doc.bookmarks || [],
  updatedAt: doc.updatedAt,
})

export default createApiHandler({
  GET: {
    auth: true,
    handler: async (req, res) => {
      const col = await getCollection('book_progress')
      const items = await col
        .find({ userId: req.userId })
        .sort({ updatedAt: -1 })
        .limit(MAX_BOOKS)
        .toArray()
      res.status(200).json({ items: items.map(shape) })
    },
  },
  PUT: {
    auth: true,
    rateLimit: { name: 'book_progress', max: 60, windowMs: 60 * 1000, keyFn: userRateKey },
    handler: async (req, res) => {
      const { bookId, title, chapter, offset, percent, bookmarks } = req.body || {}
      if (!validBookId(bookId)) throw errors.badRequest('Invalid bookId')
      if (!Number.isInteger(chapter) || chapter < 0 || chapter > 100000) {
        throw errors.badRequest('chapter must be a non-negative integer')
      }
      if (typeof offset !== 'number' || offset < 0 || offset > 1) {
        throw errors.badRequest('offset must be a number 0..1')
      }
      if (typeof percent !== 'number' || percent < 0 || percent > 100) {
        throw errors.badRequest('percent must be a number 0..100')
      }
      if (title != null && (typeof title !== 'string' || title.length > 160)) {
        throw errors.badRequest('title must be a string ≤ 160 chars')
      }

      const col = await getCollection('book_progress')
      const count = await col.countDocuments({ userId: req.userId })
      const exists = await col.findOne({ userId: req.userId, bookId: bookId.trim() })
      if (!exists && count >= MAX_BOOKS) {
        throw errors.conflict('limit_reached', `At most ${MAX_BOOKS} books can be tracked`)
      }

      const update = {
        chapter,
        offset,
        percent,
        updatedAt: new Date(),
      }
      if (typeof title === 'string') update.title = title.trim().slice(0, 160)
      if (bookmarks !== undefined) update.bookmarks = cleanBookmarks(bookmarks)

      const doc = await col.findOneAndUpdate(
        { userId: req.userId, bookId: bookId.trim() },
        { $set: update, $setOnInsert: { userId: req.userId, bookId: bookId.trim(), createdAt: new Date() } },
        { upsert: true, returnDocument: 'after' }
      )
      res.status(200).json({ item: shape(doc) })
    },
  },
  DELETE: {
    auth: true,
    rateLimit: { name: 'book_progress_del', max: 30, windowMs: 60 * 1000, keyFn: userRateKey },
    handler: async (req, res) => {
      const { bookId } = req.body || {}
      if (!validBookId(bookId)) throw errors.badRequest('Invalid bookId')
      const col = await getCollection('book_progress')
      await col.deleteOne({ userId: req.userId, bookId: bookId.trim() })
      res.status(200).json({ ok: true })
    },
  },
})
