import { User } from '~/lib/models/User'
import { getUserIdFromRequest } from '~/lib/auth'
import { runCors } from '~/lib/cors'

export default async function handler(req, res) {
  if (runCors(req, res)) return

  try {
    const userId = getUserIdFromRequest(req)
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (req.method === 'GET') {
      const user = await User.findById(userId)
      return res.status(200).json({
        settings: user?.settings || {
          themeColor: 'red',
          language: 'en',
          translationLanguages: ['en'],
          alwaysShowPinyin: false,
          alwaysShowTranslation: false,
          dailyGoal: 10,
          notifications: true
        }
      })
    }

    if (req.method === 'PUT') {
      const { themeColor, language, translationLanguages, alwaysShowPinyin, alwaysShowTranslation, dailyGoal, notifications } = req.body

      await User.update(userId, {
        settings: {
          themeColor: themeColor || 'red',
          language: language || 'en',
          translationLanguages: translationLanguages || ['en'],
          alwaysShowPinyin: alwaysShowPinyin || false,
          alwaysShowTranslation: alwaysShowTranslation || false,
          dailyGoal: dailyGoal ?? 10,
          notifications: notifications ?? true
        }
      })

      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Settings API error:', error)
    return res.status(500).json({ error: 'Failed to manage settings' })
  }
}
