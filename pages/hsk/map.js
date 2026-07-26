import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import AppShell from '~/components/AppShell'
import WordSheet from '~/components/WordSheet'
import MapSection from '~/components/wordmap/MapSection'
import MapStats from '~/components/wordmap/MapStats'
import { readKnown, writeKnown, migrateLegacyLevel } from '~/components/hsk/known-store'
import { Button, Field, Chip, Segmented, EmptyState, PageLoader } from '~/components/ui'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { api, apiError } from '~/lib/api-client'
import { makeWordId } from '~/lib/words-shared'

const LEVELS = [1, 2, 3, 4, 5, 6]

const wid = (word) => (word && word.id) || makeWordId(word)

function BackIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4.5 12.5l5 5L19.5 6.8" />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

/** Normalize a string for accent-insensitive-ish pinyin/meaning search. */
function norm(s) {
  return String(s || '').toLowerCase()
}

/**
 * Interactive HSK vocabulary MAP — the whole HSK 1–6 lexicon rendered as a wall
 * of hanzi tiles, colored by level, with a live known/total progress overlay.
 *
 * Loading: HSK 1 paints immediately; the remaining levels are pulled
 * progressively (an IntersectionObserver sentinel near the page bottom kicks off
 * the next idle level, and switching the level filter fetches on demand).
 *
 * Rendering: each level owns its own capped grid (see MapSection) so ~5000 nodes
 * never hit the DOM in one synchronous frame.
 */
