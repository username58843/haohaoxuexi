import { createApiHandler, rateLimit } from '~/lib/server/api'
import { findUserByEmail } from '~/lib/server/users'
import { sendVerifyEmail, generateVerificationCode } from '~/lib/server/email'
import { getCollection } from '~/lib/server/db'
import { objectBody, email as emailField } from '~/lib/server/validate'

export default createApiHandler({
  POST: {
    handler: async (req, res) => {
      const body = objectBody(req.body)
      const email = emailField(body.email)

      await rateLimit('send-verification', email, { max: 3, windowMs: 3600000 })

      const user = await findUserByEmail(email)
      if (!user || user.emailVerified) {
        return res.status(200).json({ ok: true })
      }

      const code = generateVerificationCode()
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const users = await getCollection('users')
      await users.updateOne(
        { _id: user._id },
        { $set: { verifyCode: code, verifyExpires: expires, updatedAt: new Date() } }
      )

      const lang = user.settings?.language || 'en'
      await sendVerifyEmail({ to: user.email, name: user.name, code, lang })
      res.status(200).json({ ok: true })
    },
  },
})
