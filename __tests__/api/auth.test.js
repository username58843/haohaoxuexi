/**
 * Tests for API input validation logic.
 * These verify that API handlers correctly validate inputs
 * without requiring database connections.
 */
const { createRequest, createResponse } = require('node-mocks-http')

// Mock the modules that require external services
jest.mock('~/lib/db', () => ({
  __esModule: true,
  default: Promise.resolve({
    db: () => ({
      collection: () => ({
        findOne: jest.fn(),
        insertOne: jest.fn(),
        updateOne: jest.fn(),
      })
    })
  })
}))

jest.mock('~/lib/auth', () => ({
  getUserIdFromRequest: jest.fn(() => null),
  generateToken: jest.fn(() => 'mock-token'),
  verifyToken: jest.fn(() => null),
}))

jest.mock('~/lib/models/User', () => ({
  User: {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    verifyPassword: jest.fn(),
  }
}))

jest.mock('~/lib/cors', () => ({
  runCors: jest.fn(() => false),
}))

describe('Auth API - Login', () => {
  let handler

  beforeEach(() => {
    jest.resetModules()
    handler = require('../../pages/api/auth/login').default
  })

  test('rejects non-POST requests with 405', async () => {
    const req = createRequest({ method: 'GET' })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
    const data = res._getJSONData()
    expect(data.error).toBe('Method not allowed')
  })

  test('returns 400 when email is missing', async () => {
    const req = createRequest({
      method: 'POST',
      body: { password: 'test123' }
    })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    const data = res._getJSONData()
    expect(data.error).toBe('Email and password are required')
  })

  test('returns 400 when password is missing', async () => {
    const req = createRequest({
      method: 'POST',
      body: { email: 'test@example.com' }
    })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    const data = res._getJSONData()
    expect(data.error).toBe('Email and password are required')
  })

  test('returns 401 when user not found', async () => {
    const { User } = require('~/lib/models/User')
    User.findByEmail.mockResolvedValue(null)

    const req = createRequest({
      method: 'POST',
      body: { email: 'nonexistent@example.com', password: 'test123' }
    })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    const data = res._getJSONData()
    expect(data.error).toBe('Invalid credentials')
  })

  test('returns 401 when password is wrong', async () => {
    const { User } = require('~/lib/models/User')
    User.findByEmail.mockResolvedValue({ _id: 'user1', email: 'test@example.com', password: 'hashed' })
    User.verifyPassword.mockResolvedValue(false)

    const req = createRequest({
      method: 'POST',
      body: { email: 'test@example.com', password: 'wrongpassword' }
    })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    const data = res._getJSONData()
    expect(data.error).toBe('Invalid credentials')
  })

  test('returns 403 when user is banned', async () => {
    const { User } = require('~/lib/models/User')
    User.findByEmail.mockResolvedValue({
      _id: 'user1',
      email: 'test@example.com',
      password: 'hashed',
      isBanned: true,
      banReason: 'Violation'
    })
    User.verifyPassword.mockResolvedValue(true)

    const req = createRequest({
      method: 'POST',
      body: { email: 'test@example.com', password: 'test123' }
    })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(403)
    const data = res._getJSONData()
    expect(data.banned).toBe(true)
  })

  test('returns 200 with token on successful login', async () => {
    const { User } = require('~/lib/models/User')
    User.findByEmail.mockResolvedValue({
      _id: 'user1',
      email: 'test@example.com',
      password: 'hashed',
      name: 'Test User',
      isBanned: false,
      isPremium: false,
      isAdmin: false
    })
    User.verifyPassword.mockResolvedValue(true)
    User.update.mockResolvedValue({})

    const req = createRequest({
      method: 'POST',
      body: { email: 'test@example.com', password: 'test123' },
      headers: { 'x-forwarded-for': '127.0.0.1' }
    })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const data = res._getJSONData()
    expect(data.success).toBe(true)
    expect(data.user.email).toBe('test@example.com')
    expect(data.token).toBe('mock-token')
  })
})

describe('Auth API - Register', () => {
  let handler

  beforeEach(() => {
    jest.resetModules()
    handler = require('../../pages/api/auth/register').default
  })

  test('rejects non-POST requests with 405', async () => {
    const req = createRequest({ method: 'GET' })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
  })

  test('returns 400 when fields are missing', async () => {
    const req = createRequest({
      method: 'POST',
      body: { email: 'test@example.com' }
    })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    const data = res._getJSONData()
    expect(data.error).toBe('Email, password and name are required')
  })

  test('returns 400 when password is too short', async () => {
    const req = createRequest({
      method: 'POST',
      body: { email: 'test@example.com', password: '123', name: 'Test' }
    })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    const data = res._getJSONData()
    expect(data.error).toBe('Password must be at least 6 characters')
  })
})

describe('Auth API - Me', () => {
  let handler

  beforeEach(() => {
    jest.resetModules()
    handler = require('../../pages/api/auth/me').default
  })

  test('rejects non-GET requests with 405', async () => {
    const req = createRequest({ method: 'POST' })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
  })

  test('returns 401 when not authenticated', async () => {
    const { getUserIdFromRequest } = require('~/lib/auth')
    getUserIdFromRequest.mockReturnValue(null)

    const req = createRequest({ method: 'GET' })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    const data = res._getJSONData()
    expect(data.error).toBe('Not authenticated')
  })
})

describe('Auth API - Logout', () => {
  let handler

  beforeEach(() => {
    jest.resetModules()
    handler = require('../../pages/api/auth/logout').default
  })

  test('rejects non-POST requests with 405', async () => {
    const req = createRequest({ method: 'GET' })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
  })

  test('clears cookie on logout', async () => {
    const req = createRequest({ method: 'POST' })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const data = res._getJSONData()
    expect(data.success).toBe(true)
    // Cookie should be set with Max-Age=0 to clear it
    const cookie = res.getHeader('Set-Cookie')
    expect(cookie).toContain('token=')
    expect(cookie).toContain('Max-Age=0')
  })
})
