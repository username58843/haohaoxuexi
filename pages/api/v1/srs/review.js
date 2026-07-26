import { createApiHandler, errors, getClientIp } from '~/lib/server/api'
import { objectBody, str, int, tzOffset } from '~/lib/server/validate'
import { applyReview } from '~/lib/server/srs'
import { isValidWordSnapshot } from '~/lib/words-shared'

export default createApiHandler({
  POST: {
    auth: true,
    rateLimit: {
      name: 'review',
      max: 1200,
      windowMs: 60 * 60 * 1000,
      // Bucket per token tail (Bearer clients); cookie-auth web falls back to IP.
      keyFn: (req) => String(req.headers.authorization || '').slice(-24) || getClientIp(req),
    },
    handler: async (req, res) => {
      const body = objectBody(req.body)
      const wordId = str(body.wordId, { field: 'wordId', min: 1, max: 120 })
      const grade = int(body.grade, { field: 'grade', min: 0, max: 3 })

      let word = null
      if (body.word !== undefined && body.word !== null) {
        if (!isValidWordSnapshot(body.word)) throw errors.badRequest('Invalid word snapshot')
        word = body.word
      }

      const result = await applyReview({
        userId: req.userId,
        wordId,
        grade,
        word,
        tzOffset: tzOffset(body.tzOffset),
      })
      if (result.error === 'word_snapshot_required') {
        throw errors.badRequest('word snapshot required for first review')
      }

      res.status(200).json({ card: result.card })
    },
  },
})
