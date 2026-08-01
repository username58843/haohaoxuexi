import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import AppShell from '~/components/AppShell'
import WordSheet from '~/components/WordSheet'
import AddToDeck from '~/components/hsk/AddToDeck'
import { Button, Card, StatCard, EmptyState, PageLoader } from '~/components/ui'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { api, apiError } from '~/lib/api-client'
import { meaningLine } from '~/components/learn/session-utils'

const LOCALE_MAP = { en: 'en-US', ru: 'ru-RU', tk: 'tk', zh: 'zh-CN' }
const ACTIVITY_DAYS = 182
const DIFFICULT_LIMIT = 20

/** Tiny template helper: fill('{n} reviews', 3) → '3 reviews'. */
function fill(template, n) {
  return String(template).replace('{n}', String(n))
}

/** Parses 'YYYY-MM-DD' as a LOCAL date (new Date(string) would mean UTC). */
function parseDay(day) {
  const [y, m, d] = String(day).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/**
 * Chunks the activity list into Monday-first week columns (GitHub-style):
 * the first column is padded with leading nulls so weekdays line up, the
 * last one is padded with trailing nulls to a full 7 rows.
 */
function buildWeeks(days) {
  if (!days.length) return []
  const lead = (parseDay(days[0].day).getDay() + 6) % 7
  const cells = new Array(lead).fill(null).concat(days)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** Auth-gated statistics: 6-month review heatmap + difficult-words leech list. */
export default function StatsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { t, language } = useSettings()

  const [activity, setActivity] = useState([])
  const [difficult, setDifficult] = useState({ items: [], total: 0 })
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [errorMsg, setErrorMsg] = useState('')
  const [loadKey, setLoadKey] = useState(0)
  const [sheetItem, setSheetItem] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const scrollRef = useRef(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/auth')
  }, [loading, user, router])

  const retry = useCallback(() => {
    setStatus('loading')
    setErrorMsg('')
    setLoadKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (!user) return undefined
    let stale = false
    const tzOffset = -new Date().getTimezoneOffset()
    Promise.all([
      api.get('/stats/activity', { params: { days: ACTIVITY_DAYS, tzOffset } }),
      api.get('/srs/difficult', { params: { limit: DIFFICULT_LIMIT } }),
    ])
      .then(([actRes, diffRes]) => {
        if (stale) return
        setActivity(Array.isArray(actRes.data?.days) ? actRes.data.days : [])
        setDifficult({
          items: Array.isArray(diffRes.data?.items) ? diffRes.data.items : [],
          total: Number(diffRes.data?.total) || 0,
        })
        setStatus('ready')
      })
      .catch((err) => {
        if (stale) return
        setErrorMsg(apiError(err).message)
        setStatus('error')
      })
    return () => {
      stale = true
    }
  }, [user, loadKey])

  // Fresh weeks live on the right edge — start the strip scrolled to the end.
  useEffect(() => {
    if (status !== 'ready') return
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [status])

  const openWord = useCallback((item) => {
    setSheetItem(item)
    setSheetOpen(true)
  }, [])

  const locale = LOCALE_MAP[language] || 'en-US'

  const weeks = useMemo(() => buildWeeks(activity), [activity])

  const totals = useMemo(() => {
    let reviews = 0
    let correct = 0
    let activeDays = 0
    let best = 0
    for (const d of activity) {
      reviews += d.reviews
      correct += d.correct
      if (d.reviews > 0) activeDays += 1
      if (d.reviews > best) best = d.reviews
    }
    return { reviews, correct, activeDays, best }
  }, [activity])

  const monthLabels = useMemo(() => {
    let fmt
    try {
      fmt = new Intl.DateTimeFormat(locale, { month: 'short' })
    } catch {
      return weeks.map(() => '')
    }
    const labels = weeks.map(() => '')
    let prevMonth = -1
    weeks.forEach((week, i) => {
      const cell = week.find(Boolean)
      if (!cell) return
      const date = parseDay(cell.day)
      if (date.getMonth() !== prevMonth) {
        labels[i] = fmt.format(date)
        prevMonth = date.getMonth()
      }
    })
    // The first column usually starts mid-month; drop its label when the real
    // month boundary sits in the very next column (the two would overlap).
    if (labels[0] && labels[1]) labels[0] = ''
    return labels
  }, [weeks, locale])

  const dayLabels = useMemo(() => {
    let fmt
    try {
      fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
    } catch {
      return ['M', 'W', 'F']
    }
    // 2024-01-01 is a Monday — offsets 0/2/4 give Mon/Wed/Fri in any locale.
    return [0, 2, 4].map((offset) => fmt.format(new Date(2024, 0, 1 + offset)))
  }, [locale])

  if (loading || !user) {
    return (
      <AppShell>
        <PageLoader />
      </AppShell>
    )
  }

  const maxReviews = totals.best
  const levelOf = (reviews) => {
    if (!reviews || maxReviews <= 0) return 0
    return Math.min(4, Math.max(1, Math.ceil((reviews / maxReviews) * 4)))
  }

  const accuracy =
    totals.reviews > 0 ? `${Math.round((totals.correct / totals.reviews) * 100)}%` : '—'
  const reviewsLabel = t('statsReviews', '{n} reviews')

  return (
    <AppShell>
      <Head>
        <title>{`${t('statsTitle', 'Statistics')} · 好好学习汉语`}</title>
      </Head>

      <div className="col-app stats">
        <header className="stats__head">
          <span className="eyebrow">{t('statsEyebrow', 'Your progress')}</span>
          <h1 className="stats__title">{t('statsTitle', 'Statistics')}</h1>
        </header>

        {status === 'loading' && <PageLoader />}

        {status === 'error' && (
          <Card className="stats__error">
            <EmptyState
              glyph="错"
              title={t('statsErrorTitle', 'Could not load statistics')}
              text={errorMsg}
              action={
                <Button variant="primary" onClick={retry}>
                  {t('statsRetry', 'Try again')}
                </Button>
              }
            />
          </Card>
        )}

        {status === 'ready' && (
          <>
            <section className="stats-cards" aria-label={t('statsEyebrow', 'Your progress')}>
              <StatCard value={totals.reviews} label={t('statsTotalReviews', 'Reviews')} />
              <StatCard value={accuracy} label={t('statsAccuracy', 'Accuracy')} />
              <StatCard value={totals.activeDays} label={t('statsActiveDays', 'Active days')} />
              <StatCard value={totals.best} label={t('statsBestDay', 'Best day')} />
            </section>

            <Card className="stats-heatmap">
              <h2 className="stats-section-title">{t('statsHeatmapTitle', 'Last 6 months')}</h2>
              <div className="stats-heatmap__wrap">
                <div className="stats-heatmap__days" aria-hidden>
                  {dayLabels.map((label, i) => (
                    <span key={i} style={{ gridRow: i * 2 + 1 }}>
                      {label}
                    </span>
                  ))}
                </div>
                <div className="stats-heatmap__scroll" ref={scrollRef}>
                  <div className="stats-heatmap__months" aria-hidden>
                    {monthLabels.map((label, i) => (
                      <span key={i}>{label}</span>
                    ))}
                  </div>
                  <div
                    className="stats-heatmap__grid"
                    role="img"
                    aria-label={t('statsHeatmapAria', 'Daily review heatmap')}
                  >
                    {weeks.map((week, wi) =>
                      week.map((cell, di) =>
                        cell ? (
                          <div
                            key={cell.day}
                            className={`stats-heatmap__cell stats-heatmap__cell--l${levelOf(
                              cell.reviews
                            )}`}
                            title={`${cell.day} · ${fill(reviewsLabel, cell.reviews)}`}
                          />
                        ) : (
                          <div
                            key={`pad-${wi}-${di}`}
                            className="stats-heatmap__cell stats-heatmap__cell--pad"
                          />
                        )
                      )
                    )}
                  </div>
                </div>
              </div>
              <div className="stats-heatmap__legend" aria-hidden>
                <span>{t('statsLess', 'Less')}</span>
                {[0, 1, 2, 3, 4].map((lvl) => (
                  <i key={lvl} className={`stats-heatmap__cell stats-heatmap__cell--l${lvl}`} />
                ))}
                <span>{t('statsMore', 'More')}</span>
              </div>
            </Card>

            <Card className="stats-difficult">
              <div className="stats-difficult__head">
                <h2 className="stats-section-title">
                  {t('statsDifficultTitle', 'Difficult words')}
                </h2>
                {difficult.total > 0 && (
                  <span className="stats-difficult__total u-mono">{difficult.total}</span>
                )}
              </div>

              {difficult.items.length === 0 ? (
                <EmptyState
                  glyph="易"
                  title={t('statsDifficultEmptyTitle', 'No difficult words')}
                  text={t(
                    'statsDifficultEmptyText',
                    'Words you keep forgetting during reviews will show up here.'
                  )}
                />
              ) : (
                <>
                  <p className="stats-difficult__hint">
                    {t(
                      'statsDifficultHint',
                      'These words keep slipping away. Tap one to open it and add it to a deck for extra practice.'
                    )}
                  </p>
                  <div className="stats-difficult__list">
                    {difficult.items.map((item) => (
                      <button
                        key={item.wordId}
                        type="button"
                        className="word-row"
                        onClick={() => openWord(item)}
                      >
                        <span className="word-row__hanzi hanzi" lang="zh">
                          {item.word.simplified}
                        </span>
                        <span className="word-row__body">
                          <span className="word-row__pinyin">{item.word.pinyin}</span>
                          <span className="word-row__def">{meaningLine(item.word, language)}</span>
                        </span>
                        <span
                          className="stats-difficult__lapses"
                          title={fill(t('statsLapses', 'Forgotten {n} times'), item.lapses)}
                        >
                          ×{item.lapses}
                        </span>
                        {item.word.hsk ? (
                          <span className={`word-row__tag word-row__tag--hsk${item.word.hsk}`}>
                            HSK {item.word.hsk}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </>
        )}

        <WordSheet
          word={sheetItem ? sheetItem.word : null}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          actions={
            sheetItem && (
              <div className="hsk-sheet-actions">
                <AddToDeck word={sheetItem.word} />
              </div>
            )
          }
        />
      </div>
    </AppShell>
  )
}
