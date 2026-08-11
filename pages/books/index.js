import React, { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import AppShell from '~/components/AppShell'
import { Button, EmptyState, Spinner, useToast } from '~/components/ui'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { api } from '~/lib/api-client'

/**
 * Books — the reading library. Three shelves:
 *   Continue reading  — synced progress (server when signed in, else local)
 *   Classics          — bundled public-domain works served from /books/*
 *   My books          — user uploads (TXT / EPUB / PDF), parsed and stored
 *                       entirely in the browser's IndexedDB
 */

const AUTHOR_NOTE = {
  simplified: '简体',
  traditional: '繁體',
}

const MAX_BYTES = 80 * 1024 * 1024

function coverHue(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return h
}

function formatSize(n) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function BooksPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { t } = useSettings()
  const toast = useToast()
  const fileRef = useRef(null)

  const [builtin, setBuiltin] = useState(null)
  const [mine, setMine] = useState(null)
  const [progress, setProgress] = useState({}) // bookId → {chapter, percent, title, updatedAt}
  const [busy, setBusy] = useState(false)
  const [parsePct, setParsePct] = useState(0)

  useEffect(() => {
    fetch('/books/index.json')
      .then((r) => (r.ok ? r.json() : []))
      .then(setBuiltin)
      .catch(() => setBuiltin([]))
  }, [])

  useEffect(() => {
    let alive = true
    import('~/lib/books/store').then(({ idbAvailable, listBooks }) => {
      if (!idbAvailable()) return alive && setMine([])
      listBooks()
        .then((items) => alive && setMine(items.filter((b) => b.type !== 'builtin')))
        .catch(() => alive && setMine([]))
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let local = {}
    try {
      local = JSON.parse(localStorage.getItem('hhx_book_progress') || '{}')
    } catch {
      local = {}
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(local)
    if (!user) return
    let alive = true
    api
      .get('/books/progress')
      .then(({ data }) => {
        if (!alive) return
        const merged = { ...local }
        for (const item of data.items || []) {
          const cur = merged[item.bookId]
          if (!cur || new Date(item.updatedAt).getTime() >= (cur.updatedAt || 0)) {
            merged[item.bookId] = {
              chapter: item.chapter,
              offset: item.offset,
              percent: item.percent,
              title: item.title,
              updatedAt: new Date(item.updatedAt).getTime(),
            }
          }
        }
        setProgress(merged)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [user])

  const onUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_BYTES) {
      toast?.error?.(t('booksTooLarge', 'File is too large (80 MB max)'))
      return
    }
    setBusy(true)
    setParsePct(0)
    try {
      const [{ parseFile }, store] = await Promise.all([
        import('~/lib/books/parse'),
        import('~/lib/books/store'),
      ])
      if (!store.idbAvailable()) throw new Error('no_idb')
      const parsed = await parseFile(file, {
        onProgress: (done, total) => {
          if (total > 0) setParsePct(Math.round((done / total) * 100))
        },
      })
      const id = store.makeBookId(file.name, file.size)
      const type = /\.epub$/i.test(file.name)
        ? 'epub'
        : /\.pdf$/i.test(file.name)
          ? 'pdf'
          : 'txt'
      const mode = parsed.mode === 'pdf' ? 'pdf' : 'text'
      const book = {
        id,
        title: parsed.title,
        author: parsed.author || '',
        script: '',
        type,
        mode,
        chapters: mode === 'text' ? parsed.chapters : [],
        pageCount: parsed.pageCount || (parsed.chapters?.length || 0),
        size: file.size,
        addedAt: Date.now(),
      }
      if (mode === 'pdf') {
        const bytes = parsed.pdfBytes || (await file.arrayBuffer())
        await store.putBookWithBlob(book, bytes)
      } else {
        await store.putBook(book)
      }
      router.push(`/books/read?id=${encodeURIComponent(id)}`)
    } catch (err) {
      const code = err?.message || ''
      const msg =
        code === 'pdf_no_text'
          ? t('booksPdfNoText', 'This PDF has no text layer (scanned pages can’t be read)')
          : code === 'pdf_encrypted'
            ? t('booksPdfEncrypted', 'This PDF is password-protected and can’t be opened')
            : code === 'pdf_open_failed'
              ? t('booksPdfOpenFailed', 'Could not open this PDF')
              : code === 'no_idb'
                ? t('booksNoIdb', 'This browser does not support local book storage.')
                : t(
                    'booksParseFailed',
                    'Could not read this file — try TXT, EPUB or a PDF (text or scan)'
                  )
      toast?.error?.(msg)
    } finally {
      setBusy(false)
      setParsePct(0)
    }
  }

  const removeMine = async (id) => {
    const { deleteBook } = await import('~/lib/books/store')
    await deleteBook(id).catch(() => {})
    setMine((list) => (list || []).filter((b) => b.id !== id))
    if (user) api.delete('/books/progress', { data: { bookId: id } }).catch(() => {})
  }

  const continueItems = Object.entries(progress)
    .map(([bookId, p]) => ({ bookId, ...p }))
    .filter((p) => p.percent > 0 && p.percent < 99.5 && p.title)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 6)

  const hrefFor = (bookId) =>
    bookId.startsWith('builtin:')
      ? `/books/read?b=${encodeURIComponent(bookId.slice(8))}`
      : `/books/read?id=${encodeURIComponent(bookId)}`

  return (
    <AppShell>
      <Head>
        <title>{t('booksTitle', 'Books')} — 好好学习汉语</title>
      </Head>
      <div className="page page--wide books">
        <header className="page__head books__hero">
          <div>
            <p className="eyebrow">{t('booksEyebrow', 'Reading')}</p>
            <h1>{t('booksTitle', 'Books')}</h1>
            <p className="page__sub">
              {t(
                'booksSubtitle',
                'Read Chinese in the original — tap any word for an instant translation.'
              )}
            </p>
          </div>
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy
              ? parsePct > 0
                ? `${t('booksParsing', 'Reading file…')} ${parsePct}%`
                : t('booksParsing', 'Reading file…')
              : `+ ${t('booksUpload', 'Add a book')}`}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.epub,.pdf,.md,.text,text/plain,application/epub+zip,application/pdf"
            hidden
            onChange={onUpload}
          />
        </header>

        {continueItems.length > 0 && (
          <section className="books__section">
            <h2>{t('booksContinue', 'Continue reading')}</h2>
            <div className="books__continue">
              {continueItems.map((p) => (
                <button
                  key={p.bookId}
                  type="button"
                  className="books__continue-card"
                  onClick={() => router.push(hrefFor(p.bookId))}
                >
                  <span className="books__continue-title hanzi" lang="zh">
                    {p.title}
                  </span>
                  <span className="books__continue-meta">
                    {Math.round(p.percent)}% · {t('booksChapterShort', 'ch.')} {p.chapter + 1}
                  </span>
                  <span className="books__progress">
                    <span style={{ width: `${Math.min(100, p.percent)}%` }} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="books__section">
          <div className="books__section-head">
            <h2>{t('booksMine', 'My books')}</h2>
          </div>
          <p className="books__hint">
            {t(
              'booksUploadHint',
              'TXT, EPUB or PDF (including scans). Books stay in this browser only — nothing is uploaded; reading progress syncs with your account.'
            )}
          </p>
          {mine === null ? (
            <Spinner />
          ) : mine.length === 0 ? (
            <div className="books__empty-card">
              <EmptyState
                glyph="书"
                title={t('booksMineEmpty', 'No books yet')}
                text={t(
                  'booksMineEmptyHint',
                  'Add your own book and read it with the built-in dictionary.'
                )}
                action={
                  <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
                    + {t('booksUpload', 'Add a book')}
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="books__grid">
              {mine.map((b) => {
                const p = progress[b.id]
                const chapters = b.chapterCount || b.pageCount || 0
                return (
                  <div key={b.id} className="books__card" style={{ '--cover-hue': coverHue(b.id) }}>
                    <button
                      type="button"
                      className="books__card-body"
                      onClick={() => router.push(`/books/read?id=${encodeURIComponent(b.id)}`)}
                    >
                      <span className="books__cover hanzi" lang="zh">
                        {(b.title || '书').slice(0, 4)}
                      </span>
                      <span className="books__card-title" title={b.title}>
                        {b.title}
                      </span>
                      <span className="books__card-meta">
                        {b.type.toUpperCase()}
                        {b.mode === 'pdf' ? ` · ${t('booksScanBadge', 'scan')}` : ''}
                        {chapters ? ` · ${chapters} ${t('booksChaptersShort', 'ch.')}` : ''}
                        {p ? ` · ${Math.round(p.percent)}%` : ''}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="books__card-remove"
                      aria-label={t('delete', 'Delete')}
                      onClick={() => removeMine(b.id)}
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="books__section">
          <h2>{t('booksClassics', 'Classics library')}</h2>
          <p className="books__hint">
            {t('booksClassicsHint', 'Public-domain Chinese classics, free to read.')}
          </p>
          {builtin === null ? (
            <Spinner />
          ) : (
            <div className="books__grid">
              {builtin.map((b) => {
                const p = progress[`builtin:${b.id}`]
                return (
                  <div key={b.id} className="books__card" style={{ '--cover-hue': coverHue(b.id) }}>
                    <button
                      type="button"
                      className="books__card-body"
                      onClick={() => router.push(`/books/read?b=${encodeURIComponent(b.id)}`)}
                    >
                      <span className="books__cover hanzi" lang="zh">
                        {b.title.slice(0, 4)}
                      </span>
                      <span className="books__card-title hanzi" lang="zh">
                        {b.title}
                      </span>
                      <span className="books__card-meta">
                        {b.author} · {AUTHOR_NOTE[b.script] || ''}
                        {b.chapters ? ` · ${b.chapters} ${t('booksChaptersShort', 'ch.')}` : ''}
                        {p ? ` · ${Math.round(p.percent)}%` : ''}
                        {b.size ? ` · ${formatSize(b.size)}` : ''}
                      </span>
                      {p ? (
                        <span className="books__progress books__progress--card">
                          <span style={{ width: `${Math.min(100, p.percent)}%` }} />
                        </span>
                      ) : null}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {!user && !authLoading && (
          <p className="books__signin-hint">
            {t(
              'booksSignInHint',
              'Sign in to sync reading progress, translate sentences and use AI retelling.'
            )}
          </p>
        )}
      </div>
    </AppShell>
  )
}
