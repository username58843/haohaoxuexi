import { createApiHandler } from '~/lib/server/api'
import { optStr, int } from '~/lib/server/validate'
import { searchWords } from '~/lib/server/words'

export default createApiHandler({
  GET: {
    rateLimit: { name: 'wsearch', max: 60, windowMs: 60 * 1000 },
    handler: async (req, res) => {
      const q = optStr(req.query.q, { field: 'q', max: 100 }) || ''

      let level = null
      const rawLevel = req.query.level
      if (rawLevel !== undefined && rawLevel !== '' && rawLevel !== 'all') {
        // 7 = the combined HSK 3.0 band 7-9.
        level = int(rawLevel, { field: 'level', min: 1, max: 7 })
      }

      const page = int(req.query.page, { field: 'page', def: 1, min: 1, max: 500 })
      const limit = int(req.query.limit, { field: 'limit', def: 40, min: 1, max: 100 })

      res.status(200).json(searchWords({ q, level, page, limit }))
    },
  },
})
