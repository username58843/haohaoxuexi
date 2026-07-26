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

let ensureIndexesPromise = null

async function ensureIndexes(db) {
  if (indexesEnsured) return
  // Single in-flight run; concurrent cold-start requests await the same promise
  // instead of racing ahead before indexes exist.
  if (!ensureIndexesPromise) ensureIndexesPromise = buildIndexes(db)
  await ensureIndexesPromise
}

async function buildIndexes(db) {
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
    ['content', [{ key: { type: 1, key: 1, lang: 1 }, unique: true }]],
    [
      'rate_limits',
      [
        { key: { key: 1 }, unique: true },
        { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
      ],
    ],
  ]
  let allOk = true
  for (const [name, indexes] of spec) {
    try {
      await db.collection(name).createIndexes(indexes)
    } catch (err) {
      // A build can legitimately fail on legacy data (e.g. duplicate emails
      // before cleanup). Don't take the API down, but do NOT latch success —
      // leave it retryable so a later request re-attempts after cleanup.
      // App-level guards (register E11000 → 409) cover the window meanwhile.
      allOk = false
      console.error(`ensureIndexes(${name}):`, err.message)
    }
  }
  if (allOk) indexesEnsured = true
  else ensureIndexesPromise = null // allow a fresh retry on the next getDb()
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
