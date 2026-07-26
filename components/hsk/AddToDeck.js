import React, { useState } from 'react'
import { Button, Field, Spinner, useToast } from '~/components/ui'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { api, apiError } from '~/lib/api-client'
import { makeWordId, toWordSnapshot } from '~/lib/words-shared'

const MAX_DECK_WORDS = 2000

function PlusIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

const idOf = (deck) => String((deck && (deck.id || deck._id)) || '')
const countOf = (deck) => {
  if (Array.isArray(deck?.words)) return deck.words.length
  if (Number.isInteger(deck?.wordCount)) return deck.wordCount
  return null
}

/**
 * "Add to deck" action for the WordSheet: trigger button + inline submenu
 * listing the user's decks, with an inline "new deck" creator.
 * The root uses display:contents so both parts flow into the parent
 * `.hsk-sheet-actions` flex row (panel wraps to full width).
 */
export default function AddToDeck({ word }) {
  const { t } = useSettings()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [decks, setDecks] = useState(null) // null = never loaded
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [busyId, setBusyId] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const wordKey = word ? makeWordId(word) : ''
  const [prevWordKey, setPrevWordKey] = useState(wordKey)

  // Collapse the submenu whenever the sheet switches to another word
  // (render-time "adjust state when props change" pattern, not an effect).
  if (wordKey !== prevWordKey) {
    setPrevWordKey(wordKey)
    setOpen(false)
    setShowNew(false)
    setNewName('')
    setBusyId(null)
  }

  const loadDecks = async () => {
    setStatus('loading')
    try {
      const { data } = await api.get('/decks')
      setDecks(Array.isArray(data?.decks) ? data.decks : [])
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  const toggleOpen = () => {
    const next = !open
    setOpen(next)
    if (next && decks === null && status !== 'loading') loadDecks()
  }

  const addToDeck = async (deck) => {
    const targetId = idOf(deck)
    if (!word || !targetId || busyId) return
    setBusyId(targetId)
    try {
      const { data } = await api.get(`/decks/${targetId}`)
      const full = data?.deck || data || {}
      const words = Array.isArray(full.words) ? full.words : []

      if (words.some((w) => makeWordId(w) === wordKey)) {
        toast.show(t('hskAlreadyInDeck', 'Already in this deck'))
        return
      }
      if (words.length >= MAX_DECK_WORDS) {
        toast.error(t('hskDeckFull', 'This deck is full'))
        return
      }

      const nextWords = [...words, toWordSnapshot(word)]
      await api.put(`/decks/${targetId}`, { words: nextWords })
      setDecks((prev) =>
        prev
          ? prev.map((d) =>
              idOf(d) === targetId && Array.isArray(d.words) ? { ...d, words: nextWords } : d
            )
          : prev
      )
      toast.success(`${t('hskAddedToDeck', 'Added to deck')}: ${deck.name}`)
    } catch (err) {
      toast.error(apiError(err).message)
    } finally {
      setBusyId(null)
    }
  }

  const createDeck = async (e) => {
    e.preventDefault()
    const name = newName.trim().slice(0, 80)
    if (!word || !name || creating) return
    setCreating(true)
    try {
      const { data } = await api.post('/decks', { name, words: [toWordSnapshot(word)] })
      const created = data?.deck || data
      if (created && idOf(created)) {
        setDecks((prev) => (prev ? [...prev, created] : [created]))
        if (status !== 'ready') setStatus('ready')
      } else {
        loadDecks()
      }
      setShowNew(false)
      setNewName('')
      toast.success(`${t('hskDeckCreated', 'Deck created')}: ${name}`)
    } catch (err) {
      toast.error(apiError(err).message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="hsk-add">
      <Button size="sm" variant="soft" onClick={toggleOpen} aria-expanded={open}>
        <PlusIcon /> {t('hskAddToDeck', 'Add to deck')}
      </Button>

      {open && (
        <div className="hsk-add__panel">
          {status === 'loading' && (
            <div className="hsk-add__status">
              <Spinner /> {t('hskDecksLoading', 'Loading decks…')}
            </div>
          )}

          {status === 'error' && (
            <div className="hsk-add__status">
              <span>{t('hskDecksError', 'Could not load decks')}</span>
              <Button size="sm" variant="ghost" onClick={loadDecks}>
                {t('hskRetry', 'Retry')}
              </Button>
            </div>
          )}

          {status === 'ready' && decks && decks.length === 0 && (
            <div className="hsk-add__status">
              {t('hskNoDecks', 'No decks yet — create your first one below.')}
            </div>
          )}

          {status === 'ready' &&
            decks &&
            decks.map((deck) => {
              const dId = idOf(deck)
              const count = countOf(deck)
              return (
                <button
                  key={dId}
                  type="button"
                  className="hsk-add__deck"
                  disabled={busyId !== null}
                  onClick={() => addToDeck(deck)}
                >
                  <span className="hsk-add__deck-name">{deck.name}</span>
                  {busyId === dId ? (
                    <Spinner />
                  ) : count !== null ? (
                    <span className="hsk-add__deck-count u-mono">{count}</span>
                  ) : null}
                </button>
              )
            })}

          {showNew ? (
            <form className="hsk-add__new" onSubmit={createDeck}>
              <Field
                className="hsk-add__new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('hskDeckName', 'Deck name')}
                aria-label={t('hskDeckName', 'Deck name')}
                maxLength={80}
                autoFocus
              />
              <Button
                type="submit"
                size="sm"
                variant="primary"
                loading={creating}
                disabled={!newName.trim()}
              >
                {t('hskCreate', 'Create')}
              </Button>
            </form>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setShowNew(true)}>
              <PlusIcon /> {t('hskNewDeck', 'New deck…')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
