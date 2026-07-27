import { createApiHandler, ApiError, rateLimit, getClientIp } from '~/lib/server/api'
import { findUserByEmail } from '~/lib/server/users'
import { sendResetEmail, generateToken } from '~/lib/server/email'
import { getCollection } from '~/lib/server/db'
import { verifyTurnstile } from '~/lib/server/captcha'

export default createApiHandler({
  POST: {
    handler: async (req, res) => {
      const { email, captchaToken } = req.body || {}
      if (!email || typeof email !== 'string') {
        throw new ApiError(400, 'validation', 'Email is required')
      }

      await verifyTurnstile(captchaToken, getClientIp(req))
      await rateLimit('forgot-password', email.toLowerCase().trim(), { max: 3, windowMs: 3600000 })

      const user = await findUserByEmail(email.toLowerCase().trim())
      // Always return success to prevent email enumeration.
      if (!user) {
        return res.status(200).json({ ok: true })
      }

      const token = generateToken()
      const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      const users = await getCollection('users')
      await users.updateOne(
        { _id: user._id },
        { $set: { resetToken: token, resetExpires: expires, updatedAt: new Date() } }
      )

      await sendResetEmail({ to: user.email, name: user.name, token })
      res.status(200).json({ ok: true })
    },
  },
})
