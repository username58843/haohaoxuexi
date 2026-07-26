import React, { useState, useEffect, useCallback } from 'react'
import AdminLayout from '~/components/admin/AdminLayout'
import BarChart from '~/components/admin/BarChart'
import { Button, Card, StatCard, Spinner } from '~/components/ui'
import { api, apiError } from '~/lib/api-client'
import { useSettings } from '~/lib/contexts/SettingsContext'

/** /admin — platform overview: headline totals + 14-day activity charts. */
export default function AdminOverviewPage() {
  const { t } = useSettings()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: json } = await api.get('/admin/overview')
      setData(json)
    } catch (err) {
      setError(apiError(err, t('admLoadFailed', 'Could not load data')).message)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  const totals = data?.totals

  return (
    <AdminLayout active="overview" title={t('admOverviewTitle', 'Overview')}>
      {loading && (
        <div className="adm-loading">
          <Spinner />
        </div>
      )}

      {!loading && error && (
        <Card className="adm-error">
          <p className="adm-error__text">{error}</p>
          <Button variant="soft" size="sm" onClick={load}>
            {t('admRetry', 'Retry')}
          </Button>
        </Card>
      )}

      {!loading && !error && data && (
        <>
          <div className="adm-stats">
            <StatCard
              value={<span className="u-mono">{totals.users}</span>}
              label={t('admStatUsers', 'Users')}
            />
            <StatCard
              value={<span className="u-mono">{totals.newUsers7d}</span>}
              label={t('admStatNew7d', 'New (7d)')}
            />
            <StatCard
              value={<span className="u-mono">{totals.activeToday}</span>}
              label={t('admStatActiveToday', 'Active today')}
            />
            <StatCard
              value={<span className="u-mono">{totals.decks}</span>}
              label={t('admStatDecks', 'Decks')}
            />
            <StatCard
              value={<span className="u-mono">{totals.reviews7d}</span>}
              label={t('admStatReviews7d', 'Reviews (7d)')}
            />
          </div>

          <div className="adm-charts">
            <Card className="adm-chart-card">
              <h2 className="adm-chart-card__title">
                {t('admChartSignups', 'Signups — last 14 days')}
              </h2>
              <BarChart data={data.signupsByDay} />
            </Card>
            <Card className="adm-chart-card">
              <h2 className="adm-chart-card__title">
                {t('admChartReviews', 'Reviews — last 14 days')}
              </h2>
              <BarChart data={data.reviewsByDay} />
            </Card>
          </div>
        </>
      )}
    </AdminLayout>
  )
}
