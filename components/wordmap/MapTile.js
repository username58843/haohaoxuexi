import React from 'react'

/**
 * One character tile on the vocabulary wall.
 *
 * Kept intentionally lean and memoized — thousands of these can be mounted at
 * once, so it renders a single <button> with the hanzi (serif) and no nested
 * layout. Coloring is driven by a CSS custom property (`--tile-tint`) set by the
 * parent grid so we never allocate per-tile inline style objects for the tint.
 */
function MapTile({ word, tint, known, colorBy, label, onSelect }) {
  const isKnownMode = colorBy === 'known'
  // Font size scales with word length (and tile size, via container queries):
  // 1-2 chars render in one row, 3 in a tighter row, 4 wrap into a 2×2 block.
  const chars = Array.from(word.simplified || '').length
  const sizeClass = chars <= 1 ? 'n1' : chars === 2 ? 'n2' : chars === 3 ? 'n3' : chars === 4 ? 'n4' : 'n5'
  const cls = [
    'wmap-tile',
    `wmap-tile--${sizeClass}`,
    known ? 'wmap-tile--known' : 'wmap-tile--unknown',
    isKnownMode ? 'wmap-tile--bwk' : 'wmap-tile--level',
  ].join(' ')

  return (
    <button
      type="button"
      className={cls}
      style={{ '--tile-tint': tint }}
      onClick={() => onSelect(word)}
      title={label}
      aria-label={label}
    >
      <span className="wmap-tile__hanzi hanzi" lang="zh">
        {word.simplified}
      </span>
      {known && (
        <span className="wmap-tile__check" aria-hidden>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 12.5l5 5L19.5 6.8" />
          </svg>
        </span>
      )}
    </button>
  )
}

export default React.memo(MapTile)
