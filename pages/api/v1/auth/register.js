import { createApiHandler, errors, signToken, buildAuthCookie, getClientIp } from '~/lib/server/api'
import { objectBody, str, email } from '~/lib/server/validate'
import { findUserByEmail, createUser, publicUser } from '~/lib/server/users'
import { verifyTurnstile } from '~/lib/server/captcha'
import { sendVerifyEmail, generateToken } from '~/lib/server/email'
import { getCollection } from '~/lib/server/db'

export default createApiHandler({
  POST: {
    rateLimit: { name: 'register', max: 5, windowMs: 900000 },
    handler: async (req, res) => {
      const body = objectBody(req.body)
      const emailValue = email(body.email)
      const password = str(body.password, { field: 'password', min: 8, max: 200, trim: false })
      const name = str(body.name, { field: 'name', min: 2, max: 40 })

      await verifyTurnstile(body.captchaToken, getClientIp(req))

      const existing = await findUserByEmail(emailValue)
      if (existing) throw errors.conflict('email_taken', 'Email is already registered')

      let user
      try {
        user = await createUser({ email: emailValue, password, name })
      } catch (err) {
        if (err?.code === 'DUPLICATE_EMAIL') {
          throw errors.conflict('email_taken', 'Email is already registered')
        }
        throw err
      }

      // Generate and store verify token, then send email (best-effort).
      const verifyToken = generateToken()
      const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const users = await getCollection('users')
      await users.updateOne(
        { _id: user._id },
        { $set: { verifyToken, verifyExpires } }
      )
      sendVerifyEmail({ to: user.email, name: user.name, token: verifyToken }).catch(() => {})

      const token = signToken(user)
      res.setHeader('Set-Cookie', buildAuthCookie(token))
      res.status(201).json({ user: publicUser(user), token })
    },
  },
})
