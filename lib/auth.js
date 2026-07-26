import jwt from 'jsonwebtoken'
import { parseCookies } from './cookies'

// In-memory rate limiter for login
const loginAttempts = new Map()

export function checkRateLimit(ip, maxAttempts = 5, windowMs = 15 * 60 * 1000) {
  const now = Date.now()
  const attempts = loginAttempts.get(ip) || []
  const recentAttempts = attempts.filter((time) => now - time < windowMs)

  if (recentAttempts.length >= maxAttempts) {
    return false
  }

  recentAttempts.push(now)
  loginAttempts.set(ip, recentAttempts)
  return true
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required!')
  }
  return secret
}

/** Always store userId as a plain string in the JWT */
export function generateToken(userId) {
  const id = userId?.toString?.() || String(userId)
  return jwt.sign({ userId: id }, getJwtSecret(), { expiresIn: '30d' })
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null
  try {
    return jwt.verify(token.trim(), getJwtSecret())
  } catch (error) {
    return null
  }
}

export function getTokenFromRequest(req) {
  let token = null

  const auth = req.headers?.authorization || req.headers?.Authorization
  if (auth && typeof auth === 'string') {
    token = auth.replace(/^Bearer\s+/i, '').trim()
  }

  if (!token) {
    const cookies = parseCookies(req)
    token = cookies.token || cookies.authToken || null
  }

  if (!token && req.query?.token) {
    token = String(req.query.token)
  }

  return token || null
}

export function getUserIdFromRequest(req) {
  const token = getTokenFromRequest(req)
  if (!token) return null

  const decoded = verifyToken(token)
  if (!decoded) return null

  // Support both string and rare object forms
  const raw = decoded.userId ?? decoded.id ?? decoded.sub
  if (!raw) return null
  if (typeof raw === 'string') return raw
  if (raw?.toString) return raw.toString()
  return String(raw)
}

/** Build Set-Cookie for auth token (dev + prod) */
export function buildAuthCookie(token, { clear = false } = {}) {
  const isProduction = process.env.NODE_ENV === 'production'
  if (clear) {
    return [
      'token=',
      'HttpOnly',
      'Path=/',
      'Max-Age=0',
      'SameSite=Lax',
      isProduction ? 'Secure' : '',
    ]
      .filter(Boolean)
      .join('; ')
  }

  // Don't encodeURIComponent the whole JWT — breaks some parsers; token is base64url-safe
  return [
    `token=${token}`,
    'HttpOnly',
    'Path=/',
    'Max-Age=2592000', // 30 days
    'SameSite=Lax',
    isProduction ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}
