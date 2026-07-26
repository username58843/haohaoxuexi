import { createApiHandler } from '~/lib/server/api'
import { publicUser } from '~/lib/server/users'

export default createApiHandler({
  GET: {
    auth: true,
    handler: async (req, res) => {
      res.status(200).json({ user: publicUser(req.user) })
    },
  },
})
