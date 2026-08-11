import React, { useEffect, useState } from 'react'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { useAuth } from '~/lib/contexts/AuthContext'
import { api, apiError } from '~/lib/api-client'
import { speakLong, canSpeak } from '~/lib/speech'
import { Spinner } from '~/components/ui'

/**
 * AI companion drawer: retell the current chapter in Chinese (listen with
 * browser TTS), in graded simple Chinese for a chosen HSK level, or as a
 * summary in the UI language. Availability depends on the server having an
 * AI provider key configured (probed via GET /ai/retell).
 */
const MAX_INPUT = 15000

export default function AiPanel({ chapterText, onClose }) {
  const { t, language } = useSettings()
  const { user } = useAuth()
  const [avail, setAvail] = useState({ state: 'loading' })
  const [mode, setMode] = useState('retell')
  const [level, setLevel] = useState(3)
  const [run, setRun] = useState({ state: 'idle', text: '', error: '' })
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    if (!user) return undefined // rendered as the sign-in hint, no probe needed
    let alive = true
    api
      .get('/ai/retell')
      .then(({ data }) => alive && setAvail({ state: data.available ? 'ok' : 'off' }))
      .catch(() => alive && setAvail({ state: 'off' }))
    return () => {
      alive = false
    }
  }, [user])

  // Derived, not stored: guests always see the sign-in hint.
  const availState = user ? avail.state : 'signin'

  const speakerRef = React.useRef(null)

  useEffect(() => {
    return () => speakerRef.current?.stop()
  }, [])

  const runAi = async () => {
    if (run.state === 'loading') return
    setRun({ state: 'loading', text: '', error: '' })
    try {
      const { data } = await api.post(
        '/ai/retell',
        {
          text: chapterText.slice(0, MAX_INPUT),
          mode,
          level: mode === 'simple' ? level : undefined,
          lang: language || 'en',
        },
        { timeout: 65000 }
      )
      setRun({ state: 'done', text: data.text, error: '' })
    } catch (err) {
      const e = apiError(err)
      setRun({
        state: 'error',
        text: '',
        error:
          e.code === 'ai_not_configured'
            ? t('booksAiOff', 'AI is not configured on this server yet')
            : e.code === 'rate_limited'
              ? t('booksAiRateLimited', 'AI limit reached — try again in an hour')
              : t('booksAiFailed', 'AI is unavailable right now, try again later'),
      })
    }
  }

  const toggleSpeak = () => {
    if (!canSpeak()) return
    if (speaking) {
      speakerRef.current?.stop()
      speakerRef.current = null
      return
    }
    setSpeaking(true)
    speakerRef.current = speakLong(run.text, {
      lang: 'zh',
      onDone: () => setSpeaking(false),
    })
    if (!speakerRef.current) setSpeaking(false)
  }

  const MODES = [
    { id: 'retell', label: t('booksAiRetell', 'Retell in Chinese') },
    { id: 'simple', label: t('booksAiSimple', 'Simple Chinese') },
    { id: 'translate', label: t('booksAiSummary', 'Summary in my language') },
  ]

  return (
    <div className="reader__drawer reader__drawer--ai" role="dialog">
      <div className="reader__drawer-head">
        <strong>✨ {t('booksAi', 'AI retelling')}</strong>
        <button type="button" className="reader__bar-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      {availState === 'loading' && <Spinner />}
      {availState === 'signin' && (
        <p className="reader__hint">{t('booksAiSignIn', 'Sign in to use AI retelling.')}</p>
      )}
      {availState === 'off' && (
        <p className="reader__hint">
          {t('booksAiOff', 'AI is not configured on this server yet')}
        </p>
      )}

      {availState === 'ok' && (
        <>
          <div className="ai-panel__modes">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`ai-panel__mode${mode === m.id ? ' is-active' : ''}`}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === 'simple' && (
            <div className="ai-panel__levels">
              <span>{t('booksAiLevel', 'HSK level')}</span>
              {[1, 2, 3, 4, 5, 6].map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`reader__font-btn${level === l ? ' is-active' : ''}`}
                  onClick={() => setLevel(l)}
                >
                  {l}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            className="ai-panel__run"
            onClick={runAi}
            disabled={run.state === 'loading'}
          >
            {run.state === 'loading' ? t('booksAiWorking', 'Working…') : t('booksAiRun', 'Generate')}
          </button>

          {run.state === 'error' && <p className="word-pop__error">{run.error}</p>}
          {run.state === 'done' && (
            <div className="ai-panel__result">
              {mode !== 'translate' && canSpeak() && (
                <button type="button" className="word-pop__btn" onClick={toggleSpeak}>
                  {speaking ? `⏹ ${t('booksAiStop', 'Stop')}` : `🔊 ${t('booksAiListen', 'Listen')}`}
                </button>
              )}
              <p className={mode !== 'translate' ? 'hanzi' : ''} lang={mode !== 'translate' ? 'zh' : undefined}>
                {run.text}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
