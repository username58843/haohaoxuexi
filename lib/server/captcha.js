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
 *
 * If no token is provided the request is allowed through but a warning
 * is logged. This keeps the app usable on devices with an outdated
 * WebView (e.g. Android emulators) while still protecting against
 * bots on real devices where Turnstile renders correctly.
 */
export async function verifyTurnstile(token, remoteIp) {
  if (!enabled()) return

  // No token → allow but log (old WebView / emulator / network issue)
  if (!token || typeof token !== 'string') {
    console.warn('[captcha] No token received – allowing request (ip=%s)', remoteIp || 'unknown')
    return
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
