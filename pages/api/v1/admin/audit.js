import { createApiHandler } from '~/lib/server/api'
import { getCollection } from '~/lib/server/db'
import { int } from '~/lib/server/validate'

function auditItem(doc) {
  return {
    id: doc._id.toString(),
    actorId: doc.actorId ? doc.actorId.toString() : null,
    action: doc.action,
    targetUserId: doc.targetUserId ? doc.targetUserId.toString() : null,
    detail: doc.detail || {},
    createdAt: doc.createdAt,
  }
}

export default createApiHandler({
  GET: {
    admin: true,
    handler: async (req, res) => {
      const page = int(req.query.page, { field: 'page', min: 1, max: 100000, def: 1 })
      const limit = int(req.query.limit, { field: 'limit', min: 1, max: 50, def: 20 })

      const audit = await getCollection('audit_logs')
      const [docs, total] = await Promise.all([
        audit
          .find({})
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .toArray(),
        audit.countDocuments({}),
      ])

      res.status(200).json({
        items: docs.map(auditItem),
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
      })
    },
  },
})
