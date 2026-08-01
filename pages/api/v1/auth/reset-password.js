import { createApiHandler, ApiError, rateLimit, getClientIp } from '~/lib/server/api'
import { getCollection } from '~/lib/server/db'
import { hashPassword } from '~/lib/server/users'
import { objectBody, str } from '~/lib/server/validate'

export default createApiHandler({
  POST: {
    handler: async (req, res) => {
      const body = objectBody(req.body)
      const token = str(body.token, { field: 'token', min: 1, max: 256 })
      const password = str(body.password, { field: 'password', min: 8, max: 200, trim: false })

      // Defense in depth: tokens are unguessable, but redemption should not
      // be a free brute-force oracle either.
      await rateLimit('reset-password', getClientIp(req), { max: 10, windowMs: 3600000 })

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
