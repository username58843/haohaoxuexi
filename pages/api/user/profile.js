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

    const { name, avatar } = req.body
    const updates = {}

    if (name !== undefined) updates.name = name
    if (avatar !== undefined) updates.avatar = avatar

    await User.update(userId, updates)

    const updatedUser = await User.findById(userId)
    return res.status(200).json({
      user: {
        id: updatedUser._id.toString(),
        email: updatedUser.email,
        name: updatedUser.name,
        avatar: updatedUser.avatar,
        isAdmin: updatedUser.isAdmin,
        isPremium: updatedUser.isPremium
      }
    })
  } catch (error) {
    console.error('Update profile error:', error)
    return res.status(500).json({ error: 'Failed to update profile' })
  }
}

