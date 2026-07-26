import { getUserIdFromRequest } from '~/lib/auth'
import { User } from '~/lib/models/User'
import { runCors } from '~/lib/cors'
import { queryLexicon, getLexiconStats } from '~/lib/lexicon'

export default async function handler(req, res) {
  if (runCors(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { q = '', level = 'all', page = '1', limit = '40', statsOnly } = req.query

    if (statsOnly === '1' || statsOnly === 'true') {
      return res.status(200).json({ stats: getLexiconStats() })
    }

    // Optional: remember query for logged-in users
    const userId = getUserIdFromRequest(req)
    if (userId && q && String(q).trim()) {
      try {
        await User.addSearchHistory(userId, String(q).trim())
      } catch (e) {
        // non-blocking
      }
    }

    const data = queryLexicon({
      q: String(q || ''),
      level,
      page: Number(page) || 1,
      limit: Number(limit) || 40,
    })

    return res.status(200).json({
      ...data,
      results: data.items, // backward-compatible for SearchResults
    })
  } catch (error) {
    console.error('Lexicon API error:', error)
    return res.status(500).json({ error: 'Failed to load lexicon' })
  }
}
