import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSettings } from '~/lib/contexts/SettingsContext'

const SECTIONS = ['tasks', 'topics', 'characters', 'grammar']
const PAGE_SIZE = 16

export default function HskGuide({ compact = false }) {
  const { t } = useSettings()
  const [showSource, setShowSource] = useState(false)
  const [source, setSource] = useState(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [section, setSection] = useState('tasks')
  const [page, setPage] = useState(0)

  useEffect(() => {
    if (!showSource || source) return
    const controller = new AbortController()
    fetch('/hsk/syllabus-zh.json', { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('source'); return response.json() })
      .then((data) => {
        if (!SECTIONS.every((key) => Array.isArray(data.sections?.[key]))) throw new Error('source')
        setSource(data.sections)
      })
      .catch((err) => { if (err.name !== 'AbortError') setError(true) })
    return () => controller.abort()
  }, [showSource, retry, source])

  const blocks = source?.[section] || []
  const pages = Math.ceil(blocks.length / PAGE_SIZE)
  return <section className={`hsk-guide${compact ? ' hsk-guide--compact' : ''}`} aria-labelledby="hsk-guide-heading">
    <div className="learning-eyebrow">HSK 3.0 · 11 000</div>
    <h2 id="hsk-guide-heading">{t('hsk3.title')}</h2>
    <p className="learning-muted">{t('hsk3.dates')}</p>
    <p>{t('hsk3.intro')}</p>
    <p className="learning-notice">{t('hsk3.editorial')}</p>
    {compact ? <div className="learning-actions">
      <Link href="/hsk/syllabus" className="btn btn--soft">{t('hsk3.open')}</Link>
      <Link href="/memorize" className="btn btn--primary">{t('memorize.title')}</Link>
    </div> : <>
      <p>{t('hsk3.scope')}</p>
      <div className="hsk-guide__overview">
        {SECTIONS.map((key) => <details key={key}>
          <summary>{t(`hsk3.${key}`)}</summary>
          <p>{t(`hsk3.${key}Text`)}</p>
        </details>)}
      </div>
      <button className="btn btn--soft" aria-expanded={showSource}
        onClick={() => { setError(false); setShowSource((value) => !value) }}>{t('hsk3.original')}</button>
      {showSource && <div className="hsk-guide__original">
        <p className="learning-notice">{t('hsk3.originalNote')}</p>
        <label>{t('hsk3.title')}
          <select value={section} onChange={(event) => { setSection(event.target.value); setPage(0) }}>
            {SECTIONS.map((key) => <option key={key} value={key}>{t(`hsk3.${key}`)}</option>)}
          </select>
        </label>
        {error ? <p role="alert">{t('memorize.error')} <button onClick={() => { setError(false); setRetry((value) => value + 1) }}>{t('hskRetry', 'Retry')}</button></p>
          : !source ? <p role="status">{t('memorize.loading')}</p>
            : <div className="hsk-guide__source" lang="zh">
              {blocks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((block, index) => block.type === 'table'
                ? <div className="hsk-guide__table" key={`${section}:${page}:${index}`} tabIndex={0}>
                  <table><tbody>{block.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>)}</tbody></table>
                </div>
                : <p key={`${section}:${page}:${index}`}>{block.text}</p>)}
            </div>}
        {pages > 0 && <nav className="learning-pagination" aria-label={t('hsk3.original')}>
          <button className="btn btn--soft" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>{t('memorize.previous')}</button>
          <span aria-live="polite">{page + 1} / {pages}</span>
          <button className="btn btn--soft" disabled={page + 1 === pages} onClick={() => setPage((value) => value + 1)}>{t('memorize.next')}</button>
        </nav>}
      </div>}
    </>}
    <p className="learning-muted"><small>{t('hsk3.source')}</small></p>
  </section>
}
