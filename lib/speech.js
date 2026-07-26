/**
 * Chinese TTS via the browser's Web Speech API — no server proxy, no API keys.
 */

let cachedVoice = null

function pickChineseVoice() {
  if (cachedVoice) return cachedVoice
  const voices = window.speechSynthesis?.getVoices?.() || []
  cachedVoice =
    voices.find((v) => /^zh([-_]CN)?$/i.test(v.lang)) ||
    voices.find((v) => /^zh/i.test(v.lang)) ||
    null
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
