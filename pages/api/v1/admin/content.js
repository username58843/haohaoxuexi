import { createApiHandler } from '~/lib/server/api'
import { objectBody, str, optStr, oneOf } from '~/lib/server/validate'
import { getAllContent, setContentEntry, CONTENT_LANGS } from '~/lib/server/content'
import { writeAuditLog } from '~/lib/server/users'

// Admin: read every override, or upsert/remove one entry.
export default createApiHandler({
  GET: {
    admin: true,
    handler: async (req, res) => {
      res.status(200).json({ items: await getAllContent() })
    },
  },
  PUT: {
    admin: true,
    handler: async (req, res) => {
      const body = objectBody(req.body)
      const scope = str(body.scope, { field: 'scope', min: 1, max: 60 })
      const key = str(body.key, { field: 'key', min: 1, max: 80 })
      const lang = oneOf(body.lang, CONTENT_LANGS, { field: 'lang' })
      // Empty value clears the override (falls back to the shipped default).
      const value = optStr(body.value, { field: 'value', max: 20000, trim: false }) || ''

      const result = await setContentEntry({ scope, key, lang, value, actorId: req.userId })
      await writeAuditLog(req.userId, 'content.update', {
        detail: { scope, key, lang, removed: result.removed, length: value.length },
      })
      res.status(200).json({ ok: true, removed: result.removed })
    },
  },
})
