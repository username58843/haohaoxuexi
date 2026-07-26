import { createApiHandler } from '~/lib/server/api'
import { objectBody, oneOf, int, bool } from '~/lib/server/validate'
import { getCollection } from '~/lib/server/db'
import { publicUser, DEFAULT_SETTINGS } from '~/lib/server/users'

const THEMES = ['dark', 'light', 'system']
const THEME_COLORS = ['cinnabar', 'orange', 'gold', 'jade', 'blue', 'violet', 'pink', 'cyan']
const LANGUAGES = ['en', 'ru', 'tk', 'zh']

export default createApiHandler({
  GET: {
    auth: true,
    handler: async (req, res) => {
      res.status(200).json({ settings: publicUser(req.user).settings })
    },
  },
  PUT: {
    auth: true,
    handler: async (req, res) => {
      const body = objectBody(req.body)
      const settings = { ...DEFAULT_SETTINGS, ...(req.user.settings || {}) }

      if (body.theme !== undefined) {
        settings.theme = oneOf(body.theme, THEMES, { field: 'theme' })
      }
      if (body.themeColor !== undefined) {
        settings.themeColor = oneOf(body.themeColor, THEME_COLORS, { field: 'themeColor' })
      }
      if (body.language !== undefined) {
        settings.language = oneOf(body.language, LANGUAGES, { field: 'language' })
      }
      if (body.dailyGoal !== undefined) {
        settings.dailyGoal = int(body.dailyGoal, { field: 'dailyGoal', min: 5, max: 500 })
      }
      if (body.alwaysShowPinyin !== undefined) {
        settings.alwaysShowPinyin = bool(body.alwaysShowPinyin, { field: 'alwaysShowPinyin' })
      }
      if (body.alwaysShowTranslation !== undefined) {
        settings.alwaysShowTranslation = bool(body.alwaysShowTranslation, {
          field: 'alwaysShowTranslation',
        })
      }

      const users = await getCollection('users')
      await users.updateOne(
        { _id: req.userId },
        { $set: { settings, updatedAt: new Date() } }
      )

      res.status(200).json({ settings })
    },
  },
})
