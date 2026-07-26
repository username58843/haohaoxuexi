import React, { useState, useEffect, useCallback } from 'react'
import AdminLayout from '~/components/admin/AdminLayout'
import Pager from '~/components/admin/Pager'
import UserDrawer from '~/components/admin/UserDrawer'
import { Button, Card, Chip, EmptyState, Field, Spinner } from '~/components/ui'
import { api, apiError } from '~/lib/api-client'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { fmtDate, fmtDateTime } from '~/components/admin/format'

const DEBOUNCE_MS = 350

/** /admin/users — searchable, filterable, paginated user management. */
export default function AdminUsersPage() {
  const { t, language } = useSettings()

  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)

  // Result of the last completed fetch, tagged with the key it was fetched for.
  // While the current key differs we are (re)loading; stale data is kept so the
  // table stays visible with the `is-refreshing` treatment.
  const [result, setResult] = useState(null) // { key, data, error }

  const [selected, setSelected] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const fetchKey = `${language}|${reloadKey}|${q}|${filter}|${page}`
  const loading = !result || result.key !== fetchKey
  const data = result ? result.data : null
  const error = loading ? null : result.error

  // Debounce the search input → q; a new search goes back to page 1.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = qInput.trim()
      if (next !== q) {
        setQ(next)
        setPage(1)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [qInput, q])

  useEffect(() => {
    let stale = false
    const params = { page }
    if (q) params.q = q
    if (filter !== 'all') params.filter = filter
    api
      .get('/admin/users', { params })
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
  }, [fetchKey, q, filter, page, t])

  const retry = () => setReloadKey((k) => k + 1)

  const selectFilter = (next) => {
    if (filter === next) return
    setFilter(next)
    setPage(1) // new filter → back to page 1
  }

  const openUser = useCallback((user) => {
    setSelected(user)
    setDrawerOpen(true)
  }, [])

  const handleSaved = useCallback((updated) => {
    setSelected(updated)
    setResult((prev) =>
      prev && prev.data
        ? {
            ...prev,
            data: {
              ...prev.data,
              users: prev.data.users.map((u) => (u.id === updated.id ? updated : u)),
            },
          }
        : prev
    )
  }, [])

  const handleDeleted = useCallback(() => {
    setDrawerOpen(false)
    setSelected(null)
    setReloadKey((k) => k + 1)
  }, [])

  const FILTERS = [
    { value: 'all', label: t('admFilterAll', 'All') },
    { value: 'banned', label: t('admFilterBanned', 'Banned') },
    { value: 'premium', label: t('admFilterPremium', 'Premium') },
    { value: 'admin', label: t('admFilterAdmins', 'Admins') },
  ]

  const users = data?.users || []

  return (
    <AdminLayout active="users" title={t('admUsersTitle', 'Users')}>
      <div className="adm-toolbar">
        <Field
          className="adm-toolbar__search"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder={t('admSearchPlaceholder', 'Search name or email…')}
          type="search"
          aria-label={t('admSearchLabel', 'Search users')}
        />
        <div className="adm-toolbar__chips" role="group" aria-label={t('admFilterLabel', 'Filter users')}>
          {FILTERS.map((f) => (
            <Chip key={f.value} active={filter === f.value} onClick={() => selectFilter(f.value)}>
              {f.label}
            </Chip>
          ))}
        </div>
      </div>

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

      {!error && data && users.length === 0 && (
        <EmptyState
          glyph="无"
          title={t('admUsersEmpty', 'No users found')}
          text={t('admUsersEmptyText', 'Try a different search or filter.')}
        />
      )}

      {!error && data && users.length > 0 && (
        <Card className={`adm-table-card${loading ? ' is-refreshing' : ''}`}>
          <div className="adm-table-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>{t('admColUser', 'User')}</th>
                  <th>{t('admColRole', 'Role')}</th>
                  <th>{t('admColPremium', 'Premium')}</th>
                  <th>{t('admColStatus', 'Status')}</th>
                  <th>{t('admColCreated', 'Created')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="adm-table__row"
                    tabIndex={0}
                    onClick={() => openUser(u)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openUser(u)
                      }
                    }}
                  >
                    <td>
                      <span className="adm-table__name">{u.name}</span>
                      <span className="adm-table__email">{u.email}</span>
                    </td>
                    <td>
                      <span className={`adm-badge${u.role === 'admin' ? ' adm-badge--accent' : ''}`}>
                        {u.role === 'admin' ? t('admRoleAdmin', 'Admin') : t('admRoleUser', 'User')}
                      </span>
                    </td>
                    <td>
                      {u.isPremium ? (
                        <span className="adm-badge adm-badge--warn">
                          {t('admPremiumYes', 'Premium')}
                        </span>
                      ) : (
                        <span className="adm-table__dash">—</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`adm-badge${u.isBanned ? ' adm-badge--danger' : ' adm-badge--ok'}`}
                        title={
                          u.lastSeen
                            ? `${t('admDetailLastSeen', 'Last seen')}: ${fmtDateTime(u.lastSeen, language)}`
                            : undefined
                        }
                      >
                        {u.isBanned ? t('admStatusBanned', 'Banned') : t('admStatusOk', 'OK')}
                      </span>
                    </td>
                    <td className="adm-table__date u-mono">{fmtDate(u.createdAt, language)}</td>
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

      <UserDrawer
        user={selected}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </AdminLayout>
  )
}
