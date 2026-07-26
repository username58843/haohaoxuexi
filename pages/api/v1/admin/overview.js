import { createApiHandler } from '~/lib/server/api'
import { getCollection } from '~/lib/server/db'

const DAY_MS = 24 * 60 * 60 * 1000

/** Last N UTC days as 'YYYY-MM-DD', oldest first, ending today. */
function lastDays(n, now = new Date()) {
  const days = []
  for (let i = n - 1; i >= 0; i--) {
    days.push(new Date(now.getTime() - i * DAY_MS).toISOString().slice(0, 10))
  }
  return days
}

/** Fill a [{day, count}] series for every day, defaulting missing days to 0. */
function fillSeries(days, rows) {
  const byDay = new Map(rows.map((r) => [r._id, r.count]))
  return days.map((day) => ({ day, count: byDay.get(day) || 0 }))
}

export default createApiHandler({
  GET: {
    admin: true,
    handler: async (req, res) => {
      const now = new Date()
      const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS)
      const dayAgo = new Date(now.getTime() - DAY_MS)
      const sevenDaysAgoDay = sevenDaysAgo.toISOString().slice(0, 10)
      const days = lastDays(14, now)
      const rangeStart = new Date(`${days[0]}T00:00:00Z`)

      const [users, decks, reviewLogs] = await Promise.all([
        getCollection('users'),
        getCollection('decks'),
        getCollection('review_logs'),
      ])

      const [
        totalUsers,
        newUsers7d,
        activeToday,
        totalDecks,
        reviews7dAgg,
        signupRows,
        reviewRows,
      ] = await Promise.all([
        users.countDocuments({}),
        users.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
        users.countDocuments({ lastSeen: { $gte: dayAgo } }),
        decks.countDocuments({}),
        reviewLogs
          .aggregate([
            { $match: { day: { $gte: sevenDaysAgoDay } } },
            { $group: { _id: null, count: { $sum: '$reviews' } } },
          ])
          .toArray(),
        users
          .aggregate([
            { $match: { createdAt: { $gte: rangeStart } } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                count: { $sum: 1 },
              },
            },
          ])
          .toArray(),
        reviewLogs
          .aggregate([
            { $match: { day: { $gte: days[0] } } },
            { $group: { _id: '$day', count: { $sum: '$reviews' } } },
          ])
          .toArray(),
      ])

      res.status(200).json({
        totals: {
          users: totalUsers,
          newUsers7d,
          activeToday,
          decks: totalDecks,
          reviews7d: reviews7dAgg[0]?.count || 0,
        },
        signupsByDay: fillSeries(days, signupRows),
        reviewsByDay: fillSeries(days, reviewRows),
      })
    },
  },
})
