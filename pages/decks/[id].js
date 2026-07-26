import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import AppShell from '~/components/AppShell'
import WordSheet from '~/components/WordSheet'
import {
  Button,
  Card,
  Modal,
  PageLoader,
  EmptyState,
  Spinner,
  useToast,
} from '~/components/ui'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { api, apiError } from '~/lib/api-client'
import { makeWordId, toWordSnapshot } from '~/lib/words-shared'
import {
  deckStudyHref,
  buildDeckJson,
  buildDeckCsv,
  downloadFile,
  safeFileName,
  DECK_WORD_CAP,
} from '~/components/decks/deck-utils'
import ImportModal from '~/components/decks/ImportModal'

/* ---------- inline icons (1.8 stroke, currentColor) ---------- */

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

function IconChevronLeft() {
  return (
    <svg {...iconProps}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  )
}

function IconPencil() {
  return (
    <svg {...iconProps}>
      <path d="M16.7 3.8l3.5 3.5L7.5 20 3.5 20.5 4 16.5 16.7 3.8z" />
    </svg>
  )
}

function IconDots() {
  return (
    <svg {...iconProps}>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg {...iconProps}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IconX() {
  return (
    <svg {...iconProps}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg {...iconProps}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}

function IconDownload() {
  return (
    <svg {...iconProps}>
      <path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" />
    </svg>
  )
}

function IconUpload() {
  return (
    <svg {...iconProps}>
      <path d="M12 14V4m0 0L8 8m4-4l4 4M5 19h14" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg {...iconProps}>
      <path d="M4 7h16M9 7V4.8h6V7m-9 0l1 13.2h10L18 7" />
    </svg>
  )
}

/* ---------- word row ---------- */

function WordRow({ word, onOpen, action }) {
  return (
    <div
      className="word-row deck-row"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <span className="word-row__hanzi hanzi" lang="zh">
        {word.simplified}
      </span>
      <span className="word-row__body">
        <span className="word-row__pinyin">{word.pinyin}</span>
        <span className="word-row__def">{(word.definitions || [])[0] || ''}</span>
      </span>
      {word.hsk ? (
        <span className={`word-row__tag word-row__tag--hsk${word.hsk}`}>HSK {word.hsk}</span>
      ) : null}
      {action}
    </div>
  )
}

export default function DeckDetailPage() {
  const { user, loading: authLoading } = useAuth()
  const { t } = useSettings()
  const router = useRouter()
  const toast = useToast()

  const id = typeof router.query.id === 'string' ? router.query.id : ''

  const [deck, setDeck] = useState(null)
  const [loadError, setLoadError] = useState(null)

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const cancelRenameRef = useRef(false)

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const [importOpen, setImportOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [sheetWord, setSheetWord] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const searchInputRef = useRef(null)

  const deckRef = useRef(null)
  useEffect(() => {
    deckRef.current = deck
  }, [deck])

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [authLoading, user, router])

  const fetchDeck = useCallback(async () => {
    if (!id) return
    setLoadError(null)
    setDeck(null)
    try {
      const { data } = await api.get(`/decks/${id}`)
      setDeck((data && data.deck) || data)
    } catch (err) {
      setLoadError(apiError(err))
    }
  }, [id])

  const userId = user ? user.id : null
  useEffect(() => {
    if (userId && router.isReady && id) fetchDeck()
  }, [userId, router.isReady, id, fetchDeck])

  const words = useMemo(() => (deck && Array.isArray(deck.words) ? deck.words : []), [deck])
  const idsInDeck = useMemo(() => new Set(words.map(makeWordId)), [words])

  /* ---------- mutations (optimistic with rollback) ---------- */

  const saveDeckPatch = useCallback(
    async (patch, successMsg) => {
      const prev = deckRef.current
      setDeck((d) => (d ? { ...d, ...patch } : d))
      try {
        const { data } = await api.put(`/decks/${id}`, patch)
        if (data && data.deck) setDeck(data.deck)
        if (successMsg) toast.success(successMsg)
        return true
      } catch (err) {
        setDeck(prev)
        toast.error(apiError(err).message)
        return false
      }
    },
    [id, toast]
  )

  const startRename = () => {
    cancelRenameRef.current = false
    setNameDraft(deck.name)
    setEditingName(true)
  }

  const commitRename = () => {
    setEditingName(false)
    if (cancelRenameRef.current) {
      cancelRenameRef.current = false
      return
    }
    const name = nameDraft.trim().slice(0, 80)
    if (!name || name === deck.name) return
    saveDeckPatch({ name }, t('deckRenamed', 'Deck renamed'))
  }

  const removeWord = (wid) => {
    const next = words.filter((w) => makeWordId(w) !== wid)
    saveDeckPatch({ words: next }, t('deckWordRemoved', 'Removed from deck'))
  }

  const addWord = (word) => {
    const snap = toWordSnapshot(word)
    const wid = makeWordId(snap)
    if (idsInDeck.has(wid)) {
      toast.show(t('deckAlreadyIn', 'Already in this deck'))
      return
    }
    if (words.length >= DECK_WORD_CAP) {
      toast.error(t('deckFull', 'This deck is full (2000 words max)'))
      return
    }
    saveDeckPatch({ words: [...words, snap] }, t('deckWordAdded', 'Added to deck'))
  }

  const handleImport = (newWords) => {
    setImportOpen(false)
    if (!newWords || newWords.length === 0) return
    saveDeckPatch({ words: [...words, ...newWords] }, t('deckImported', 'Words imported'))
  }

  /* ---------- export / delete ---------- */

  const exportJson = () => {
    setMenuOpen(false)
    downloadFile(`${safeFileName(deck.name)}.json`, buildDeckJson(words), 'application/json')
  }

  const exportCsv = () => {
    setMenuOpen(false)
    downloadFile(`${safeFileName(deck.name)}.csv`, buildDeckCsv(words), 'text/csv;charset=utf-8')
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/decks/${id}`)
      toast.success(t('deckDeleted', 'Deck deleted'))
      router.replace('/decks')
    } catch (err) {
      toast.error(apiError(err).message)
      setDeleting(false)
    }
  }

  /* ---------- overflow menu dismissal ---------- */

  useEffect(() => {
    if (!menuOpen) return undefined
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  /* ---------- dictionary search (debounced) ---------- */

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults(null)
      setSearchError(null)
      setSearching(false)
      return undefined
    }
    let cancelled = false
    setSearching(true)
    setSearchError(null)
    const timer = setTimeout(() => {
      api
        .get('/words/search', { params: { q, limit: 20 } })
        .then(({ data }) => {
          if (!cancelled) setResults(Array.isArray(data.items) ? data.items : [])
        })
        .catch((err) => {
          if (!cancelled) {
            setResults(null)
            setSearchError(apiError(err).message)
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  /* ---------- word sheet ---------- */

  const openSheet = (word) => {
    setSheetWord(word)
    setSheetOpen(true)
  }

  const sheetWordId = sheetWord ? makeWordId(sheetWord) : null
  const sheetInDeck = sheetWordId ? idsInDeck.has(sheetWordId) : false

  /* ---------- render ---------- */

  const pageTitle = `${deck ? deck.name : t('deckTitle', 'Decks')} · 好好学习`

  if (authLoading || !user) {
    return (
      <AppShell>
        <Head>
          <title>{pageTitle}</title>
        </Head>
        <PageLoader />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Head>
        <title>{pageTitle}</title>
      </Head>

      <div className="col-app deck-page">
        <Link href="/decks" className="deck-back">
          <IconChevronLeft />
          {t('deckBackAll', 'All decks')}
        </Link>

        {!deck && !loadError && <PageLoader />}

        {loadError && (
          <Card className="deck-error">
            <p>
              {loadError.code === 'not_found'
                ? t('deckNotFound', 'This deck does not exist')
                : loadError.message}
            </p>
            <div className="deck-error__actions">
              {loadError.code !== 'not_found' && (
                <Button variant="soft" onClick={fetchDeck}>
                  {t('deckRetry', 'Try again')}
                </Button>
              )}
              <Button variant="ghost" href="/decks">
                {t('deckBackAll', 'All decks')}
              </Button>
            </div>
          </Card>
        )}

        {deck && (
          <>
            <header className="deck-detail__head">
              <div className="deck-detail__title-wrap">
                {editingName ? (
                  <input
                    className="field__input deck-title-input"
                    value={nameDraft}
                    maxLength={80}
                    autoFocus
                    aria-label={t('deckNameLabel', 'Deck name')}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        e.currentTarget.blur()
                      }
                      if (e.key === 'Escape') {
                        cancelRenameRef.current = true
                        e.currentTarget.blur()
                      }
                    }}
                  />
                ) : (
                  <div className="deck-title-row">
                    <h1 className="deck-title">{deck.name}</h1>
                    <button
                      type="button"
                      className="deck-iconbtn"
                      onClick={startRename}
                      aria-label={t('deckRename', 'Rename deck')}
                    >
                      <IconPencil />
                    </button>
                  </div>
                )}
                <p className="deck-detail__meta u-mono">
                  {words.length} {t('deckWordsLabel', 'words')}
                </p>
              </div>

              <div className="deck-detail__actions">
                <Button
                  variant="primary"
                  href={deckStudyHref(id)}
                  disabled={words.length === 0}
                >
                  {t('deckStudy', 'Study')}
                </Button>
                <div className="deck-menu-wrap" ref={menuRef}>
                  <button
                    type="button"
                    className="deck-iconbtn deck-iconbtn--lg"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-label={t('deckMoreActions', 'More actions')}
                    onClick={() => setMenuOpen((v) => !v)}
                  >
                    <IconDots />
                  </button>
                  {menuOpen && (
                    <div className="deck-menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        className="deck-menu__item"
                        onClick={exportJson}
                      >
                        <IconDownload /> {t('deckExportJson', 'Export JSON')}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="deck-menu__item"
                        onClick={exportCsv}
                      >
                        <IconDownload /> {t('deckExportCsv', 'Export CSV')}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="deck-menu__item"
                        onClick={() => {
                          setMenuOpen(false)
                          setImportOpen(true)
                        }}
                      >
                        <IconUpload /> {t('deckImport', 'Import words')}
                      </button>
                      <div className="deck-menu__sep" role="separator" />
                      <button
                        type="button"
                        role="menuitem"
                        className="deck-menu__item deck-menu__item--danger"
                        onClick={() => {
                          setMenuOpen(false)
                          setDeleteOpen(true)
                        }}
                      >
                        <IconTrash /> {t('deckDelete', 'Delete deck')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            <section className="deck-section">
              <span className="eyebrow deck-section__eyebrow">
                {t('deckWordsSection', 'Words')}
              </span>
              {words.length === 0 ? (
                <EmptyState
                  glyph="词"
                  title={t('deckEmptyTitle', 'No words yet')}
                  text={t(
                    'deckEmptyText',
                    'Search the dictionary below and tap + to add your first words.'
                  )}
                  action={
                    <Button
                      variant="soft"
                      onClick={() => searchInputRef.current && searchInputRef.current.focus()}
                    >
                      {t('deckEmptyCta', 'Add words')}
                    </Button>
                  }
                />
              ) : (
                <div className="deck-rows">
                  {words.map((w, i) => {
                    const wid = makeWordId(w)
                    return (
                      <WordRow
                        key={`${wid}-${i}`}
                        word={w}
                        onOpen={() => openSheet(w)}
                        action={
                          <button
                            type="button"
                            className="deck-row__btn deck-row__btn--remove"
                            aria-label={t('deckRemoveWord', 'Remove from deck')}
                            onClick={(e) => {
                              e.stopPropagation()
                              removeWord(wid)
                            }}
                          >
                            <IconX />
                          </button>
                        }
                      />
                    )
                  })}
                </div>
              )}
            </section>

            <section className="deck-section">
              <span className="eyebrow deck-section__eyebrow">
                {t('deckAddSection', 'Add words')}
              </span>
              <label className="field deck-search">
                <span className="field__label">
                  {t('deckSearchLabel', 'Search the dictionary')}
                </span>
                <span className="field__wrap">
                  <input
                    ref={searchInputRef}
                    className="field__input"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('deckSearchPlaceholder', 'Hanzi, pinyin, or meaning')}
                  />
                  {searching && (
                    <span className="deck-search__spin">
                      <Spinner />
                    </span>
                  )}
                </span>
              </label>

              {searchError && (
                <p className="deck-search-note deck-search-note--error">{searchError}</p>
              )}
              {results && results.length === 0 && !searching && (
                <p className="deck-search-note">{t('deckNoResults', 'Nothing found')}</p>
              )}
              {results && results.length > 0 && (
                <div className="deck-rows">
                  {results.map((item, i) => {
                    const wid = makeWordId(item)
                    const inDeck = idsInDeck.has(wid)
                    return (
                      <WordRow
                        key={`${wid}-${i}`}
                        word={item}
                        onOpen={() => openSheet(item)}
                        action={
                          inDeck ? (
                            <span
                              className="deck-row__btn deck-row__btn--in"
                              title={t('deckAlreadyIn', 'Already in this deck')}
                            >
                              <IconCheck />
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="deck-row__btn deck-row__btn--add"
                              aria-label={t('deckAddWord', 'Add to deck')}
                              onClick={(e) => {
                                e.stopPropagation()
                                addWord(item)
                              }}
                            >
                              <IconPlus />
                            </button>
                          )
                        }
                      />
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <WordSheet
        word={sheetWord}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        actions={
          sheetWord &&
          (sheetInDeck ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                removeWord(sheetWordId)
                setSheetOpen(false)
              }}
            >
              {t('deckRemoveWord', 'Remove from deck')}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                addWord(sheetWord)
                setSheetOpen(false)
              }}
            >
              {t('deckAddWord', 'Add to deck')}
            </Button>
          ))
        }
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        existingWords={words}
        onConfirm={handleImport}
      />

      <Modal
        open={deleteOpen}
        onClose={() => {
          if (!deleting) setDeleteOpen(false)
        }}
        title={t('deckDeleteTitle', 'Delete deck?')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              {t('deckCancel', 'Cancel')}
            </Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>
              {t('deckDeleteConfirm', 'Delete forever')}
            </Button>
          </>
        }
      >
        <p className="deck-delete__text">
          {t(
            'deckDeleteText',
            'This permanently deletes the deck and its word list. Your SRS progress on these words is kept.'
          )}
        </p>
      </Modal>
    </AppShell>
  )
}
