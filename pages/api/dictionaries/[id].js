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

    const { id } = req.query

    if (req.method === 'PUT') {
      // Валидация ID
      if (!id || typeof id !== 'string' || id.length > 100) {
        return res.status(400).json({ error: 'Invalid dictionary ID' })
      }

      // Валидация данных
      const { name, words } = req.body

      if (name && (typeof name !== 'string' || name.length > 200)) {
        return res.status(400).json({ error: 'Invalid dictionary name' })
      }

      if (words && (!Array.isArray(words) || words.length > 10000)) {
        return res.status(400).json({ error: 'Invalid words array' })
      }

      const updates = {}
      if (name) updates.name = name.trim().slice(0, 200)
      if (words) updates.words = words.slice(0, 10000)

      const dictionary = await User.updatePersonalDictionary(userId, id, updates)

      if (!dictionary) {
        return res.status(404).json({ error: 'Dictionary not found' })
      }

      return res.status(200).json({ dictionary })
    }

    if (req.method === 'DELETE') {
      // Удалить словарь
      const success = await User.deletePersonalDictionary(userId, id)
      if (!success) {
        return res.status(404).json({ error: 'Dictionary not found' })
      }

      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Dictionary API error:', error)
    return res.status(500).json({ error: 'Failed to manage dictionary' })
  }
}
