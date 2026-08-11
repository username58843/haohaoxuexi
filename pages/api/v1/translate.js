import { createApiHandler, errors, userRateKey } from '~/lib/server/api'

/**
 * POST /api/v1/translate — sentence translation for the Books reader.
 * { text: string 1..1200, to: 'en'|'ru'|'tk' } → { text, provider }
 *
 * Providers (server-side, keyless, best-effort — word lookups never touch
 * this endpoint, they run on the local /dict data):
 *   1. Google web endpoint (unofficial but stable for years, generous limits)
 *   2. MyMemory (fallback, hard-capped free tier)
 * Auth required + per-user rate limit so the proxy can't be farmed anonymously.
 */

const TARGETS = new Set(['en', 'ru', 'tk'])
const TIMEOUT_MS = 8000

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function viaGoogle(text, to) {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&dt=t' +
    `&tl=${encodeURIComponent(to)}&q=${encodeURIComponent(text)}`
  const res = await fetchWithTimeout(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; haohaoxuexi/1.0)' },
  })
  if (!res.ok) throw new Error(`google ${res.status}`)
  const data = await res.json()
  const out = Array.isArray(data?.[0])
    ? data[0].map((seg) => (Array.isArray(seg) ? seg[0] : '')).join('')
    : ''
  if (!out.trim()) throw new Error('google empty')
  return out.trim()
}

async function viaMyMemory(text, to) {
  const url =
    'https://api.mymemory.translated.net/get?langpair=' +
    encodeURIComponent(`zh-CN|${to}`) +
    `&q=${encodeURIComponent(text)}`
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`mymemory ${res.status}`)
  const data = await res.json()
  const out = data?.responseData?.translatedText
  if (typeof out !== 'string' || !out.trim() || /MYMEMORY WARNING/i.test(out)) {
    throw new Error('mymemory empty')
  }
  return out.trim()
}

export default createApiHandler({
  POST: {
    auth: true,
    rateLimit: { name: 'translate', max: 40, windowMs: 60 * 1000, keyFn: userRateKey },
    handler: async (req, res) => {
      const { text, to } = req.body || {}
      if (typeof text !== 'string' || !text.trim() || text.length > 1200) {
        throw errors.badRequest('text must be a string of 1..1200 characters')
      }
      if (typeof to !== 'string' || !TARGETS.has(to)) {
        throw errors.badRequest('to must be one of: en, ru, tk')
      }
      const clean = text.trim()
      try {
        const out = await viaGoogle(clean, to)
        return res.status(200).json({ text: out, provider: 'google' })
      } catch {
        // fall through
      }
      try {
        const out = await viaMyMemory(clean, to)
        return res.status(200).json({ text: out, provider: 'mymemory' })
      } catch {
        throw errors.conflict('translate_unavailable', 'Translation providers are unavailable right now')
      }
    },
  },
})
