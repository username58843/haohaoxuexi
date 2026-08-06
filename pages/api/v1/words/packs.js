import { createApiHandler } from '~/lib/server/api'
import { getPacksResolved } from '~/lib/server/words'

export default createApiHandler({
  GET: {
    handler: async (req, res) => {
      // Short shared cache: textbook pack titles/contents are admin-editable.
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600')
      res.status(200).json({ packs: await getPacksResolved() })
    },
  },
})
