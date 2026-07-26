import { getUserIdFromRequest } from '~/lib/auth'
import { User } from '~/lib/models/User'
import { runCors } from '~/lib/cors'

/**
 * Optional cloud backup for study stats (client remains source of truth).
 * GET  -> { stats }
 * PUT  -> body.stats merges into user.studyStats
 */
export default async function handler(req, res) {
  if (runCors(req, res)) return

  if (req.method !== 'GET' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const userId = getUserIdFromRequest(req)
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const user = await User.findById(userId)
    if (!user) return res.status(404).json({ error: 'User not found' })

    if (req.method === 'GET') {
      return res.status(200).json({ stats: user.studyStats || null })
    }

    const { stats } = req.body || {}
    if (!stats || typeof stats !== 'object') {
      return res.status(400).json({ error: 'stats object required' })
    }

    // Keep payload small
    const safe = {
      version: 1,
      totalAnswered: Number(stats.totalAnswered) || 0,
      totalCorrect: Number(stats.totalCorrect) || 0,
      totalSessions: Number(stats.totalSessions) || 0,
      streak: Number(stats.streak) || 0,
      bestStreak: Number(stats.bestStreak) || 0,
      lastStudyDate: stats.lastStudyDate || null,
      updatedAt: new Date().toISOString(),
    }

    await User.update(userId, { studyStats: safe })
    return res.status(200).json({ stats: safe })
  } catch (error) {
    console.error('user/stats error', error)
    return res.status(500).json({ error: 'Failed to handle stats' })
  }
}
