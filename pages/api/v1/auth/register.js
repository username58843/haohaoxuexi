import { createApiHandler, errors, getClientIp } from '~/lib/server/api'
import { objectBody, str, email } from '~/lib/server/validate'
import { findUserByEmail, createUser } from '~/lib/server/users'
import { verifyTurnstile } from '~/lib/server/captcha'
import { generateVerificationCode } from '~/lib/server/email'
import { getCollection } from '~/lib/server/db'

export default createApiHandler({
  POST: {
    rateLimit: { name: 'register', max: 5, windowMs: 900000 },
    handler: async (req, res) => {
      const body = objectBody(req.body)
      const emailValue = email(body.email)
      const password = str(body.password, { field: 'password', min: 8, max: 200, trim: false })
      const name = str(body.name, { field: 'name', min: 2, max: 40 })
      const lang = body.lang || 'en'

      await verifyTurnstile(body.captchaToken, getClientIp(req))

      const existing = await findUserByEmail(emailValue)
      if (existing) throw errors.conflict('email_taken', 'Email is already registered')

      let user
      try {
        user = await createUser({ email: emailValue, password, name, settings: { language: lang } })
      } catch (err) {
        if (err?.code === 'DUPLICATE_EMAIL') {
          throw errors.conflict('email_taken', 'Email is already registered')
        }
        throw err
      }

      const code = generateVerificationCode()
      const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const users = await getCollection('users')
      await users.updateOne(
        { _id: user._id },
        { $set: { verifyCode: code, verifyExpires } }
      )

      res.status(201).json({ ok: true, email: user.email })
    },
  },
})
