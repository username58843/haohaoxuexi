import { runCors } from '~/lib/cors'
import { buildAuthCookie } from '~/lib/auth'

export default async function handler(req, res) {
  if (runCors(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  res.setHeader('Set-Cookie', buildAuthCookie('', { clear: true }))
  return res.status(200).json({ success: true })
}
