import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient, ObjectId } from 'mongodb'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import fs from 'node:fs'

const port = Number(process.env.PORT || 3000)
const mongo = await MongoMemoryServer.create()
const uri = mongo.getUri('haohao-preview')
const client = await new MongoClient(uri).connect()
const db = client.db()
const userId = new ObjectId()
const now = new Date()
await db.collection('users').insertOne({ _id: userId, email: 'reader@example.test',
  password: await bcrypt.hash('local-reader-preview-123', 10), name: 'Reader Demo',
  emailVerified: true, role: 'user', tokenVersion: 0, createdAt: now, schemaVersion: 3,
  settings: { language: 'ru', theme: 'light', schemaVersion: 3 },
})
const legacyWord = JSON.parse(fs.readFileSync('words/legacy/hsk1.json', 'utf8'))[0]
await db.collection('decks').insertOne({ userId, name: 'Моя учебная колода', words: [legacyWord], order: 0, createdAt: now, updatedAt: now })
await client.close()
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '0.0.0.0', '--port', String(port)], {
  stdio: 'inherit',
  env: { ...process.env, MONGODB_URI: uri, JWT_SECRET: randomBytes(32).toString('hex'),
    APP_URL: `http://localhost:${port}`, RESEND_API_KEY: '', TURNSTILE_SECRET_KEY: '',
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: '', NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1' },
})
console.log('Disposable local preview; fixture login: reader@example.test / local-reader-preview-123')
let closing = false
async function close() {
  if (closing) return
  closing = true
  server.kill('SIGTERM')
  await mongo.stop()
}
process.on('SIGTERM', () => { void close() })
process.on('SIGINT', () => { void close() })
server.once('exit', (code) => { void close().then(() => { process.exitCode = code || 0 }) })
