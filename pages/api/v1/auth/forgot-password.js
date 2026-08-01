import { createApiHandler, rateLimit, getClientIp } from '~/lib/server/api'
import { findUserByEmail } from '~/lib/server/users'
import { sendResetEmail, generateToken } from '~/lib/server/email'
import { getCollection } from '~/lib/server/db'
import { verifyTurnstile } from '~/lib/server/captcha'
import { objectBody, email as emailField, optStr } from '~/lib/server/validate'

export default createApiHandler({
  POST: {
    handler: async (req, res) => {
      const body = objectBody(req.body)
      const email = emailField(body.email)
      const captchaToken = optStr(body.captchaToken, { field: 'captchaToken', max: 4096 })

      await verifyTurnstile(captchaToken, getClientIp(req))
      await rateLimit('forgot-password', email, { max: 3, windowMs: 3600000 })

      const user = await findUserByEmail(email)
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

      const lang = user.settings?.language || 'en'
      await sendResetEmail({ to: user.email, name: user.name, token, lang })
      res.status(200).json({ ok: true })
    },
  },
})
