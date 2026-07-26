import { createApiHandler } from '~/lib/server/api'
import { oneOf } from '~/lib/server/validate'
import { getAllContent, CONTENT_LANGS } from '~/lib/server/content'

// Public: the published content overrides for one language, plus a parallel
// `meta` map of per-entry updatedAt timestamps (used for the docs pages'
// "Last updated" line). Rows are filtered server-side to the requested lang.
export default createApiHandler({
  GET: {
    handler: async (req, res) => {
      const lang = oneOf(req.query.lang, CONTENT_LANGS, { field: 'lang', def: 'en' })
      const rows = await getAllContent()
      const entries = {}
      const meta = {}
      for (const r of rows) {
        if (r.lang !== lang) continue
        const key = `${r.scope}:${r.key}`
        entries[key] = r.value
        if (r.updatedAt) {
          meta[key] = r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt
        }
      }
      // Short public cache for visitors; admin clients bypass it with a
      // cache-busting query param so fresh edits are always visible to them.
      res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=300')
      res.status(200).json({ lang, entries, meta })
    },
  },
})
