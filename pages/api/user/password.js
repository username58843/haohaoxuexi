import { User } from '~/lib/models/User'
import { getUserIdFromRequest } from '~/lib/auth'
import { runCors } from '~/lib/cors'
import bcrypt from 'bcryptjs'

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

    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const isValid = await User.verifyPassword(currentPassword, user.password)
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await User.update(userId, { password: hashedPassword })

    return res.status(200).json({ success: true, message: 'Password updated successfully' })
  } catch (error) {
    console.error('Change password error:', error)
    return res.status(500).json({ error: 'Failed to change password' })
  }
}

