import { createApiHandler } from '~/lib/server/api'
import { getPacks, getPacksResolved, getPackOverrideSummaries } from '~/lib/server/words'

/**
 * Admin: registry of built-in packs with override status. Textbook packs are
 * editable (title + words via pack_overrides); HSK packs are read-only.
 */
export default createApiHandler({
  GET: {
    admin: true,
    handler: async (req, res) => {
      const base = new Map(getPacks().map((p) => [p.id, p]))
      const overrides = new Map(
        (await getPackOverrideSummaries()).map((o) => [o.packId, o])
      )
      const resolved = await getPacksResolved()
      res.status(200).json({
        items: resolved.map((p) => {
          const b = base.get(p.id)
          const o = overrides.get(p.id)
          return {
            ...p,
            editable: p.group === 'textbook',
            defaultTitle: b?.title || p.id,
            defaultCount: b?.count ?? p.count,
            titleOverridden: !!(o && typeof o.title === 'string' && o.title.trim()),
            wordsOverridden: !!o?.hasWords,
            overrideUpdatedAt: o?.updatedAt || null,
          }
        }),
      })
    },
  },
})
