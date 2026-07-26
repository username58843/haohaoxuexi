import { createApiHandler } from '~/lib/server/api'
import { oneOf } from '~/lib/server/validate'
import { getContentBundle, CONTENT_LANGS } from '~/lib/server/content'

// Public: the published content overrides for one language.
export default createApiHandler({
  GET: {
    handler: async (req, res) => {
      const lang = oneOf(req.query.lang, CONTENT_LANGS, { field: 'lang', def: 'en' })
      const entries = await getContentBundle(lang)
      // Short cache; the client also refetches on navigation/language change.
      res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=300')
      res.status(200).json({ lang, entries })
    },
  },
})
