import { createApiHandler, errors, signToken, buildAuthCookie } from '~/lib/server/api'
import { objectBody, str, email } from '~/lib/server/validate'
import { findUserByEmail, createUser, publicUser } from '~/lib/server/users'

export default createApiHandler({
  POST: {
    rateLimit: { name: 'register', max: 5, windowMs: 900000 },
    handler: async (req, res) => {
      const body = objectBody(req.body)
      const emailValue = email(body.email)
      const password = str(body.password, { field: 'password', min: 8, max: 200, trim: false })
      const name = str(body.name, { field: 'name', min: 2, max: 40 })

      const existing = await findUserByEmail(emailValue)
      if (existing) throw errors.conflict('email_taken', 'Email is already registered')

      let user
      try {
        user = await createUser({ email: emailValue, password, name })
      } catch (err) {
        // Concurrent registration for the same email (unique index).
        if (err?.code === 'DUPLICATE_EMAIL') {
          throw errors.conflict('email_taken', 'Email is already registered')
        }
        throw err
      }
      const token = signToken(user)
      res.setHeader('Set-Cookie', buildAuthCookie(token))
      res.status(201).json({ user: publicUser(user), token })
    },
  },
})
