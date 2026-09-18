/**
 * TTS via the browser's Web Speech API — no server proxy, no API keys.
 *
 * Mandarin is the main use (word cards, example sentences), but the quiz can
 * also read a *meaning* out loud, which has to use the UI language — so the
 * voice picker is parameterized by locale instead of being zh-only.
 *
 * Voice quality: browsers often default to a robotic local voice, so the
 * candidates are scored and the most natural one wins: remote/cloud voices
 * (Google 普通话, Microsoft Online Natural) beat local ones, and
 * "natural/neural/premium/enhanced" variants beat plain defaults.
 */

/** UI language code → preferred BCP-47 locale for synthesis. */
const LOCALE_BY_LANG = {
  zh: 'zh-CN',
  ru: 'ru-RU',
  en: 'en-US',
  tk: 'tk-TM',
}

/** Mandarin is read slightly slower than normal; prose at (near) full speed. */
const RATE_BY_LANG = { zh: 0.85 }

// Resolved voice per locale ('zh-CN' → SpeechSynthesisVoice | null).
const voiceCache = new Map()

const normalizeLocale = (value) => String(value || '').replace('_', '-').toLowerCase()

/**
 * Scores a voice against a target locale. Returns -1 for a different language.
 * Mandarin gets the extra `cmn-*` aliases some engines report.
 */
function scoreVoice(voice, target) {
  const lang = normalizeLocale(voice.lang)
  const name = String(voice.name || '').toLowerCase()
  const wanted = normalizeLocale(target)
  const primary = wanted.split('-')[0]
  const isChinese = primary === 'zh'

  let score = 0
  if (lang === wanted || (isChinese && lang === 'cmn-cn')) {
    score += 10 // exact region match (zh-CN, ru-RU, …)
  } else if (lang.split('-')[0] === primary || (isChinese && lang.startsWith('cmn'))) {
    score += 4 // same language, different region (zh-TW, ru-BY, …)
  } else {
    return -1
  }

  // Cloud voices are the near-native ones (Chrome: localService=false).
  if (voice.localService === false) score += 8
  if (/natural|neural/.test(name)) score += 6 // Edge "Xiaoxiao Online (Natural)"
  if (/premium|enhanced/.test(name)) score += 4 // iOS/macOS enhanced voices
  if (/google/.test(name)) score += 3 // "Google 普通话（中国大陆）"
  if (/siri/.test(name)) score += 2
  return score
}

function pickVoice(target) {
  if (voiceCache.has(target)) return voiceCache.get(target)
  const voices = window.speechSynthesis?.getVoices?.() || []
  let best = null
  let bestScore = 0
  for (const voice of voices) {
    const score = scoreVoice(voice, target)
    if (score > bestScore) {
      bestScore = score
      best = voice
    }
  }
  // An empty voice list means the engine has not loaded them yet — don't cache
  // that as "no voice", or the first utterance would poison every later one.
  if (voices.length) voiceCache.set(target, best)
  return best
}

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Speaks `text` in the given UI language ('zh' | 'ru' | 'en' | 'tk'),
 * cancelling any ongoing utterance. Returns false when speech is unavailable.
 *
 * A missing voice for the language is not a hard failure: the utterance still
 * carries the locale, so the engine can fall back to whatever it has (relevant
 * for Turkmen, which most platforms don't ship).
 */
export function speak(text, { lang = 'zh', rate } = {}) {
  if (!canSpeak() || !text) return false
  const locale = LOCALE_BY_LANG[lang] || LOCALE_BY_LANG.en
  const synth = window.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = locale
  utterance.rate = rate ?? RATE_BY_LANG[lang] ?? 1
  utterance.pitch = 1
  const voice = pickVoice(locale)
  if (voice) utterance.voice = voice
  synth.speak(utterance)
  return true
}

export function speakChinese(text, { rate = RATE_BY_LANG.zh } = {}) {
  return speak(text, { lang: 'zh', rate })
}

/**
 * Long-form narration (Books AI retelling): splits `text` into sentences and
 * chains utterances so engines with per-utterance length caps don't cut off
 * mid-story. Returns a controller { stop() } or null when speech is
 * unavailable; `onDone` fires after the last sentence or on stop().
 */
export function splitSpeechText(text, maxLength = 180) {
  const limit = Math.max(1, Math.floor(maxLength) || 180)
  return String(text).split(/(?<=[。！？；!?;\n])/u).flatMap((sentence) => {
    const characters = Array.from(sentence.trim())
    const chunks = []
    for (let start = 0; start < characters.length; start += limit) {
      chunks.push(characters.slice(start, start + limit).join(''))
    }
    return chunks
  })
}

export function speakLong(text, { lang = 'zh', rate, onDone, onError } = {}) {
  if (!canSpeak() || !text) return null
  const locale = LOCALE_BY_LANG[lang] || LOCALE_BY_LANG.en
  const synth = window.speechSynthesis
  synth.cancel()

  const parts = splitSpeechText(text)
  if (parts.length === 0) return null

  let stopped = false
  let index = 0
  const finish = () => {
    if (stopped) return
    stopped = true
    onDone?.()
  }
  const speakNext = () => {
    if (stopped) return
    if (index >= parts.length) {
      finish()
      return
    }
    const utterance = new SpeechSynthesisUtterance(parts[index])
    index += 1
    utterance.lang = locale
    utterance.rate = rate ?? RATE_BY_LANG[lang] ?? 1
    utterance.pitch = 1
    const voice = pickVoice(locale)
    if (voice) utterance.voice = voice
    utterance.onend = speakNext
    utterance.onerror = (event) => {
      if (stopped) return
      if (!['canceled', 'interrupted'].includes(event.error)) onError?.(event.error)
      finish()
    }
    try { synth.speak(utterance) } catch (error) { onError?.(error); finish() }
  }
  speakNext()

  return {
    stop() {
      finish()
      synth.cancel()
    },
  }
}

// Voice list loads asynchronously in some browsers.
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    voiceCache.clear()
  }
}
