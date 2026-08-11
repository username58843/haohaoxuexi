import { createApiHandler, errors, userRateKey } from '~/lib/server/api'

/**
 * AI chapter retelling for the Books reader.
 *
 * GET  /api/v1/ai/retell → { available, provider } — feature probe (no key leak)
 * POST /api/v1/ai/retell → { text }
 *   { text: 50..16000 chars, mode: 'retell'|'simple'|'translate', level?: 1..7, lang: 'en'|'ru'|'tk'|'zh' }
 *   retell    — literary retelling in Chinese (听书 companion, read with browser TTS)
 *   simple    — graded retelling in simple Chinese capped to an HSK level
 *   translate — summary of the chapter in the user's UI language
 *
 * Providers are pluggable via env (first configured wins, no vendor lock-in):
 *   GROQ_API_KEY    → api.groq.com (OpenAI-compatible, free tier)
 *   GEMINI_API_KEY  → generativelanguage.googleapis.com (free tier)
 *   OPENROUTER_API_KEY → openrouter.ai (free models)
 * Optional model overrides: GROQ_MODEL, GEMINI_MODEL, OPENROUTER_MODEL.
 */

const MODES = new Set(['retell', 'simple', 'translate'])
const LANGS = new Set(['en', 'ru', 'tk', 'zh'])
const LANG_NAMES = { en: 'English', ru: 'Russian', tk: 'Turkmen', zh: 'Chinese' }
const TIMEOUT_MS = 60000

function pickProvider() {
  if (process.env.GROQ_API_KEY) return 'groq'
  if (process.env.GEMINI_API_KEY) return 'gemini'
  if (process.env.OPENROUTER_API_KEY) return 'openrouter'
  return null
}

function buildPrompt({ mode, level, lang }) {
  if (mode === 'simple') {
    const capped = Math.min(Math.max(level || 3, 1), 7)
    return (
      `You are a Chinese graded-reader author. Retell the chapter below in simplified Chinese ` +
      `using only vocabulary and grammar appropriate for HSK ${capped} learners. ` +
      `Keep the story vivid but the language plain; short sentences; 250-450 characters. ` +
      `Answer with the retelling only — no preamble, no translation, no pinyin.`
    )
  }
  if (mode === 'translate') {
    return (
      `You are a literary editor. Summarize the Chinese chapter below in ${LANG_NAMES[lang] || 'English'}: ` +
      `what happens, who acts, what changes. 150-250 words, engaging but faithful. ` +
      `Answer with the summary only — no preamble.`
    )
  }
  return (
    `You are a masterful Chinese storyteller (说书人). Retell the chapter below in fluent ` +
    `simplified Chinese as an engaging spoken-style narration suitable for listening (听书): ` +
    `natural rhythm, 400-700 characters, keep all key plot points and names. ` +
    `Answer with the narration only — no preamble, no pinyin, no translation.`
  )
}

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function callOpenAiCompatible(url, key, model, system, text, extraHeaders = {}) {
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: text },
      ],
      temperature: 0.7,
      max_tokens: 1200,
    }),
  })
  if (!res.ok) throw new Error(`provider ${res.status}`)
  const data = await res.json()
  const out = data?.choices?.[0]?.message?.content
  if (typeof out !== 'string' || !out.trim()) throw new Error('empty completion')
  return out.trim()
}

async function callGemini(key, system, text) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
    }),
  })
  if (!res.ok) throw new Error(`gemini ${res.status}`)
  const data = await res.json()
  const out = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('')
  if (typeof out !== 'string' || !out.trim()) throw new Error('empty completion')
  return out.trim()
}

async function complete(provider, system, text) {
  if (provider === 'groq') {
    return callOpenAiCompatible(
      'https://api.groq.com/openai/v1/chat/completions',
      process.env.GROQ_API_KEY,
      process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      system,
      text
    )
  }
  if (provider === 'gemini') {
    return callGemini(process.env.GEMINI_API_KEY, system, text)
  }
  if (provider === 'openrouter') {
    return callOpenAiCompatible(
      'https://openrouter.ai/api/v1/chat/completions',
      process.env.OPENROUTER_API_KEY,
      process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
      system,
      text,
      { 'HTTP-Referer': process.env.APP_URL || 'https://haohaoxuexi.tech' }
    )
  }
  throw new Error('no provider')
}

export default createApiHandler({
  GET: {
    auth: true,
    handler: async (req, res) => {
      const provider = pickProvider()
      res.status(200).json({ available: !!provider, provider })
    },
  },
  POST: {
    auth: true,
    rateLimit: { name: 'ai_retell', max: 15, windowMs: 60 * 60 * 1000, keyFn: userRateKey },
    handler: async (req, res) => {
      const provider = pickProvider()
      if (!provider) {
        throw errors.conflict('ai_not_configured', 'AI provider is not configured on this server')
      }
      const { text, mode, level, lang } = req.body || {}
      if (typeof text !== 'string' || text.trim().length < 50 || text.length > 16000) {
        throw errors.badRequest('text must be a string of 50..16000 characters')
      }
      if (typeof mode !== 'string' || !MODES.has(mode)) {
        throw errors.badRequest('mode must be one of: retell, simple, translate')
      }
      if (level != null && (!Number.isInteger(level) || level < 1 || level > 7)) {
        throw errors.badRequest('level must be an integer 1..7')
      }
      const uiLang = typeof lang === 'string' && LANGS.has(lang) ? lang : 'en'

      const system = buildPrompt({ mode, level, lang: uiLang })
      try {
        const out = await complete(provider, system, text.trim())
        res.status(200).json({ text: out, provider })
      } catch (err) {
        console.error('ai/retell provider error:', err.message)
        throw errors.conflict('ai_unavailable', 'AI provider is unavailable right now, try again later')
      }
    },
  },
})
