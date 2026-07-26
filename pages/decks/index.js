import React, { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import AppShell from '~/components/AppShell'
import {
  Button,
  Card,
  Field,
  Modal,
  PageLoader,
  EmptyState,
  useToast,
} from '~/components/ui'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { api, apiError } from '~/lib/api-client'
import { deckIdOf, deckStudyHref } from '~/components/decks/deck-utils'

function IconPlus() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export default function DecksPage() {
  const { user, loading } = useAuth()
  const { t } = useSettings()
  const router = useRouter()
  const toast = useToast()

  const [decks, setDecks] = useState(null)
  const [error, setError] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createError, setCreateError] = useState(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/auth')
  }, [loading, user, router])

  const fetchDecks = useCallback(async () => {
    setError(null)
    setDecks(null)
    try {
      const { data } = await api.get('/decks')
      setDecks(Array.isArray(data.decks) ? data.decks : [])
    } catch (err) {
      setError(apiError(err).message)
    }
  }, [])

  const userId = user ? user.id : null
  useEffect(() => {
    if (userId) fetchDecks()
  }, [userId, fetchDecks])

  const openCreate = () => {
    setCreateName('')
    setCreateError(null)
    setCreateOpen(true)
  }

  const submitCreate = async (e) => {
    e.preventDefault()
    if (creating) return
    const name = createName.trim()
    if (!name) {
      setCreateError(t('deckNameRequired', 'Give your deck a name'))
      return
    }
    if (name.length > 80) {
      setCreateError(t('deckNameTooLong', 'Name must be 80 characters or fewer'))
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const { data } = await api.post('/decks', { name })
      const created = (data && data.deck) || data
      toast.success(t('deckCreated', 'Deck created'))
      const id = deckIdOf(created)
      if (id) {
        router.push(`/decks/${id}`)
      } else {
        setCreateOpen(false)
        fetchDecks()
      }
    } catch (err) {
      setCreateError(apiError(err).message)
    } finally {
      setCreating(false)
    }
  }

  if (loading || !user) {
    return (
      <AppShell>
        <Head>
          <title>{`${t('deckTitle', 'Decks')} · 好好学习`}</title>
        </Head>
        <PageLoader />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Head>
        <title>{`${t('deckTitle', 'Decks')} · 好好学习`}</title>
      </Head>

      <div className="col-app deck-page">
        <header className="deck-head">
          <div className="deck-head__text">
            <span className="eyebrow">{t('deckEyebrow', 'Your collections')}</span>
            <h1 className="deck-head__title">{t('deckTitle', 'Decks')}</h1>
          </div>
          <Button variant="primary" onClick={openCreate}>
            <IconPlus /> {t('deckNew', 'New deck')}
          </Button>
        </header>

        {decks === null && !error && <PageLoader />}

        {error && (
          <Card className="deck-error">
            <p>{error}</p>
            <div className="deck-error__actions">
              <Button variant="soft" onClick={fetchDecks}>
                {t('deckRetry', 'Try again')}
              </Button>
            </div>
          </Card>
        )}

        {decks && decks.length === 0 && (
          <EmptyState
            glyph="册"
            title={t('deckEmptyListTitle', 'No decks yet')}
            text={t(
              'deckEmptyListText',
              'Decks are personal word collections you can study as flashcards or quizzes.'
            )}
            action={
              <Button variant="primary" onClick={openCreate}>
                {t('deckEmptyListCta', 'Create your first deck')}
              </Button>
            }
          />
        )}

        {decks && decks.length > 0 && (
          <div className="deck-grid">
            {decks.map((deck) => {
              const id = deckIdOf(deck)
              const words = Array.isArray(deck.words) ? deck.words : []
              const preview = words.slice(0, 4)
              return (
                <Card key={id} className="deck-card">
                  <div
                    className={`deck-card__preview${preview.length === 0 ? ' deck-card__preview--empty' : ''}`}
                    aria-hidden
                  >
                    {preview.length > 0 ? (
                      preview.map((w, i) => (
                        <span key={i} className="hanzi" lang="zh">
                          {w.simplified}
                        </span>
                      ))
                    ) : (
                      <span className="hanzi" lang="zh">
                        空
                      </span>
                    )}
                  </div>
                  <h2 className="deck-card__name">{deck.name}</h2>
                  <span className="deck-card__count u-mono">
                    {words.length} {t('deckWordsLabel', 'words')}
                  </span>
                  <div className="deck-card__actions">
                    <Button
                      size="sm"
                      variant="primary"
                      href={deckStudyHref(id)}
                      disabled={words.length === 0}
                    >
                      {t('deckStudy', 'Study')}
                    </Button>
                    <Button size="sm" variant="soft" href={`/decks/${id}`}>
                      {t('deckOpen', 'Open')}
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => {
          if (!creating) setCreateOpen(false)
        }}
        title={t('deckNewTitle', 'New deck')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              {t('deckCancel', 'Cancel')}
            </Button>
            <Button type="submit" form="deck-create-form" variant="primary" loading={creating}>
              {t('deckCreate', 'Create deck')}
            </Button>
          </>
        }
      >
        <form id="deck-create-form" onSubmit={submitCreate}>
          <Field
            label={t('deckNameLabel', 'Deck name')}
            value={createName}
            onChange={(e) => {
              setCreateName(e.target.value)
              setCreateError(null)
            }}
            error={createError}
            maxLength={80}
            autoFocus
            placeholder={t('deckNamePlaceholder', 'e.g. Restaurant words')}
          />
        </form>
      </Modal>
    </AppShell>
  )
}
