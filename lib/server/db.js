import { MongoClient } from 'mongodb'

/**
 * Lazy MongoDB connection: nothing connects until the first query, so pure
 * helpers from sibling modules stay importable in tests and build steps.
 * In dev the promise is cached on `global` to survive HMR reloads.
 */

function connect() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xuehanyu-local'
  return new MongoClient(uri).connect()
}

function getClientPromise() {
  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = connect().catch((err) => {
        global._mongoClientPromise = null
        throw err
      })
    }
    return global._mongoClientPromise
  }
  if (!getClientPromise._promise) {
    getClientPromise._promise = connect()
  }
  return getClientPromise._promise
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
  const client = await getClientPromise()
  const db = client.db()
  await ensureIndexes(db)
  return db
}

export async function getCollection(name) {
  const db = await getDb()
  return db.collection(name)
}
