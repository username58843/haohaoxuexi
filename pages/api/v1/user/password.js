import { createApiHandler, signToken, buildAuthCookie, ApiError } from '~/lib/server/api'
import { objectBody, str } from '~/lib/server/validate'
import { getCollection } from '~/lib/server/db'
import { verifyPassword, hashPassword } from '~/lib/server/users'

export default createApiHandler({
  PUT: {
    auth: true,
    rateLimit: { name: 'pwd', max: 5, windowMs: 15 * 60 * 1000 },
    handler: async (req, res) => {
      const body = objectBody(req.body)
      const currentPassword = str(body.currentPassword, {
        field: 'currentPassword',
        min: 1,
        max: 200,
        trim: false,
      })
      const newPassword = str(body.newPassword, {
        field: 'newPassword',
        min: 8,
        max: 200,
        trim: false,
      })

      const ok = await verifyPassword(currentPassword, req.user.password)
      if (!ok) throw new ApiError(400, 'invalid_credentials', 'Current password is incorrect')

      const hashed = await hashPassword(newPassword)
      const users = await getCollection('users')
      await users.updateOne(
        { _id: req.userId },
        { $set: { password: hashed, updatedAt: new Date() }, $inc: { tokenVersion: 1 } }
      )

      // Sign a fresh token against the bumped tokenVersion so this session stays
      // valid while every other session is revoked.
      const token = signToken({ ...req.user, tokenVersion: (req.user.tokenVersion || 0) + 1 })
      res.setHeader('Set-Cookie', buildAuthCookie(token))
      res.status(200).json({ ok: true, token })
    },
  },
})
