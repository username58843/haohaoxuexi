import {
  createApiHandler,
  errors,
  ApiError,
  signToken,
  buildAuthCookie,
  rateLimit,
  getClientIp,
} from '~/lib/server/api'
import { objectBody, str, email } from '~/lib/server/validate'
import { findUserByEmail, findUserById, verifyPassword, publicUser } from '~/lib/server/users'
import { verifyTurnstile } from '~/lib/server/captcha'

const invalidCredentials = () =>
  new ApiError(401, 'invalid_credentials', 'Invalid email or password')

export default createApiHandler({
  POST: {
    rateLimit: { name: 'login', max: 8, windowMs: 900000 },
    handler: async (req, res) => {
      const body = objectBody(req.body)
      const emailValue = email(body.email)
      const password = str(body.password, { field: 'password', min: 1, max: 200, trim: false })

      await verifyTurnstile(body.captchaToken, getClientIp(req))

      await rateLimit('login-email', emailValue, { max: 8, windowMs: 900000 })

      const found = await findUserByEmail(emailValue)
      if (!found) throw invalidCredentials()
      const ok = await verifyPassword(password, found.password)
      if (!ok) throw invalidCredentials()

      if (found.isBanned) throw errors.banned(found.banReason)

      if (!found.emailVerified) {
        throw new ApiError(403, 'email_not_verified', 'Please verify your email first')
      }

      const user = (await findUserById(found._id)) || found

      const token = signToken(user)
      res.setHeader('Set-Cookie', buildAuthCookie(token))
      res.status(200).json({ user: publicUser(user), token })
    },
  },
})
