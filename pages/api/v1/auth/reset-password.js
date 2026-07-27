import { createApiHandler, ApiError } from '~/lib/server/api'
import { getCollection } from '~/lib/server/db'
import { hashPassword } from '~/lib/server/users'

export default createApiHandler({
  POST: {
    handler: async (req, res) => {
      const { token, password } = req.body || {}
      if (!token || typeof token !== 'string') {
        throw new ApiError(400, 'validation', 'Token is required')
      }
      if (!password || typeof password !== 'string' || password.length < 8) {
        throw new ApiError(400, 'validation', 'Password must be at least 8 characters')
      }

      const users = await getCollection('users')
      const user = await users.findOne({
        resetToken: token,
        resetExpires: { $gt: new Date() },
      })

      if (!user) {
        throw new ApiError(400, 'invalid_token', 'Invalid or expired reset link')
      }

      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            password: await hashPassword(password),
            tokenVersion: (user.tokenVersion || 0) + 1, // invalidate all existing sessions
            updatedAt: new Date(),
          },
          $unset: { resetToken: '', resetExpires: '' },
        }
      )

      res.status(200).json({ ok: true })
    },
  },
})