export default function HskMapPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { t } = useSettings()

  const [level, setLevel] = useState('all') // 'all' | '1'..'6'
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [hideKnown, setHideKnown] = useState(false)
  const [colorBy, setColorBy] = useState('level') // 'level' | 'known'
  const [known, setKnown] = useState({})
  const [packs, setPacks] = useState({}) // { [level]: { status, words, error } }
  const [sheetWord, setSheetWord] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const inflightRef = useRef(new Set())
  const sentinelRef = useRef(null)

  const levelNum = level === 'all' ? null : Number(level)

  useEffect(() => {
    if (!loading && !user) router.replace('/auth')
  }, [loading, user, router])

  // Hydrate the SAME known-words map the /hsk list view uses.
  useEffect(() => {
    setKnown(readKnown())
  }, [])

  // Debounce search (200ms).
  useEffect(() => {
    const id = setTimeout(() => setQuery(norm(queryInput.trim()).slice(0, 100)), 200)
    return () => clearTimeout(id)
  }, [queryInput])

  const fetchPack = useCallback(async (lvl) => {
    if (inflightRef.current.has(lvl)) return
    inflightRef.current.add(lvl)
    setPacks((prev) => ({ ...prev, [lvl]: { status: 'loading', words: [], error: '' } }))
    try {
      const { data } = await api.get('/words', { params: { pack: `hsk${lvl}` } })
      const words = Array.isArray(data?.items) ? data.items : []
      setPacks((prev) => ({ ...prev, [lvl]: { status: 'ready', words, error: '' } }))

      // Keep known-map migration behavior identical to the list view.
      const migratedIds = migrateLegacyLevel(lvl, words)
      if (migratedIds && migratedIds.length > 0) {
        setKnown((prev) => {
          const next = { ...prev }
          for (const id of migratedIds) next[id] = true
          writeKnown(next)
          return next
        })
      }
    } catch (err) {
      const e = apiError(err)
      setPacks((prev) => ({ ...prev, [lvl]: { status: 'error', words: [], error: e.message } }))
    } finally {
      inflightRef.current.delete(lvl)
    }
  }, [])

  // Ensure the pack(s) needed for the active view are loading.
  useEffect(() => {
    if (!user) return
    if (levelNum) {
      if (!packs[levelNum]) fetchPack(levelNum)
    } else if (!packs[1]) {
      fetchPack(1) // "All" starts with HSK 1; deeper levels load on scroll
    }
  }, [user, levelNum, packs, fetchPack])

  // The levels currently in view (stable per levelNum).
  const activeLevels = useMemo(() => (levelNum ? [levelNum] : LEVELS), [levelNum])

  // Next not-yet-fetched level (for the progressive-scroll sentinel, "All" only).
  const nextIdleLevel = useMemo(() => {
    if (levelNum) return null
    for (const lvl of LEVELS) {
      const st = packs[lvl]?.status
      if (!st || st === 'idle') return lvl
    }
    return null
  }, [levelNum, packs])

  const anyLoading = activeLevels.some((lvl) => packs[lvl]?.status === 'loading')

  const loadNext = useCallback(() => {
    if (nextIdleLevel != null && !inflightRef.current.has(nextIdleLevel)) {
      fetchPack(nextIdleLevel)
    }
  }, [nextIdleLevel, fetchPack])

  // Progressive load-on-scroll sentinel.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadNext()
      },
      { rootMargin: '500px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [loadNext])

  // ----- Derived per-level data (filter + stats) -------------------------
  const matches = useCallback(
    (w) => {
      if (!query) return true
      if (norm(w.simplified).includes(query)) return true
      if (norm(w.pinyin).includes(query)) return true
      const defs = w.definitions || []
      for (const d of defs) if (norm(d).includes(query)) return true
      const en = (w.translations && w.translations.en) || []
      for (const d of en) if (norm(d).includes(query)) return true
      return false
    },
    [query]
  )

  const sections = useMemo(() => {
    return activeLevels.map((lvl) => {
      const pack = packs[lvl]
      const words = pack?.words || []
      let knownInLevel = 0
      for (const w of words) if (known[wid(w)]) knownInLevel += 1

      let filtered = words
      if (query) filtered = filtered.filter(matches)
      if (hideKnown) filtered = filtered.filter((w) => !known[wid(w)])

      return {
        level: lvl,
        status: pack?.status || 'idle',
        error: pack?.error || '',
        words: filtered,
        totalInLevel: words.length,
        knownInLevel,
      }
    })
  }, [activeLevels, packs, known, query, hideKnown, matches])

  // Stats across ALL loaded levels (not just the filtered view), so the header
  // reflects true mastery. Levels not yet fetched simply read 0/0.
  const levelStats = useMemo(() => {
    const out = {}
    for (const lvl of LEVELS) {
      const words = packs[lvl]?.words || []
      let k = 0
      for (const w of words) if (known[wid(w)]) k += 1
      out[lvl] = { total: words.length, known: k }
    }
    return out
  }, [packs, known])

  const totalWords = LEVELS.reduce((n, l) => n + levelStats[l].total, 0)
  const totalKnown = LEVELS.reduce((n, l) => n + levelStats[l].known, 0)
  const visibleMatches = sections.reduce((n, s) => n + s.words.length, 0)

  // ----- Actions ----------------------------------------------------------
  const toggleKnown = useCallback((word) => {
    const id = wid(word)
    if (!id) return
    setKnown((prev) => {
      const next = { ...prev }
      if (next[id]) delete next[id]
      else next[id] = true
      writeKnown(next)
      return next
    })
  }, [])

  const openWord = useCallback((word) => {
    setSheetWord(word)
    setSheetOpen(true)
  }, [])

  if (loading || !user) {
    return (
      <AppShell>
        <PageLoader />
      </AppShell>
    )
  }

  const colorOptions = [
    { value: 'level', label: t('wmapColorLevel', 'Level') },
    { value: 'known', label: t('wmapColorKnown', 'Known') },
  ]

  const knownLabel = t('wmapKnown', 'Known')
  const sheetIsKnown = sheetWord ? !!known[wid(sheetWord)] : false

  // Every active section still idle/loading with nothing on screen → boot state.
  const nothingLoadedYet = sections.every(
    (s) => s.status === 'idle' || (s.status === 'loading' && s.words.length === 0)
  )
  const noSearchHits =
    !!query &&
    sections.every((s) => s.status === 'ready') &&
    visibleMatches === 0

  return (
    <AppShell>
      <Head>
        <title>{t('wmapTitle', 'Word Map')} · 好好学习汉语</title>
      </Head>

      <div className="wmap">
        <div className="wmap__sticky">
          <div className="col-wide">
            <div className="wmap__topline">
              <Button href="/hsk" size="sm" variant="ghost" className="wmap__back">
                <BackIcon /> {t('wmapBackToList', 'List view')}
              </Button>
              <h1 className="wmap__heading">
                <span className="hanzi" lang="zh">汉字</span> {t('wmapTitle', 'Word Map')}
              </h1>
            </div>

            <div className="wmap__bar">
              <div className="wmap__chips" role="group" aria-label={t('wmapLevelFilter', 'HSK level')}>
                <Chip active={level === 'all'} onClick={() => setLevel('all')}>
                  {t('wmapAll', 'All')}
                </Chip>
                {LEVELS.map((lvl) => (
                  <Chip
                    key={lvl}
                    active={level === String(lvl)}
                    onClick={() => setLevel(String(lvl))}
                    className={`wmap__chip wmap__chip--hsk${lvl}`}
                  >
                    {lvl}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="wmap__bar wmap__bar--tools">
              <Field
                className="wmap__search"
                type="search"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder={t('wmapSearchPlaceholder', 'Search hanzi, pinyin or meaning…')}
                aria-label={t('wmapSearchLabel', 'Search words')}
                maxLength={100}
                trailing={
                  queryInput ? (
                    <button
                      type="button"
                      className="field__trailing"
                      onClick={() => setQueryInput('')}
                      aria-label={t('wmapClearSearch', 'Clear search')}
                    >
                      <ClearIcon />
                    </button>
                  ) : null
                }
              />
              <div className="wmap__toggles">
                <span className="wmap__toggle-label u-mono">{t('wmapColorBy', 'Color by')}</span>
                <Segmented
                  options={colorOptions}
                  value={colorBy}
                  onChange={setColorBy}
                  ariaLabel={t('wmapColorBy', 'Color by')}
                />
                <Chip active={hideKnown} onClick={() => setHideKnown((v) => !v)}>
                  {t('wmapHideKnown', 'Hide known')}
                </Chip>
              </div>
            </div>
          </div>
        </div>

        <div className="col-wide">
          <MapStats
            levelStats={levelStats}
            totalWords={totalWords}
            totalKnown={totalKnown}
            t={t}
          />

          {noSearchHits ? (
            <EmptyState
              glyph="无"
              title={t('wmapNoHitsTitle', 'No words found')}
              text={t('wmapNoHitsText', 'Try different characters, pinyin or an English meaning.')}
              action={
                <Button size="sm" variant="soft" onClick={() => setQueryInput('')}>
                  {t('wmapClearSearch', 'Clear search')}
                </Button>
              }
            />
          ) : (
            <div className={`wmap__wall${colorBy === 'known' ? ' wmap__wall--bwk' : ''}`}>
              {sections.map((s) => (
                <MapSection
                  key={s.level}
                  level={s.level}
                  status={s.status}
                  error={s.error}
                  words={s.words}
                  totalInLevel={s.totalInLevel}
                  knownInLevel={s.knownInLevel}
                  known={known}
                  colorBy={colorBy}
                  wid={wid}
                  knownLabel={knownLabel}
                  onSelect={openWord}
                  onRetry={() => fetchPack(s.level)}
                  t={t}
                />
              ))}
            </div>
          )}

          {/* Progressive-load sentinel + fallback button ("All" view only). */}
          {!query && nextIdleLevel != null && (
            <div className="wmap__more" ref={sentinelRef}>
              <Button variant="soft" onClick={loadNext} loading={anyLoading}>
                {t('wmapLoadLevel', 'Load HSK')} {nextIdleLevel}
              </Button>
            </div>
          )}

          {nothingLoadedYet && !noSearchHits && (
            <div className="wmap__boot">
              <PageLoader />
            </div>
          )}
        </div>

        <WordSheet
          word={sheetWord}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          actions={
            sheetWord && (
              <div className="wmap-sheet-actions">
                <Button
                  size="sm"
                  variant={sheetIsKnown ? 'primary' : 'soft'}
                  onClick={() => toggleKnown(sheetWord)}
                >
                  <CheckIcon /> {sheetIsKnown ? knownLabel : t('wmapMarkKnown', 'Mark as known')}
                </Button>
              </div>
            )
          }
        />
      </div>
    </AppShell>
  )
}
