import React, { useState, useEffect, useCallback, useRef } from 'react'
import AdminLayout from '~/components/admin/AdminLayout'
import Pager from '~/components/admin/Pager'
import { Button, Card, Chip, EmptyState, Spinner, useToast } from '~/components/ui'
import { api, apiError } from '~/lib/api-client'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { fmtDateTime, shortId } from '~/components/admin/format'

const STATUSES = ['new', 'seen', 'done']

/** /admin/feedback — inbox with status workflow (new → seen → done). */
export default function AdminFeedbackPage() {
  const { t, language } = useSettings()
  const toast = useToast()

  const [status, setStatus] = useState('new')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const requestRef = useRef(0)

  useEffect(() => {
    setPage(1)
  }, [status])

  const load = useCallback(async () => {
    const requestId = ++requestRef.current
    setLoading(true)
    setError(null)
    try {
      const params = { page }
      if (status !== 'all') params.status = status
      const { data: json } = await api.get('/admin/feedback', { params })
      if (requestId !== requestRef.current) return
      setData(json)
      if (page > json.pages) setPage(json.pages)
    } catch (err) {
      if (requestId !== requestRef.current) return
      setError(apiError(err, t('admLoadFailed', 'Could not load data')).message)
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [status, page, t])

  useEffect(() => {
    load()
  }, [load])

  const setItemStatus = useCallback(
    async (item, nextStatus) => {
      if (item.status === nextStatus) return
      const prevItems = data ? data.items : []
      // Optimistic: update in place; drop the card if it leaves the active filter.
      setData((prev) => {
        if (!prev) return prev
        const items = prev.items
          .map((it) => (it.id === item.id ? { ...it, status: nextStatus } : it))
          .filter((it) => status === 'all' || it.status === status)
        return { ...prev, items }
      })
      try {
        await api.put('/admin/feedback', { id: item.id, status: nextStatus })
      } catch (err) {
        setData((prev) => (prev ? { ...prev, items: prevItems } : prev))
        toast.error(apiError(err, t('admFbUpdateFailed', 'Could not update status')).message)
      }
    },
    [data, status, toast, t]
  )

  const FILTERS = [
    { value: 'new', label: t('admFbNew', 'New') },
    { value: 'seen', label: t('admFbSeen', 'Seen') },
    { value: 'done', label: t('admFbDone', 'Done') },
    { value: 'all', label: t('admFilterAll', 'All') },
  ]

  const STATUS_LABELS = {
    new: t('admFbNew', 'New'),
    seen: t('admFbSeen', 'Seen'),
    done: t('admFbDone', 'Done'),
  }

  const TOPIC_LABELS = {
    bug: t('admFbTopicBug', 'Bug'),
    idea: t('admFbTopicIdea', 'Idea'),
    content: t('admFbTopicContent', 'Content'),
    other: t('admFbTopicOther', 'Other'),
  }

  const items = data?.items || []

  return (
    <AdminLayout active="feedback" title={t('admFeedbackTitle', 'Feedback')}>
      <div className="adm-toolbar">
        <div className="adm-toolbar__chips" role="group" aria-label={t('admFbFilterLabel', 'Filter feedback')}>
          {FILTERS.map((f) => (
            <Chip key={f.value} active={status === f.value} onClick={() => setStatus(f.value)}>
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

      {!error && data && items.length === 0 && (
        <EmptyState
          glyph="信"
          title={t('admFbEmpty', 'No feedback here')}
          text={t('admFbEmptyText', 'Nothing matches this status filter.')}
        />
      )}

      {!error && items.length > 0 && (
        <div className={`adm-fb-list${loading ? ' is-refreshing' : ''}`}>
          {items.map((item) => (
            <Card key={item.id} className="adm-fb">
              <div className="adm-fb__head">
                <span className={`adm-badge adm-badge--topic-${item.topic}`}>
                  {TOPIC_LABELS[item.topic] || item.topic}
                </span>
                <span className="adm-fb__date u-mono">{fmtDateTime(item.createdAt, language)}</span>
              </div>
              <p className="adm-fb__message">{item.message}</p>
              <div className="adm-fb__meta">
                {item.email && <span className="adm-fb__from u-mono">{item.email}</span>}
                {!item.email && item.userId && (
                  <span className="adm-fb__from u-mono" title={item.userId}>
                    {t('admFbUser', 'User')} {shortId(item.userId)}
                  </span>
                )}
                {!item.email && !item.userId && (
                  <span className="adm-fb__from">{t('admFbAnonymous', 'Anonymous')}</span>
                )}
              </div>
              <div className="adm-fb__actions" role="group" aria-label={t('admFbStatusLabel', 'Set status')}>
                {STATUSES.map((s) => (
                  <Chip key={s} active={item.status === s} onClick={() => setItemStatus(item, s)}>
                    {STATUS_LABELS[s]}
                  </Chip>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {!error && data && (
        <Pager page={data.page} pages={data.pages} onPage={setPage} disabled={loading} />
      )}
    </AdminLayout>
  )
}
