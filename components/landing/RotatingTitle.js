import React, { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Hero headline: a fixed 好好学习 stem with a rotating tail.
 *
 * Only the tail animates — 好好学习 never moves or re-renders. Each swap picks
 * a different transition (blur-rise, slide, slot-roll, typewriter, pop, flip,
 * wipe, drop) so the headline never feels like a single looping effect; the
 * same variant is never used twice in a row.
 *
 * The first tail (汉语) is what renders on the server and on the first client
 * paint, so SSR output and SEO stay identical to the old static headline.
 * Respects prefers-reduced-motion (plain crossfade) and pauses while the tab
 * is hidden.
 */

export const HERO_STEM = '好好学习'

/** Tails appended to 好好学习 — order preserved from the source list. */
export const HERO_TAILS = [
  '汉语',
  '中文',
  '普通话',
  '拼音',
  '汉字',
  '词汇',
  '生词',
  '单词',
  '语法',
  '发音',
  '声调',
  '口语',
  '听力',
  '阅读',
  '写作',
  '会话',
  '表达',
  '成语',
  '中国传统文化',
  'HSK',
  '翻译',
  '古文',
  '句子',
  '中国文学',
  '朗读',
  '复习',
  '中国历史',
  '书写',
  '课文',
  '作文',
  '现代汉语',
  '努力',
  '坚持',
  '成长',
  '奋斗',
  '思考',
  '知识',
  '，成就自己',
  '，实现梦想',
  '，一起加油！',
  '，改变未来',
  '，永不放弃',
  '，天天向上！',
  '，考试顺利！',
  '，越学越好！',
  '，继续努力！',
]

/** Transition variants and how long their exit animation runs. */
const VARIANTS = [
  { name: 'rise', out: 420 },
  { name: 'slide', out: 380 },
  { name: 'roll', out: 440 },
  { name: 'type', out: 300 },
  { name: 'pop', out: 380 },
  { name: 'flip', out: 440 },
  { name: 'wipe', out: 400 },
  { name: 'drop', out: 400 },
]

const HOLD_MS = 2500

/** Approximate advance width in em: hanzi/full-width punctuation ≈ 1, latin ≈ 0.62. */
function charWidth(ch) {
  if (/[A-Za-z0-9]/.test(ch)) return 0.62
  return 1
}

function widthEm(text) {
  let w = 0
  for (const ch of text) w += charWidth(ch) + 0.04 /* letter-spacing */
  return Math.round(w * 1000) / 1000
}

/** Keep long phrases inside the viewport: shrink relative to a 6-hanzi phrase. */
function scaleFor(fullLength) {
  const s = 6 / Math.max(fullLength, 6)
  return Math.round(s * 1000) / 1000
}

function pickNext(prevName) {
  const pool = VARIANTS.filter((v) => v.name !== prevName)
  return pool[Math.floor(Math.random() * pool.length)]
}

export default function RotatingTitle({ className = '', tails = HERO_TAILS, stem = HERO_STEM }) {
  const [index, setIndex] = useState(0)
  const [variant, setVariant] = useState(VARIANTS[0])
  const [leaving, setLeaving] = useState(false)
  const timers = useRef([])

  useEffect(() => {
    if (tails.length < 2 || typeof window === 'undefined') return

    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let stopped = false
    let lastName = null

    const push = (fn, ms) => timers.current.push(setTimeout(fn, ms))

    const schedule = () => {
      if (stopped) return
      push(() => {
        if (stopped) return
        if (document.hidden) {
          schedule()
          return
        }
        const next = reduce ? { name: 'fade', out: 200 } : pickNext(lastName)
        lastName = next.name
        setVariant(next)
        setLeaving(true)
        push(() => {
          if (stopped) return
          setIndex((i) => (i + 1) % tails.length)
          setLeaving(false)
          schedule()
        }, next.out)
      }, HOLD_MS)
    }

    schedule()
    return () => {
      stopped = true
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [tails])

  const tail = tails[index] || tails[0]
  const chars = useMemo(() => Array.from(tail), [tail])

  return (
    <h1
      className={`lp-hero__title hanzi ${className}`.trim()}
      lang="zh"
      style={{ '--phrase-scale': scaleFor(Array.from(stem).length + chars.length) }}
    >
      <span className="lp-hero__stem">{stem}</span>
      <span className="u-sr-only">{tail}</span>
      <span
        className="lp-hero__tail"
        style={{ '--tail-w': `${widthEm(tail)}em` }}
        aria-hidden="true"
      >
        <span
          key={index}
          className={`lp-hero__swap lp-hero__swap--${variant.name}${
            leaving ? ' is-leaving' : ''
          }`}
        >
          {chars.map((ch, i) => (
            <span
              key={`${index}-${i}`}
              className="lp-hero__char"
              style={{ '--i': i, '--n': chars.length }}
            >
              {ch}
            </span>
          ))}
        </span>
      </span>
      <span className="lp-hero__seal" aria-hidden="true" />
    </h1>
  )
}
