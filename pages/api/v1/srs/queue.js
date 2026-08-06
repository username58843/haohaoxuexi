import { createApiHandler } from '~/lib/server/api'
import { int, optStr } from '~/lib/server/validate'
import { getQueue } from '~/lib/server/srs'
import { getPackWords, isTextbookPack } from '~/lib/server/words'

export default createApiHandler({
  GET: {
    auth: true,
    handler: async (req, res) => {
      // 0 = "all" (the default since the session-size picker was removed);
      // getQueue hard-caps the batch server-side. Explicit values are kept for
      // older mobile clients that still send limit=10/20/40.
      const limit = int(req.query.limit, { field: 'limit', min: 0, max: 500, def: 0 })

      // ?packs=hsk1,hsk2 — unknown pack ids are skipped silently. A known
      // base pack is enough here; getQueue resolves admin overrides itself.
      const packsRaw = optStr(req.query.packs, { field: 'packs', max: 2000 })
      const packs = packsRaw
        ? [...new Set(packsRaw.split(',').map((p) => p.trim()).filter(Boolean))].filter(
            (id) => getPackWords(id) || isTextbookPack(id)
          )
        : []

      const result = await getQueue({ userId: req.userId, packs, limit })
      res.status(200).json(result)
    },
  },
})
