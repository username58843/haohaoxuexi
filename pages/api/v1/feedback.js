import {
  createApiHandler,
  verifyToken,
  getTokenFromRequest,
  userRateKey,
  rateLimit,
} from '~/lib/server/api'
import { objectBody, oneOf, str, email as validEmail } from '~/lib/server/validate'
import { findUserById } from '~/lib/server/users'
import { getCollection } from '~/lib/server/db'

const TOPICS = ['bug', 'idea', 'content', 'other']

export default createApiHandler({
  POST: {
    // Abuse guard (two Mongo-TTL buckets, cross-instance):
    //  - 5 per hour per verified user (or per IP when anonymous) — the key is
    //    derived from the VERIFIED token, so it can't be reset by mangling
    //    the Authorization header;
    //  - plus a 20-per-day cap on the same key (slow-drip flood protection).
    // Message length is validated to ≤ 2000 chars before the insert.
    rateLimit: { name: 'feedback', max: 5, windowMs: 60 * 60 * 1000, keyFn: userRateKey },
    handler: async (req, res) => {
      await rateLimit('feedback_day', userRateKey(req), {
        max: 20,
        windowMs: 24 * 60 * 60 * 1000,
      })
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
