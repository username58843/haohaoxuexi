import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import AppShell from '~/components/AppShell'
import WordSheet from '~/components/WordSheet'
import WordRow from '~/components/hsk/WordRow'
import AddToDeck from '~/components/hsk/AddToDeck'
import { readKnown, writeKnown, migrateLegacyLevel } from '~/components/hsk/known-store'
import {
  Button,
  Field,
  Segmented,
  Chip,
  EmptyState,
  Spinner,
  PageLoader,
} from '~/components/ui'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { api, apiError } from '~/lib/api-client'
import { makeWordId } from '~/lib/words-shared'

const LEVELS = [1, 2, 3, 4, 5, 6]
const CHUNK = 60

const wid = (word) => (word && word.id) || makeWordId(word)

function CheckIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4.5 12.5l5 5L19.5 6.8" />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

/** Auth-gated HSK lexicon browser: level filter, search, known map, decks. */
export default function HskPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { t } = useSettings()

  const [level, setLevel] = useState('all') // 'all' | '1'..'6'
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('') // debounced
  const [hideKnown, setHideKnown] = useState(false)
  const [known, setKnown] = useState({})
  const [packs, setPacks] = useState({}) // { [level]: { status, words, error } }
  const [visible, setVisible] = useState(CHUNK)
  const [search, setSearch] = useState({
    status: 'idle', // idle | loading | more | ready | error
    items: [],
    total: 0,
    page: 1,
    pages: 1,
    error: '',
  })
  const [sheetWord, setSheetWord] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const inflightRef = useRef(new Set())
  const searchReqRef = useRef(0)
  const sentinelRef = useRef(null)

  const levelNum = level === 'all' ? null : Number(level)
  const searching = query.length > 0

  useEffect(() => {
    if (!loading && !user) router.replace('/auth')
  }, [loading, user, router])

  // Hydrate the known-words map (client only).
  useEffect(() => {
    setKnown(readKnown())
  }, [])

  // Debounce the search input (250ms).
  useEffect(() => {
    const id = setTimeout(() => setQuery(queryInput.trim().slice(0, 100)), 250)
    return () => clearTimeout(id)
  }, [queryInput])

  // Reset chunked rendering when the view changes.
  useEffect(() => {
    setVisible(CHUNK)
  }, [level, hideKnown, query])

  const fetchPack = useCallback(async (lvl) => {
    if (inflightRef.current.has(lvl)) return
    inflightRef.current.add(lvl)
    setPacks((prev) => ({ ...prev, [lvl]: { status: 'loading', words: [], error: '' } }))
    try {
      const { data } = await api.get('/words', { params: { pack: `hsk${lvl}` } })
      const words = Array.isArray(data?.items) ? data.items : []
      setPacks((prev) => ({ ...prev, [lvl]: { status: 'ready', words, error: '' } }))

      // One-time legacy known-map migration for this level.
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

  // Make sure the pack(s) for the current browse view are (being) loaded.
  useEffect(() => {
    if (!user || searching) return
    const wanted = levelNum || 1 // 'All' starts with HSK 1; deeper levels load on scroll
    if (!packs[wanted]) fetchPack(wanted)
  }, [user, searching, levelNum, packs, fetchPack])

  const runSearch = useCallback(
    async (page, append) => {
      const reqId = ++searchReqRef.current
      setSearch((prev) => ({
        ...prev,
        status: append ? 'more' : 'loading',
        error: '',
        ...(append ? {} : { items: [], total: 0, page: 1, pages: 1 }),
      }))
      try {
        const params = { q: query, page, limit: CHUNK }
        if (levelNum) params.level = levelNum
        const { data } = await api.get('/words/search', { params })
        if (searchReqRef.current !== reqId) return
        setSearch((prev) => ({
          status: 'ready',
          items: append ? [...prev.items, ...(data.items || [])] : data.items || [],
          total: Number(data.total) || 0,
          page: Number(data.page) || page,
          pages: Number(data.pages) || 1,
          error: '',
        }))
      } catch (err) {
        if (searchReqRef.current !== reqId) return
        setSearch((prev) => ({ ...prev, status: 'error', error: apiError(err).message }))
      }
    },
    [query, levelNum]
  )

  useEffect(() => {
    if (!user) return
    if (!query) {
      searchReqRef.current += 1
      setSearch({ status: 'idle', items: [], total: 0, page: 1, pages: 1, error: '' })
      return
    }
    runSearch(1, false)
  }, [user, query, runSearch])

  // ----- Derived browse data ---------------------------------------------
  const sections = useMemo(() => {
    const lvls = levelNum ? [levelNum] : LEVELS
    return lvls.map((lvl) => {
      const pack = packs[lvl]
      const words = pack?.words || []
      const rows = hideKnown ? words.filter((w) => !known[wid(w)]) : words
      let knownCount = 0
      for (const w of words) if (known[wid(w)]) knownCount += 1
      return {
        level: lvl,
        status: pack?.status || 'idle',
        error: pack?.error || '',
        words,
        rows,
        knownCount,
      }
    })
  }, [levelNum, packs, hideKnown, known])

  const totalWords = sections.reduce((n, s) => n + s.words.length, 0)
  const totalKnown = sections.reduce((n, s) => n + s.knownCount, 0)
  const totalRows = sections.reduce((n, s) => n + s.rows.length, 0)
  const anyLoading = sections.some((s) => s.status === 'loading')
  const nextIdleLevel = levelNum
    ? null
    : (sections.find((s) => s.status === 'idle') || {}).level ?? null

  const searchKnownCount = searching
    ? search.items.reduce((n, w) => n + (known[wid(w)] ? 1 : 0), 0)
    : 0

  const showMoreArea = searching
    ? search.status === 'more' || (search.status === 'ready' && search.page < search.pages)
    : visible < totalRows || nextIdleLevel != null
  const moreLoading = searching ? search.status === 'more' : anyLoading

  const loadMore = useCallback(() => {
    if (searching) {
      if (search.status === 'ready' && search.page < search.pages) {
        runSearch(search.page + 1, true)
      }
      return
    }
    if (visible < totalRows) {
      setVisible((v) => v + CHUNK)
      return
    }
    if (nextIdleLevel != null && !anyLoading) fetchPack(nextIdleLevel)
  }, [
    searching,
    search.status,
    search.page,
    search.pages,
    runSearch,
    visible,
    totalRows,
    nextIdleLevel,
    anyLoading,
    fetchPack,
  ])

  // Infinite scroll sentinel (the "Load more" button doubles as a fallback).
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore()
      },
      { rootMargin: '400px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [loadMore, showMoreArea])

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

  const levelOptions = [
    { value: 'all', label: t('hskAll', 'All') },
    ...LEVELS.map((lvl) => ({ value: String(lvl), label: String(lvl) })),
  ]

  const knownLabel = t('hskKnown', 'Known')
  const sheetIsKnown = sheetWord ? !!known[wid(sheetWord)] : false

  let statsLine = null
  if (searching) {
    if (search.status === 'ready' || search.status === 'more') {
      statsLine = `${search.total} ${t('hskStatResults', 'results')} · ${searchKnownCount} ${t(
        'hskStatKnown',
        'known'
      )}`
    }
  } else if (totalWords > 0) {
    statsLine = `${totalWords} ${t('hskStatWords', 'words')} · ${totalKnown} ${t(
      'hskStatKnown',
      'known'
    )}`
  }

  const renderBrowse = () => {
    const out = []
    let budget = visible
    const single = levelNum != null

    for (const s of sections) {
      if (s.status === 'idle') break
      if (budget <= 0) break

      if (!single) {
        out.push(
          <div className="hsk-section" key={`head-${s.level}`}>
            <span className={`word-row__tag word-row__tag--hsk${s.level}`}>HSK {s.level}</span>
            {s.words.length > 0 && (
              <span className="hsk-section__count">
                {s.words.length} {t('hskStatWords', 'words')} · {s.knownCount}{' '}
                {t('hskStatKnown', 'known')}
              </span>
            )}
          </div>
        )
      }

      if (s.status === 'loading') {
        out.push(
          <div className="hsk__status" key={`loading-${s.level}`}>
            <Spinner />
          </div>
        )
        continue
      }

      if (s.status === 'error') {
        out.push(
          <div className="hsk__status" key={`error-${s.level}`}>
            <span>{s.error || t('hskLoadError', 'Could not load words')}</span>
            <Button size="sm" variant="soft" onClick={() => fetchPack(s.level)}>
              {t('hskRetry', 'Retry')}
            </Button>
          </div>
        )
        continue
      }

      // ready
      if (s.rows.length === 0) {
        if (single) {
          out.push(
            hideKnown && s.words.length > 0 ? (
              <EmptyState
                key="all-known"
                glyph="好"
                title={t('hskAllKnownTitle', 'Everything here is known')}
                text={t('hskAllKnownText', 'You have marked every word in this view as known.')}
                action={
                  <Button size="sm" variant="soft" onClick={() => setHideKnown(false)}>
                    {t('hskShowKnown', 'Show known words')}
                  </Button>
                }
              />
            ) : (
              <EmptyState key="empty" glyph="空" title={t('hskPackEmpty', 'Nothing here yet')} />
            )
          )
        } else if (hideKnown && s.words.length > 0) {
          out.push(
            <p className="hsk-section__done" key={`done-${s.level}`}>
              {t('hskLevelDone', 'All known — nice work')}
            </p>
          )
        }
        continue
      }

      const take = s.rows.slice(0, budget)
      budget -= take.length
      for (let i = 0; i < take.length; i += 1) {
        const w = take[i]
        const id = wid(w)
        out.push(
          <WordRow
            key={`${s.level}:${id}:${i}`}
            word={w}
            known={!!known[id]}
            onSelect={openWord}
            knownLabel={knownLabel}
          />
        )
      }
    }

    if (out.length === 0) {
      out.push(
        <div className="hsk__status" key="boot">
          <Spinner />
        </div>
      )
    }
    return out
  }

  const renderSearch = () => {
    if (search.status === 'loading') {
      return (
        <div className="hsk__status">
          <Spinner />
        </div>
      )
    }
    if (search.status === 'error') {
      return (
        <div className="hsk__status">
          <span>{search.error || t('hskLoadError', 'Could not load words')}</span>
          <Button size="sm" variant="soft" onClick={() => runSearch(1, false)}>
            {t('hskRetry', 'Retry')}
          </Button>
        </div>
      )
    }
    if (search.status === 'idle') return null

    if (search.items.length === 0) {
      return (
        <EmptyState
          glyph="无"
          title={t('hskEmptyTitle', 'No words found')}
          text={t('hskEmptyText', 'Try different characters, pinyin or an English meaning.')}
        />
      )
    }

    const rows = hideKnown ? search.items.filter((w) => !known[wid(w)]) : search.items
    if (rows.length === 0) {
      return (
        <EmptyState
          glyph="好"
          title={t('hskAllKnownTitle', 'Everything here is known')}
          action={
            <Button size="sm" variant="soft" onClick={() => setHideKnown(false)}>
              {t('hskShowKnown', 'Show known words')}
            </Button>
          }
        />
      )
    }

    return rows.map((w, i) => {
      const id = wid(w)
      return (
        <WordRow
          key={`s:${id}:${i}`}
          word={w}
          known={!!known[id]}
          onSelect={openWord}
          knownLabel={knownLabel}
        />
      )
    })
  }

  return (
    <AppShell>
      <Head>
        <title>HSK · 好好学习汉语</title>
      </Head>

      <div className="hsk">
        <div className="hsk__sticky">
          <div className="col-app">
            <div className="hsk__bar">
              <div className="hsk__levels">
                <Segmented
                  options={levelOptions}
                  value={level}
                  onChange={setLevel}
                  ariaLabel={t('hskLevelFilter', 'HSK level')}
                />
              </div>
              {!searching && totalWords > 0 && (
                <span
                  className="hsk__level-stat u-mono"
                  title={t('hskKnownOfTotal', 'Known / total words in view')}
                >
                  {totalKnown}/{totalWords}
                </span>
              )}
            </div>
            <div className="hsk__bar hsk__bar--tools">
              <Field
                className="hsk__search"
                type="search"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder={t('hskSearchPlaceholder', 'Search hanzi, pinyin or meaning…')}
                aria-label={t('hskSearchLabel', 'Search words')}
                maxLength={100}
                trailing={
                  queryInput ? (
                    <button
                      type="button"
                      className="field__trailing"
                      onClick={() => setQueryInput('')}
                      aria-label={t('hskClearSearch', 'Clear search')}
                    >
                      <ClearIcon />
                    </button>
                  ) : null
                }
              />
              <Chip active={hideKnown} onClick={() => setHideKnown((v) => !v)}>
                {t('hskHideKnown', 'Hide known')}
              </Chip>
            </div>
          </div>
        </div>

        <div className="col-app">
          {statsLine && <p className="hsk__stats">{statsLine}</p>}

          <div className="hsk__list">{searching ? renderSearch() : renderBrowse()}</div>

          {showMoreArea && (
            <div className="hsk__more" ref={sentinelRef}>
              <Button variant="soft" onClick={loadMore} loading={moreLoading}>
                {t('hskLoadMore', 'Load more')}
              </Button>
            </div>
          )}
        </div>

        <WordSheet
          word={sheetWord}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          actions={
            sheetWord && (
              <div className="hsk-sheet-actions">
                <Button
                  size="sm"
                  variant={sheetIsKnown ? 'primary' : 'soft'}
                  onClick={() => toggleKnown(sheetWord)}
                >
                  <CheckIcon /> {sheetIsKnown ? knownLabel : t('hskMarkKnown', 'Mark as known')}
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
