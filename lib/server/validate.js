/**
 * Minimal input validation. Every helper throws ValidationError on bad input
 * and returns the sanitized value otherwise. Rejecting non-string objects here
 * is the NoSQL-operator-injection guard for the whole API.
 */

export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
  }
}

export function str(value, { field = 'value', min = 0, max = 10000, trim = true } = {}) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be a string`, field)
  }
  const v = trim ? value.trim() : value
  if (v.length < min) throw new ValidationError(`${field} must be at least ${min} characters`, field)
  if (v.length > max) throw new ValidationError(`${field} must be at most ${max} characters`, field)
  return v
}

export function optStr(value, opts = {}) {
  if (value === undefined || value === null) return undefined
  return str(value, opts)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function email(value, { field = 'email' } = {}) {
  const v = str(value, { field, min: 5, max: 254 }).toLowerCase()
  if (!EMAIL_RE.test(v)) throw new ValidationError('Invalid email address', field)
  return v
}

export function int(value, { field = 'value', min = -Infinity, max = Infinity, def } = {}) {
  if ((value === undefined || value === null || value === '') && def !== undefined) return def
  const n = Number(value)
  if (!Number.isInteger(n)) throw new ValidationError(`${field} must be an integer`, field)
  if (n < min || n > max) throw new ValidationError(`${field} out of range`, field)
  return n
}

export function bool(value, { field = 'value', def } = {}) {
  if (value === undefined && def !== undefined) return def
  if (typeof value !== 'boolean') throw new ValidationError(`${field} must be a boolean`, field)
  return value
}

export function oneOf(value, allowed, { field = 'value', def } = {}) {
  if (value === undefined && def !== undefined) return def
  if (!allowed.includes(value)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}`, field)
  }
  return value
}

export function arr(value, { field = 'value', max = 10000 } = {}) {
  if (!Array.isArray(value)) throw new ValidationError(`${field} must be an array`, field)
  if (value.length > max) throw new ValidationError(`${field} too long (max ${max})`, field)
  return value
}

export function optArr(value, opts = {}) {
  if (value === undefined || value === null) return undefined
  return arr(value, opts)
}

/** Body must be a plain object (protects against arrays/null/primitives). */
export function objectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }
  return body
}

/** tzOffset in minutes east of UTC, clamped to real-world range. */
export function tzOffset(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(-720, Math.min(840, Math.trunc(n)))
}
