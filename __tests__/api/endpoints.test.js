/**
 * Tests for dictionary and user API input validation.
 */
const { createRequest, createResponse } = require('node-mocks-http')

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
    findById: jest.fn(),
    update: jest.fn(),
    verifyPassword: jest.fn(),
    createPersonalDictionary: jest.fn(),
    updatePersonalDictionary: jest.fn(),
    deletePersonalDictionary: jest.fn(),
  }
}))

jest.mock('~/lib/cors', () => ({
  runCors: jest.fn(() => false),
}))

describe('Dictionaries API', () => {
  let handler

  beforeEach(() => {
    jest.resetModules()
    handler = require('../../pages/api/dictionaries/index').default
  })

  test('rejects unsupported methods', async () => {
    const req = createRequest({ method: 'DELETE' })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
  })

  test('GET returns 401 when not authenticated', async () => {
    const { getUserIdFromRequest } = require('~/lib/auth')
    getUserIdFromRequest.mockReturnValue(null)

    const req = createRequest({ method: 'GET' })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
  })

  test('POST returns 401 when not authenticated', async () => {
    const { getUserIdFromRequest } = require('~/lib/auth')
    getUserIdFromRequest.mockReturnValue(null)

    const req = createRequest({
      method: 'POST',
      body: { name: 'Test Dict' }
    })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
  })

  test('GET returns dictionaries for authenticated user', async () => {
    const { getUserIdFromRequest } = require('~/lib/auth')
    const { User } = require('~/lib/models/User')
    getUserIdFromRequest.mockReturnValue('user123')
    User.findById.mockResolvedValue({
      personalDictionaries: [{ id: 'd1', name: 'Test' }],
      selectedWords: []
    })

    const req = createRequest({ method: 'GET' })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const data = res._getJSONData()
    expect(data.dictionaries).toHaveLength(1)
    expect(data.dictionaries[0].name).toBe('Test')
  })

  test('POST returns 400 when name is missing', async () => {
    const { getUserIdFromRequest } = require('~/lib/auth')
    getUserIdFromRequest.mockReturnValue('user123')

    const req = createRequest({
      method: 'POST',
      body: { name: '' }
    })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    const data = res._getJSONData()
    expect(data.error).toBe('Dictionary name is required')
  })
})

describe('Dictionary [id] API', () => {
  let handler

  beforeEach(() => {
    jest.resetModules()
    handler = require('../../pages/api/dictionaries/[id]').default
  })

  test('returns 401 when not authenticated', async () => {
    const { getUserIdFromRequest } = require('~/lib/auth')
    getUserIdFromRequest.mockReturnValue(null)

    const req = createRequest({ method: 'PUT', query: { id: 'dict1' } })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
  })

  test('rejects unsupported methods', async () => {
    const { getUserIdFromRequest } = require('~/lib/auth')
    getUserIdFromRequest.mockReturnValue('user123')

    const req = createRequest({ method: 'GET', query: { id: 'dict1' } })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
  })

  test('PUT validates dictionary ID', async () => {
    const { getUserIdFromRequest } = require('~/lib/auth')
    getUserIdFromRequest.mockReturnValue('user123')

    const req = createRequest({
      method: 'PUT',
      query: { id: 'x'.repeat(200) },
      body: { name: 'Updated' }
    })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    const data = res._getJSONData()
    expect(data.error).toBe('Invalid dictionary ID')
  })
})

describe('User Profile API', () => {
  let handler

  beforeEach(() => {
    jest.resetModules()
    handler = require('../../pages/api/user/profile').default
  })

  test('rejects non-PUT requests', async () => {
    const req = createRequest({ method: 'GET' })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
  })

  test('returns 401 when not authenticated', async () => {
    const { getUserIdFromRequest } = require('~/lib/auth')
    getUserIdFromRequest.mockReturnValue(null)

    const req = createRequest({
      method: 'PUT',
      body: { name: 'New Name' }
    })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
  })
})

describe('User Password API', () => {
  let handler

  beforeEach(() => {
    jest.resetModules()
    handler = require('../../pages/api/user/password').default
  })

  test('rejects non-PUT requests', async () => {
    const req = createRequest({ method: 'GET' })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
  })

  test('returns 400 when passwords are missing', async () => {
    const { getUserIdFromRequest } = require('~/lib/auth')
    getUserIdFromRequest.mockReturnValue('user123')

    const req = createRequest({
      method: 'PUT',
      body: { currentPassword: 'test' }
    })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    const data = res._getJSONData()
    expect(data.error).toBe('Current and new passwords are required')
  })
})

describe('Search API', () => {
  test('rejects non-GET requests', async () => {
    jest.resetModules()

    // Need additional mocking for search endpoint
    jest.mock('~/words', () => ({}))

    const handler = require('../../pages/api/search/index').default

    const req = createRequest({ method: 'POST' })
    const res = createResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
  })
})
