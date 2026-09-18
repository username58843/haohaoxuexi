import { createApiHandler, errors } from '~/lib/server/api'
import { str } from '~/lib/server/validate'
import { isLegacyCatalogRequest, HSK_CATALOG_VERSION } from '~/lib/hsk-catalog'
import { getPackWordsResolved, isTextbookPack } from '~/lib/server/words'

export default createApiHandler({
  GET: {
    handler: async (req, res) => {
      const pack = str(req.query.pack, { field: 'pack', min: 1, max: 40 })
      const legacy = isLegacyCatalogRequest(req)
      const items = await getPackWordsResolved(pack, { legacy })
      if (!items) throw errors.notFound('Unknown pack')

      // Textbook packs are admin-editable (pack_overrides), so their cache
      // must revalidate quickly; the HSK lexicon only changes with a deploy.
      res.setHeader(
        'Cache-Control',
        isTextbookPack(pack)
          ? 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600'
          : 'public, max-age=86400, stale-while-revalidate=604800'
      )
      res.status(200).json({ items, catalog: legacy ? 'legacy' : HSK_CATALOG_VERSION })
    },
  },
})
