import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import AppShell from '~/components/AppShell'
import WordSheet from '~/components/WordSheet'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { speakLong } from '~/lib/speech'
import { READING_RANGES, READING_LANGUAGES, normalizeReaderPreferences, readerPage, validateReadingDocument } from '~/lib/learning/reader-state'

const PREFS_KEY = 'hhx_memorize_preferences_v1'
const POSITION_KEY = 'hhx_memorize_position_v1:'
const subscribe = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

function readLocal(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}
function writeLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Reading also works without storage. */ }
}

function Story({ preferences }) {
  const { language: uiLanguage, t } = useSettings()
  const { range, pinyin, translation, fontSize } = preferences
  const language = preferences.language || (READING_LANGUAGES[uiLanguage] ? uiLanguage : 'en')
  const [state, setState] = useState({ status: 'loading', document: null, page: 0 })
  const [retry, setRetry] = useState(0)
  const [word, setWord] = useState(null)
  const [speaking, setSpeaking] = useState(false)
  const [audioError, setAudioError] = useState(false)
  const narration = useRef(null)
  const heading = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/learning/${range}.json`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('reading'); return response.json() })
      .then((raw) => {
        const document = validateReadingDocument(raw, range)
        if (!controller.signal.aborted) setState({ status: 'ready', document,
          page: readerPage(readLocal(POSITION_KEY + range), document) })
      })
      .catch((error) => { if (!controller.signal.aborted && error.name !== 'AbortError') setState({ status: 'error', document: null, page: 0 }) })
    return () => controller.abort()
  }, [range, retry])

  useEffect(() => () => narration.current?.stop(), [])

  function stop() {
    narration.current?.stop()
    narration.current = null
    setSpeaking(false)
  }
  function listen() {
    if (speaking) { stop(); return }
    setAudioError(false)
    setSpeaking(true)
    const text = state.document.passages.flatMap((passage) => passage.sentences.map((sentence) => sentence.zh)).join('\n')
    const audio = speakLong(text, { lang: 'zh', onDone: () => setSpeaking(false), onError: () => setAudioError(true) })
    narration.current = audio
    if (!audio) { setSpeaking(false); setAudioError(true) }
  }
  function goToPage(page) {
    const clamped = Math.max(0, Math.min(state.document.passages.length - 1, page))
    setState((previous) => ({ ...previous, page: clamped }))
    writeLocal(POSITION_KEY + range, { revision: state.document.revision, page: clamped })
    requestAnimationFrame(() => {
      heading.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      heading.current?.focus({ preventScroll: true })
    })
  }

  if (state.status === 'error') return <div role="alert" className="learning-notice">
    <p>{t('memorize.error')}</p>
    <button className="btn btn--soft" onClick={() => { setState({ status: 'loading', document: null, page: 0 }); setRetry((value) => value + 1) }}>{t('hskRetry', 'Retry')}</button>
  </div>
  if (state.status !== 'ready') return <p role="status">{t('memorize.loading')}</p>
  const document = state.document
  const passage = document.passages[state.page]
  const { covered, total, outside } = document.coverage
  const percent = (100 * covered / total).toFixed(1)

  return <>
    <section className="memorize-coverage" aria-label={t('memorize.coverage')}>
      <div><strong>{t('memorize.coverage')}</strong><span>{covered.toLocaleString(uiLanguage)} / {total.toLocaleString(uiLanguage)} · {percent}%</span></div>
      <progress max={total} value={covered} aria-label={t('memorize.coverage')} />
      {document.status !== 'complete' && <p className="learning-notice">{t('memorize.draft')}</p>}
      {outside > 0 && <p>{t('memorize.outside')}: {outside}</p>}
    </section>
    <div className="learning-actions memorize-audio">
      <button className="btn btn--primary" onClick={listen} aria-pressed={speaking}>{speaking ? '■ ' + t('memorize.stop') : '▶ ' + t('memorize.listen')}</button>
      <button className="btn btn--soft" onClick={() => goToPage(0)} disabled={state.page === 0}>{t('memorize.reset')}</button>
    </div>
    {audioError && <p role="alert" className="learning-notice">{t('memorize.audioError')}</p>}
    <article className="memorize-story" style={{ '--reading-size': `${fontSize}px` }}>
      <div className="learning-eyebrow">{document.title[uiLanguage] || document.title.en}</div>
      <h2 ref={heading} tabIndex={-1}>{passage.title[uiLanguage] || passage.title.en}</h2>
      <p className="learning-muted">{t('memorize.chapter')} {state.page + 1} / {document.passages.length}</p>
      {passage.sentences.map((sentence, index) => <div className="memorize-sentence" key={`${passage.id}:${index}`}>
        <p className={`memorize-chinese${pinyin ? ' has-pinyin' : ''}`} lang="zh">
          {sentence.tokens.map((token, tokenIndex) => token.wordId
            ? <button type="button" key={tokenIndex} className="memorize-word" aria-label={`${token.text} · ${token.pinyin}`}
              onClick={() => { stop(); setWord(document.words[token.wordId]) }}>
              {pinyin ? <ruby>{token.text}<rt>{token.pinyin}</rt></ruby> : token.text}
            </button>
            : <span key={tokenIndex}>{token.text}</span>)}
        </p>
        {translation && <p className="memorize-translation" lang={language}>{sentence[language]}</p>}
      </div>)}
      <nav className="learning-pagination" aria-label={t('memorize.chapter')}>
        <button className="btn btn--soft" disabled={state.page === 0} onClick={() => goToPage(state.page - 1)}>{t('memorize.previous')}</button>
        <span aria-live="polite">{state.page + 1} / {document.passages.length}</span>
        <button className="btn btn--soft" disabled={state.page + 1 === document.passages.length} onClick={() => goToPage(state.page + 1)}>{t('memorize.next')}</button>
      </nav>
    </article>
    <WordSheet word={word} open={!!word} onClose={() => setWord(null)} />
  </>
}

function Reader() {
  const { t, language: uiLanguage } = useSettings()
  const [preferences, setPreferences] = useState(() => normalizeReaderPreferences(readLocal(PREFS_KEY)))
  useEffect(() => writeLocal(PREFS_KEY, preferences), [preferences])
  const update = (patch) => setPreferences((previous) => normalizeReaderPreferences({ ...previous, ...patch }))
  const language = preferences.language || (READING_LANGUAGES[uiLanguage] ? uiLanguage : 'en')
  return <>
    <section className="memorize-controls" aria-label={t('memorize.title')}>
      <label>{t('memorize.level')}
        <select value={preferences.range} onChange={(event) => update({ range: event.target.value })}>
          {READING_RANGES.map((range) => <option key={range} value={range}>HSK 3.0 · {range === '1-7-9' ? '1–(7–9)' : range.replace('-', '–')}</option>)}
        </select>
      </label>
      <label>{t('memorize.language')}
        <select value={language} onChange={(event) => update({ language: event.target.value })}>
          {Object.entries(READING_LANGUAGES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select>
      </label>
      <label className="memorize-toggle"><input type="checkbox" checked={preferences.pinyin} onChange={(event) => update({ pinyin: event.target.checked })} />{t('memorize.pinyin')}</label>
      <label className="memorize-toggle"><input type="checkbox" checked={preferences.translation} onChange={(event) => update({ translation: event.target.checked })} />{t('memorize.translation')}</label>
      <label className="memorize-size" htmlFor="memorize-font-size">{t('memorize.size')} <output aria-hidden="true">{preferences.fontSize}</output>
        <input id="memorize-font-size" type="range" min="18" max="42" step="1" value={preferences.fontSize} onChange={(event) => update({ fontSize: Number(event.target.value) })} />
      </label>
    </section>
    <p className="learning-muted memorize-hint">{t('memorize.lookup')}</p>
    <Story key={preferences.range} preferences={preferences} />
  </>
}

export default function MemorizePage() {
  const { t } = useSettings()
  const ready = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
  return <AppShell>
    <Head><title>{t('memorize.title')} · 好好学习</title></Head>
    <div className="learning-page memorize-page">
      <Link className="learning-back" href="/hsk">← {t('memorize.back')}</Link>
      <header className="memorize-header">
        <div className="learning-eyebrow">HSK 3.0 · 2026</div>
        <h1>{t('memorize.title')}</h1>
        <p className="memorize-subtitle">{t('memorize.subtitle')}</p>
        <h2>{t('memorize.method')}</h2>
        <p>{t('memorize.explanation')}</p>
      </header>
      {ready ? <Reader /> : <p role="status">{t('memorize.loading')}</p>}
    </div>
  </AppShell>
}
