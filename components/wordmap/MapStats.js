import React, { useEffect, useRef, useState } from 'react'

const LEVELS = [1, 2, 3, 4, 5, 6]

/**
 * Animated count-up of the overall mastery percentage. Honors
 * prefers-reduced-motion (jumps straight to the value).
 */
function useCountUp(target) {
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  const rafRef = useRef(0)

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const from = fromRef.current
    if (reduce || from === target) {
      fromRef.current = target
      setValue(target)
      return undefined
    }
    const start = performance.now()
    const dur = 650
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(from + (target - from) * eased))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target])

  return value
}

/**
 * Stats + legend header: an overall mastery ring-ish counter plus a per-level
 * legend with mini progress bars. `levelStats[level] = { total, known }`.
 */
export default function MapStats({ levelStats, totalWords, totalKnown, t }) {
  const mastery = totalWords > 0 ? Math.round((totalKnown / totalWords) * 100) : 0
  const displayed = useCountUp(mastery)

  return (
    <div className="wmap-stats">
      <div className="wmap-stats__overall">
        <span className="wmap-stats__pct u-mono">{displayed}%</span>
        <span className="wmap-stats__label">
          {t('wmapMastery', 'Mastery')}
          <span className="wmap-stats__sub u-mono">
            {' '}
            {totalKnown}/{totalWords || '—'}
          </span>
        </span>
      </div>

      <div className="wmap-legend" role="list" aria-label={t('wmapLegend', 'Legend')}>
        {LEVELS.map((lvl) => {
          const s = levelStats[lvl] || { total: 0, known: 0 }
          const pct = s.total > 0 ? Math.round((s.known / s.total) * 100) : 0
          return (
            <div
              className="wmap-legend__item"
              role="listitem"
              key={lvl}
              style={{ '--leg-tint': `var(--hsk-${lvl})` }}
            >
              <span className="wmap-legend__dot" aria-hidden />
              <span className="wmap-legend__name u-mono">HSK {lvl}</span>
              <span className="wmap-legend__bar" aria-hidden>
                <span className="wmap-legend__bar-fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="wmap-legend__count u-mono">
                {s.total > 0 ? `${s.known}/${s.total}` : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
