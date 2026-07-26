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
      // Получить выбранные слова
      const user = await User.findById(userId)
      return res.status(200).json({
        selectedWords: user.selectedWords || []
      })
    }

    if (req.method === 'POST') {
      // Добавить слово к выбранным
      const { word } = req.body

      if (!word || !word.simplified) {
        return res.status(400).json({ error: 'Word data is required' })
      }

      const result = await User.addSelectedWord(userId, word)
      const user = await User.findById(userId)

      return res.status(200).json({
        selectedWords: user.selectedWords || [],
        added: result?.added !== false,
        alreadyExists: !!result?.alreadyExists
      })
    }

    if (req.method === 'DELETE') {
      const { wordSimplified } = req.query

      // Если wordSimplified не указан — очищаем ВСЕ слова
      if (!wordSimplified) {
        // Очистить все выбранные слова
        await User.clearAllSelectedWords(userId)
        return res.status(200).json({
          selectedWords: [],
          message: 'All selected words cleared'
        })
      }

      // Если указан wordSimplified — удаляем конкретное слово
      await User.removeSelectedWord(userId, wordSimplified)
      const user = await User.findById(userId)

      return res.status(200).json({
        selectedWords: user.selectedWords || []
      })
    }

    if (req.method === 'PUT') {
      // Создать словарь из выбранных слов
      const { dictionaryName } = req.body

      if (!dictionaryName || dictionaryName.trim().length === 0) {
        return res.status(400).json({ error: 'Dictionary name is required' })
      }

      const dictionary = await User.createDictionaryFromSelectedWords(userId, dictionaryName.trim())

      if (!dictionary) {
        return res.status(400).json({ error: 'No selected words found' })
      }

      return res.status(201).json({ dictionary })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Selected words API error:', error)
    return res.status(500).json({ error: 'Failed to manage selected words' })
  }
}
