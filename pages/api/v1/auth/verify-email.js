import { createApiHandler, ApiError } from '~/lib/server/api'
import { getCollection } from '~/lib/server/db'

export default createApiHandler({
  GET: {
    handler: async (req, res) => {
      const { token } = req.query || {}
      if (!token || typeof token !== 'string') {
        throw new ApiError(400, 'validation', 'Token is required')
      }

      const users = await getCollection('users')
      const user = await users.findOne({
        verifyToken: token,
        verifyExpires: { $gt: new Date() },
      })

      if (!user) {
        throw new ApiError(400, 'invalid_token', 'Invalid or expired verification link')
      }

      await users.updateOne(
        { _id: user._id },
        {
          $set: { emailVerified: true, updatedAt: new Date() },
          $unset: { verifyToken: '', verifyExpires: '' },
        }
      )

      // Redirect to login with success message.
      res.redirect(302, '/auth?verified=1')
    },
  },
})
