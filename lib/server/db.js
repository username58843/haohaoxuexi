import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xuehanyu-local'

let clientPromise
if (process.env.NODE_ENV === 'development') {
  // Preserve the client across HMR reloads; drop a failed promise so the next
  // request retries instead of caching the failure forever.
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri).connect().catch((err) => {
      global._mongoClientPromise = null
      throw err
    })
  }
  clientPromise = global._mongoClientPromise
} else {
  clientPromise = new MongoClient(uri).connect()
}

let indexesEnsured = false

async function ensureIndexes(db) {
  if (indexesEnsured) return
  indexesEnsured = true
  const spec = [
    ['users', [{ key: { email: 1 }, unique: true }]],
    ['decks', [{ key: { userId: 1, order: 1 } }]],
    [
      'srs_cards',
      [
        { key: { userId: 1, wordId: 1 }, unique: true },
        { key: { userId: 1, due: 1 } },
      ],
    ],
    ['review_logs', [{ key: { userId: 1, day: 1 }, unique: true }]],
    ['feedback', [{ key: { createdAt: -1 } }]],
    ['audit_logs', [{ key: { createdAt: -1 } }]],
    [
      'rate_limits',
      [
        { key: { key: 1 }, unique: true },
        { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
      ],
    ],
  ]
  for (const [name, indexes] of spec) {
    try {
      await db.collection(name).createIndexes(indexes)
    } catch (err) {
      // Index conflicts (e.g. legacy duplicate emails) must not take the API
      // down; surface them in logs for manual cleanup.
      console.error(`ensureIndexes(${name}):`, err.message)
    }
  }
}

export async function getDb() {
  const client = await clientPromise
  const db = client.db()
  await ensureIndexes(db)
  return db
}

export async function getCollection(name) {
  const db = await getDb()
  return db.collection(name)
}

export default clientPromise
