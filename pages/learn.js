import React, { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import AppShell from '~/components/AppShell'
import { Button, Card, Chip, EmptyState, PageLoader, Segmented } from '~/components/ui'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { api, apiError } from '~/lib/api-client'
import { ALL_QMODES, QmodeLabel } from '~/components/learn/session-utils'

const CONFIG_KEY = 'xue_learn_config_v2'
const REVIEW_LIMITS = [10, 20, 40]
const QUIZ_COUNTS = [10, 20, 40, 0]

function readConfig() {
  if (typeof window === 'undefined') return null
  try {
    const raw = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null')
    return raw && typeof raw === 'object' ? raw : null
  } catch {
    return null
  }
}

function writeConfig(cfg) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
  } catch {
    /* private mode — session still starts */
  }
}

function reviewUrl(review) {
  const params = new URLSearchParams()
  params.set('mode', 'review')
  const packs = Array.isArray(review?.packs) ? review.packs.filter(Boolean) : []
  if (packs.length) params.set('packs', packs.join(','))
  params.set('limit', String(REVIEW_LIMITS.includes(review?.limit) ? review.limit : 20))
  return `/learn/session?${params.toString()}`
}

function quizUrl(quiz) {
  const params = new URLSearchParams()
  params.set('mode', 'quiz')
  params.set('sources', (Array.isArray(quiz?.sources) ? quiz.sources : []).filter(Boolean).join(','))
  params.set('count', String(QUIZ_COUNTS.includes(quiz?.count) ? quiz.count : 20))
  const modes = (Array.isArray(quiz?.qmodes) ? quiz.qmodes : []).filter((m) =>
    ALL_QMODES.includes(m)
  )
  params.set('qmodes', (modes.length ? modes : ['cp', 'ct']).join(','))
  return `/learn/session?${params.toString()}`
}

const toggleIn = (list, value) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

function ChipGroup({ label, children }) {
  return (
    <section className="learn-section">
      <span className="eyebrow">{label}</span>
      <div className="learn-chips">{children}</div>
    </section>
  )
}

