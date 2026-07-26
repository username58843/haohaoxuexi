import { createApiHandler } from '~/lib/server/api'
import { int, optStr } from '~/lib/server/validate'
import { getQueue } from '~/lib/server/srs'
import { getPackWords } from '~/lib/server/words'

export default createApiHandler({
  GET: {
    auth: true,
    handler: async (req, res) => {
      const limit = int(req.query.limit, { field: 'limit', min: 1, max: 100, def: 20 })

      // ?packs=hsk1,hsk2 — unknown pack ids are skipped silently.
      const packsRaw = optStr(req.query.packs, { field: 'packs', max: 2000 })
      const packs = packsRaw
        ? [...new Set(packsRaw.split(',').map((p) => p.trim()).filter(Boolean))].filter((id) =>
            getPackWords(id)
          )
        : []

      const result = await getQueue({ userId: req.userId, packs, limit })
      res.status(200).json(result)
    },
  },
})
