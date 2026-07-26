import { createApiHandler, errors, parseObjectId } from '~/lib/server/api'
import { getCollection } from '~/lib/server/db'
import { int, oneOf, objectBody } from '~/lib/server/validate'
import { writeAuditLog } from '~/lib/server/users'

const STATUSES = ['new', 'seen', 'done']

function feedbackItem(doc) {
  return {
    id: doc._id.toString(),
    userId: doc.userId ? doc.userId.toString() : null,
    email: doc.email || null,
    topic: doc.topic,
    message: doc.message,
    status: doc.status || 'new',
    userAgent: doc.userAgent || null,
    createdAt: doc.createdAt,
  }
}

export default createApiHandler({
  GET: {
    admin: true,
    handler: async (req, res) => {
      const page = int(req.query.page, { field: 'page', min: 1, max: 100000, def: 1 })
      const limit = int(req.query.limit, { field: 'limit', min: 1, max: 50, def: 20 })
      const status =
        req.query.status === undefined
          ? undefined
          : oneOf(req.query.status, STATUSES, { field: 'status' })

      const query = {}
      if (status) query.status = status

      const feedback = await getCollection('feedback')
      const [docs, total] = await Promise.all([
        feedback
          .find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .toArray(),
        feedback.countDocuments(query),
      ])

      res.status(200).json({
        items: docs.map(feedbackItem),
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
      })
    },
  },

  PUT: {
    admin: true,
    handler: async (req, res) => {
      const body = objectBody(req.body)
      const id = parseObjectId(body.id)
      const status = oneOf(body.status, STATUSES, { field: 'status' })

      const feedback = await getCollection('feedback')
      const result = await feedback.updateOne({ _id: id }, { $set: { status } })
      if (result.matchedCount === 0) throw errors.notFound('Feedback not found')

      await writeAuditLog(req.userId, 'feedback.status', {
        detail: { feedbackId: id.toString(), status },
      })

      res.status(200).json({ ok: true })
    },
  },
})
