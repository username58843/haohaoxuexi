import { createApiHandler } from '~/lib/server/api'
import { tzOffset } from '~/lib/server/validate'
import { getSummary } from '~/lib/server/srs'
import { isLegacyCatalogRequest } from '~/lib/hsk-catalog'

export default createApiHandler({
  GET: {
    auth: true,
    handler: async (req, res) => {
      const result = await getSummary({
        userId: req.userId,
        tzOffset: tzOffset(req.query.tzOffset),
        dailyGoal: req.user.settings?.dailyGoal || 20,
        legacy: isLegacyCatalogRequest(req),
      })
      res.status(200).json(result)
    },
  },
})
