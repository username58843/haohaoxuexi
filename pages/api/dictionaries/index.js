import { User } from '~/lib/models/User'
import { getUserIdFromRequest } from '~/lib/auth'
import { runCors } from '~/lib/cors'

export default async function handler(req, res) {
  if (runCors(req, res)) return

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const userId = getUserIdFromRequest(req)
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (req.method === 'GET') {
      // Получить все пользовательские словари
      const user = await User.findById(userId)
      return res.status(200).json({
        dictionaries: user.personalDictionaries || [],
        selectedWordsCount: user.selectedWords?.length || 0
      })
    }

    if (req.method === 'POST') {
      // Создать новый словарь
      const { name, words } = req.body

      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Dictionary name is required' })
      }

      const dictionary = await User.createPersonalDictionary(userId, name.trim(), words || [])
      return res.status(201).json({ dictionary })
    }
  } catch (error) {
    console.error('Dictionaries API error:', error)
    return res.status(500).json({ error: 'Failed to manage dictionaries' })
  }
}
