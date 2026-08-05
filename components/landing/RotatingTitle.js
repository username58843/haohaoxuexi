import React, { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Hero headline that cycles through the 好好学习… family of phrases.
 *
 * The first phrase (好好学习汉语) is what renders on the server and on the
 * very first client paint, so SSR output and SEO stay unchanged; the rotation
 * only starts once mounted. Respects prefers-reduced-motion (crossfade only,
 * no per-character stagger) and pauses while the tab is hidden.
 */

export const HERO_PHRASES = [
  '好好学习汉语',
  '好好学习中文',
  '好好学习普通话',
  '好好学习拼音',
  '好好学习汉字',
  '好好学习词汇',
  '好好学习生词',
  '好好学习单词',
  '好好学习语法',
  '好好学习发音',
  '好好学习声调',
  '好好学习口语',
  '好好学习听力',
  '好好学习阅读',
  '好好学习写作',
  '好好学习会话',
  '好好学习表达',
  '好好学习成语',
  '好好学习中国传统文化',
  '好好学习HSK',
  '好好学习翻译',
  '好好学习古文',
  '好好学习句子',
  '好好学习中国文学',
  '好好学习朗读',
  '好好学习复习',
  '好好学习中国历史',
  '好好准备考试',
  '好好学习书写',
  '好好学习课文',
  '好好学习作文',
  '好好学习现代汉语',
  '好好学习努力',
  '好好学习坚持',
  '好好学习成长',
  '好好学习奋斗',
  '好好学习思考',
  '好好学习，成就自己',
  '好好学习，实现梦想',
  '好好学习，一起加油！',
  '好好学习，改变未来',
  '好好学习，永不放弃',
  '好好学习知识',
  '好好学习，天天向上！',
  '好好学习，考试顺利！',
  '好好学习，越学越好！',
  '好好学习，继续努力！',
]

const HOLD_MS = 2600
const OUT_MS = 420

/** Punctuation is visually narrower, so it counts for less when scaling. */
function widthWeight(phrase) {
  let w = 0
  for (const ch of phrase) {
    if ('，。！、'.includes(ch)) w += 0.5
    else if (/[A-Za-z0-9]/.test(ch)) w += 0.62
    else w += 1
  }
  return w
}

/** Keep long phrases inside the viewport: shrink relative to a 6-hanzi phrase. */
function scaleFor(phrase) {
  const s = 6 / Math.max(widthWeight(phrase), 6)
  return Math.round(s * 1000) / 1000
}

export default function RotatingTitle({ className = '', phrases = HERO_PHRASES }) {
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const timers = useRef([])

  useEffect(() => {
    if (phrases.length < 2) return
    if (typeof window === 'undefined') return

    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const clear = () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }

    let stopped = false

    const schedule = () => {
      if (stopped) return
      timers.current.push(
        setTimeout(() => {
          if (stopped) return
          if (document.hidden) {
            schedule()
            return
          }
          setLeaving(true)
          timers.current.push(
            setTimeout(
              () => {
                setIndex((i) => (i + 1) % phrases.length)
                setLeaving(false)
                schedule()
              },
              reduce ? 200 : OUT_MS
            )
          )
        }, HOLD_MS)
      )
    }

    schedule()
    return () => {
      stopped = true
      clear()
    }
  }, [phrases])

  const phrase = phrases[index] || phrases[0]
  const chars = useMemo(() => Array.from(phrase), [phrase])

  return (
    <h1
      className={`lp-hero__title hanzi ${className}`.trim()}
      lang="zh"
      style={{ '--phrase-scale': scaleFor(phrase) }}
    >
      <span className="u-sr-only">{phrase}</span>
      <span
        key={index}
        className={`lp-hero__phrase${leaving ? ' is-leaving' : ''}`}
        aria-hidden="true"
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
      <span className="lp-hero__seal" aria-hidden="true" />
    </h1>
  )
}
