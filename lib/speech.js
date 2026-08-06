/**
 * Chinese TTS via the browser's Web Speech API — no server proxy, no API keys.
 *
 * Voice quality: browsers often default to a robotic local voice, so the
 * Mandarin voices on offer are scored and the most natural one wins:
 * remote/cloud voices (Google 普通话, Microsoft Online Natural) beat local
 * ones, "natural/neural/premium/enhanced" variants beat plain defaults.
 */

let cachedVoice = null

function scoreVoice(v) {
  const lang = String(v.lang || '').replace('_', '-').toLowerCase()
  const name = String(v.name || '').toLowerCase()

  // Mandarin (mainland) strongly preferred; other zh variants are a fallback.
  let score = 0
  if (lang === 'zh-cn' || lang === 'cmn-cn') score += 10
  else if (/^zh/.test(lang) || /^cmn/.test(lang)) score += 4
  else return -1

  // Cloud voices are the near-native ones (Chrome: localService=false).
  if (v.localService === false) score += 8
  if (/natural|neural/.test(name)) score += 6 // Edge "Xiaoxiao Online (Natural)"
  if (/premium|enhanced/.test(name)) score += 4 // iOS/macOS enhanced voices
  if (/google/.test(name)) score += 3 // "Google 普通话（中国大陆）"
  if (/siri/.test(name)) score += 2
  return score
}

function pickChineseVoice() {
  if (cachedVoice) return cachedVoice
  const voices = window.speechSynthesis?.getVoices?.() || []
  let best = null
  let bestScore = 0
  for (const v of voices) {
    const s = scoreVoice(v)
    if (s > bestScore) {
      bestScore = s
      best = v
    }
  }
  cachedVoice = best
  return cachedVoice
}

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speakChinese(text, { rate = 0.85 } = {}) {
  if (!canSpeak() || !text) return false
  const synth = window.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = rate
  utterance.pitch = 1
  const voice = pickChineseVoice()
  if (voice) utterance.voice = voice
  synth.speak(utterance)
  return true
}

// Voice list loads asynchronously in some browsers.
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null
  }
}
