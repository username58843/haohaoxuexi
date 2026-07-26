/**
 * CORS middleware for API routes.
 * Handles preflight OPTIONS requests for cross-origin clients (e.g. Android app).
 *
 * Usage:
 *   import { runCors } from '~/lib/cors'
 *   export default async function handler(req, res) {
 *     if (runCors(req, res)) return
 *     // ... rest of handler
 *   }
 */
export function runCors(req, res) {
  // List of allowed origins
  const allowedOrigins = [
    process.env.APP_URL,
    'https://xuehanyuapp.vercel.app',
    'http://localhost:3000',
  ].filter(Boolean)

  const origin = req.headers.origin
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else if (!origin) {
    // Allow requests without origin (e.g. mobile apps, server-to-server)
    res.setHeader('Access-Control-Allow-Origin', '*')
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Cookie, X-Requested-With'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return true
  }

  return false
}
