import { User } from '~/lib/models/User'
import { getUserIdFromRequest } from '~/lib/auth'
import { runCors } from '~/lib/cors'

export default async function handler(req, res) {
  if (runCors(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const userId = getUserIdFromRequest(req)
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const user = await User.findById(userId)
    if (!user) {
      // Treat as unauthenticated so client can clear a stale token cleanly
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Update last seen
    await User.update(userId, { lastSeen: new Date() })

    // Check if premium is still valid
    const isPremium = user.isPremium &&
                     (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > new Date())

    // Check if user is banned
    if (user.isBanned) {
      return res.status(403).json({
        error: 'Account is banned',
        banReason: user.banReason || 'No reason provided',
        isBanned: true
      })
    }

    return res.status(200).json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        isPremium: isPremium,
        premiumExpiresAt: user.premiumExpiresAt,
        isAdmin: user.isAdmin,
        isBanned: user.isBanned || false,
        banReason: user.banReason || null,
        personalDictionaries: user.personalDictionaries || [],
        searchHistory: user.searchHistory || []
      }
    })
  } catch (error) {
    console.error('Get user error:', error)
    return res.status(500).json({ error: 'Failed to get user' })
  }
}

