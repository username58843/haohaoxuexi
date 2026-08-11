import React, { useCallback, useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import AppShell from '~/components/AppShell'
import Reader from '~/components/books/Reader'
import { PageLoader, EmptyState, Button } from '~/components/ui'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { api } from '~/lib/api-client'
import { parseTxt } from '~/lib/books/parse'

const PdfViewer = dynamic(() => import('~/components/books/PdfViewer'), {
  ssr: false,
  loading: () => <PageLoader />,
})

/**
 * /books/read?b=<builtinId> | ?id=<localId> — the reading screen.
 * Builtin classics are fetched from /books/<file> once and cached in
 * IndexedDB; uploads are read straight from IndexedDB. Progress is written
 * to localStorage on every report and debounced to the account when
 * signed in.
 */

const SERVER_SYNC_MS = 4000

export default function ReadPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useSettings()
  const [state, setState] = useState({ status: 'loading' })
  const syncTimer = useRef(null)
  const lastSent = useRef(null)

  const builtinId = typeof router.query.b === 'string' ? router.query.b : null
  const localId = typeof router.query.id === 'string' ? router.query.id : null
  const progressId = builtinId ? `builtin:${builtinId}` : localId

  useEffect(() => {
    if (!router.isReady) return
    let alive = true
    ;(async () => {
      try {
        const store = await import('~/lib/books/store')
        let book = null
        let pdfBytes = null

        if (builtinId) {
          if (store.idbAvailable()) {
            book = await store.getBook(`builtin:${builtinId}`).catch(() => null)
          }
          if (!book) {
            const list = await fetch('/books/index.json').then((r) => r.json())
            const meta = list.find((b) => b.id === builtinId)
            if (!meta) throw new Error('not_found')
            const text = await fetch(`/books/${meta.file}`).then((r) => {
              if (!r.ok) throw new Error('not_found')
              return r.text()
            })
            const parsed = parseTxt(text, { fileName: meta.title })
            book = {
              id: `builtin:${builtinId}`,
              title: meta.title,
              author: meta.author,
              script: meta.script,
              type: 'builtin',
              mode: 'text',
              chapters: parsed.chapters,
              size: meta.size,
              addedAt: Date.now(),
            }
            if (store.idbAvailable()) store.putBook(book).catch(() => {})
          }
        } else if (localId) {
          if (!store.idbAvailable()) throw new Error('no_idb')
          book = await store.getBook(localId)
          if (!book) throw new Error('not_found')
          if (book.mode === 'pdf' || (book.type === 'pdf' && (!book.chapters || book.chapters.length === 0))) {
            pdfBytes = await store.getBookBlob(localId)
            if (!pdfBytes) throw new Error('pdf_blob_missing')
            book = { ...book, mode: 'pdf' }
          } else {
            book = { ...book, mode: book.mode || 'text' }
          }
        } else {
          throw new Error('not_found')
        }

        // Resume position: local first, server (if newer) on top.
        let resume = { chapter: 0, offset: 0 }
        let local = {}
        try {
          local = JSON.parse(localStorage.getItem('hhx_book_progress') || '{}')
        } catch {
          local = {}
        }
        const pid = book.id.startsWith('builtin:') ? book.id : localId
        if (local[pid]) resume = local[pid]
        if (user) {
          try {
            const { data } = await api.get('/books/progress')
            const remote = (data.items || []).find((i) => i.bookId === pid)
            if (remote && new Date(remote.updatedAt).getTime() > (local[pid]?.updatedAt || 0)) {
              resume = { chapter: remote.chapter, offset: remote.offset }
            }
          } catch {
            // offline / signed-out — local resume is fine
          }
        }
        if (alive) setState({ status: 'ready', book, resume, pdfBytes })
      } catch (err) {
        if (alive) setState({ status: 'error', code: err?.message })
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, builtinId, localId])

  const onProgress = useCallback(
    (chapter, offset, percent) => {
      if (!progressId || !state.book) return
      const record = {
        chapter,
        offset: Math.round(offset * 1000) / 1000,
        percent,
        title: state.book.title,
        updatedAt: Date.now(),
      }
      try {
        const all = JSON.parse(localStorage.getItem('hhx_book_progress') || '{}')
        all[progressId] = record
        localStorage.setItem('hhx_book_progress', JSON.stringify(all))
      } catch {
        // localStorage unavailable — server sync still applies
      }
      if (!user) return
      clearTimeout(syncTimer.current)
      syncTimer.current = setTimeout(() => {
        const key = `${record.chapter}:${record.offset}`
        if (lastSent.current === key) return
        lastSent.current = key
        api
          .put('/books/progress', {
            bookId: progressId,
            title: state.book.title,
            chapter: record.chapter,
            offset: record.offset,
            percent: record.percent,
          })
          .catch(() => {})
      }, SERVER_SYNC_MS)
    },
    [progressId, state.book, user]
  )

  useEffect(() => () => clearTimeout(syncTimer.current), [])

  const title = state.book?.title || t('booksTitle', 'Books')
  const goLibrary = () => router.push('/books')

  return (
    <AppShell bare>
      <Head>
        <title>{title} — 好好学习汉语</title>
      </Head>
      {state.status === 'loading' && <PageLoader />}
      {state.status === 'error' && (
        <div className="page">
          <EmptyState
            glyph="书"
            title={
              state.code === 'pdf_blob_missing'
                ? t('booksPdfBlobMissing', 'PDF data is missing — please re-add the book')
                : t('booksNotFound', 'Book not found')
            }
            text={
              state.code === 'no_idb'
                ? t('booksNoIdb', 'This browser does not support local book storage.')
                : t('booksNotFoundHint', 'It may have been removed from this browser.')
            }
            action={
              <Button onClick={goLibrary}>{t('booksBackToLibrary', 'Back to the library')}</Button>
            }
          />
        </div>
      )}
      {state.status === 'ready' && state.book.mode === 'pdf' && state.pdfBytes && (
        <PdfViewer
          arrayBuffer={state.pdfBytes}
          title={state.book.title}
          initialPage={state.resume.chapter || 0}
          onProgress={onProgress}
          onBack={goLibrary}
        />
      )}
      {state.status === 'ready' && state.book.mode !== 'pdf' && (
        <Reader
          book={state.book}
          initialChapter={state.resume.chapter}
          initialOffset={state.resume.offset}
          onProgress={onProgress}
        />
      )}
    </AppShell>
  )
}
