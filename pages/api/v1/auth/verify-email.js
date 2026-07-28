import { createApiHandler, ApiError, signToken, buildAuthCookie } from '~/lib/server/api'
import { getCollection } from '~/lib/server/db'
import { publicUser } from '~/lib/server/users'

export default createApiHandler({
  POST: {
    handler: async (req, res) => {
      const { email, code } = req.body || {}
      if (!email || !code) {
        throw new ApiError(400, 'validation', 'Email and code are required')
      }

      const users = await getCollection('users')
      const user = await users.findOne({
        email: email.toLowerCase().trim(),
        verifyCode: code,
        verifyExpires: { $gt: new Date() },
      })

      if (!user) {
        throw new ApiError(400, 'invalid_code', 'Invalid or expired verification code')
      }

      await users.updateOne(
        { _id: user._id },
        {
          $set: { emailVerified: true, updatedAt: new Date() },
          $unset: { verifyCode: '', verifyExpires: '' },
        }
      )

      const token = signToken(user)
      res.setHeader('Set-Cookie', buildAuthCookie(token))
      res.status(200).json({ user: publicUser(user), token })
    },
  },
})