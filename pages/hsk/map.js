import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import AppShell from '~/components/AppShell'
import WordSheet from '~/components/WordSheet'
import MapSection from '~/components/wordmap/MapSection'
import MapStats from '~/components/wordmap/MapStats'
import AddToDeck from '~/components/hsk/AddToDeck'
import { useKnownWords, migrateLegacyLevel } from '~/components/hsk/known-store'
import { Button, Field, Chip, Segmented, EmptyState, PageLoader } from '~/components/ui'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { api, apiError } from '~/lib/api-client'
import { makeWordId } from '~/lib/words-shared'
import { HSK_LEVELS as LEVELS, hskLevelLabel, hskPackId } from '~/lib/hsk-levels'

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

/**
 * Normalize a string for search matching: lowercase only. Tone marks are
 * preserved on purpose — the /hsk server search (lib/server/words.js) is
 * equally tone-sensitive, so the two views stay consistent.
 */
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

  const [level, setLevel] = useState('all') // 'all' | '1'..'7' (7 = band 7-9)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [hideKnown, setHideKnown] = useState(false)
  const [colorBy, setColorBy] = useState('level') // 'level' | 'known'
  // The SAME known-words store the /hsk list view uses — localStorage-cached
  // and synced with the account (GET/PUT /words/known) so web and Android see
  // the same set. readKnown() returns {} on the server, and the page renders
  // <PageLoader/> until auth resolves, so server/client first paints match.
  const { known, toggleKnown: toggleKnownId, addKnownIds } = useKnownWords(user)
  const [packs, setPacks] = useState({}) // { [level]: { status, words, error } }
  const [sheetWord, setSheetWord] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const inflightRef = useRef(new Set())
  const sentinelRef = useRef(null)
  const wmapRef = useRef(null)
  const stickyHeadRef = useRef(null)

  const levelNum = level === 'all' ? null : Number(level)

  useEffect(() => {
    if (!loading && !user) router.replace('/auth')
  }, [loading, user, router])

  // Debounce search (200ms).
  useEffect(() => {
    const id = setTimeout(() => setQuery(norm(queryInput.trim()).slice(0, 100)), 200)
    return () => clearTimeout(id)
  }, [queryInput])

  // All state updates happen inside .then/.catch so effect-triggered calls
  // never set state synchronously (react-hooks/set-state-in-effect). The
  // 'loading' record lands via a microtask, which always resolves before the
  // network response, so ready/error can never be overwritten by it.
  const fetchPack = useCallback((lvl) => {
    if (inflightRef.current.has(lvl)) return
    inflightRef.current.add(lvl)
    Promise.resolve().then(() => {
      setPacks((prev) =>
        prev[lvl]?.status === 'ready'
          ? prev
          : { ...prev, [lvl]: { status: 'loading', words: [], error: '' } }
      )
    })
    api
      .get('/words', { params: { pack: hskPackId(lvl) } })
      .then(({ data }) => {
        const words = Array.isArray(data?.items) ? data.items : []
        setPacks((prev) => ({ ...prev, [lvl]: { status: 'ready', words, error: '' } }))

        // Keep known-map migration behavior identical to the list view
        // (the merged ids are also pushed to the account via the store).
        const migratedIds = migrateLegacyLevel(lvl, words)
        if (migratedIds && migratedIds.length > 0) addKnownIds(migratedIds)
      })
      .catch((err) => {
        const e = apiError(err)
        setPacks((prev) => ({ ...prev, [lvl]: { status: 'error', words: [], error: e.message } }))
      })
      .finally(() => {
        inflightRef.current.delete(lvl)
      })
  }, [addKnownIds])

  // Ensure the pack(s) needed for the active view are loading.
  useEffect(() => {
    if (!user) return
    if (levelNum) {
      if (!packs[levelNum]) fetchPack(levelNum)
    } else if (!packs[1]) {
      fetchPack(1) // "All" starts with HSK 1; deeper levels load on scroll
    }
  }, [user, levelNum, packs, fetchPack])

  // While searching in "All" mode, pull in every remaining level so the search
  // covers the whole lexicon (the packs are small and would load on scroll
  // anyway) instead of silently skipping levels that were never fetched.
  useEffect(() => {
    if (!user || !query || levelNum) return
    for (const lvl of LEVELS) {
      const st = packs[lvl]?.status
      if (!st || st === 'idle') fetchPack(lvl)
    }
  }, [user, query, levelNum, packs, fetchPack])

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

  // Progressive load-on-scroll sentinel. `sentinelVisible` mirrors the JSX
  // render condition for the sentinel node: it must be a dependency so the
  // observer re-binds when the node unmounts/remounts (e.g. after a search
  // round-trip) instead of watching a detached element forever.
  const sentinelVisible = !query && nextIdleLevel != null
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
  }, [loadNext, sentinelVisible])

  // The level headers stick right below the control header, whose real height
  // varies (rows wrap at intermediate widths and with longer locale strings).
  // Measure it into a CSS var consumed by .wmap-section__head instead of
  // trusting hardcoded offsets. Depends on [loading, user] because the refs
  // only exist once the authed UI has replaced the boot <PageLoader/>.
  useEffect(() => {
    const root = wmapRef.current
    const head = stickyHeadRef.current
    if (!root || !head || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => {
      root.style.setProperty('--wmap-head-h', `${head.offsetHeight}px`)
    })
    ro.observe(head) // fires once on observe, so the var is set immediately
    return () => ro.disconnect()
  }, [loading, user])

  // ----- Derived per-level data (filter + stats) -------------------------
  // Precomputed searchable text per word id — the same fields the /hsk server
  // search covers (lib/server/words.js): hanzi (simplified + traditional),
  // pinyin as written AND with whitespace stripped (so "nǐhǎo" finds "nǐ hǎo"),
  // definitions, and EN + RU translations. One includes() per word beats the
  // old multi-branch loop over ~5000 words on every keystroke.
  const searchHay = useMemo(() => {
    const map = new Map()
    for (const lvl of LEVELS) {
      const words = packs[lvl]?.words || []
      for (const w of words) {
        const tr = w.translations || {}
        const hay = [
          w.simplified,
          w.traditional,
          w.pinyin,
          String(w.pinyin || '').replace(/\s+/g, ''),
          ...(w.definitions || []),
          ...(tr.en || []),
          ...(tr.ru || []),
          ...(tr.tk || []),
        ]
          .filter(Boolean)
          .join('\n')
        map.set(wid(w), norm(hay))
      }
    }
    return map
  }, [packs])

  const matches = useCallback(
    (w) => !query || (searchHay.get(wid(w)) || '').includes(query),
    [query, searchHay]
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
  const toggleKnown = useCallback(
    (word) => {
      const id = wid(word)
      if (id) toggleKnownId(id)
    },
    [toggleKnownId]
  )

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

      <div className="wmap" ref={wmapRef}>
        <div className="wmap__sticky" ref={stickyHeadRef}>
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
                    {hskLevelLabel(lvl)}
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

          <p className="wmap__hint">
            {t(
              'wmapHoldHint',
              'Tip: press and hold a tile to mark the word as known — hold it again to unmark.'
            )}
          </p>

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
          ) : nothingLoadedYet ? (
            <div className="wmap__boot">
              <PageLoader />
            </div>
          ) : (
            <div className="wmap__wall">
              {/* Idle levels stay hidden (the legend + load button already
                  represent them) so the boot screen isn't a wall of 0/0 rows. */}
              {sections.filter((s) => s.status !== 'idle').map((s) => (
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
                  onToggleKnown={toggleKnown}
                  onRetry={() => fetchPack(s.level)}
                  t={t}
                />
              ))}
            </div>
          )}

          {/* Progressive-load sentinel + fallback button ("All" view only).
              The button hides while a level is loading — its label names the
              NEXT idle level, so a spinner on it would point at the wrong
              level (the loading section already shows its own spinner). */}
          {sentinelVisible && (
            <div className="wmap__more" ref={sentinelRef}>
              {!anyLoading && (
                <Button variant="soft" onClick={loadNext}>
                  {t('wmapLoadLevel', 'Load HSK')} {hskLevelLabel(nextIdleLevel)}
                </Button>
              )}
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
                <AddToDeck word={sheetWord} />
              </div>
            )
          }
        />
      </div>
    </AppShell>
  )
}
