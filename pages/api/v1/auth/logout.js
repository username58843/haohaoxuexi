import { createApiHandler, buildAuthCookie } from '~/lib/server/api'

export default createApiHandler({
  POST: {
    handler: async (req, res) => {
      res.setHeader('Set-Cookie', buildAuthCookie(null, { clear: true }))
      res.status(200).json({ ok: true })
    },
  },
})
