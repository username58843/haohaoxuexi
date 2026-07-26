import { createApiHandler } from '~/lib/server/api'
import { getPacks } from '~/lib/server/words'

export default createApiHandler({
  GET: {
    handler: async (req, res) => {
      res.setHeader('Cache-Control', 'public, max-age=3600')
      res.status(200).json({ packs: getPacks() })
    },
  },
})
