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
  const result = await users.insertOne(doc)
  return { ...doc, _id: result.insertedId }
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
  const unset = {}

  if (!doc.role) set.role = doc.isAdmin === true ? 'admin' : 'user'
  if (typeof doc.tokenVersion !== 'number') set.tokenVersion = 0
  if (!doc.settings) set.settings = { ...DEFAULT_SETTINGS }

  if (Array.isArray(doc.personalDictionaries) && doc.personalDictionaries.length > 0) {
    const decks = await getCollection('decks')
    const existing = await decks.countDocuments({ userId: doc._id })
    if (existing === 0) {
      const now = new Date()
      await decks.insertMany(
        doc.personalDictionaries.map((d, i) => ({
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

  for (const legacy of [
    'personalDictionaries',
    'selectedWords',
    'searchHistory',
    'avatar',
    'ipAddress',
    'isAdmin',
    'studyStats',
  ]) {
    if (legacy in doc) unset[legacy] = ''
  }

  const update = { $set: set }
  if (Object.keys(unset).length > 0) update.$unset = unset
  await users.updateOne({ _id: doc._id }, update)

  const migrated = { ...doc, ...set }
  for (const key of Object.keys(unset)) delete migrated[key]
  return migrated
}

/** Full account erasure (Play Store requirement). */
export async function deleteUserCompletely(userId) {
  const [users, decks, srs, logs, feedback] = await Promise.all([
    getCollection('users'),
    getCollection('decks'),
    getCollection('srs_cards'),
    getCollection('review_logs'),
    getCollection('feedback'),
  ])
  await Promise.all([
    decks.deleteMany({ userId }),
    srs.deleteMany({ userId }),
    logs.deleteMany({ userId }),
    feedback.updateMany({ userId }, { $set: { userId: null, email: null } }),
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
