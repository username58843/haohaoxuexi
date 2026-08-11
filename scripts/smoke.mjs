/**
 * End-to-end API smoke test.
 * Boots an in-memory MongoDB + `next start`, then exercises the whole /api/v1
 * surface as a real client would. Requires a production build (npm run build).
 *
 * Usage: node scripts/smoke.mjs
 */
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient } from 'mongodb'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 3123
const BASE = `http://127.0.0.1:${PORT}/api/v1`

let passed = 0
let failed = 0
const failures = []

function check(name, cond, extra = '') {
  if (cond) {
    passed++
  } else {
    failed++
    failures.push(`${name} ${extra}`)
    console.error(`  FAIL ${name} ${extra}`)
  }
}

async function req(method, path, { body, token, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json, headers: res.headers }
}

async function main() {
  console.log('Starting in-memory MongoDB...')
  const mongod = await MongoMemoryServer.create()
  const uri = `${mongod.getUri()}smoke`

  console.log('Starting next start...')
  const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MONGODB_URI: uri,
      JWT_SECRET: 'smoke-test-secret-0123456789abcdef0123456789abcdef',
      NODE_ENV: 'production',
      APP_URL: `http://127.0.0.1:${PORT}`,
    },
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stdout.on('data', () => {})
  server.stderr.on('data', (d) => {
    const s = String(d)
    if (s.includes('Error') || s.includes('error')) console.error('[server]', s.slice(0, 400))
  })

  // Wait for readiness
  let ready = false
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/api/v1/health`)
      if (r.ok) {
        ready = true
        break
      }
    } catch {
      /* not up yet */
    }
    await sleep(1000)
  }
  if (!ready) {
    console.error('Server never became ready')
    process.exit(1)
  }
  console.log('Server ready. Running checks...\n')

  try {
    // --- health
    let r = await req('GET', '/health')
    check('health 200', r.status === 200 && r.json?.ok === true)

    // --- validation & injection guards
    r = await req('POST', '/auth/login', { body: { email: { $ne: null }, password: 'x' } })
    check('login rejects operator-object email', r.status === 400, `got ${r.status}`)

    r = await req('POST', '/auth/register', { body: { email: 'bad', password: 'short', name: 'x' } })
    check('register rejects invalid input', r.status === 400, `got ${r.status}`)

    // --- register + email verification (the code is read straight from the
    // in-memory DB — no real email leaves the smoke run)
    const mcAuth = new MongoClient(uri)
    await mcAuth.connect()
    const verifyCodeFor = async (email) =>
      (await mcAuth.db().collection('users').findOne({ email }))?.verifyCode

    r = await req('POST', '/auth/register', {
      body: { email: 'alice@example.com', password: 'password123', name: 'Alice' },
    })
    check('register 201', r.status === 201, `got ${r.status} ${JSON.stringify(r.json)}`)
    check('register creates no session', r.json?.ok === true && !r.json?.token, JSON.stringify(r.json))

    r = await req('POST', '/auth/login', { body: { email: 'alice@example.com', password: 'password123' } })
    check('unverified login blocked', r.status === 403 && r.json?.error?.code === 'email_not_verified', `got ${r.status}`)

    r = await req('POST', '/auth/verify-email', { body: { email: 'alice@example.com', code: '000000' } })
    check('verify rejects wrong code', r.status === 400 || r.status === 401, `got ${r.status}`)

    r = await req('POST', '/auth/verify-email', {
      body: { email: 'alice@example.com', code: await verifyCodeFor('alice@example.com') },
    })
    check('verify-email 200', r.status === 200 && typeof r.json?.token === 'string', `got ${r.status} ${JSON.stringify(r.json)}`)
    check('verified user shape', r.json?.user?.email === 'alice@example.com' && !r.json?.user?.password)
    const alice = r.json?.token

    r = await req('POST', '/auth/register', {
      body: { email: 'alice@example.com', password: 'password123', name: 'Alice2' },
    })
    check('duplicate email 409', r.status === 409 && r.json?.error?.code === 'email_taken', `got ${r.status}`)

    // --- login
    r = await req('POST', '/auth/login', { body: { email: 'alice@example.com', password: 'wrongpass' } })
    check('bad password 401', r.status === 401 && r.json?.error?.code === 'invalid_credentials')

    r = await req('POST', '/auth/login', { body: { email: 'ALICE@example.com'.toLowerCase(), password: 'password123' } })
    check('login 200', r.status === 200 && r.json?.token, `got ${r.status}`)

    // --- me
    r = await req('GET', '/auth/me', { token: alice })
    check('me 200', r.status === 200 && r.json?.user?.name === 'Alice')
    check('me no sensitive fields', !('tokenVersion' in (r.json?.user || {})) && !('password' in (r.json?.user || {})))
    r = await req('GET', '/auth/me')
    check('me unauthenticated 401', r.status === 401)

    // --- settings
    r = await req('PUT', '/user/settings', { token: alice, body: { themeColor: 'jade', dailyGoal: 30 } })
    check('settings update', r.status === 200 && r.json?.settings?.themeColor === 'jade' && r.json?.settings?.dailyGoal === 30)
    r = await req('PUT', '/user/settings', { token: alice, body: { themeColor: 'not-a-color' } })
    check('settings rejects bad color', r.status === 400)

    // --- profile
    r = await req('PUT', '/user/profile', { token: alice, body: { name: 'Alice Chen' } })
    check('profile update', r.status === 200 && r.json?.user?.name === 'Alice Chen')

    // --- words
    r = await req('GET', '/words/packs')
    check('packs list', r.status === 200 && Array.isArray(r.json?.packs) && r.json.packs.length >= 30)
    r = await req('GET', '/words?pack=hsk1')
    check('hsk1 words', r.status === 200 && r.json?.items?.length > 100)
    const firstWord = r.json?.items?.[0]
    check('word has id', typeof firstWord?.id === 'string' && firstWord.id.includes('·'))
    r = await req('GET', '/words?pack=nope')
    check('unknown pack 404', r.status === 404)
    r = await req('GET', '/words/search?q=%E7%88%B1')
    check('search 爱', r.status === 200 && r.json?.items?.some((w) => w.simplified === '爱'))

    // --- decks CRUD
    r = await req('POST', '/decks', { token: alice, body: { name: 'My words', words: [firstWord] } })
    check('deck create', r.status === 200 || r.status === 201, `got ${r.status} ${JSON.stringify(r.json)}`)
    const deckId = r.json?.deck?.id || r.json?.deck?._id || r.json?.id
    check('deck id present', !!deckId, JSON.stringify(r.json))
    r = await req('GET', '/decks', { token: alice })
    check('decks list', r.status === 200 && (r.json?.decks?.length === 1))
    r = await req('PUT', `/decks/${deckId}`, { token: alice, body: { name: 'Renamed deck' } })
    check('deck rename', r.status === 200, `got ${r.status} ${JSON.stringify(r.json)}`)
    r = await req('GET', `/decks/${deckId}`, { token: alice })
    check('deck read', r.status === 200 && (r.json?.deck?.name === 'Renamed deck'), JSON.stringify(r.json?.deck?.name))
    r = await req('PUT', `/decks/${deckId}`, { token: alice, body: { words: [{ bogus: true }] } })
    check('deck rejects invalid words', r.status === 400, `got ${r.status}`)

    // IDOR: second user cannot touch alice's deck
    r = await req('POST', '/auth/register', { body: { email: 'bob@example.com', password: 'password123', name: 'Bobby' } })
    r = await req('POST', '/auth/verify-email', {
      body: { email: 'bob@example.com', code: await verifyCodeFor('bob@example.com') },
    })
    const bob = r.json?.token
    await mcAuth.close()
    r = await req('PUT', `/decks/${deckId}`, { token: bob, body: { name: 'hacked' } })
    check('deck IDOR blocked', r.status === 404 || r.status === 403, `got ${r.status}`)

    // --- SRS flow
    r = await req('GET', '/srs/queue?packs=hsk1&limit=5', { token: alice })
    check('queue 200', r.status === 200 && r.json?.cards?.length === 5, `got ${r.status} len ${r.json?.cards?.length}`)
    const card = r.json?.cards?.[0]
    check('queue card new', card?.isNew === true)

    r = await req('POST', '/srs/review', {
      token: alice,
      body: { wordId: card.wordId, grade: 2, word: card.word, tzOffset: 180 },
    })
    check('review good', r.status === 200 && r.json?.card?.state === 'review' && r.json?.card?.intervalDays === 1, JSON.stringify(r.json?.card))

    r = await req('POST', '/srs/review', {
      token: alice,
      body: { wordId: card.wordId, grade: 0, tzOffset: 180 },
    })
    check('review again → learning', r.status === 200 && r.json?.card?.state === 'learning' && r.json?.card?.lapses === 1)

    r = await req('POST', '/srs/review', { token: alice, body: { wordId: 'unseen·word', grade: 2, tzOffset: 0 } })
    check('review unseen without snapshot 400', r.status === 400)

    r = await req('POST', '/srs/review', { token: alice, body: { wordId: card.wordId, grade: 9, tzOffset: 0 } })
    check('review bad grade 400', r.status === 400)

    // --- summary + activity
    r = await req('GET', '/srs/summary?tzOffset=180', { token: alice })
    check('summary', r.status === 200 && r.json?.todayReviews === 2 && r.json?.streak === 1 && r.json?.goal === 30, JSON.stringify(r.json))
    r = await req('GET', '/stats/activity?days=14&tzOffset=180', { token: alice })
    check('activity 14 days', r.status === 200 && r.json?.days?.length === 14 && r.json.days.at(-1).reviews === 2)

    // --- feedback
    r = await req('POST', '/feedback', { token: alice, body: { topic: 'idea', message: 'Great app, add audio!' } })
    check('feedback 201', r.status === 201, `got ${r.status}`)
    r = await req('POST', '/feedback', { body: { topic: 'bug', message: 'x'.repeat(3000) } })
    check('feedback too long 400', r.status === 400)

    // --- CMS content (public read + admin write)
    r = await req('GET', '/content?lang=en')
    check('content public read', r.status === 200 && typeof r.json?.entries === 'object')
    r = await req('PUT', '/admin/content', { token: alice, body: { scope: 'landing', key: 'x', lang: 'en', value: 'hi' } })
    check('content write blocked for non-admin', r.status === 403 || r.status === 401, `got ${r.status}`)

    // --- admin (promote alice via DB, as documented bootstrap)
    const mc = new MongoClient(uri)
    await mc.connect()
    await mc.db().collection('users').updateOne({ email: 'alice@example.com' }, { $set: { role: 'admin' } })

    r = await req('GET', '/admin/overview', { token: bob })
    check('admin blocked for non-admin', r.status === 403)
    r = await req('GET', '/admin/overview', { token: alice })
    check('admin overview', r.status === 200 && r.json?.totals?.users === 2, JSON.stringify(r.json?.totals))
    r = await req('GET', '/admin/users?q=bob', { token: alice })
    check('admin user search', r.status === 200 && r.json?.users?.length === 1 && r.json.users[0].email === 'bob@example.com')
    check('admin list no hashes', !('password' in (r.json?.users?.[0] || {})))
    const bobId = r.json?.users?.[0]?.id

    r = await req('PUT', `/admin/users/${bobId}`, { token: alice, body: { isBanned: true, banReason: 'spam' } })
    check('admin ban', r.status === 200 && r.json?.user?.isBanned === true, `got ${r.status} ${JSON.stringify(r.json)}`)
    r = await req('GET', '/auth/me', { token: bob })
    check('banned token revoked', r.status === 401 || r.status === 403, `got ${r.status}`)

    r = await req('PUT', `/admin/users/${bobId}`, { token: alice, body: { isBanned: false } })
    check('admin unban', r.status === 200 && r.json?.user?.isBanned === false)

    // login again as bob (tokenVersion bumped)
    r = await req('POST', '/auth/login', { body: { email: 'bob@example.com', password: 'password123' } })
    const bob2 = r.json?.token
    check('unbanned can login', r.status === 200 && !!bob2)

    // self-protection guards
    const aliceMe = await req('GET', '/auth/me', { token: alice })
    const aliceId = aliceMe.json?.user?.id
    r = await req('PUT', `/admin/users/${aliceId}`, { token: alice, body: { isBanned: true } })
    check('cannot ban self', r.status === 403, `got ${r.status}`)
    r = await req('PUT', `/admin/users/${aliceId}`, { token: alice, body: { role: 'user' } })
    check('cannot demote last admin', r.status === 403, `got ${r.status}`)

    r = await req('GET', '/admin/feedback', { token: alice })
    check('admin feedback list', r.status === 200 && (r.json?.items?.length ?? 0) >= 1, JSON.stringify(r.json))
    r = await req('GET', '/admin/audit', { token: alice })
    check('audit log recorded', r.status === 200 && (r.json?.items?.length ?? 0) >= 2, `items ${r.json?.items?.length}`)

    // admin can now write + read back CMS content
    r = await req('PUT', '/admin/content', { token: alice, body: { scope: 'landing', key: 'heroTitle', lang: 'ru', value: 'Привет' } })
    check('admin content write', r.status === 200, `got ${r.status}`)
    r = await req('GET', '/content?lang=ru')
    check('content override readable', r.json?.entries?.['landing:heroTitle'] === 'Привет')
    r = await req('PUT', '/admin/content', { token: alice, body: { scope: 'landing', key: 'heroTitle', lang: 'ru', value: '   ' } })
    check('whitespace clears override', r.status === 200 && r.json?.removed === true, JSON.stringify(r.json))

    // --- password change bumps tokenVersion
    r = await req('PUT', '/user/password', {
      token: bob2,
      body: { currentPassword: 'password123', newPassword: 'newpassword456' },
    })
    check('password change', r.status === 200 && !!r.json?.token, `got ${r.status}`)
    const bob3 = r.json?.token
    r = await req('GET', '/auth/me', { token: bob2 })
    check('old token invalid after pwd change', r.status === 401, `got ${r.status}`)
    r = await req('GET', '/auth/me', { token: bob3 })
    check('new token valid', r.status === 200)

    // --- account deletion
    r = await req('DELETE', '/account', { token: bob3, body: { password: 'wrongwrong' } })
    check('delete wrong password 403', r.status === 403, `got ${r.status}`)
    r = await req('DELETE', '/account', { token: bob3, body: { password: 'newpassword456' } })
    check('delete account', r.status === 200, `got ${r.status} ${JSON.stringify(r.json)}`)
    r = await req('POST', '/auth/login', { body: { email: 'bob@example.com', password: 'newpassword456' } })
    check('deleted user cannot login', r.status === 401 || r.status === 429, `got ${r.status}`)

    const users = await mc.db().collection('users').countDocuments()
    check('user really deleted from DB', users === 1, `count ${users}`)
    await mc.close()

    // --- rate limiting (register: max 5/15min/IP — we've used 3)
    let last = null
    for (let i = 0; i < 6; i++) {
      last = await req('POST', '/auth/register', {
        body: { email: `rl${i}@example.com`, password: 'password123', name: `RL ${i}` },
      })
      if (last.status === 429) break
    }
    check('register rate limit kicks in', last.status === 429, `got ${last.status}`)

    // --- security headers
    r = await req('GET', '/health')
    check('nosniff header', r.headers.get('x-content-type-options') === 'nosniff')
  } catch (err) {
    failed++
    failures.push(`unhandled: ${err.message}`)
    console.error('UNHANDLED', err)
  }

  console.log(`\n=== SMOKE RESULT: ${passed} passed, ${failed} failed ===`)
  if (failures.length) console.log(failures.map((f) => ` - ${f}`).join('\n'))

  // Windows: kill the whole process tree, otherwise the next server survives
  // the shell wrapper and keeps the port (and a dead DB) for the next run.
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/F', '/T', '/PID', String(server.pid)], { shell: true })
      killer.on('close', resolve)
      killer.on('error', resolve)
    })
  } else {
    server.kill('SIGTERM')
  }
  await mongod.stop()
  process.exit(failed > 0 ? 1 : 0)
}

main()
