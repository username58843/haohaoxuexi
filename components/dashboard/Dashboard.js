import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { api, apiError } from '~/lib/api-client'
import {
  Button,
  Card,
  StatCard,
  ProgressRing,
  EmptyState,
  PageLoader,
} from '~/components/ui'

const LOCALE_MAP = { en: 'en-US', ru: 'ru-RU', tk: 'tk', zh: 'zh-CN' }
const HSK_LEVELS = [1, 2, 3, 4, 5, 6]

/** Tiny template helper: fill('{n} cards', 3) → '3 cards'. */
function fill(template, n) {
  return String(template).replace('{n}', String(n))
}

function IconGrid() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
    </svg>
  )
}

function IconBook() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

function IconChart() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 20V14" />
      <path d="M12 20V7" />
      <path d="M19 20V11" />
    </svg>
  )
}

function IconChevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

/**
 * Authed home. Rendered inside AppShell by pages/index.js.
 * Data: /srs/summary + /stats/activity (14 days) fetched in parallel.
 */
export default function Dashboard() {
  const { user } = useAuth()
  const { t, language } = useSettings()

  const [summary, setSummary] = useState(null)
  const [activity, setActivity] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [errorMsg, setErrorMsg] = useState('')
  const [prevUser, setPrevUser] = useState(null)
  const [loadKey, setLoadKey] = useState(0)

  // Show the loader whenever a (new) user triggers a refetch — render-time
  // state adjustment, keeps the pre-refactor "loading on refetch" behavior.
  if (user !== prevUser) {
    setPrevUser(user)
    if (user) {
      setStatus('loading')
      setErrorMsg('')
    }
  }

  const retry = useCallback(() => {
    setStatus('loading')
    setErrorMsg('')
    setLoadKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (!user) return
    const tzOffset = -new Date().getTimezoneOffset()
    Promise.all([
      api.get('/srs/summary', { params: { tzOffset } }),
      api.get('/stats/activity', { params: { days: 14, tzOffset } }),
    ])
      .then(([sumRes, actRes]) => {
        setSummary(sumRes.data)
        setActivity(Array.isArray(actRes.data?.days) ? actRes.data.days : [])
        setStatus('ready')
      })
      .catch((err) => {
        setErrorMsg(apiError(err).message)
        setStatus('error')
      })
  }, [user, loadKey])

  const locale = LOCALE_MAP[language] || 'en-US'

  const dateLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(new Date())
    } catch {
      return new Date().toDateString()
    }
  }, [locale])

  // Cheap enough to build per call — no manual memoization needed
  // (the returned-closure useMemo defeated the compiler's memo analysis).
  const weekdayLetter = (day) => {
    let fmt
    try {
      fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
    } catch {
      return ''
    }
    return fmt.format(new Date(`${day}T00:00:00`))
  }

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return t('dashGreetingMorning', 'Good morning')
    if (hour < 18) return t('dashGreetingAfternoon', 'Good afternoon')
    return t('dashGreetingEvening', 'Good evening')
  }, [t])

  // Page is auth-gated by pages/index.js, but user can be null for a beat.
  if (!user) return null

  const goal = summary?.goal || 20
  const goalMet = !!summary && goal > 0 && summary.todayReviews >= goal
  const accuracy =
    summary && summary.todayReviews > 0
      ? Math.round((summary.todayCorrect / summary.todayReviews) * 100)
      : null
  const totalCards = summary
    ? (summary.byState?.new || 0) +
      (summary.byState?.learning || 0) +
      (summary.byState?.review || 0)
    : 0
  const neverStudied = !!summary && totalCards === 0 && summary.todayReviews === 0
  const maxReviews = activity.reduce((m, d) => Math.max(m, d.reviews), 0)
  const totalReviews14 = activity.reduce((sum, d) => sum + d.reviews, 0)

  return (
    <>
      <Head>
        <title>{`${t('dashTitle', 'Home')} · 好好学习汉语`}</title>
      </Head>

      <div className="col-app dash">
        <header className="dash-head">
          <span className="eyebrow">{dateLabel}</span>
          <h1 className="dash-head__greeting u-two-tone">
            {greeting}, <span>{user.name}</span>
          </h1>
        </header>

        {status === 'loading' && <PageLoader />}

        {status === 'error' && (
          <Card className="dash-error">
            <EmptyState
              glyph="错"
              title={t('dashErrorTitle', 'Could not load your dashboard')}
              text={errorMsg}
              action={
                <Button variant="primary" onClick={retry}>
                  {t('dashRetry', 'Try again')}
                </Button>
              }
            />
          </Card>
        )}

        {status === 'ready' && summary && (
          <>
            <section className="dash-stats" aria-label={t('dashStatsAria', 'Your progress')}>
              <StatCard
                value={`🔥 ${summary.streak}`}
                label={t('dashStreak', 'Day streak')}
                trend={
                  summary.bestStreak > 0
                    ? fill(t('dashBestStreak', 'Best {n}'), summary.bestStreak)
                    : undefined
                }
              />
              <StatCard value={summary.dueCount} label={t('dashDueCards', 'Due cards')} />
              <StatCard
                value={summary.todayReviews}
                label={t('dashTodayReviews', 'Reviews today')}
                trend={
                  accuracy !== null
                    ? fill(t('dashCorrectPct', '{n}% correct'), accuracy)
                    : undefined
                }
              />
              <div className="dash-goal" title={`${summary.todayReviews} / ${goal}`}>
                <ProgressRing
                  value={goal > 0 ? summary.todayReviews / goal : 0}
                  size={72}
                  stroke={7}
                >
                  <span className="dash-goal__num">{summary.todayReviews}</span>
                  <span className="dash-goal__of">/{goal}</span>
                </ProgressRing>
                <span className={`dash-goal__label${goalMet ? ' is-met' : ''}`}>
                  {goalMet
                    ? t('dashGoalMet', 'Goal met!')
                    : t('dashDailyGoal', 'Daily goal')}
                </span>
              </div>
            </section>

            {neverStudied ? (
              <Card accent className="dash-onboard">
                <EmptyState
                  glyph="学"
                  title={t('dashOnboardTitle', 'Start your first session')}
                  text={t(
                    'dashOnboardText',
                    'Learn your first words today and start building a daily habit.'
                  )}
                  action={
                    <Button variant="primary" size="lg" href="/learn">
                      {t('dashOnboardBtn', 'Start learning')}
                    </Button>
                  }
                />
              </Card>
            ) : (
              <Card accent className="dash-continue">
                <div className="dash-continue__text">
                  <h2 className="dash-continue__title">
                    {t('dashContinueTitle', 'Continue studying')}
                  </h2>
                  <p className="dash-continue__sub">
                    {summary.dueCount > 0
                      ? fill(
                          t('dashContinueDueText', '{n} cards are waiting for review.'),
                          summary.dueCount
                        )
                      : t(
                          'dashContinueFreshText',
                          'Nothing due right now — learn something new.'
                        )}
                  </p>
                </div>
                {summary.dueCount > 0 ? (
                  <Button
                    variant="primary"
                    size="lg"
                    // No limit param = the whole due queue (one server batch
                    // caps at 500) — keep the label honest about that cap.
                    href="/learn/session?mode=review"
                  >
                    {fill(t('dashReviewBtn', 'Review {n} due cards'), Math.min(summary.dueCount, 500))}
                  </Button>
                ) : (
                  <Button variant="primary" size="lg" href="/learn">
                    {t('dashLearnBtn', 'Learn new words')}
                  </Button>
                )}
              </Card>
            )}

            <Card className="dash-activity">
              <div className="dash-activity__head">
                <h2 className="dash-section-title">
                  {t('dashActivityTitle', 'Last 14 days')}
                </h2>
                <span className="dash-activity__total u-mono">
                  {fill(t('dashReviewsCount', '{n} reviews'), totalReviews14)}
                </span>
              </div>
              <div
                className="dash-chart"
                role="img"
                aria-label={t('dashActivityAria', 'Daily review activity chart')}
              >
                {activity.map((d, i) => {
                  const isToday = i === activity.length - 1
                  const pct =
                    maxReviews > 0 ? Math.round((d.reviews / maxReviews) * 100) : 0
                  const height = d.reviews === 0 ? 3 : Math.max(pct, 6)
                  return (
                    <div
                      key={d.day}
                      className="dash-chart__col"
                      title={`${d.day} · ${fill(
                        t('dashReviewsCount', '{n} reviews'),
                        d.reviews
                      )}`}
                    >
                      <div className="dash-chart__stack">
                        <div
                          className={`dash-chart__bar${isToday ? ' is-today' : ''}${
                            d.reviews === 0 ? ' is-zero' : ''
                          }`}
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <span
                        className={`dash-chart__day${isToday ? ' is-today' : ''}`}
                        aria-hidden
                      >
                        {weekdayLetter(d.day)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card className="dash-hsk">
              <h2 className="dash-section-title dash-hsk__title">
                {t('dashHskTitle', 'HSK progress')}
              </h2>
              <div className="dash-hsk__rows">
                {HSK_LEVELS.map((level) => {
                  const row = summary.byLevel?.[level] || { total: 0, seen: 0, mature: 0 }
                  const seenPct = row.total > 0 ? (row.seen / row.total) * 100 : 0
                  const maturePct = row.total > 0 ? (row.mature / row.total) * 100 : 0
                  return (
                    <div
                      key={level}
                      className="dash-hsk__row"
                      title={`${row.mature} ${t('dashMature', 'mature')} · ${row.seen} ${t(
                        'dashSeen',
                        'seen'
                      )} · ${row.total} ${t('dashTotal', 'total')}`}
                    >
                      <span className="dash-hsk__label">HSK {level}</span>
                      <div className="dash-hsk__bar">
                        <div
                          className="dash-hsk__fill dash-hsk__fill--seen"
                          style={{ width: `${seenPct}%` }}
                        />
                        <div
                          className="dash-hsk__fill dash-hsk__fill--mature"
                          style={{ width: `${maturePct}%` }}
                        />
                      </div>
                      <span className="dash-hsk__nums u-mono">
                        {row.seen}/{row.total}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Card>

            <section
              className="dash-quick"
              aria-label={t('dashQuickAria', 'Quick actions')}
            >
              <Card as={Link} href="/hsk" interactive className="dash-quick__card">
                <span className="dash-quick__icon">
                  <IconGrid />
                </span>
                <span className="dash-quick__body">
                  <span className="dash-quick__title">
                    {t('dashQuickHskTitle', 'Browse HSK words')}
                  </span>
                  <span className="dash-quick__sub">
                    {t('dashQuickHskSub', 'All levels, search and collect')}
                  </span>
                </span>
                <span className="dash-quick__arrow">
                  <IconChevron />
                </span>
              </Card>
              <Card as={Link} href="/decks" interactive className="dash-quick__card">
                <span className="dash-quick__icon">
                  <IconBook />
                </span>
                <span className="dash-quick__body">
                  <span className="dash-quick__title">
                    {t('dashQuickDecksTitle', 'My decks')}
                  </span>
                  <span className="dash-quick__sub">
                    {t('dashQuickDecksSub', 'Your personal collections')}
                  </span>
                </span>
                <span className="dash-quick__arrow">
                  <IconChevron />
                </span>
              </Card>
              <Card as={Link} href="/stats" interactive className="dash-quick__card">
                <span className="dash-quick__icon">
                  <IconChart />
                </span>
                <span className="dash-quick__body">
                  <span className="dash-quick__title">
                    {t('dashQuickStatsTitle', 'Statistics')}
                  </span>
                  <span className="dash-quick__sub">
                    {t('dashQuickStatsSub', 'Heatmap and difficult words')}
                  </span>
                </span>
                <span className="dash-quick__arrow">
                  <IconChevron />
                </span>
              </Card>
            </section>
          </>
        )}
      </div>
    </>
  )
}
