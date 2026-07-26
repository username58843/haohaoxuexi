import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'
import { getCollection } from './db'

const BCRYPT_COST = 12

export const DEFAULT_SETTINGS = {
  themeColor: 'cinnabar',
  theme: 'dark',
  language: 'en',
  dailyGoal: 20,
  alwaysShowPinyin: false,
  alwaysShowTranslation: false,
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_COST)
}

export async function verifyPassword(plain, hash) {
  if (typeof plain !== 'string' || typeof hash !== 'string') return false
  return bcrypt.compare(plain, hash)
}

/** Shape exposed to the client. Never leaks hash/tokenVersion/other PII. */
export function publicUser(doc) {
  if (!doc) return null
  return {
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    role: doc.role || 'user',
    isPremium: !!doc.isPremium && (!doc.premiumExpiresAt || new Date(doc.premiumExpiresAt) > new Date()),
    premiumExpiresAt: doc.premiumExpiresAt || null,
    isBanned: !!doc.isBanned,
    settings: { ...DEFAULT_SETTINGS, ...(doc.settings || {}) },
    createdAt: doc.createdAt,
  }
}

/** Admin-facing shape — includes moderation fields, still no hash. */
export function adminUserView(doc) {
  if (!doc) return null
  return {
    ...publicUser(doc),
    banReason: doc.banReason || null,
    bannedAt: doc.bannedAt || null,
    lastSeen: doc.lastSeen || null,
    updatedAt: doc.updatedAt || null,
  }
}

export async function findUserByEmail(emailLower) {
  const users = await getCollection('users')
  return users.findOne({ email: emailLower })
}

export async function findUserById(id) {
  if (!id) return null
  let objectId
  try {
    objectId = typeof id === 'string' ? new ObjectId(id) : id
  } catch {
    return null
  }
  const users = await getCollection('users')
  const doc = await users.findOne({ _id: objectId })
  if (!doc) return null
  return migrateLegacyUser(doc)
}

export async function createUser({ email, password, name }) {
  const users = await getCollection('users')
  const now = new Date()
  const doc = {
    email,
    password: await hashPassword(password),
    name,
    role: 'user',
    isPremium: false,
    premiumExpiresAt: null,
    isBanned: false,
    banReason: null,
    bannedAt: null,
    tokenVersion: 0,
    settings: { ...DEFAULT_SETTINGS },
    lastSeen: now,
    createdAt: now,
    updatedAt: now,
  }
  try {
    const result = await users.insertOne(doc)
    return { ...doc, _id: result.insertedId }
  } catch (err) {
    // Unique email index caught a concurrent duplicate registration; surface a
    // recognizable code so the route can return 409 instead of a 500.
    if (err?.code === 11000) {
      const conflict = new Error('email_taken')
      conflict.code = 'DUPLICATE_EMAIL'
      throw conflict
    }
    throw err
  }
}

/**
 * One-time in-place migration of pre-rebuild user documents:
 * - isAdmin flag -> role
 * - embedded personalDictionaries -> decks collection
 * - drops searchHistory / selectedWords / avatar / ipAddress / studyStats
 * Idempotent: marked with schemaVersion 2.
 */
export async function migrateLegacyUser(doc) {
  if (!doc || doc.schemaVersion >= 2) return doc

  const users = await getCollection('users')
  const set = { schemaVersion: 2, updatedAt: new Date() }
  set.role = doc.role || (doc.isAdmin === true ? 'admin' : 'user')
  if (typeof doc.tokenVersion !== 'number') set.tokenVersion = 0
  if (!doc.settings) set.settings = { ...DEFAULT_SETTINGS }

  const unset = {
    personalDictionaries: '',
    selectedWords: '',
    searchHistory: '',
    avatar: '',
    ipAddress: '',
    isAdmin: '',
    studyStats: '',
  }

  // Atomic claim: only the request whose filter still matches an unmigrated doc
  // wins. `before` is the pre-image (null if another request already migrated),
  // so exactly one caller performs the deck copy — no duplicate decks.
  const before = await users.findOneAndUpdate(
    { _id: doc._id, schemaVersion: { $lt: 2 } },
    { $set: set, $unset: unset },
    { returnDocument: 'before' }
  )
  // Some legacy docs have no schemaVersion field at all; retry that shape.
  const claimed =
    before ||
    (await users.findOneAndUpdate(
      { _id: doc._id, schemaVersion: { $exists: false } },
      { $set: set, $unset: unset },
      { returnDocument: 'before' }
    ))

  if (claimed) {
    const legacyDicts = claimed.personalDictionaries
    if (Array.isArray(legacyDicts) && legacyDicts.length > 0) {
      const decks = await getCollection('decks')
      const now = new Date()
      await decks.insertMany(
        legacyDicts.map((d, i) => ({
          userId: doc._id,
          name: String(d.name || 'Deck').slice(0, 80),
          words: Array.isArray(d.words) ? d.words.slice(0, 2000) : [],
          order: Number.isInteger(d.order) ? d.order : i,
          createdAt: d.createdAt ? new Date(d.createdAt) : now,
          updatedAt: now,
        }))
      )
    }
  }

  const migrated = { ...doc, ...set }
  for (const key of Object.keys(unset)) delete migrated[key]
  return migrated
}

/** Full account erasure (Play Store requirement). */
export async function deleteUserCompletely(userId) {
  const [users, decks, srs, logs, feedback, audit] = await Promise.all([
    getCollection('users'),
    getCollection('decks'),
    getCollection('srs_cards'),
    getCollection('review_logs'),
    getCollection('feedback'),
    getCollection('audit_logs'),
  ])
  await Promise.all([
    decks.deleteMany({ userId }),
    srs.deleteMany({ userId }),
    logs.deleteMany({ userId }),
    feedback.updateMany({ userId }, { $set: { userId: null, email: null } }),
    // Keep the audit trail (targetUserId as opaque tombstone) but scrub any
    // identifying fields so erasure leaves no PII behind.
    audit.updateMany(
      { targetUserId: userId },
      { $unset: { 'detail.email': '', 'detail.name': '', 'detail.banReason': '' } }
    ),
  ])
  await users.deleteOne({ _id: userId })
}

export async function writeAuditLog(actorId, action, { targetUserId = null, detail = {} } = {}) {
  const audit = await getCollection('audit_logs')
  await audit.insertOne({
    actorId,
    action,
    targetUserId,
    detail,
    createdAt: new Date(),
  })
}
