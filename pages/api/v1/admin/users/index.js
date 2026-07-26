import { createApiHandler } from '~/lib/server/api'
import { getCollection } from '~/lib/server/db'
import { optStr, oneOf, int } from '~/lib/server/validate'
import { adminUserView } from '~/lib/server/users'

const FILTERS = {
  banned: { isBanned: true },
  premium: { isPremium: true },
  admin: { role: 'admin' },
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default createApiHandler({
  GET: {
    admin: true,
    handler: async (req, res) => {
      const q = optStr(req.query.q, { field: 'q', max: 100 })
      const filter =
        req.query.filter === undefined
          ? undefined
          : oneOf(req.query.filter, ['banned', 'premium', 'admin'], { field: 'filter' })
      const page = int(req.query.page, { field: 'page', min: 1, max: 100000, def: 1 })
      const limit = int(req.query.limit, { field: 'limit', min: 1, max: 50, def: 20 })

      const query = {}
      if (q) {
        const rx = new RegExp(escapeRegex(q), 'i')
        query.$or = [{ name: rx }, { email: rx }]
      }
      if (filter) Object.assign(query, FILTERS[filter])

      const users = await getCollection('users')
      const [docs, total] = await Promise.all([
        users
          .find(query)
          .project({ password: 0 })
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .toArray(),
        users.countDocuments(query),
      ])

      res.status(200).json({
        users: docs.map(adminUserView),
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
      })
    },
  },
})
