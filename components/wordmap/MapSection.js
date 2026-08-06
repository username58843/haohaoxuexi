import React, { useMemo, useState } from 'react'
import MapTile from './MapTile'
import { Button, Spinner } from '~/components/ui'

/**
 * A single HSK-level block: sticky level header + a dense tile grid.
 *
 * Performance strategy (see /pages/hsk/map.js for the whole picture):
 * each level renders its own grid, and within a level we cap the INITIAL paint
 * to CAP tiles. HSK 5/6 hold ~1300–2500 words each, so painting every node up
 * front would jank on mid-range phones. The rest is revealed on demand via a
 * "show all N" expander. Once expanded, the level stays expanded.
 *
 * CAP is deliberately generous (600) — enough that HSK 1–4 never truncate and
 * the fold on 5/6 lands well below the first viewport, but low enough that the
 * synchronous tile count per frame stays comfortable.
 */
const CAP = 600

import { hskLevelLabel } from '~/lib/hsk-levels'

function levelTint(level) {
  return `var(--hsk-${level})`
}

export default function MapSection({
  level,
  status,
  error,
  words, // already filtered for the active view
  totalInLevel, // unfiltered count, for the header stat
  knownInLevel,
  known,
  colorBy,
  wid,
  knownLabel,
  onSelect,
  onToggleKnown,
  onRetry,
  t,
}) {
  const [expanded, setExpanded] = useState(false)

  const shown = useMemo(() => {
    if (expanded || words.length <= CAP) return words
    return words.slice(0, CAP)
  }, [expanded, words])

  const hidden = words.length - shown.length
  const tint = levelTint(level)

  const pct = totalInLevel > 0 ? Math.round((knownInLevel / totalInLevel) * 100) : 0

  return (
    <section className="wmap-section" aria-label={`HSK ${hskLevelLabel(level)}`}>
      <header className="wmap-section__head" style={{ '--sec-tint': tint }}>
        <span className={`word-row__tag word-row__tag--hsk${level} wmap-section__tag`}>
          HSK {hskLevelLabel(level)}
        </span>
        <div className="wmap-section__meta">
          <span className="wmap-section__count u-mono">
            {knownInLevel}/{totalInLevel}
          </span>
          <span className="wmap-section__bar" aria-hidden>
            <span className="wmap-section__bar-fill" style={{ width: `${pct}%` }} />
          </span>
          <span className="wmap-section__pct u-mono">{pct}%</span>
        </div>
      </header>

      {status === 'loading' && (
        <div className="wmap-section__status">
          <Spinner />
        </div>
      )}

      {status === 'error' && (
        <div className="wmap-section__status">
          <span>{error || t('wmapLoadError', 'Could not load words')}</span>
          <Button size="sm" variant="soft" onClick={onRetry}>
            {t('wmapRetry', 'Retry')}
          </Button>
        </div>
      )}

      {status === 'ready' && words.length === 0 && (
        <p className="wmap-section__empty">
          {t('wmapSectionEmpty', 'No words match here.')}
        </p>
      )}

      {status === 'ready' && shown.length > 0 && (
        <>
          <div className="wmap-grid">
            {shown.map((w) => {
              const id = wid(w)
              const isKnown = !!known[id]
              return (
                <MapTile
                  key={id}
                  word={w}
                  tint={tint}
                  known={isKnown}
                  colorBy={colorBy}
                  label={`${w.simplified} · ${w.pinyin}${isKnown ? ` · ${knownLabel}` : ''}`}
                  onSelect={onSelect}
                  onLongPress={onToggleKnown}
                />
              )
            })}
          </div>
          {hidden > 0 && (
            <div className="wmap-section__expand">
              <Button size="sm" variant="ghost" onClick={() => setExpanded(true)}>
                {t('wmapShowAll', 'Show all')} {words.length}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
