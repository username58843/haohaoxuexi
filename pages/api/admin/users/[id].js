import { User } from '~/lib/models/User'
import { getUserIdFromRequest } from '~/lib/auth'
import { ObjectId } from 'mongodb'
import { runCors } from '~/lib/cors'
import clientPromise from '~/lib/db'

export default async function handler(req, res) {
  if (runCors(req, res)) return

  const userId = getUserIdFromRequest(req)
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const admin = await User.findById(userId)
  if (!admin || !admin.isAdmin) {
    return res.status(403).json({ error: 'Access denied' })
  }

  const { id } = req.query
  const targetUserId = typeof id === 'string' ? new ObjectId(id) : id

  if (req.method === 'PUT') {
    try {
      const { isPremium, premiumExpiresAt, isAdmin, isBanned, banReason } = req.body
      const updates = {}

      if (isPremium !== undefined) updates.isPremium = isPremium
      if (premiumExpiresAt !== undefined) {
        updates.premiumExpiresAt = premiumExpiresAt ? new Date(premiumExpiresAt) : null
      }
      if (isAdmin !== undefined) updates.isAdmin = isAdmin
      if (isBanned !== undefined) updates.isBanned = isBanned
      if (banReason !== undefined) updates.banReason = banReason

      await User.update(targetUserId, updates)
      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Update user error:', error)
      return res.status(500).json({ error: 'Failed to update user' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      // Prevent admin from deleting their own account
      if (id === userId) {
        return res.status(400).json({ error: 'Cannot delete your own account' })
      }

      const client = await clientPromise
      const db = client.db()
      const users = db.collection('users')
      await users.deleteOne({ _id: targetUserId })
      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Delete user error:', error)
      return res.status(500).json({ error: 'Failed to delete user' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

