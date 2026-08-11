import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { loadDictionary } from '~/lib/books/dict-client'
import { segmentText, sentenceAround } from '~/lib/books/segment'
import WordPopup from './WordPopup'
import AiPanel from './AiPanel'

/**
 * The reading surface: one chapter at a time, every dictionary word is a
 * tap/hover target for the popup dictionary. Rendering is event-delegated —
 * thousands of word spans share the two handlers on the container.
 */

const FONT_SIZES = [16, 18, 20, 22, 24, 26]
const HOVER_DELAY_MS = 220

function readerPrefs() {
  try {
    return JSON.parse(localStorage.getItem('hhx_reader_prefs') || '{}')
  } catch {
    return {}
  }
}

export default function Reader({ book, initialChapter = 0, initialOffset = 0, onProgress }) {
  const { t } = useSettings()
  const [dict, setDict] = useState(null)
  const [chapterIdx, setChapterIdx] = useState(
    Math.min(Math.max(initialChapter, 0), book.chapters.length - 1)
  )
  const prefs = useMemo(() => readerPrefs(), [])
  const [fontSize, setFontSize] = useState(prefs.fontSize || 20)
  const [pinyinOn, setPinyinOn] = useState(!!prefs.pinyinOn)
  const [popup, setPopup] = useState(null)
  const [panel, setPanel] = useState(null) // 'chapters' | 'settings' | 'ai' | null
  const contentRef = useRef(null)
  const hoverTimer = useRef(null)
  const pendingOffset = useRef(initialOffset)
  const canHover = useRef(false)

  useEffect(() => {
    canHover.current =
      typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)')?.matches
  }, [])

  useEffect(() => {
    let alive = true
    loadDictionary()
      .then((d) => alive && setDict(d))
      .catch(() => {}) // reader still works without the dictionary
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('hhx_reader_prefs', JSON.stringify({ fontSize, pinyinOn }))
    } catch {
      // storage full/blocked — prefs just won't stick
    }
  }, [fontSize, pinyinOn])

  const chapter = book.chapters[chapterIdx]

  // Segment the chapter: [{ text, tokens: [{ t, d?, start }] }] per paragraph.
  const paragraphs = useMemo(() => {
    const paras = (chapter?.text || '').split('\n').filter((p) => p.trim())
    return paras.map((text) => {
      const tokens = segmentText(text, dict)
      let at = 0
      for (const tok of tokens) {
        tok.start = at
        at += tok.t.length
      }
      return { text, tokens }
    })
  }, [chapter, dict])

  // Restore scroll position when entering the chapter (or on first load).
  useEffect(() => {
    const offset = pendingOffset.current
    pendingOffset.current = 0
    const el = document.scrollingElement
    if (!el) return
    requestAnimationFrame(() => {
      const max = el.scrollHeight - window.innerHeight
      window.scrollTo(0, offset > 0 && max > 0 ? offset * max : 0)
    })
  }, [chapterIdx, paragraphs])

  // Progress reporting (throttled scroll → parent persists).
  useEffect(() => {
    let ticking = false
    const report = () => {
      ticking = false
      const el = document.scrollingElement
      if (!el) return
      const max = el.scrollHeight - window.innerHeight
      const offset = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0
      const percent = Math.round(((chapterIdx + offset) / book.chapters.length) * 1000) / 10
      onProgress?.(chapterIdx, offset, percent)
    }
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        setTimeout(report, 400)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    report()
    return () => window.removeEventListener('scroll', onScroll)
  }, [chapterIdx, book.chapters.length, onProgress])

  const gotoChapter = useCallback(
    (idx) => {
      if (idx < 0 || idx >= book.chapters.length) return
      pendingOffset.current = 0
      setPopup(null)
      setPanel(null)
      setChapterIdx(idx)
    },
    [book.chapters.length]
  )

  // Keyboard: ←/→ chapters.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return
      if (e.key === 'ArrowRight') gotoChapter(chapterIdx + 1)
      if (e.key === 'ArrowLeft') gotoChapter(chapterIdx - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chapterIdx, gotoChapter])

  const openPopupFor = useCallback(
    (span) => {
      const p = Number(span.getAttribute('data-p'))
      const i = Number(span.getAttribute('data-i'))
      const para = paragraphs[p]
      const token = para?.tokens[i]
      if (!token) return
      setPopup({
        word: token.t,
        entry: token.d || null,
        rect: span.getBoundingClientRect(),
        sentence: sentenceAround(para.text, token.start),
      })
    },
    [paragraphs]
  )

  const onContentClick = useCallback(
    (e) => {
      const span = e.target.closest?.('[data-tok]')
      if (!span) return
      clearTimeout(hoverTimer.current)
      openPopupFor(span)
    },
    [openPopupFor]
  )

  const onContentOver = useCallback(
    (e) => {
      if (!canHover.current) return
      const span = e.target.closest?.('[data-tok]')
      if (!span) return
      clearTimeout(hoverTimer.current)
      hoverTimer.current = setTimeout(() => openPopupFor(span), HOVER_DELAY_MS)
    },
    [openPopupFor]
  )

  const onContentOut = useCallback(() => clearTimeout(hoverTimer.current), [])

  const percentNow = Math.round(((chapterIdx + 1) / book.chapters.length) * 100)

  return (
    <div className="reader" style={{ '--reader-font': `${fontSize}px` }}>
      <header className="reader__bar">
        <button
          type="button"
          className="reader__bar-btn"
          onClick={() => {
            if (typeof window !== 'undefined' && window.history.length > 1) {
              window.history.back()
            } else {
              window.location.href = '/books'
            }
          }}
          aria-label={t('back', 'Back')}
        >
          ←
        </button>
        <div className="reader__bar-title">
          <strong className="hanzi" lang="zh">
            {book.title}
          </strong>
          {book.chapters.length > 1 && (
            <span>
              {chapterIdx + 1} / {book.chapters.length}
            </span>
          )}
        </div>
        <div className="reader__bar-actions">
          <button
            type="button"
            className={`reader__bar-btn${pinyinOn ? ' is-active' : ''}`}
            onClick={() => setPinyinOn((v) => !v)}
            title={t('booksPinyin', 'Pinyin')}
          >
            拼
          </button>
          <button
            type="button"
            className={`reader__bar-btn${panel === 'ai' ? ' is-active' : ''}`}
            onClick={() => setPanel(panel === 'ai' ? null : 'ai')}
            title={t('booksAi', 'AI retelling')}
          >
            ✨
          </button>
          <button
            type="button"
            className={`reader__bar-btn${panel === 'chapters' ? ' is-active' : ''}`}
            onClick={() => setPanel(panel === 'chapters' ? null : 'chapters')}
            title={t('booksChapters', 'Chapters')}
          >
            ☰
          </button>
          <button
            type="button"
            className={`reader__bar-btn${panel === 'settings' ? ' is-active' : ''}`}
            onClick={() => setPanel(panel === 'settings' ? null : 'settings')}
            title={t('settings', 'Settings')}
          >
            Aa
          </button>
        </div>
      </header>

      <main
        className={`reader__content${pinyinOn ? ' reader__content--ruby' : ''}`}
        ref={contentRef}
        onClick={onContentClick}
        onMouseOver={onContentOver}
        onMouseOut={onContentOut}
      >
        {chapter?.title ? (
          <h2 className="reader__chapter-title hanzi" lang="zh">
            {chapter.title}
          </h2>
        ) : null}
        {paragraphs.map((para, p) => (
          <p key={p} className="reader__para hanzi" lang="zh">
            {para.tokens.map((tok, i) =>
              tok.d ? (
                <span key={i} className="reader__w" data-tok data-p={p} data-i={i}>
                  {pinyinOn ? (
                    <ruby>
                      {tok.t}
                      <rt>{tok.d.pinyin}</rt>
                    </ruby>
                  ) : (
                    tok.t
                  )}
                </span>
              ) : (
                <span key={i} data-tok={tok.t.length <= 4 && /[一-鿿]/.test(tok.t) ? '' : undefined} data-p={p} data-i={i}>
                  {tok.t}
                </span>
              )
            )}
          </p>
        ))}

        <nav className="reader__pager">
          <button
            type="button"
            className="reader__pager-btn"
            disabled={chapterIdx === 0}
            onClick={() => gotoChapter(chapterIdx - 1)}
          >
            ← {t('booksPrevChapter', 'Previous')}
          </button>
          <span className="reader__pager-info">{percentNow}%</span>
          <button
            type="button"
            className="reader__pager-btn"
            disabled={chapterIdx >= book.chapters.length - 1}
            onClick={() => gotoChapter(chapterIdx + 1)}
          >
            {t('booksNextChapter', 'Next')} →
          </button>
        </nav>
      </main>

      {panel === 'chapters' && (
        <div className="reader__drawer" role="dialog">
          <div className="reader__drawer-head">
            <strong>{t('booksChapters', 'Chapters')}</strong>
            <button type="button" className="reader__bar-btn" onClick={() => setPanel(null)}>
              ✕
            </button>
          </div>
          <ol className="reader__toc">
            {book.chapters.map((ch, i) => (
              <li key={i}>
                <button
                  type="button"
                  className={`reader__toc-item${i === chapterIdx ? ' is-active' : ''}`}
                  onClick={() => gotoChapter(i)}
                >
                  <span className="hanzi" lang="zh">
                    {ch.title || `${i + 1}`}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {panel === 'settings' && (
        <div className="reader__drawer" role="dialog">
          <div className="reader__drawer-head">
            <strong>{t('settings', 'Settings')}</strong>
            <button type="button" className="reader__bar-btn" onClick={() => setPanel(null)}>
              ✕
            </button>
          </div>
          <div className="reader__setting">
            <span>{t('booksFontSize', 'Font size')}</span>
            <div className="reader__font-sizes">
              {FONT_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`reader__font-btn${fontSize === s ? ' is-active' : ''}`}
                  style={{ fontSize: 12 + (s - 16) / 2 }}
                  onClick={() => setFontSize(s)}
                >
                  A
                </button>
              ))}
            </div>
          </div>
          <div className="reader__setting">
            <span>{t('booksPinyinAbove', 'Pinyin above words')}</span>
            <button
              type="button"
              className={`reader__font-btn${pinyinOn ? ' is-active' : ''}`}
              onClick={() => setPinyinOn((v) => !v)}
            >
              拼音
            </button>
          </div>
          <p className="reader__hint">{t('booksTapHint', 'Tap any word to see its translation.')}</p>
        </div>
      )}

      {panel === 'ai' && <AiPanel chapterText={chapter?.text || ''} onClose={() => setPanel(null)} />}

      <WordPopup data={popup} onClose={() => setPopup(null)} />
    </div>
  )
}
