import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'
import { getCollection } from './db'
import { ValidationError } from './validate'
import { findUserById } from './users'

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days

function jwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is required')
  return secret
}

export function signToken(user) {
  return jwt.sign(
    { uid: user._id.toString(), tv: user.tokenVersion || 0 },
    jwtSecret(),
    { algorithm: 'HS256', expiresIn: TOKEN_TTL_SECONDS }
  )
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null
  try {
    return jwt.verify(token.trim(), jwtSecret(), { algorithms: ['HS256'] })
  } catch {
    return null
  }
}

function parseCookies(req) {
  const header = req.headers?.cookie
  const out = {}
  if (!header || typeof header !== 'string') return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    if (!key) continue
    try {
      out[key] = decodeURIComponent(part.slice(idx + 1).trim())
    } catch {
      out[key] = part.slice(idx + 1).trim()
    }
  }
  return out
}

/** Token from Authorization: Bearer or the httpOnly cookie. NEVER from query. */
export function getTokenFromRequest(req) {
  const auth = req.headers?.authorization
  if (auth && typeof auth === 'string' && /^Bearer\s+/i.test(auth)) {
    return auth.replace(/^Bearer\s+/i, '').trim() || null
  }
  return parseCookies(req).token || null
}

export function buildAuthCookie(token, { clear = false } = {}) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  if (clear) return `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`
  return `token=${token}; HttpOnly; Path=/; Max-Age=${TOKEN_TTL_SECONDS}; SameSite=Lax${secure}`
}

export function getClientIp(req) {
  const fwd = req.headers?.['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim()
  return req.socket?.remoteAddress || 'unknown'
}

/**
 * Rate-limit key tied to the *verified* token identity, falling back to IP for
 * anonymous callers. Use as a keyFn on authenticated routes so the bucket can't
 * be reset by mangling the raw Authorization header, and so cookie-auth web
 * users don't share one IP bucket.
 */
export function userRateKey(req) {
  const payload = verifyToken(getTokenFromRequest(req))
  return payload?.uid ? `u:${payload.uid}` : `ip:${getClientIp(req)}`
}

export class ApiError extends Error {
  constructor(status, code, message, extra = null) {
    super(message)
    this.status = status
    this.code = code
    this.extra = extra
  }
}

export const errors = {
  unauthorized: () => new ApiError(401, 'unauthorized', 'Authentication required'),
  forbidden: (msg = 'Not allowed') => new ApiError(403, 'forbidden', msg),
  banned: (banReason) => new ApiError(403, 'banned', 'Account is banned', { banReason: banReason || null }),
  notFound: (msg = 'Not found') => new ApiError(404, 'not_found', msg),
  conflict: (code, msg) => new ApiError(409, code, msg),
  rateLimited: () => new ApiError(429, 'rate_limited', 'Too many requests, try again later'),
  badRequest: (msg = 'Bad request') => new ApiError(400, 'validation', msg),
}

/**
 * Fixed-window rate limiter backed by the rate_limits TTL collection —
 * works across serverless instances. Throws 429 when the bucket is full.
 */
export async function rateLimit(name, key, { max, windowMs }) {
  const col = await getCollection('rate_limits')
  const bucketKey = `${name}:${key}`
  const now = new Date()
  const fresh = () => new Date(now.getTime() + windowMs)

  const doc = await col.findOneAndUpdate(
    { key: bucketKey, expiresAt: { $gt: now } },
    {
      $inc: { count: 1 },
      $setOnInsert: { key: bucketKey, expiresAt: fresh() },
    },
    { upsert: true, returnDocument: 'after' }
  ).catch(async (err) => {
    // Unique-key collision: the bucket exists but is expired (TTL reaper hasn't
    // swept it yet). Start a NEW window instead of incrementing the stale
    // count — otherwise an over-limit user stays blocked past window expiry.
    if (err?.code === 11000) {
      return col.findOneAndUpdate(
        { key: bucketKey },
        [
          {
            $set: {
              count: { $cond: [{ $gt: ['$expiresAt', now] }, { $add: ['$count', 1] }, 1] },
              expiresAt: { $cond: [{ $gt: ['$expiresAt', now] }, '$expiresAt', fresh()] },
            },
          },
        ],
        { returnDocument: 'after' }
      )
    }
    throw err
  })
  if ((doc?.count || 0) > max) throw errors.rateLimited()
}

export function parseObjectId(value, field = 'id') {
  if (typeof value !== 'string' || !ObjectId.isValid(value)) {
    throw new ApiError(400, 'validation', `Invalid ${field}`)
  }
  return new ObjectId(value)
}

const LAST_SEEN_THROTTLE_MS = 60 * 1000
const lastSeenCache = new Map() // userId -> timestamp (best-effort, per instance)

async function touchLastSeen(userId) {
  const key = userId.toString()
  const now = Date.now()
  if ((lastSeenCache.get(key) || 0) > now - LAST_SEEN_THROTTLE_MS) return
  lastSeenCache.set(key, now)
  try {
    const users = await getCollection('users')
    await users.updateOne({ _id: userId }, { $set: { lastSeen: new Date() } })
  } catch {
    // non-critical
  }
}

function setBaseHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-Frame-Options', 'DENY')

  // Reflect CORS only for the configured web origin (credentialed requests).
  const appUrl = process.env.APP_URL
  const origin = req.headers?.origin
  if (appUrl && origin && origin === appUrl) {
    res.setHeader('Access-Control-Allow-Origin', appUrl)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }
}

