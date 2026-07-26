import { createApiHandler } from '~/lib/server/api'
import { tzOffset } from '~/lib/server/validate'
import { getSummary } from '~/lib/server/srs'

export default createApiHandler({
  GET: {
    auth: true,
    handler: async (req, res) => {
      const result = await getSummary({
        userId: req.userId,
        tzOffset: tzOffset(req.query.tzOffset),
        dailyGoal: req.user.settings?.dailyGoal || 20,
      })
      res.status(200).json(result)
    },
  },
})
