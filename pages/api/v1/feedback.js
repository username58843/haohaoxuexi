import { createApiHandler, verifyToken, getTokenFromRequest } from '~/lib/server/api'
import { objectBody, oneOf, str, email as validEmail } from '~/lib/server/validate'
import { findUserById } from '~/lib/server/users'
import { getCollection } from '~/lib/server/db'

const TOPICS = ['bug', 'idea', 'content', 'other']

export default createApiHandler({
  POST: {
    rateLimit: { name: 'feedback', max: 5, windowMs: 60 * 60 * 1000 },
    handler: async (req, res) => {
      const body = objectBody(req.body)
      const topic = oneOf(body.topic, TOPICS, { field: 'topic' })
      const message = str(body.message, { field: 'message', min: 3, max: 2000 })
      const email =
        body.email === undefined || body.email === null || body.email === ''
          ? null
          : validEmail(body.email)

      // Optional auth: attach the user when a valid token is present, but never
      // reject anonymous submissions.
      let user = null
      const payload = verifyToken(getTokenFromRequest(req))
      if (payload?.uid) {
        const found = await findUserById(payload.uid)
        if (found && (found.tokenVersion || 0) === (payload.tv || 0)) user = found
      }

      const feedback = await getCollection('feedback')
      await feedback.insertOne({
        userId: user ? user._id : null,
        email: email || user?.email || null,
        topic,
        message,
        status: 'new',
        createdAt: new Date(),
        userAgent: (req.headers['user-agent'] || '').slice(0, 300),
      })

      res.status(201).json({ ok: true })
    },
  },
})
