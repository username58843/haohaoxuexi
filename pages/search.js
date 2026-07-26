import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { Button, Modal, ModalHeader, ModalBody } from 'reactstrap'
import axios from 'axios'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import SiteLayout from '~/components/SiteLayout'
import LoadingSpinner from '~/components/LoadingSpinner'
import { KNOWN_KEY, loadKnownMap, exportKnownAsJson } from '~/lib/stats'

const LEVELS = [1, 2, 3, 4, 5, 6]

function loadKnown() {
  return loadKnownMap()
}

function saveKnown(map) {
  localStorage.setItem(KNOWN_KEY, JSON.stringify(map))
}

export default function LexiconPage() {
  const { user, loading: authLoading } = useAuth()
  const { t } = useSettings()
  const router = useRouter()

  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('all')
  const [items, setItems] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [known, setKnown] = useState({})
  const [highlightUnique, setHighlightUnique] = useState(false)
  const [hideKnown, setHideKnown] = useState(false)
  const [selected, setSelected] = useState(null)
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState('')
  const [selectedCount, setSelectedCount] = useState(0)

  useEffect(() => {
    setKnown(loadKnown())
  }, [])

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth')
  }, [user, authLoading, router])

  const refreshSelectedCount = useCallback(async () => {
    try {
      const res = await axios.get('/api/dictionaries/selected-words', { withCredentials: true })
      setSelectedCount((res.data.selectedWords || []).length)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (user) refreshSelectedCount()
  }, [user, refreshSelectedCount])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const response = await axios.get('/api/lexicon', {
        params: {
          q: query.trim(),
          level,
          page: 1,
          limit: 5000,
        },
      })
      setItems(response.data.items || [])
      setStats(response.data.stats || null)
    } catch (err) {
      console.error(err)
      setError(t('somethingWentWrong') || 'Error')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [user, query, level, t])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  const knownCount = useMemo(() => {
    return items.reduce((n, w) => (known[w.id] ? n + 1 : n), 0)
  }, [items, known])

  const uniqueChars = useMemo(() => {
    if (!highlightUnique) return null
    const first = new Set()
    const seen = new Set()
    for (const w of items) {
      const chars = [...(w.simplified || '')].filter((c) => {
        const code = c.codePointAt(0)
        return code >= 0x4e00 && code <= 0x9fff
      })
      for (const c of chars) {
        if (!seen.has(c)) {
          first.add(`${w.id}:${c}`)
          seen.add(c)
        }
      }
    }
    return first
  }, [items, highlightUnique])

  const visibleItems = useMemo(() => {
    if (!hideKnown) return items
    return items.filter((w) => !known[w.id])
  }, [items, known, hideKnown])

  const grouped = useMemo(() => {
    if (level !== 'all' || query.trim()) {
      return [{ level: level === 'all' ? null : Number(level), words: visibleItems }]
    }
    return LEVELS.map((L) => ({
      level: L,
      words: visibleItems.filter((w) => w.hsk === L),
    })).filter((g) => g.words.length > 0)
  }, [visibleItems, level, query])

  const toggleKnown = (word, e) => {
    e?.stopPropagation?.()
    setKnown((prev) => {
      const next = { ...prev }
      if (next[word.id]) delete next[word.id]
      else next[word.id] = true
      saveKnown(next)
      return next
    })
  }

  const openWord = (word) => {
    setAddMsg('')
    setSelected(word)
  }

  const addToSelected = async () => {
    if (!selected) return
    setAdding(true)
    setAddMsg('')
    try {
      const res = await axios.post(
        '/api/dictionaries/selected-words',
        {
          word: {
            simplified: selected.simplified,
            traditional: selected.traditional || selected.simplified,
            pinyin: selected.pinyin || '',
            definitions: selected.definitions || [],
          },
        },
        { withCredentials: true }
      )
      const count = (res.data.selectedWords || []).length
      setSelectedCount(count)
      if (res.data.alreadyExists) {
        setAddMsg(`${t('wordAddedToSelected')} ✓ · ${count}`)
      } else {
        setAddMsg(`${t('wordAddedToSelected')} (${count})`)
      }
      setTimeout(() => setAddMsg(''), 3500)
    } catch (err) {
      console.error('addToSelected failed', err)
      const msg =
        err.response?.data?.error ||
        (err.response?.status === 401
          ? t('login')
          : t('failedToAddWord'))
      setAddMsg(`ERR:${msg}`)
      setTimeout(() => setAddMsg(''), 4000)
    } finally {
      setAdding(false)
    }
  }

  if (authLoading) {
    return (
      <SiteLayout>
        <LoadingSpinner text={t('loading')} />
      </SiteLayout>
    )
  }

  if (!user) return null

  return (
    <SiteLayout>
      <div className="hsk-vis">
        <header className="hsk-vis__header">
          <div>
            <p className="hsk-vis__sub" style={{ marginTop: 0 }}>{t('lexiconSubtitle')}</p>
          </div>
          <div className="hsk-vis__stats">
            <div className="hsk-vis__stat">
              <strong>{stats?.total ?? '—'}</strong>
              <span>{t('lexiconWords')}</span>
            </div>
            <div className="hsk-vis__stat">
              <strong>{knownCount}</strong>
              <span>{t('lexiconKnown')}</span>
            </div>
            <Link href="/dictionaries" className="hsk-vis__stat hsk-vis__stat--link">
              <strong>{selectedCount}</strong>
              <span>{t('selectedWords')}</span>
            </Link>
          </div>
        </header>

        <form
          className="hsk-vis__find"
          onSubmit={(e) => {
            e.preventDefault()
            setQuery(draft)
          }}
        >
          <input
            className="hsk-vis__input"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('lexiconPlaceholder')}
            autoComplete="off"
          />
          <Button type="submit" color="primary" className="hsk-vis__find-btn">
            {t('lexiconFind')}
          </Button>
        </form>

        <div className="hsk-vis__toolbar">
          <div className="hsk-vis__levels">
            <button
              type="button"
              className={`hsk-vis__chip ${level === 'all' ? 'is-active' : ''}`}
              onClick={() => setLevel('all')}
            >
              {t('lexiconAllLevels')}
            </button>
            {LEVELS.map((L) => (
              <button
                key={L}
                type="button"
                className={`hsk-vis__chip hsk-vis__chip--l${L} ${String(level) === String(L) ? 'is-active' : ''}`}
                onClick={() => setLevel(L)}
              >
                HSK {L}
                {stats?.byLevel?.[L] != null ? ` · ${stats.byLevel[L]}` : ''}
              </button>
            ))}
          </div>

          <div className="hsk-vis__toggles">
            <label className="hsk-vis__toggle">
              <input
                type="checkbox"
                checked={highlightUnique}
                onChange={(e) => setHighlightUnique(e.target.checked)}
              />
              <span>{t('lexiconHighlightUnique')}</span>
            </label>
            <label className="hsk-vis__toggle">
              <input
                type="checkbox"
                checked={hideKnown}
                onChange={(e) => setHideKnown(e.target.checked)}
              />
              <span>{t('lexiconHideKnown') || 'Hide known'}</span>
            </label>
            <button
              type="button"
              className="hsk-vis__chip"
              onClick={() => {
                const blob = new Blob([exportKnownAsJson()], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'known-words.json'
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              {t('exportKnown') || 'Export known'}
            </button>
            <button
              type="button"
              className="hsk-vis__chip"
              onClick={() => {
                if (!window.confirm(t('clearKnown') || 'Clear known?')) return
                saveKnown({})
                setKnown({})
              }}
            >
              {t('clearKnown') || 'Clear known'}
            </button>
          </div>
        </div>

        <div className="hsk-vis__legend">
          {LEVELS.map((L) => (
            <span key={L} className={`hsk-vis__legend-item hsk-vis__legend-item--l${L}`}>
              HSK {L}
            </span>
          ))}
          <span className="hsk-vis__legend-item hsk-vis__legend-item--known">{t('lexiconKnown')}</span>
        </div>

        <p className="hsk-vis__hint">{t('lexiconGridHint')}</p>

        {error && <div className="alert alert-danger">{error}</div>}

        {loading && (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status" />
          </div>
        )}

        {!loading &&
          grouped.map((group) => (
            <section key={group.level ?? 'q'} className="hsk-vis__section">
              {group.level != null && (
                <h2 className={`hsk-vis__section-title hsk-vis__section-title--l${group.level}`}>
                  HSK {group.level}
                  <span>{group.words.length}</span>
                </h2>
              )}
              <div className="hsk-vis__grid">
                {group.words.map((word) => {
                  const isKnown = !!known[word.id]
                  const hasUnique =
                    highlightUnique &&
                    [...(word.simplified || '')].some((c) => uniqueChars?.has(`${word.id}:${c}`))
                  return (
                    <button
                      key={word.id}
                      type="button"
                      className={[
                        'hsk-vis__cell',
                        `hsk-vis__cell--l${word.hsk}`,
                        isKnown ? 'is-known' : '',
                        hasUnique ? 'is-unique' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => openWord(word)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        toggleKnown(word, e)
                      }}
                      title={`${word.simplified} · ${word.pinyin}`}
                    >
                      <span className="hsk-vis__cell-hanzi hanzi" lang="zh">{word.simplified}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}

        {!loading && items.length === 0 && (
          <div className="hsk-vis__empty">
            <div>{t('noResults')}</div>
            <div className="text-muted">{t('tryDifferentSearch')}</div>
          </div>
        )}
      </div>

      <Modal isOpen={!!selected} toggle={() => setSelected(null)} centered>
        {selected && (
          <>
            <ModalHeader toggle={() => setSelected(null)} className="hsk-vis-modal-header">
              HSK {selected.hsk}
            </ModalHeader>
            <ModalBody className="hsk-vis-modal-body">
              <div className="hsk-vis-modal__hanzi hanzi" lang="zh">{selected.simplified}</div>
              <div className="hsk-vis-modal__pinyin">{selected.pinyin}</div>
              <div className="hsk-vis-modal__def">
                {(selected.definitions || []).join(' · ')}
              </div>
              {selected.translations?.ru?.length > 0 && (
                <div className="hsk-vis-modal__ru">
                  {selected.translations.ru.join(' · ')}
                </div>
              )}
              {addMsg && (
                <div
                  className={`hsk-vis-modal__toast ${
                    addMsg.startsWith('ERR:') ? 'is-error' : 'is-ok'
                  }`}
                >
                  {addMsg.startsWith('ERR:') ? addMsg.slice(4) : addMsg}
                </div>
              )}
              <div className="hsk-vis-modal__actions">
                <Button
                  color={known[selected.id] ? 'success' : 'secondary'}
                  onClick={() => toggleKnown(selected)}
                >
                  {known[selected.id] ? `✓ ${t('lexiconKnown')}` : t('lexiconMarkKnown')}
                </Button>
                <Button color="primary" disabled={adding} onClick={addToSelected}>
                  {adding ? '…' : `+ ${t('addToSelected')}`}
                </Button>
              </div>
              <p className="hsk-vis-modal__hint">
                {t('selectedWords')}: <strong>{selectedCount}</strong>
                {' · '}
                <Link href="/dictionaries" style={{ color: 'var(--theme-color)' }}>
                  {t('myDictionaries')} →
                </Link>
              </p>
            </ModalBody>
          </>
        )}
      </Modal>
    </SiteLayout>
  )
}
