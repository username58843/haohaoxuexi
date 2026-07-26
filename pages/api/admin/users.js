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
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const users = await User.getAllUsers()
    const sanitizedUsers = users.map(u => ({
      id: u._id.toString(),
      email: u.email,
      name: u.name,
      avatar: u.avatar,
      isPremium: u.isPremium,
      premiumExpiresAt: u.premiumExpiresAt,
      isAdmin: u.isAdmin,
      isBanned: u.isBanned,
      banReason: u.banReason,
      ipAddress: u.ipAddress,
      lastSeen: u.lastSeen,
      isOnline: u.isOnline,
      createdAt: u.createdAt
    }))

    return res.status(200).json({ users: sanitizedUsers })
  } catch (error) {
    console.error('Get users error:', error)
    return res.status(500).json({ error: 'Failed to get users' })
  }
}

