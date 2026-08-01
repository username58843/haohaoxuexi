import { createApiHandler, ApiError, signToken, buildAuthCookie, rateLimit } from '~/lib/server/api'
import { getCollection } from '~/lib/server/db'
import { publicUser } from '~/lib/server/users'
import { objectBody, email as emailField, str } from '~/lib/server/validate'

const CODE_RE = /^\d{6}$/

export default createApiHandler({
  POST: {
    handler: async (req, res) => {
      const body = objectBody(req.body)
      const email = emailField(body.email)
      // Strict string validation — the raw value must never reach the Mongo
      // query (NoSQL-operator-injection guard), and the shape is known.
      const code = str(body.code, { field: 'code', min: 6, max: 6 })
      if (!CODE_RE.test(code)) {
        throw new ApiError(400, 'invalid_code', 'Invalid or expired verification code')
      }

      // The code space is only 10^6 — throttle guesses per email.
      await rateLimit('verify-email', email, { max: 10, windowMs: 3600000 })

      const users = await getCollection('users')
      const user = await users.findOne({
        email,
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
