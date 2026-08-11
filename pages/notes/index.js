import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import AppShell from '~/components/AppShell'
import { Button, EmptyState, Field, Modal, PageLoader, Spinner, useToast } from '~/components/ui'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { api, apiError } from '~/lib/api-client'

const Editor = dynamic(() => import('~/components/notes/Editor'), {
  ssr: false,
  loading: () => <Spinner />,
})

/**
 * Notes — a Notesnook-style personal notebook: three panes (sections / note
 * list / editor), notebooks, tags, pin & favorite, archive and a 30-day
 * trash. Notes autosave to the account and sync across devices through the
 * same REST API the future Android client will use.
 */

const AUTOSAVE_MS = 800

const dateLabel = (value, lang) => {
  const d = new Date(value)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  if (sameDay) return d.toLocaleTimeString(lang === 'en' ? undefined : lang, { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString(lang === 'en' ? undefined : lang, { day: 'numeric', month: 'short' })
}

export default function NotesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { t, language } = useSettings()
  const toast = useToast()

  const [view, setView] = useState({ kind: 'notes' }) // notes|favorites|archive|trash|notebook|tag
  const [notes, setNotes] = useState(null)
  const [notebooks, setNotebooks] = useState([])
  const [q, setQ] = useState('')
  const [active, setActive] = useState(null) // full note (with content)
  const [activeLoading, setActiveLoading] = useState(false)
  const [saveState, setSaveState] = useState('idle') // idle|dirty|saving|saved|error
  const [mobilePane, setMobilePane] = useState('list') // list|editor
  const [notebookModal, setNotebookModal] = useState(false)
  const [newNotebookName, setNewNotebookName] = useState('')
  const [tagsDraft, setTagsDraft] = useState('')

  const saveTimer = useRef(null)
  const pending = useRef({}) // buffered changes for the active note

  const viewQuery = useMemo(() => {
    if (view.kind === 'notebook') return { view: 'all', notebook: view.id }
    if (view.kind === 'tag') return { view: 'all', tag: view.tag }
    return { view: view.kind }
  }, [view])

  const loadNotes = useCallback(async () => {
    try {
      const params = { ...viewQuery }
      if (q.trim()) params.q = q.trim()
      const { data } = await api.get('/notes', { params })
      setNotes(data.notes)
    } catch (err) {
      toast?.error?.(apiError(err).message)
      setNotes([])
    }
  }, [viewQuery, q, toast])

  const loadNotebooks = useCallback(async () => {
    try {
      const { data } = await api.get('/notebooks')
      setNotebooks(data.notebooks)
    } catch {
      setNotebooks([])
    }
  }, [])

  useEffect(() => {
    if (!user) return
    // Reset to the loading state before the async fetch replaces the list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotes(null)
    loadNotes()
  }, [user, loadNotes])

  useEffect(() => {
    if (!user) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNotebooks()
  }, [user, loadNotebooks])

  // ----- saving -----

  const flushSave = useCallback(async () => {
    const noteId = pending.current.noteId
    const changes = pending.current.changes
    if (!noteId || !changes || Object.keys(changes).length === 0) return
    pending.current = {}
    setSaveState('saving')
    try {
      const { data } = await api.put(`/notes/${noteId}`, changes)
      setSaveState('saved')
      setNotes((list) =>
        list ? list.map((n) => (n.id === noteId ? { ...n, ...data.note } : n)) : list
      )
    } catch (err) {
      setSaveState('error')
      toast?.error?.(apiError(err, t('notesSaveFailed', 'Could not save the note')).message)
    }
  }, [toast, t])

  const queueSave = useCallback(
    (noteId, changes) => {
      pending.current = {
        noteId,
        changes: { ...(pending.current.noteId === noteId ? pending.current.changes : {}), ...changes },
      }
      setSaveState('dirty')
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(flushSave, AUTOSAVE_MS)
    },
    [flushSave]
  )

  // Flush on unmount / tab close.
  useEffect(() => {
    const onLeave = () => {
      clearTimeout(saveTimer.current)
      flushSave()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => {
      window.removeEventListener('beforeunload', onLeave)
      onLeave()
    }
  }, [flushSave])

  // ----- note actions -----

  const openNote = useCallback(
    async (id) => {
      clearTimeout(saveTimer.current)
      await flushSave()
      setActiveLoading(true)
      setMobilePane('editor')
      try {
        const { data } = await api.get(`/notes/${id}`)
        setActive(data.note)
        setTagsDraft((data.note.tags || []).join(', '))
        setSaveState('idle')
      } catch (err) {
        toast?.error?.(apiError(err).message)
      } finally {
        setActiveLoading(false)
      }
    },
    [flushSave, toast]
  )

  const createNote = async () => {
    try {
      const body = {}
      if (view.kind === 'notebook') body.notebookId = view.id
      const { data } = await api.post('/notes', body)
      setNotes((list) => [ { ...data.note }, ...(list || [])])
      setActive(data.note)
      setTagsDraft('')
      setSaveState('idle')
      setMobilePane('editor')
    } catch (err) {
      toast?.error?.(apiError(err).message)
    }
  }

  const patchActive = async (changes, { optimistic = true } = {}) => {
    if (!active) return
    if (optimistic) setActive((n) => ({ ...n, ...changes }))
    try {
      const { data } = await api.put(`/notes/${active.id}`, changes)
      setNotes((list) => {
        if (!list) return list
        const inView = (note) => {
          if (view.kind === 'trash') return note.trashed
          if (note.trashed) return false
          if (view.kind === 'archive') return note.archived
          if (note.archived) return view.kind === 'notebook' || view.kind === 'tag'
          if (view.kind === 'favorites') return note.favorite
          return true
        }
        const merged = list.map((n) => (n.id === active.id ? { ...n, ...data.note } : n))
        return merged.filter(inView)
      })
      setActive((n) => (n && n.id === active.id ? { ...n, ...data.note, content: n.content } : n))
    } catch (err) {
      toast?.error?.(apiError(err).message)
    }
  }

  const trashActive = async () => {
    if (!active) return
    const wasTrashed = active.trashed
    try {
      if (wasTrashed) {
        await api.delete(`/notes/${active.id}?permanent=1`)
      } else {
        await api.put(`/notes/${active.id}`, { trashed: true })
      }
      setNotes((list) => (list ? list.filter((n) => n.id !== active.id) : list))
      setActive(null)
      setMobilePane('list')
    } catch (err) {
      toast?.error?.(apiError(err).message)
    }
  }

  const restoreActive = async () => {
    if (!active) return
    try {
      await api.put(`/notes/${active.id}`, { trashed: false })
      setNotes((list) => (list ? list.filter((n) => n.id !== active.id) : list))
      setActive(null)
      setMobilePane('list')
    } catch (err) {
      toast?.error?.(apiError(err).message)
    }
  }

  const applyTags = () => {
    const tags = tagsDraft
      .split(/[,，]/)
      .map((s) => s.trim().replace(/^#/, ''))
      .filter(Boolean)
      .slice(0, 20)
    patchActive({ tags })
  }

  const createNotebook = async () => {
    const name = newNotebookName.trim()
    if (!name) return
    try {
      const { data } = await api.post('/notebooks', { name })
      setNotebooks((list) => [...list, data.notebook])
      setNotebookModal(false)
      setNewNotebookName('')
    } catch (err) {
      toast?.error?.(apiError(err).message)
    }
  }

  const removeNotebook = async (id) => {
    try {
      await api.delete(`/notebooks/${id}`)
      setNotebooks((list) => list.filter((n) => n.id !== id))
      if (view.kind === 'notebook' && view.id === id) setView({ kind: 'notes' })
    } catch (err) {
      toast?.error?.(apiError(err).message)
    }
  }

  // Tags across loaded notes (sidebar).
  const allTags = useMemo(() => {
    const counts = new Map()
    for (const n of notes || []) {
      for (const tag of n.tags || []) {
        const key = tag.toLowerCase()
        counts.set(key, { tag, n: (counts.get(key)?.n || 0) + 1 })
      }
    }
    return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 30)
  }, [notes])

  // ----- guards -----

  if (authLoading) {
    return (
      <AppShell>
        <PageLoader />
      </AppShell>
    )
  }
  if (!user) {
    return (
      <AppShell>
        <Head>
          <title>{t('notesTitle', 'Notes')} — 好好学习汉语</title>
        </Head>
        <div className="page">
          <EmptyState
            title={t('notesSignIn', 'Sign in to use notes')}
            text={t('notesSignInHint', 'Your notes sync across devices with your account.')}
          />
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Button onClick={() => router.push('/auth')}>{t('signIn', 'Sign in')}</Button>
          </div>
        </div>
      </AppShell>
    )
  }

  const SECTIONS = [
    { kind: 'notes', label: t('notesAll', 'Notes'), icon: '📝' },
    { kind: 'favorites', label: t('notesFavorites', 'Favorites'), icon: '★' },
    { kind: 'archive', label: t('notesArchive', 'Archive'), icon: '🗄' },
    { kind: 'trash', label: t('notesTrash', 'Trash'), icon: '🗑' },
  ]

  const viewTitle =
    view.kind === 'notebook'
      ? notebooks.find((n) => n.id === view.id)?.name || t('notesNotebook', 'Notebook')
      : view.kind === 'tag'
        ? `#${view.tag}`
        : SECTIONS.find((s) => s.kind === view.kind)?.label

  const saveLabel = {
    dirty: t('notesSavingSoon', 'Unsaved…'),
    saving: t('notesSaving', 'Saving…'),
    saved: t('notesSaved', 'Saved'),
    error: t('notesSaveFailed', 'Could not save the note'),
  }[saveState]

  return (
    <AppShell>
      <Head>
        <title>{t('notesTitle', 'Notes')} — 好好学习汉语</title>
      </Head>
      <div className={`notes notes--${mobilePane}`}>
        {/* ---- sidebar ---- */}
        <aside className="notes__sidebar">
          <div className="notes__side-section">
            {SECTIONS.map((s) => (
              <button
                key={s.kind}
                type="button"
                className={`notes__side-item${view.kind === s.kind ? ' is-active' : ''}`}
                onClick={() => {
                  setView({ kind: s.kind })
                  setActive(null)
                  setMobilePane('list')
                }}
              >
                <span className="notes__side-icon">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>

          <div className="notes__side-section">
            <div className="notes__side-head">
              <span>{t('notesNotebooks', 'Notebooks')}</span>
              <button type="button" className="notes__side-add" onClick={() => setNotebookModal(true)}>
                +
              </button>
            </div>
            {notebooks.map((nb) => (
              <div
                key={nb.id}
                className={`notes__side-item notes__side-item--nb${
                  view.kind === 'notebook' && view.id === nb.id ? ' is-active' : ''
                }`}
              >
                <button
                  type="button"
                  className="notes__side-nb-btn"
                  onClick={() => {
                    setView({ kind: 'notebook', id: nb.id })
                    setActive(null)
                    setMobilePane('list')
                  }}
                >
                  <span className="notes__side-icon">📔</span>
                  <span className="notes__side-label">{nb.name}</span>
                  <span className="notes__side-count">{nb.noteCount}</span>
                </button>
                <button
                  type="button"
                  className="notes__side-remove"
                  aria-label={t('delete', 'Delete')}
                  onClick={() => removeNotebook(nb.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {allTags.length > 0 && (
            <div className="notes__side-section">
              <div className="notes__side-head">
                <span>{t('notesTags', 'Tags')}</span>
              </div>
              <div className="notes__side-tags">
                {allTags.map(({ tag }) => (
                  <button
                    key={tag}
                    type="button"
                    className={`notes__tag${view.kind === 'tag' && view.tag === tag ? ' is-active' : ''}`}
                    onClick={() => {
                      setView({ kind: 'tag', tag })
                      setActive(null)
                      setMobilePane('list')
                    }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ---- note list ---- */}
        <section className="notes__list">
          <div className="notes__list-head">
            <h2>{viewTitle}</h2>
            {view.kind !== 'trash' && (
              <Button size="sm" onClick={createNote}>
                + {t('notesNew', 'New note')}
              </Button>
            )}
          </div>
          <div className="notes__search">
            <input
              type="search"
              value={q}
              placeholder={t('notesSearch', 'Search notes…')}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {notes === null ? (
            <Spinner />
          ) : notes.length === 0 ? (
            <EmptyState
              title={
                view.kind === 'trash'
                  ? t('notesTrashEmpty', 'Trash is empty')
                  : t('notesEmpty', 'No notes here yet')
              }
              hint={
                view.kind === 'trash'
                  ? t('notesTrashHint', 'Trashed notes are deleted forever after 30 days.')
                  : t('notesEmptyHint', 'Create a note — course summaries, vocab lists, anything.')
              }
            />
          ) : (
            <ul className="notes__items">
              {notes.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`notes__item${active?.id === n.id ? ' is-active' : ''}`}
                    onClick={() => openNote(n.id)}
                  >
                    <div className="notes__item-top">
                      <span className="notes__item-title">
                        {n.pinned ? <span className="notes__item-pin">📌</span> : null}
                        {n.title || t('notesUntitled', 'Untitled')}
                        {n.favorite ? <span className="notes__item-fav">★</span> : null}
                      </span>
                      <span className="notes__item-date">{dateLabel(n.updatedAt, language)}</span>
                    </div>
                    {n.headline ? <p className="notes__item-headline">{n.headline}</p> : null}
                    {(n.tags || []).length > 0 && (
                      <div className="notes__item-tags">
                        {n.tags.map((tag) => (
                          <span key={tag} className="notes__tag notes__tag--mini">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- editor pane ---- */}
        <section className="notes__editor">
          {activeLoading ? (
            <PageLoader />
          ) : !active ? (
            <div className="notes__editor-empty">
              <EmptyState
                title={t('notesPick', 'Select a note')}
                text={t('notesPickHint', 'Or create a new one — it saves as you type.')}
              />
            </div>
          ) : (
            <>
              <div className="notes__editor-bar">
                <button
                  type="button"
                  className="notes__back"
                  onClick={() => setMobilePane('list')}
                  aria-label={t('back', 'Back')}
                >
                  ←
                </button>
                <span className={`notes__save-state notes__save-state--${saveState}`}>{saveLabel || ''}</span>
                <div className="notes__editor-actions">
                  {!active.trashed ? (
                    <>
                      <button
                        type="button"
                        className={`notes__action${active.pinned ? ' is-active' : ''}`}
                        title={t('notesPin', 'Pin')}
                        onClick={() => patchActive({ pinned: !active.pinned })}
                      >
                        📌
                      </button>
                      <button
                        type="button"
                        className={`notes__action${active.favorite ? ' is-active' : ''}`}
                        title={t('notesFavorite', 'Favorite')}
                        onClick={() => patchActive({ favorite: !active.favorite })}
                      >
                        ★
                      </button>
                      <button
                        type="button"
                        className={`notes__action${active.archived ? ' is-active' : ''}`}
                        title={t('notesArchiveAction', 'Archive')}
                        onClick={() => patchActive({ archived: !active.archived })}
                      >
                        🗄
                      </button>
                      <select
                        className="notes__nb-select"
                        value={active.notebookId || ''}
                        onChange={(e) => patchActive({ notebookId: e.target.value || null })}
                        aria-label={t('notesNotebook', 'Notebook')}
                      >
                        <option value="">{t('notesNoNotebook', 'No notebook')}</option>
                        {notebooks.map((nb) => (
                          <option key={nb.id} value={nb.id}>
                            {nb.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="notes__action notes__action--danger"
                        title={t('notesTrashAction', 'Move to trash')}
                        onClick={trashActive}
                      >
                        🗑
                      </button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" onClick={restoreActive}>
                        {t('notesRestore', 'Restore')}
                      </Button>
                      <button
                        type="button"
                        className="notes__action notes__action--danger"
                        title={t('notesDeleteForever', 'Delete forever')}
                        onClick={trashActive}
                      >
                        🗑
                      </button>
                    </>
                  )}
                </div>
              </div>

              <input
                className="notes__title-input"
                value={active.title}
                placeholder={t('notesUntitled', 'Untitled')}
                readOnly={active.trashed}
                onChange={(e) => {
                  const title = e.target.value
                  setActive((n) => ({ ...n, title }))
                  queueSave(active.id, { title })
                }}
              />

              <Editor
                noteId={active.id}
                content={active.content}
                editable={!active.trashed}
                placeholder={t('notesPlaceholder', 'Write your note — lecture summaries, hanzi, anything…')}
                onChange={(json) => queueSave(active.id, { content: json })}
              />

              {!active.trashed && (
                <div className="notes__tags-row">
                  <input
                    value={tagsDraft}
                    placeholder={t('notesTagsPlaceholder', 'Tags, comma-separated (hsk3, grammar…)')}
                    onChange={(e) => setTagsDraft(e.target.value)}
                    onBlur={applyTags}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyTags())}
                  />
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <Modal
        open={notebookModal}
        onClose={() => setNotebookModal(false)}
        title={t('notesNewNotebook', 'New notebook')}
      >
        <Field
          label={t('notesNotebookName', 'Name')}
          value={newNotebookName}
          onChange={(e) => setNewNotebookName(e.target.value)}
          maxLength={80}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <Button variant="ghost" onClick={() => setNotebookModal(false)}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button onClick={createNotebook} disabled={!newNotebookName.trim()}>
            {t('create', 'Create')}
          </Button>
        </div>
      </Modal>
    </AppShell>
  )
}
