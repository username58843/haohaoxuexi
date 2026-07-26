import React, { useState, useEffect, useCallback, useRef } from 'react'
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

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [selected, setSelected] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const requestRef = useRef(0)

  // Debounce the search input → q.
  useEffect(() => {
    const timer = setTimeout(() => setQ(qInput.trim()), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [qInput])

  // New search / filter → back to page 1.
  useEffect(() => {
    setPage(1)
  }, [q, filter])

  const load = useCallback(async () => {
    const requestId = ++requestRef.current
    setLoading(true)
    setError(null)
    try {
      const params = { page }
      if (q) params.q = q
      if (filter !== 'all') params.filter = filter
      const { data: json } = await api.get('/admin/users', { params })
      if (requestId !== requestRef.current) return
      setData(json)
      if (page > json.pages) setPage(json.pages)
    } catch (err) {
      if (requestId !== requestRef.current) return
      setError(apiError(err, t('admLoadFailed', 'Could not load data')).message)
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [q, filter, page, t])

  useEffect(() => {
    load()
  }, [load])

  const openUser = useCallback((user) => {
    setSelected(user)
    setDrawerOpen(true)
  }, [])

  const handleSaved = useCallback((updated) => {
    setSelected(updated)
    setData((prev) =>
      prev
        ? { ...prev, users: prev.users.map((u) => (u.id === updated.id ? updated : u)) }
        : prev
    )
  }, [])

  const handleDeleted = useCallback(() => {
    setDrawerOpen(false)
    setSelected(null)
    load()
  }, [load])

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
            <Chip key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)}>
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
          <Button variant="soft" size="sm" onClick={load}>
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