function sendError(res, err) {
  const status = err instanceof ApiError ? err.status : err instanceof ValidationError ? 400 : 500
  const code =
    err instanceof ApiError ? err.code : err instanceof ValidationError ? 'validation' : 'server_error'
  const message =
    err instanceof ApiError || err instanceof ValidationError
      ? err.message
      : 'Something went wrong'
  if (status >= 500) console.error('API error:', err)
  const body = { error: { code, message } }
  if (err instanceof ApiError && err.extra) Object.assign(body.error, err.extra)
  res.status(status).json(body)
}

/**
 * createApiHandler({
 *   GET:  { auth: true, handler: async (req, res) => {...} },
 *   POST: { admin: true, rateLimit: { name, max, windowMs, keyFn? }, handler },
 * })
 *
 * - auth: attaches req.user (DB doc) + req.userId (ObjectId); rejects banned
 *   users and tokens with a stale tokenVersion.
 * - admin: implies auth, requires role === 'admin'.
 * - rateLimit.keyFn(req): bucket key, defaults to client IP.
 */
export function createApiHandler(methods) {
  return async function handler(req, res) {
    setBaseHeaders(req, res)
    // Answer CORS preflight without hitting the method map.
    if (req.method === 'OPTIONS') {
      res.setHeader('Allow', `${Object.keys(methods).join(', ')}, OPTIONS`)
      return res.status(204).end()
    }
    const spec = methods[req.method]
    if (!spec) {
      res.setHeader('Allow', Object.keys(methods).join(', '))
      return sendError(res, new ApiError(405, 'method_not_allowed', 'Method not allowed'))
    }
    try {
      if (spec.rateLimit) {
        const { name, max, windowMs, keyFn } = spec.rateLimit
        await rateLimit(name, keyFn ? keyFn(req) : getClientIp(req), { max, windowMs })
      }

      if (spec.auth || spec.admin) {
        const payload = verifyToken(getTokenFromRequest(req))
        if (!payload?.uid) throw errors.unauthorized()
        const user = await findUserById(payload.uid)
        if (!user) throw errors.unauthorized()
        if ((user.tokenVersion || 0) !== (payload.tv || 0)) throw errors.unauthorized()
        if (user.isBanned) throw errors.banned(user.banReason)
        if (spec.admin && user.role !== 'admin') throw errors.forbidden()
        req.user = user
        req.userId = user._id
        touchLastSeen(user._id)
      }

      await spec.handler(req, res)
    } catch (err) {
      sendError(res, err)
    }
  }
}
