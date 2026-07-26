import { createApiHandler, errors } from '~/lib/server/api'
import { str } from '~/lib/server/validate'
import { getPackWords } from '~/lib/server/words'

export default createApiHandler({
  GET: {
    handler: async (req, res) => {
      const pack = str(req.query.pack, { field: 'pack', min: 1, max: 40 })
      const items = getPackWords(pack)
      if (!items) throw errors.notFound('Unknown pack')

      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
      res.status(200).json({ items })
    },
  },
})
