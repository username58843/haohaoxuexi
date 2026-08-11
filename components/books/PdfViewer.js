import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { loadPdfJs } from '~/lib/books/parse'
import { Spinner } from '~/components/ui'

/**
 * Page-canvas PDF viewer for scanned / image-only books.
 * Renders one page at a time at device pixel ratio. Dictionary popup is not
 * available here (no text layer) — user is told so in the bar.
 */
const PDFJS_CMAP_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.49.0/cmaps/'
const PDFJS_FONT_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.49.0/standard_fonts/'

export default function PdfViewer({
  arrayBuffer,
  title,
  initialPage = 0,
  onProgress,
  onBack,
}) {
  const { t } = useSettings()
  const canvasRef = useRef(null)
  const docRef = useRef(null)
  const renderTask = useRef(null)
  const [status, setStatus] = useState('loading') // loading|ready|error
  const [pageIdx, setPageIdx] = useState(Math.max(0, initialPage | 0))
  const [pageCount, setPageCount] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [error, setError] = useState('')

  // Open document once.
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const pdfjs = await loadPdfJs()
        const data =
          arrayBuffer instanceof ArrayBuffer ? arrayBuffer.slice(0) : arrayBuffer
        const doc = await pdfjs.getDocument({
          data,
          cMapUrl: PDFJS_CMAP_URL,
          cMapPacked: true,
          standardFontDataUrl: PDFJS_FONT_URL,
          useSystemFonts: true,
          stopAtErrors: false,
          verbosity: 0,
        }).promise
        if (!alive) {
          doc.destroy()
          return
        }
        docRef.current = doc
        setPageCount(doc.numPages)
        setPageIdx((i) => Math.min(Math.max(0, i), doc.numPages - 1))
        setStatus('ready')
      } catch (err) {
        if (!alive) return
        setError(String(err?.message || err))
        setStatus('error')
      }
    })()
    return () => {
      alive = false
      renderTask.current?.cancel?.()
      docRef.current?.destroy?.()
      docRef.current = null
    }
  }, [arrayBuffer])

  // Render current page.
  useEffect(() => {
    if (status !== 'ready' || !docRef.current || !canvasRef.current) return
    let cancelled = false
    ;(async () => {
      try {
        renderTask.current?.cancel?.()
        const page = await docRef.current.getPage(pageIdx + 1)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const containerW = Math.min(window.innerWidth - 32, 860)
        const fit = containerW / base.width
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const scale = fit * zoom
        const viewport = page.getViewport({ scale: scale * dpr })
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d', { alpha: false })
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`
        const task = page.render({ canvasContext: ctx, viewport })
        renderTask.current = task
        await task.promise
        page.cleanup()
        const percent =
          Math.round(((pageIdx + 1) / Math.max(1, pageCount)) * 1000) / 10
        onProgress?.(pageIdx, 0, percent)
      } catch (err) {
        if (err?.name === 'RenderingCancelledException') return
        // keep last frame on soft failure
      }
    })()
    return () => {
      cancelled = true
      renderTask.current?.cancel?.()
    }
  }, [status, pageIdx, zoom, pageCount, onProgress])

  const goto = useCallback(
    (idx) => {
      if (idx < 0 || idx >= pageCount) return
      setPageIdx(idx)
      window.scrollTo(0, 0)
    },
    [pageCount]
  )

  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') goto(pageIdx + 1)
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') goto(pageIdx - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pageIdx, goto])

  if (status === 'loading') {
    return (
      <div className="reader reader--pdf">
        <div className="reader__loading">
          <Spinner />
          <span>{t('booksPdfOpening', 'Opening PDF…')}</span>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="reader reader--pdf">
        <header className="reader__bar">
          <button type="button" className="reader__bar-btn" onClick={onBack} aria-label={t('back', 'Back')}>
            ←
          </button>
          <div className="reader__bar-title">
            <strong>{title}</strong>
          </div>
        </header>
        <div className="reader__loading">
          <p>{t('booksPdfOpenFailed', 'Could not open this PDF')}</p>
          {error ? <p className="reader__hint">{error}</p> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="reader reader--pdf">
      <header className="reader__bar">
        <button type="button" className="reader__bar-btn" onClick={onBack} aria-label={t('back', 'Back')}>
          ←
        </button>
        <div className="reader__bar-title">
          <strong className="hanzi" lang="zh">
            {title}
          </strong>
          <span>
            {pageIdx + 1} / {pageCount}
          </span>
        </div>
        <div className="reader__bar-actions">
          <button
            type="button"
            className="reader__bar-btn"
            onClick={() => setZoom((z) => Math.max(0.7, Math.round((z - 0.15) * 100) / 100))}
            title={t('booksZoomOut', 'Zoom out')}
          >
            −
          </button>
          <button
            type="button"
            className="reader__bar-btn"
            onClick={() => setZoom(1)}
            title={t('booksZoomReset', 'Reset zoom')}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className="reader__bar-btn"
            onClick={() => setZoom((z) => Math.min(2.4, Math.round((z + 0.15) * 100) / 100))}
            title={t('booksZoomIn', 'Zoom in')}
          >
            +
          </button>
        </div>
      </header>

      <p className="reader__scan-banner">
        {t(
          'booksScanMode',
          'Scan mode — pages are images. Word dictionary works on text-layer PDFs, TXT and EPUB.'
        )}
      </p>

      <main className="reader__pdf-stage">
        <canvas ref={canvasRef} className="reader__pdf-canvas" />
      </main>

      <nav className="reader__pager">
        <button
          type="button"
          className="reader__pager-btn"
          disabled={pageIdx === 0}
          onClick={() => goto(pageIdx - 1)}
        >
          ← {t('booksPrevChapter', 'Previous')}
        </button>
        <span className="reader__pager-info">
          {pageIdx + 1} / {pageCount}
        </span>
        <button
          type="button"
          className="reader__pager-btn"
          disabled={pageIdx >= pageCount - 1}
          onClick={() => goto(pageIdx + 1)}
        >
          {t('booksNextChapter', 'Next')} →
        </button>
      </nav>
    </div>
  )
}
