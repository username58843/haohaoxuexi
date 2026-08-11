import { createApiHandler } from '~/lib/server/api'
import { getDictionary } from '~/lib/server/dict'

/**
 * GET /api/v1/dict — the reader dictionary (see lib/server/dict.js).
 * Public, immutable-ish: strong ETag + long client cache. ~12k entries,
 * a few hundred KB gzipped; clients additionally cache it in IndexedDB.
 */
export default createApiHandler({
  GET: {
    rateLimit: { name: 'dict', max: 30, windowMs: 60 * 1000 },
    handler: async (req, res) => {
      const { body, etag } = getDictionary()
      res.setHeader('ETag', etag)
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end()
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.status(200).send(body)
    },
  },
})
