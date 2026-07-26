import { User } from '~/lib/models/User'
import { getUserIdFromRequest } from '~/lib/auth'
import { runCors } from '~/lib/cors'

export default async function handler(req, res) {
  if (runCors(req, res)) return

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const userId = getUserIdFromRequest(req)
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { dictionaryOrder } = req.body

    if (!Array.isArray(dictionaryOrder)) {
      return res.status(400).json({ error: 'Dictionary order must be an array' })
    }

    const dictionaries = await User.reorderPersonalDictionaries(userId, dictionaryOrder)
    return res.status(200).json({ dictionaries })
  } catch (error) {
    console.error('Reorder dictionaries API error:', error)
    return res.status(500).json({ error: 'Failed to reorder dictionaries' })
  }
}