function Chevron() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export default function LearnPage() {
  const { user, loading } = useAuth()
  const { t } = useSettings()
  const router = useRouter()

  const [tab, setTab] = useState('review')
  const [loadState, setLoadState] = useState('loading') // loading | error | ready
  const [loadErr, setLoadErr] = useState('')
  const [reloadNonce, setReloadNonce] = useState(0)
  const [packs, setPacks] = useState(null)
  const [decks, setDecks] = useState([])
  const [summary, setSummary] = useState(null)
  const [showTextbook, setShowTextbook] = useState(false)

  const [reviewPacks, setReviewPacks] = useState([])
  const [reviewLimit, setReviewLimit] = useState(20)
  const [quizSources, setQuizSources] = useState([])
  const [quizCount, setQuizCount] = useState(20)
  const [quizModes, setQuizModes] = useState(['cp', 'ct'])
  const [savedCfg, setSavedCfg] = useState(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/auth')
  }, [loading, user, router])

  // Hydrate the form from the last saved config. localStorage is unavailable
  // during SSR, so this runs on the client only — once, guarded by state,
  // using the documented "adjust state during render" pattern.
  const [cfgHydrated, setCfgHydrated] = useState(false)
  if (typeof window !== 'undefined' && !cfgHydrated) {
    setCfgHydrated(true)
    const cfg = readConfig()
    if (cfg) {
      setSavedCfg(cfg)
      if (cfg.mode === 'review' || cfg.mode === 'quiz') setTab(cfg.mode)
      if (cfg.review && typeof cfg.review === 'object') {
        if (Array.isArray(cfg.review.packs)) {
          setReviewPacks(cfg.review.packs.filter((p) => typeof p === 'string'))
        }
        if (REVIEW_LIMITS.includes(cfg.review.limit)) setReviewLimit(cfg.review.limit)
      }
      if (cfg.quiz && typeof cfg.quiz === 'object') {
        if (Array.isArray(cfg.quiz.sources)) {
          setQuizSources(cfg.quiz.sources.filter((s) => typeof s === 'string'))
        }
        if (QUIZ_COUNTS.includes(cfg.quiz.count)) setQuizCount(cfg.quiz.count)
        const modes = (Array.isArray(cfg.quiz.qmodes) ? cfg.quiz.qmodes : []).filter((m) =>
          ALL_QMODES.includes(m)
        )
        if (modes.length) setQuizModes(modes)
      }
    }
  }

  // ?mode=quiz deep link (used by the "all caught up" suggestion): adjust the
  // tab during render when the route-provided mode changes.
  const routeMode =
    router.isReady && (router.query.mode === 'quiz' || router.query.mode === 'review')
      ? router.query.mode
      : null
  const [prevRouteMode, setPrevRouteMode] = useState(null)
  if (routeMode !== prevRouteMode) {
    setPrevRouteMode(routeMode)
    if (routeMode) setTab(routeMode)
  }

  const userId = user?.id

  useEffect(() => {
    if (!userId) return undefined
    let cancelled = false
    const load = async () => {
      try {
        const tzOffset = -new Date().getTimezoneOffset()
        const [packsRes, summaryRes, decksRes] = await Promise.all([
          api.get('/words/packs'),
          api.get('/srs/summary', { params: { tzOffset } }),
          api.get('/decks'),
        ])
        if (cancelled) return
        const registry = Array.isArray(packsRes.data)
          ? packsRes.data
          : packsRes.data?.packs || []
        setPacks(registry)
        setSummary(summaryRes.data || {})
        const deckList = Array.isArray(decksRes.data?.decks) ? decksRes.data.decks : []
        setDecks(
          deckList.map((d) => ({
            id: String(d.id || d._id || ''),
            name: d.name || '',
            count: Array.isArray(d.words) ? d.words.length : d.wordCount || 0,
          }))
        )
        setLoadState('ready')
      } catch (err) {
        if (cancelled) return
        setLoadErr(apiError(err).message)
        setLoadState('error')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId, reloadNonce])

  // Drop selections that reference packs/decks that no longer exist.
  // Adjusted during render, guarded by a previous-value comparison.
  const [prunedFor, setPrunedFor] = useState(null)
  if (
    loadState === 'ready' &&
    packs &&
    (!prunedFor || prunedFor.packs !== packs || prunedFor.decks !== decks)
  ) {
    setPrunedFor({ packs, decks })
    const packIds = new Set(packs.map((p) => p.id))
    const deckIds = new Set(decks.map((d) => `deck:${d.id}`))
    setReviewPacks((prev) => {
      const next = prev.filter((id) => packIds.has(id))
      return next.length === prev.length ? prev : next
    })
    setQuizSources((prev) => {
      const next = prev.filter((s) => (s.startsWith('deck:') ? deckIds.has(s) : packIds.has(s)))
      return next.length === prev.length ? prev : next
    })
  }

  // Auto-expand the textbook group when a textbook pack is already selected.
  // Adjusted during render, guarded by a previous-value comparison.
  const [prevSelection, setPrevSelection] = useState(null)
  if (
    !prevSelection ||
    prevSelection.packs !== packs ||
    prevSelection.reviewPacks !== reviewPacks ||
    prevSelection.quizSources !== quizSources
  ) {
    setPrevSelection({ packs, reviewPacks, quizSources })
    if (packs) {
      const textbookIds = new Set(packs.filter((p) => p.group === 'textbook').map((p) => p.id))
      if (
        reviewPacks.some((id) => textbookIds.has(id)) ||
        quizSources.some((s) => textbookIds.has(s))
      ) {
        setShowTextbook(true)
      }
    }
  }

  const hskPacks = useMemo(() => (packs || []).filter((p) => p.group === 'hsk'), [packs])
  const textbookPacks = useMemo(
    () => (packs || []).filter((p) => p.group === 'textbook'),
    [packs]
  )

  const titleMap = useMemo(() => {
    const m = {}
    for (const p of packs || []) m[p.id] = p.title
    for (const d of decks) m[`deck:${d.id}`] = d.name
    return m
  }, [packs, decks])

  const dueCount = summary?.dueCount || 0
  const canStartReview = dueCount > 0 || reviewPacks.length > 0
  const canStartQuiz = quizSources.length > 0 && quizModes.length > 0

  const persist = (mode) => {
    const cfg = {
      mode,
      review: { packs: reviewPacks, limit: reviewLimit },
      quiz: { sources: quizSources, count: quizCount, qmodes: quizModes },
      savedAt: Date.now(),
    }
    writeConfig(cfg)
    setSavedCfg(cfg)
    return cfg
  }

  const startReview = () => {
    const cfg = persist('review')
    router.push(reviewUrl(cfg.review))
  }

  const startQuiz = () => {
    const cfg = persist('quiz')
    router.push(quizUrl(cfg.quiz))
  }

  const continueReady =
    !!savedCfg &&
    (savedCfg.mode === 'review' ||
      (savedCfg.mode === 'quiz' &&
        Array.isArray(savedCfg.quiz?.sources) &&
        savedCfg.quiz.sources.length > 0 &&
        Array.isArray(savedCfg.quiz?.qmodes) &&
        savedCfg.quiz.qmodes.length > 0))

  const continueLast = () => {
    if (!savedCfg) return
    if (savedCfg.mode === 'quiz') router.push(quizUrl(savedCfg.quiz))
    else router.push(reviewUrl(savedCfg.review))
  }

  const describeCfg = (cfg) => {
    const names = (ids) => {
      const titles = ids.map((id) => titleMap[id] || id.replace(/^deck:/, ''))
      const head = titles.slice(0, 3).join(', ')
      return titles.length > 3 ? `${head} +${titles.length - 3}` : head
    }
    if (cfg.mode === 'review') {
      const r = cfg.review || {}
      const src = (r.packs || []).length
        ? names(r.packs)
        : t('learnDueOnly', 'due cards only')
      return `${t('learnModeReview', 'Review')} · ${src} · ${
        REVIEW_LIMITS.includes(r.limit) ? r.limit : 20
      }`
    }
    const z = cfg.quiz || {}
    const cnt = z.count === 0 ? t('learnAllWords', 'All') : z.count || 20
    return `${t('learnModeQuiz', 'Quiz')} · ${names(z.sources || [])} · ${cnt}`
  }

  const packChip = (p, selected, onToggle) => (
    <Chip key={p.id} active={selected.includes(p.id)} onClick={() => onToggle(p.id)}>
      {p.title}
      <span className="learn-chip__count u-mono">{p.count}</span>
    </Chip>
  )

  if (loading || !user) {
    return (
      <AppShell>
        <PageLoader />
      </AppShell>
    )
  }

  const textbookToggle = (
    <button
      type="button"
      className="learn-toggle"
      onClick={() => setShowTextbook((v) => !v)}
      aria-expanded={showTextbook}
    >
      {t('learnTextbookPacks', 'Textbook packs')} ({textbookPacks.length})
      <Chevron />
    </button>
  )

  return (
    <AppShell>
      <Head>
        <title>{`${t('learnTitle', 'Learn')} · 好好学习`}</title>
      </Head>
      <div className="learn-page col-app">
        <header className="learn-head">
          <span className="eyebrow">{t('learnEyebrow', 'Study')}</span>
          <h1>{t('learnTitle', 'Learn')}</h1>
        </header>

        {loadState === 'loading' && <PageLoader />}

        {loadState === 'error' && (
          <EmptyState
            glyph="误"
            title={t('learnLoadFailed', 'Could not load study data')}
            text={loadErr}
            action={
              <Button
                variant="soft"
                onClick={() => {
                  setLoadState('loading')
                  setReloadNonce((n) => n + 1)
                }}
              >
                {t('learnRetry', 'Try again')}
              </Button>
            }
          />
        )}

        {loadState === 'ready' && (
          <>
            {continueReady && (
              <Card accent className="learn-continue">
                <div className="learn-continue__info">
                  <span className="eyebrow">{t('learnContinueLast', 'Continue last')}</span>
                  <span className="learn-continue__desc">{describeCfg(savedCfg)}</span>
                </div>
                <Button variant="primary" onClick={continueLast}>
                  {t('learnContinue', 'Continue')}
                </Button>
              </Card>
            )}

            <div className="learn-tabs">
              <Segmented
                block
                ariaLabel={t('learnModeAria', 'Study mode')}
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'review', label: t('learnModeReview', 'Review') },
                  { value: 'quiz', label: t('learnModeQuiz', 'Quiz') },
                ]}
              />
            </div>

            {tab === 'review' && (
              <div className="learn-panel">
                <Card className="learn-due">
                  <span className="learn-due__num u-mono">{dueCount}</span>
                  <span className="learn-due__text">
                    <strong>{t('learnDueCards', 'cards due for review')}</strong>
                    <span>
                      {t(
                        'learnDueHint',
                        'Due cards always come first — new cards from your packs fill the rest.'
                      )}
                    </span>
                  </span>
                </Card>

                <section className="learn-section">
                  <span className="eyebrow">{t('learnNewFrom', 'New cards from')}</span>
                  <div className="learn-chips">
                    {hskPacks.map((p) =>
                      packChip(p, reviewPacks, (id) =>
                        setReviewPacks((prev) => toggleIn(prev, id))
                      )
                    )}
                  </div>
                  {textbookToggle}
                  {showTextbook && (
                    <div className="learn-chips">
                      {textbookPacks.map((p) =>
                        packChip(p, reviewPacks, (id) =>
                          setReviewPacks((prev) => toggleIn(prev, id))
                        )
                      )}
                    </div>
                  )}
                </section>

                <ChipGroup label={t('learnSessionLimit', 'Session limit')}>
                  {REVIEW_LIMITS.map((n) => (
                    <Chip key={n} active={reviewLimit === n} onClick={() => setReviewLimit(n)}>
                      {n}
                    </Chip>
                  ))}
                </ChipGroup>

                <Button
                  className="learn-start"
                  variant="primary"
                  size="lg"
                  block
                  disabled={!canStartReview}
                  onClick={startReview}
                >
                  {t('learnStartReview', 'Review')} ({dueCount} {t('learnDueShort', 'due')})
                </Button>
                {!canStartReview && (
                  <p className="learn-hint">
                    {t('learnReviewHint', 'Nothing due yet — select a pack to add new cards.')}
                  </p>
                )}
              </div>
            )}

            {tab === 'quiz' && (
              <div className="learn-panel">
                {decks.length > 0 && (
                  <ChipGroup label={t('learnMyDecks', 'My decks')}>
                    {decks.map((d) => (
                      <Chip
                        key={d.id}
                        active={quizSources.includes(`deck:${d.id}`)}
                        disabled={!d.count}
                        onClick={() =>
                          setQuizSources((prev) => toggleIn(prev, `deck:${d.id}`))
                        }
                      >
                        {d.name}
                        <span className="learn-chip__count u-mono">{d.count}</span>
                      </Chip>
                    ))}
                  </ChipGroup>
                )}

                <section className="learn-section">
                  <span className="eyebrow">{t('learnWordPacks', 'Word packs')}</span>
                  <div className="learn-chips">
                    {hskPacks.map((p) =>
                      packChip(p, quizSources, (id) =>
                        setQuizSources((prev) => toggleIn(prev, id))
                      )
                    )}
                  </div>
                  {textbookToggle}
                  {showTextbook && (
                    <div className="learn-chips">
                      {textbookPacks.map((p) =>
                        packChip(p, quizSources, (id) =>
                          setQuizSources((prev) => toggleIn(prev, id))
                        )
                      )}
                    </div>
                  )}
                </section>

                <ChipGroup label={t('learnQuestionCount', 'Questions')}>
                  {QUIZ_COUNTS.map((n) => (
                    <Chip key={n} active={quizCount === n} onClick={() => setQuizCount(n)}>
                      {n === 0 ? t('learnAllWords', 'All') : n}
                    </Chip>
                  ))}
                </ChipGroup>

                <ChipGroup label={t('learnQuestionModes', 'Question types')}>
                  {ALL_QMODES.map((m) => (
                    <Chip
                      key={m}
                      active={quizModes.includes(m)}
                      onClick={() => setQuizModes((prev) => toggleIn(prev, m))}
                    >
                      <QmodeLabel mode={m} t={t} />
                    </Chip>
                  ))}
                </ChipGroup>

                <Button
                  className="learn-start"
                  variant="primary"
                  size="lg"
                  block
                  disabled={!canStartQuiz}
                  onClick={startQuiz}
                >
                  {t('learnStartQuiz', 'Start quiz')} (
                  {quizCount === 0 ? t('learnAllWords', 'All') : quizCount})
                </Button>
                {!canStartQuiz && (
                  <p className="learn-hint">
                    {t('learnQuizHint', 'Pick at least one source and one question type.')}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
