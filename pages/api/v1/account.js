import { createApiHandler, ApiError, buildAuthCookie } from '~/lib/server/api'
import { objectBody, str } from '~/lib/server/validate'
import { verifyPassword, deleteUserCompletely } from '~/lib/server/users'

export default createApiHandler({
  DELETE: {
    auth: true,
    rateLimit: { name: 'accdel', max: 3, windowMs: 3600000 },
    handler: async (req, res) => {
      const body = objectBody(req.body)
      const password = str(body.password, { field: 'password', min: 1, max: 200, trim: false })

      const ok = await verifyPassword(password, req.user.password)
      if (!ok) throw new ApiError(403, 'forbidden', 'Password is incorrect')

      await deleteUserCompletely(req.userId)
      res.setHeader('Set-Cookie', buildAuthCookie(null, { clear: true }))
      res.status(200).json({ ok: true })
    },
  },
})
