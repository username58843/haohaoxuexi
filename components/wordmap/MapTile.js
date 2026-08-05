import React, { useCallback, useEffect, useRef, useState } from 'react'

/**
 * One character tile on the vocabulary wall.
 *
 * Kept intentionally lean and memoized — thousands of these can be mounted at
 * once, so it renders a single <button> with the hanzi (serif) and no nested
 * layout. Coloring is driven by a CSS custom property (`--tile-tint`) set by the
 * parent grid so we never allocate per-tile inline style objects for the tint.
 *
 * Interaction:
 *  - tap / click        → open the word sheet
 *  - press and hold     → toggle known ⇄ unknown right on the wall
 *  - Shift+Enter / Space with Shift, or the context menu key → same toggle
 *    (keyboard equivalent of the hold)
 *
 * The hold shows a filling progress bar so it is obvious how long to keep the
 * button down, cancels if the pointer drifts or leaves, and swallows the click
 * that a mouse-up would otherwise deliver (so holding never also opens the
 * sheet). On touch devices it also suppresses the native long-press context
 * menu / text selection.
 */

export const LONG_PRESS_MS = 420
const MOVE_TOLERANCE = 10 // px of drift allowed before the hold is abandoned

function MapTile({ word, tint, known, colorBy, label, onSelect, onLongPress }) {
  const isKnownMode = colorBy === 'known'
  // Font size scales with word length (and tile size, via container queries):
  // 1-2 chars render in one row, 3 in a tighter row, 4 wrap into a 2×2 block.
  const chars = Array.from(word.simplified || '').length
  const sizeClass = chars <= 1 ? 'n1' : chars === 2 ? 'n2' : chars === 3 ? 'n3' : chars === 4 ? 'n4' : 'n5'

  const [holding, setHolding] = useState(false)
  const [flash, setFlash] = useState('') // 'on' | 'off' — post-toggle pulse
  const timerRef = useRef(null)
  const flashRef = useRef(null)
  const originRef = useRef(null)
  const firedRef = useRef(false)

  useEffect(
    () => () => {
      clearTimeout(timerRef.current)
      clearTimeout(flashRef.current)
    },
    []
  )

  const cancelHold = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = null
    originRef.current = null
    setHolding(false)
  }, [])

  const fire = useCallback(() => {
    firedRef.current = true
    setFlash(known ? 'off' : 'on')
    clearTimeout(flashRef.current)
    flashRef.current = setTimeout(() => setFlash(''), 420)
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(known ? [10, 40, 10] : 18)
    }
    onLongPress(word)
  }, [known, onLongPress, word])

  const startHold = useCallback(
    (event) => {
      if (!onLongPress) return
      if (event.type === 'mousedown' && event.button !== 0) return
      const point = event.touches ? event.touches[0] : event
      originRef.current = { x: point.clientX, y: point.clientY }
      firedRef.current = false
      setHolding(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        setHolding(false)
        fire()
      }, LONG_PRESS_MS)
    },
    [fire, onLongPress]
  )

  const trackMove = useCallback(
    (event) => {
      if (!timerRef.current || !originRef.current) return
      const point = event.touches ? event.touches[0] : event
      const dx = Math.abs(point.clientX - originRef.current.x)
      const dy = Math.abs(point.clientY - originRef.current.y)
      if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) cancelHold()
    },
    [cancelHold]
  )

  const handleClick = useCallback(() => {
    // A completed hold already did its job — don't also open the sheet.
    if (firedRef.current) {
      firedRef.current = false
      return
    }
    onSelect(word)
  }, [onSelect, word])

  const handleKeyDown = useCallback(
    (event) => {
      if (!onLongPress) return
      // Keyboard equivalent of the hold: Shift + Enter/Space, or the menu key.
      if ((event.shiftKey && (event.key === 'Enter' || event.key === ' ')) || event.key === 'ContextMenu') {
        event.preventDefault()
        fire()
        firedRef.current = false
      }
    },
    [fire, onLongPress]
  )

  const handleContextMenu = useCallback((event) => {
    // Suppress the native menu right after a hold so mobile Chrome/Safari don't
    // cover the tile the user just marked.
    if (firedRef.current || timerRef.current) event.preventDefault()
  }, [])

  const cls = [
    'wmap-tile',
    `wmap-tile--${sizeClass}`,
    known ? 'wmap-tile--known' : 'wmap-tile--unknown',
    isKnownMode ? 'wmap-tile--bwk' : 'wmap-tile--level',
    holding ? 'is-holding' : '',
    flash ? `is-flash-${flash}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={cls}
      style={{ '--tile-tint': tint, '--hold-ms': `${LONG_PRESS_MS}ms` }}
      onClick={handleClick}
      onMouseDown={startHold}
      onMouseMove={trackMove}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={startHold}
      onTouchMove={trackMove}
      onTouchEnd={cancelHold}
      onTouchCancel={cancelHold}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      onDragStart={cancelHold}
      title={label}
      aria-label={label}
      aria-pressed={known}
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
      {holding && <span className="wmap-tile__hold" aria-hidden />}
    </button>
  )
}

export default React.memo(MapTile)
