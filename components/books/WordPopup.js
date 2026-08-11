import React, { useEffect, useRef, useState } from 'react'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { useAuth } from '~/lib/contexts/AuthContext'
import { api, apiError } from '~/lib/api-client'
import { speakChinese, canSpeak } from '~/lib/speech'
import { glossFor } from '~/lib/books/dict-client'

/**
 * Word/sentence lookup card for the reader. Anchored near the tapped word,
 * clamped to the viewport. Word gloss comes from the local dictionary
 * (instant, offline); sentence translation calls /api/v1/translate on demand.
 */
export default function WordPopup({ data, onClose }) {
  const { t, language } = useSettings()
  const { user } = useAuth()
  const cardRef = useRef(null)
  const [pos, setPos] = useState(null)
  const [sentence, setSentence] = useState({ state: 'idle', text: '' })

  const entry = data?.entry || null
  const word = data?.word || ''
  const targetLang = language === 'zh' || !language ? 'en' : language

  // Reset sentence translation when the popup switches to another word.
  const [prevKey, setPrevKey] = useState(null)
  const key = data ? `${word}:${data.sentence}` : null
  if (key !== prevKey) {
    setPrevKey(key)
    setSentence({ state: 'idle', text: '' })
  }

  useEffect(() => {
    if (!data?.rect || !cardRef.current) return
    const card = cardRef.current.getBoundingClientRect()
    const margin = 8
    let x = data.rect.left + data.rect.width / 2 - card.width / 2
    x = Math.max(margin, Math.min(x, window.innerWidth - card.width - margin))
    let y = data.rect.top - card.height - 10
    if (y < margin) y = data.rect.bottom + 10
    y = Math.max(margin, Math.min(y, window.innerHeight - card.height - margin))
    setPos({ x, y })
  }, [data])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!data) return null

  const gloss = glossFor(entry, targetLang)

  const translateSentence = async () => {
    if (!data.sentence || sentence.state === 'loading') return
    setSentence({ state: 'loading', text: '' })
    try {
      const { data: res } = await api.post('/translate', {
        text: data.sentence,
        to: targetLang,
      })
      setSentence({ state: 'done', text: res.text })
    } catch (err) {
      const e = apiError(err)
      setSentence({
        state: 'error',
        text:
          e.code === 'unauthorized'
            ? t('booksSignInToTranslate', 'Sign in to translate sentences')
            : t('booksTranslateFailed', 'Translation is unavailable right now'),
      })
    }
  }

  return (
    <>
      <div className="word-pop__backdrop" onClick={onClose} />
      <div
        ref={cardRef}
        className="word-pop"
        style={pos ? { left: pos.x, top: pos.y, visibility: 'visible' } : { visibility: 'hidden' }}
        role="dialog"
        aria-label={word}
      >
        <div className="word-pop__head">
          <span className="word-pop__hanzi hanzi" lang="zh">
            {word}
          </span>
          {entry?.pinyin ? <span className="word-pop__pinyin">{entry.pinyin}</span> : null}
          {entry?.hsk ? (
            <span className={`word-pop__hsk word-pop__hsk--${entry.hsk}`}>
              HSK {entry.hsk === 7 ? '7–9' : entry.hsk}
            </span>
          ) : null}
        </div>

        {gloss ? (
          <p className="word-pop__gloss">{gloss}</p>
        ) : (
          <p className="word-pop__gloss word-pop__gloss--empty">
            {t('booksNotInDict', 'Not in the HSK dictionary')}
          </p>
        )}

        <div className="word-pop__actions">
          {canSpeak() && (
            <button type="button" className="word-pop__btn" onClick={() => speakChinese(word)}>
              🔊 {t('booksSpeak', 'Listen')}
            </button>
          )}
          {data.sentence ? (
            <button
              type="button"
              className="word-pop__btn"
              onClick={translateSentence}
              disabled={sentence.state === 'loading' || (!user && sentence.state === 'error')}
            >
              {sentence.state === 'loading'
                ? t('booksTranslating', 'Translating…')
                : t('booksTranslateSentence', 'Translate sentence')}
            </button>
          ) : null}
        </div>

        {sentence.state === 'done' && (
          <div className="word-pop__sentence">
            <p className="word-pop__sentence-zh hanzi" lang="zh">
              {data.sentence}
            </p>
            <p className="word-pop__sentence-tr">{sentence.text}</p>
          </div>
        )}
        {sentence.state === 'error' && <p className="word-pop__error">{sentence.text}</p>}
      </div>
    </>
  )
}
