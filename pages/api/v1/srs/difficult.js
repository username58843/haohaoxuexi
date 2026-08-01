import { createApiHandler } from '~/lib/server/api'
import { int } from '~/lib/server/validate'
import { getDifficult } from '~/lib/server/srs'

export default createApiHandler({
  GET: {
    auth: true,
    handler: async (req, res) => {
      const limit = int(req.query.limit, { field: 'limit', min: 1, max: 100, def: 20 })
      const minLapses = int(req.query.minLapses, { field: 'minLapses', min: 1, max: 20, def: 2 })
      const result = await getDifficult({ userId: req.userId, limit, minLapses })
      res.status(200).json(result)
    },
  },
})
