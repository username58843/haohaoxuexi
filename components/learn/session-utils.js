import React from 'react'
import { makeWordId } from '~/lib/words-shared'

/**
 * Shared helpers for the Learn hub and study session:
 * quiz question building, SRS interval previews, word normalization.
 */

export const ALL_QMODES = ['cp', 'pc', 'ct', 'tc', 'tp']

/** prompt/answer field per question mode. */
export const QMODE_DEFS = {
  cp: { prompt: 'hanzi', answer: 'pinyin' },
  pc: { prompt: 'pinyin', answer: 'hanzi' },
  ct: { prompt: 'hanzi', answer: 'meaning' },
  tc: { prompt: 'meaning', answer: 'hanzi' },
  tp: { prompt: 'meaning', answer: 'pinyin' },
}

/** Fisher–Yates on a copy. */
export function shuffle(list) {
  const a = list.slice()
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Guarantees a canonical `.id` on a word (deck snapshots lack one). */
export function ensureWordId(word) {
  if (!word || typeof word !== 'object' || !word.simplified) return null
  if (typeof word.id === 'string' && word.id) return word
  return { ...word, id: makeWordId(word) }
}

export function dedupeWords(words) {
  const seen = new Map()
  for (const w of words) {
    if (w && w.id && !seen.has(w.id)) seen.set(w.id, w)
  }
  return Array.from(seen.values())
}

/** First meaning line: definitions, then translations (UI language preferred). */
export function meaningLine(word, lang) {
  const defs = Array.isArray(word.definitions) ? word.definitions : []
  const en = (word.translations && word.translations.en) || []
  const ru = (word.translations && word.translations.ru) || []
  const tk = (word.translations && word.translations.tk) || []
  if (lang === 'ru' && ru.length) return ru[0]
  if (lang === 'tk' && tk.length) return tk[0]
  return defs[0] || en[0] || ru[0] || tk[0] || ''
}

function fieldText(word, kind, lang) {
  if (kind === 'hanzi') return word.simplified || ''
  if (kind === 'pinyin') return word.pinyin || ''
  return meaningLine(word, lang)
}

/** Which of the requested modes this word can actually be asked in. */
function modesForWord(word, qmodes, lang) {
  return qmodes.filter((m) => {
    const def = QMODE_DEFS[m]
    if (!def) return false
    return Boolean(fieldText(word, def.prompt, lang)) && Boolean(fieldText(word, def.answer, lang))
  })
}

const norm = (s) => String(s).trim().toLowerCase()

/**
 * Builds the whole quiz upfront. Each question gets a random eligible mode,
 * the correct answer plus up to 3 distractors with unique word ids AND unique
 * display texts (fewer than 4 options is accepted when the pool is small).
 */
export function buildQuizQuestions({ pool, distractors, qmodes, count, lang }) {
  const modes = (qmodes || []).filter((m) => QMODE_DEFS[m])
  if (!modes.length) return []

  const eligible = pool.filter((w) => modesForWord(w, modes, lang).length > 0)
  const picked = shuffle(eligible)
  const sliced = count > 0 ? picked.slice(0, count) : picked

  return sliced.map((word) => {
    const wordModes = modesForWord(word, modes, lang)
    const qmode = wordModes[Math.floor(Math.random() * wordModes.length)]
    const def = QMODE_DEFS[qmode]
    const correctText = fieldText(word, def.answer, lang)
    const promptText = norm(fieldText(word, def.prompt, lang))
    const usedTexts = new Set([norm(correctText)])
    const usedIds = new Set([word.id])
    const options = [{ text: correctText, wordId: word.id, correct: true }]

    for (const cand of shuffle(distractors)) {
      if (options.length >= 4) break
      if (!cand || usedIds.has(cand.id)) continue
      // Skip candidates that share the prompt (e.g. 他/她 both "tā", or the
      // 还 hái/huán homograph) — they'd be a second valid answer, not a distractor.
      if (norm(fieldText(cand, def.prompt, lang)) === promptText) continue
      const text = fieldText(cand, def.answer, lang)
      if (!text || usedTexts.has(norm(text))) continue
      usedIds.add(cand.id)
      usedTexts.add(norm(text))
      options.push({ text, wordId: cand.id, correct: false })
    }

    const shuffled = shuffle(options)
    return {
      word,
      qmode,
      promptType: def.prompt,
      answerType: def.answer,
      prompt: fieldText(word, def.prompt, lang),
      options: shuffled,
      correctIndex: shuffled.findIndex((o) => o.correct),
    }
  })
}

/**
 * Predicted next interval per grade [Again, Hard, Good, Easy] — a client
 * mirror of the server SM-2 rules (docs/ARCHITECTURE.md §7), display only.
 */
export function previewIntervals(card, t) {
  const min = t('sessUnitMin', 'm')
  const fmtDays = (raw) => {
    const days = Math.min(365, raw)
    if (days < 1) return `${Math.max(1, Math.round(days * 24))}${t('sessUnitHour', 'h')}`
    if (days < 30) {
      const v = days < 10 ? Math.round(days * 10) / 10 : Math.round(days)
      return `${v}${t('sessUnitDay', 'd')}`
    }
    return `${Math.max(1, Math.round(days / 30))}${t('sessUnitMonth', 'mo')}`
  }

  const ease = typeof card.ease === 'number' ? card.ease : 2.5
  const interval = typeof card.intervalDays === 'number' ? card.intervalDays : 0
  if (card.state !== 'review') {
    return [`10${min}`, `30${min}`, fmtDays(1), fmtDays(3)]
  }
  return [
    `10${min}`,
    fmtDays(Math.max(interval * 1.2, interval + 0.5)),
    fmtDays(interval * ease),
    fmtDays(interval * ease * 1.3),
  ]
}

/**
 * Human label for a question mode, e.g. 汉字 → Pinyin. The Chinese side is
 * spelled 汉字 (the actual word for "Chinese characters") rather than the bare
 * 字 — on its own that glyph reads as "character/word" and users had to guess
 * what the direction meant.
 */
export function QmodeLabel({ mode, t }) {
  const hanzi = (
    <span className="hanzi" lang="zh">
      汉字
    </span>
  )
  const pinyin = t('learnPinyin', 'Pinyin')
  const meaning = t('learnMeaning', 'Meaning')
  if (mode === 'cp') return <>{hanzi}{' → '}{pinyin}</>
  if (mode === 'pc') return <>{pinyin}{' → '}{hanzi}</>
  if (mode === 'ct') return <>{hanzi}{' → '}{meaning}</>
  if (mode === 'tp') return <>{meaning}{' → '}{pinyin}</>
  return <>{meaning}{' → '}{hanzi}</>
}

/**
 * What to pronounce after a correct quiz answer, when the per-account
 * "speak on correct answer" setting is on.
 *
 * The prompt side decides, so the audio always reinforces what the user was
 * just asked:
 *  - 汉字 or Pinyin prompt (cp / pc / ct) → the word itself, in Mandarin.
 *    A pinyin prompt speaks the hanzi, not the latin spelling: same
 *    pronunciation, and Chinese voices mangle romanized text.
 *  - Meaning prompt (tc / tp) → the meaning line, in the UI language.
 *
 * Returns { text, lang } — `lang` is a UI language code ('zh' for Mandarin) —
 * or null when there is nothing usable to say.
 */
export function speechForQuestion(question, lang) {
  if (!question || !question.word) return null
  const def = QMODE_DEFS[question.qmode]
  if (!def) return null
  if (def.prompt === 'meaning') {
    const text = meaningLine(question.word, lang)
    return text ? { text, lang: lang || 'en' } : null
  }
  const text = question.word.simplified || ''
  return text ? { text, lang: 'zh' } : null
}
