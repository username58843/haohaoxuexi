import { createApiHandler, ApiError, rateLimit, getClientIp } from '~/lib/server/api'
import { findUserByEmail } from '~/lib/server/users'
import { sendVerifyEmail, generateToken } from '~/lib/server/email'
import { getCollection } from '~/lib/server/db'

export default createApiHandler({
  POST: {
    handler: async (req, res) => {
      const { email } = req.body || {}
      if (!email || typeof email !== 'string') {
        throw new ApiError(400, 'validation', 'Email is required')
      }

      await rateLimit('send-verification', email.toLowerCase().trim(), { max: 3, windowMs: 3600000 })

      const user = await findUserByEmail(email.toLowerCase().trim())
      // Always return success to prevent email enumeration.
      if (!user || user.emailVerified) {
        return res.status(200).json({ ok: true })
      }

      const token = generateToken()
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
      const users = await getCollection('users')
      await users.updateOne(
        { _id: user._id },
        { $set: { verifyToken: token, verifyExpires: expires, updatedAt: new Date() } }
      )

      await sendVerifyEmail({ to: user.email, name: user.name, token })
      res.status(200).json({ ok: true })
    },
  },
})
