import { createApiHandler } from '~/lib/server/api'
import { int, tzOffset } from '~/lib/server/validate'
import { getActivity } from '~/lib/server/srs'

export default createApiHandler({
  GET: {
    auth: true,
    handler: async (req, res) => {
      const days = int(req.query.days, { field: 'days', min: 1, max: 365, def: 42 })
      const result = await getActivity({
        userId: req.userId,
        days,
        tzOffset: tzOffset(req.query.tzOffset),
      })
      res.status(200).json(result)
    },
  },
})
