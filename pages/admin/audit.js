import React, { useState, useEffect } from 'react'
import AdminLayout from '~/components/admin/AdminLayout'
import Pager from '~/components/admin/Pager'
import { Button, Card, EmptyState, Spinner } from '~/components/ui'
import { api, apiError } from '~/lib/api-client'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { fmtDateTime, shortId } from '~/components/admin/format'

/** /admin/audit — paginated log of every destructive admin action. */
export default function AdminAuditPage() {
  const { t, language } = useSettings()

  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  // Result of the last completed fetch, tagged with the key it was fetched for.
  // While the current key differs we are (re)loading; stale data is kept so the
  // table stays visible with the `is-refreshing` treatment.
  const [result, setResult] = useState(null) // { key, data, error }

  const fetchKey = `${language}|${reloadKey}|${page}`
  const loading = !result || result.key !== fetchKey
  const data = result ? result.data : null
  const error = loading ? null : result.error

  useEffect(() => {
    let stale = false
    api
      .get('/admin/audit', { params: { page } })
      .then(({ data: json }) => {
        if (stale) return
        setResult({ key: fetchKey, data: json, error: null })
        if (page > json.pages) setPage(json.pages)
      })
      .catch((err) => {
        if (stale) return
        setResult((prev) => ({
          key: fetchKey,
          data: prev ? prev.data : null,
          error: apiError(err, t('admLoadFailed', 'Could not load data')).message,
        }))
      })
    return () => {
      stale = true
    }
  }, [fetchKey, page, t])

  const retry = () => setReloadKey((k) => k + 1)

  const items = data?.items || []

  return (
    <AdminLayout active="audit" title={t('admAuditTitle', 'Audit log')}>
      {loading && !data && (
        <div className="adm-loading">
          <Spinner />
        </div>
      )}

      {error && (
        <Card className="adm-error">
          <p className="adm-error__text">{error}</p>
          <Button variant="soft" size="sm" onClick={retry}>
            {t('admRetry', 'Retry')}
          </Button>
        </Card>
      )}

      {!error && data && items.length === 0 && (
        <EmptyState
          glyph="记"
          title={t('admAuditEmpty', 'No audit entries yet')}
          text={t('admAuditEmptyText', 'Admin actions will be recorded here.')}
        />
      )}

      {!error && items.length > 0 && (
        <Card className={`adm-table-card${loading ? ' is-refreshing' : ''}`}>
          <div className="adm-table-scroll">
            <table className="adm-table adm-table--audit">
              <thead>
                <tr>
                  <th>{t('admAuditColDate', 'Date')}</th>
                  <th>{t('admAuditColActor', 'Actor')}</th>
                  <th>{t('admAuditColAction', 'Action')}</th>
                  <th>{t('admAuditColTarget', 'Target')}</th>
                  <th>{t('admAuditColDetail', 'Detail')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => (
                  <tr key={entry.id}>
                    <td className="adm-table__date u-mono">
                      {fmtDateTime(entry.createdAt, language)}
                    </td>
                    <td className="u-mono" title={entry.actorId || undefined}>
                      {shortId(entry.actorId)}
                    </td>
                    <td>
                      <span className="adm-badge adm-badge--accent">{entry.action}</span>
                    </td>
                    <td className="u-mono" title={entry.targetUserId || undefined}>
                      {entry.targetUserId ? shortId(entry.targetUserId) : '—'}
                    </td>
                    <td className="adm-table__detail">
                      {entry.detail && Object.keys(entry.detail).length > 0 ? (
                        <details className="adm-detail">
                          <summary className="adm-detail__summary u-mono">
                            {t('admAuditShowDetail', 'JSON')}
                          </summary>
                          <pre className="adm-detail__pre u-mono">
                            {JSON.stringify(entry.detail, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="adm-table__dash">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!error && data && (
        <Pager page={data.page} pages={data.pages} onPage={setPage} disabled={loading} />
      )}
    </AdminLayout>
  )
}
