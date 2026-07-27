import { ApiError } from './api'

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || ''
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

// In development (no secret key configured) captcha is silently skipped.
const enabled = () => TURNSTILE_SECRET.length > 0

/**
 * Canonical Cloudflare Turnstile siteverify.
 * POST https://challenges.cloudflare.com/turnstile/v0/siteverify
 * body: { secret, response, remoteip }
 * Checks success === true.
 */
export async function verifyTurnstile(token, remoteIp) {
  if (!enabled()) return

  if (!token || typeof token !== 'string') {
    throw new ApiError(400, 'captcha_required', 'Captcha verification required')
  }

  const r = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: TURNSTILE_SECRET,
      response: token,
      remoteip: remoteIp || '',
    }),
  })

  const result = await r.json()

  if (!result.success) {
    throw new ApiError(400, 'captcha_failed', 'Captcha verification failed')
  }
}
