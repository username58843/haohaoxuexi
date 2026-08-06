import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import AppShell from '~/components/AppShell'
import { Button, EmptyState, Modal, PageLoader, useToast } from '~/components/ui'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { api, apiError } from '~/lib/api-client'
import Flashcard from '~/components/learn/Flashcard'
import Quiz from '~/components/learn/Quiz'
import Results from '~/components/learn/Results'
import {
  ALL_QMODES,
  buildQuizQuestions,
  dedupeWords,
  ensureWordId,
  shuffle,
} from '~/components/learn/session-utils'

const RETRY_KEY = 'xue_retry_words'

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function listParam(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

async function fetchSource(source) {
  if (source.startsWith('deck:')) {
    const { data } = await api.get(`/decks/${encodeURIComponent(source.slice(5))}`)
    const deck = data?.deck || data || {}
    return (Array.isArray(deck.words) ? deck.words : []).map(ensureWordId).filter(Boolean)
  }
  const { data } = await api.get('/words', { params: { pack: source } })
  return (Array.isArray(data?.items) ? data.items : []).map(ensureWordId).filter(Boolean)
}

function SessionRunner({ params, userId, onReload }) {
  const { t, language } = useSettings()
  const router = useRouter()
  const toast = useToast()

  const [phase, setPhase] = useState('loading') // loading | error | empty | active | results
  const [errorMsg, setErrorMsg] = useState('')

  // review state
  const [remaining, setRemaining] = useState([])
  const [done, setDone] = useState(0)
  const [gradedCount, setGradedCount] = useState(0) // cards graded at least once
  const [flipped, setFlipped] = useState(false)
  const [posting, setPosting] = useState(false)

  // quiz state
  const [questions, setQuestions] = useState([])
  const [qi, setQi] = useState(0)
  const [answered, setAnswered] = useState(null) // { index, correct } | null
  const [correctCount, setCorrectCount] = useState(0)

  // Final results, set once when the session finishes.
  const [results, setResults] = useState(null) // { total, correct, mistakes }

  const [leaveOpen, setLeaveOpen] = useState(false)

  const statsRef = useRef({ firstGrades: {}, correct: 0, mistakes: [], mistakeIds: {}, syncFailed: 0 })
  const poolRef = useRef([]) // distractor pool, reused as retry extras
  const usedModesRef = useRef(['cp', 'ct'])
  const timerRef = useRef(null)

  const mode = params?.mode || 'review'

  // ------- load / build the session -------
  // The runner is remounted (via its `key`) whenever the session identity
  // changes, so every mount starts from fresh state and this effect only loads.
  useEffect(() => {
    if (!params || !userId) return undefined
    let cancelled = false

    const load = async () => {
      try {
        if (params.mode === 'review') {
          usedModesRef.current = ['cp', 'ct']
          const query = { limit: params.limit }
          if (params.packs.length) query.packs = params.packs.join(',')
          const { data } = await api.get('/srs/queue', { params: query })
          if (cancelled) return
          const cards = Array.isArray(data?.cards) ? data.cards : []
          poolRef.current = cards.map((c) => ensureWordId(c.word)).filter(Boolean)
          if (!cards.length) {
            setPhase('empty')
            return
          }
          setRemaining(cards)
          setPhase('active')
          return
        }

        let pool = []
        let distractors = []
        let qmodes = params.qmodes
        let count = params.count

        if (params.retry) {
          let stored = null
          try {
            stored = JSON.parse(sessionStorage.getItem(RETRY_KEY) || 'null')
          } catch {
            stored = null
          }
          const words = (Array.isArray(stored?.words) ? stored.words : [])
            .map(ensureWordId)
            .filter(Boolean)
          const extras = (Array.isArray(stored?.extras) ? stored.extras : [])
            .map(ensureWordId)
            .filter(Boolean)
          const storedModes = (Array.isArray(stored?.qmodes) ? stored.qmodes : []).filter((m) =>
            ALL_QMODES.includes(m)
          )
          if (storedModes.length) qmodes = storedModes
          pool = dedupeWords(words)
          distractors = dedupeWords([...words, ...extras])
          count = 0 // retry sessions always run the whole mistake list
        } else {
          if (!params.sources.length) {
            setPhase('empty')
            return
          }
          const fetched = await Promise.all(params.sources.map(fetchSource))
          if (cancelled) return
          pool = dedupeWords(fetched.flat())
          distractors = pool
        }

        usedModesRef.current = qmodes
        poolRef.current = distractors
        const built = buildQuizQuestions({ pool, distractors, qmodes, count, lang: language })
        if (cancelled) return
        if (!built.length) {
          setPhase('empty')
          return
        }
        setQuestions(built)
        setPhase('active')
      } catch (err) {
        if (cancelled) return
        setErrorMsg(apiError(err).message)
        setPhase('error')
      }
    }
    load()

    return () => {
      cancelled = true
      clearTimeout(timerRef.current)
    }
  }, [params, userId, language])

  // ------- review: grading -------
  const gradeCard = useCallback(
    async (grade) => {
      const card = remaining[0]
      if (!card || posting) return
      setPosting(true)
      try {
        const body = { wordId: card.wordId, grade, tzOffset: -new Date().getTimezoneOffset() }
        if (card.isNew) body.word = card.word
        const { data } = await api.post('/srs/review', body)

        const stats = statsRef.current
        if (!(card.wordId in stats.firstGrades)) {
          stats.firstGrades[card.wordId] = grade
          setGradedCount((n) => n + 1)
          if (grade === 0) {
            const w = ensureWordId(card.word)
            if (w) stats.mistakes.push(w)
          }
        }

        setFlipped(false)
        const rest = remaining.slice(1)
        if (grade === 0) {
          // Again → the card comes back 3 positions later in this session.
          const updated = { ...card, ...(data?.card || {}), isNew: false }
          const at = Math.min(3, rest.length)
          setRemaining([...rest.slice(0, at), updated, ...rest.slice(at)])
        } else {
          setDone((d) => d + 1)
          setRemaining(rest)
          if (!rest.length) {
            const grades = Object.values(stats.firstGrades)
            setResults({
              total: grades.length,
              correct: grades.filter((g) => g >= 2).length,
              mistakes: stats.mistakes,
            })
            setPhase('results')
          }
        }
      } catch {
        // Keep the card and let the user press the grade again.
        toast.error(
          t('sessSaveError', 'Could not save your answer — check your connection and try again')
        )
      } finally {
        setPosting(false)
      }
    },
    [remaining, posting, toast, t]
  )

  // ------- quiz: answering -------
  const advance = useCallback(() => {
    clearTimeout(timerRef.current)
    setAnswered(null)
    if (qi + 1 >= questions.length) {
      const stats = statsRef.current
      setResults({
        total: questions.length,
        correct: stats.correct,
        mistakes: stats.mistakes,
        syncFailed: stats.syncFailed,
      })
      setPhase('results')
    } else {
      setQi((i) => i + 1)
    }
  }, [qi, questions.length])

  const answerQuestion = useCallback(
    (index) => {
      if (answered) return
      const q = questions[qi]
      if (!q || index < 0 || index >= q.options.length) return
      const correct = index === q.correctIndex
      setAnswered({ index, correct })

      // Auto-grade into SRS: first-try correct → Good, wrong → Again.
      // Retry once on failure; if it still fails, count it so the results
      // screen can warn that some progress wasn't saved.
      const body = {
        wordId: q.word.id,
        grade: correct ? 2 : 0,
        word: q.word,
        tzOffset: -new Date().getTimezoneOffset(),
      }
      api
        .post('/srs/review', body)
        .catch(() => api.post('/srs/review', body))
        .catch(() => {
          statsRef.current.syncFailed += 1
        })

      if (correct) {
        statsRef.current.correct += 1
        setCorrectCount((c) => c + 1)
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(advance, 650)
      } else {
        const stats = statsRef.current
        if (!stats.mistakeIds[q.word.id]) {
          stats.mistakeIds[q.word.id] = true
          stats.mistakes.push(q.word)
        }
      }
    },
    [answered, questions, qi, advance]
  )

  // ------- progress / in-session helpers -------
  const total = mode === 'review' ? done + remaining.length : questions.length
  const position = Math.min(mode === 'review' ? done + 1 : qi + 1, Math.max(total, 1))
  const completedUnits = mode === 'review' ? done : qi + (answered ? 1 : 0)
  const pct = total > 0 ? Math.round((completedUnits / total) * 100) : 0

  const inProgress =
    phase === 'active' &&
    (mode === 'review'
      ? done > 0 || gradedCount > 0
      : qi > 0 || answered !== null || correctCount > 0)

  useEffect(() => {
    if (!inProgress) return undefined
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [inProgress])

  const handleBack = () => {
    if (inProgress) setLeaveOpen(true)
    else router.push('/learn')
  }

  const confirmLeave = () => {
    setLeaveOpen(false)
    router.push('/learn')
  }

  // ------- hotkeys: Space flip, 1..4 grade/answer, Enter next -------
  useEffect(() => {
    const onKey = (e) => {
      if (!params || leaveOpen || phase !== 'active') return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (params.mode === 'review') {
        if (!flipped && (e.code === 'Space' || e.key === 'Enter')) {
          e.preventDefault()
          setFlipped(true)
        } else if (flipped && e.key >= '1' && e.key <= '4') {
          e.preventDefault()
          if (!posting) gradeCard(Number(e.key) - 1)
        }
      } else if (!answered && e.key >= '1' && e.key <= '4') {
        e.preventDefault()
        answerQuestion(Number(e.key) - 1)
      } else if (answered && !answered.correct && (e.key === 'Enter' || e.code === 'Space')) {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [params, phase, leaveOpen, flipped, posting, answered, gradeCard, answerQuestion, advance])

  // ------- results / retry -------
  const handleRetry = useCallback(() => {
    const words = dedupeWords(statsRef.current.mistakes.map(ensureWordId).filter(Boolean))
    if (!words.length) return
    const ids = new Set(words.map((w) => w.id))
    const extras = shuffle(poolRef.current.filter((w) => w && w.id && !ids.has(w.id))).slice(0, 150)
    try {
      sessionStorage.setItem(
        RETRY_KEY,
        JSON.stringify({ words, extras, qmodes: usedModesRef.current })
      )
    } catch {
      /* storage unavailable — the retry session will show an empty state */
    }
    router.push(`/learn/session?mode=quiz&retry=${Date.now()}`)
  }, [router])

  const modeLabel = mode === 'quiz' ? t('sessModeQuiz', 'Quiz') : t('sessModeReview', 'Review')

  return (
    <AppShell bare>
      <Head>
        <title>{`${modeLabel} · 好好学习汉语`}</title>
      </Head>
      <div className="sess-page">
        <header className="sess-top">
          <button
            type="button"
            className="sess-top__back"
            onClick={handleBack}
            aria-label={t('sessBack', 'Back to Learn')}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
          </button>

          <div className="sess-top__progress">
            {phase === 'active' && (
              <>
                <span className="sess-top__count u-mono">
                  {position} / {total}
                </span>
                <div
                  className="sess-top__bar"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${pct}%` }} />
                </div>
              </>
            )}
          </div>

          <span className="eyebrow sess-top__tag">{modeLabel}</span>
        </header>

        {phase === 'loading' && <PageLoader />}

        {phase === 'error' && (
          <EmptyState
            glyph="误"
            title={t('sessLoadFailed', 'Could not load this session')}
            text={errorMsg}
            action={
              <div className="sess-empty-actions">
                <Button variant="primary" onClick={onReload}>
                  {t('sessRetry', 'Try again')}
                </Button>
                <Button variant="ghost" href="/learn">
                  {t('sessBackToLearn', 'Back to Learn')}
                </Button>
              </div>
            }
          />
        )}

        {phase === 'empty' && mode === 'review' && (
          <EmptyState
            glyph="好"
            title={t('sessCaughtUp', 'All caught up! 🎉')}
            text={t(
              'sessCaughtUpText',
              'Nothing is due right now and no new cards matched your packs. Keep going with a quiz instead.'
            )}
            action={
              <div className="sess-empty-actions">
                <Button variant="primary" href="/learn?mode=quiz">
                  {t('sessTryQuiz', 'Start a quiz')}
                </Button>
                <Button variant="ghost" href="/learn">
                  {t('sessBackToLearn', 'Back to Learn')}
                </Button>
              </div>
            }
          />
        )}

        {phase === 'empty' && mode === 'quiz' && (
          <EmptyState
            title={t('sessNoWords', 'No words to practice')}
            text={t(
              'sessNoWordsText',
              'The selected sources have no words that fit the chosen question types.'
            )}
            action={
              <Button variant="soft" href="/learn?mode=quiz">
                {t('sessBackToLearn', 'Back to Learn')}
              </Button>
            }
          />
        )}

        {phase === 'active' && mode === 'review' && remaining[0] && (
          <Flashcard
            card={remaining[0]}
            flipped={flipped}
            onFlip={() => setFlipped(true)}
            onGrade={gradeCard}
            posting={posting}
          />
        )}

        {phase === 'active' && mode === 'quiz' && questions[qi] && (
          <Quiz
            key={qi}
            question={questions[qi]}
            answered={answered}
            onAnswer={answerQuestion}
            onNext={advance}
          />
        )}

        {phase === 'results' && results && (
          <Results
            mode={mode}
            total={results.total}
            correct={results.correct}
            mistakes={results.mistakes}
            syncFailed={results.syncFailed}
            onRetry={handleRetry}
          />
        )}
      </div>

      <Modal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title={t('sessLeaveTitle', 'Leave this session?')}
        footer={
          <>
            <Button variant="soft" onClick={() => setLeaveOpen(false)}>
              {t('sessStay', 'Keep studying')}
            </Button>
            <Button variant="danger" onClick={confirmLeave}>
              {t('sessLeave', 'Leave')}
            </Button>
          </>
        }
      >
        <p>
          {t(
            'sessLeaveText',
            'Answers you already gave are saved, but the rest of this session will be lost.'
          )}
        </p>
      </Modal>
    </AppShell>
  )
}

export default function SessionPage() {
  const { user, loading } = useAuth()
  const { language } = useSettings()
  const router = useRouter()
  const [reloadNonce, setReloadNonce] = useState(0)

  useEffect(() => {
    if (!loading && !user) router.replace('/auth')
  }, [loading, user, router])

  const params = useMemo(() => {
    if (!router.isReady) return null
    const q = router.query
    const qmodes = listParam(q.qmodes).filter((m) => ALL_QMODES.includes(m))
    return {
      mode: q.mode === 'quiz' ? 'quiz' : 'review',
      packs: listParam(q.packs),
      sources: listParam(q.sources),
      // 0 = the whole queue / pool — the default since the session-size
      // pickers were removed (the server caps the review batch).
      limit: clampInt(q.limit, 0, 500, 0),
      count: clampInt(q.count, 0, 500, 0),
      qmodes: qmodes.length ? qmodes : ['cp', 'ct'],
      retry: Boolean(q.retry),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.asPath])

  if (loading || !user) {
    return (
      <AppShell bare>
        <PageLoader />
      </AppShell>
    )
  }

  // Remount the runner whenever the session identity changes (URL, language,
  // manual reload) — the `key` reset pattern replaces in-effect state resets.
  return (
    <SessionRunner
      key={`${router.asPath}|${language}|${reloadNonce}`}
      params={params}
      userId={user.id}
      onReload={() => setReloadNonce((n) => n + 1)}
    />
  )
}
