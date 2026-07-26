import { createApiHandler } from '~/lib/server/api'
import { objectBody, str } from '~/lib/server/validate'
import { getCollection } from '~/lib/server/db'
import { publicUser } from '~/lib/server/users'

export default createApiHandler({
  PUT: {
    auth: true,
    handler: async (req, res) => {
      const body = objectBody(req.body)
      const name = str(body.name, { field: 'name', min: 2, max: 40 })

      const now = new Date()
      const users = await getCollection('users')
      await users.updateOne({ _id: req.userId }, { $set: { name, updatedAt: now } })

      res.status(200).json({ user: publicUser({ ...req.user, name, updatedAt: now }) })
    },
  },
})
