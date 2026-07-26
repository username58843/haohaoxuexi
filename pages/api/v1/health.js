import { createApiHandler } from '~/lib/server/api'

export default createApiHandler({
  GET: {
    handler: async (req, res) => {
      res.status(200).json({ ok: true, ts: Date.now() })
    },
  },
})
