import React, { useEffect, useRef, useState } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { speakChinese, canSpeak } from '~/lib/speech'

const HANZI_WRITER_SRC = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js'

let writerPromise = null
function loadHanziWriter() {
  if (typeof window === 'undefined') return Promise.reject(new Error('ssr'))
  if (window.HanziWriter) return Promise.resolve(window.HanziWriter)
  if (!writerPromise) {
    writerPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = HANZI_WRITER_SRC
      script.onload = () => resolve(window.HanziWriter)
      script.onerror = () => {
        writerPromise = null
        reject(new Error('failed to load hanzi-writer'))
      }
      document.head.appendChild(script)
    })
  }
  return writerPromise
}

function StrokeOrder({ character }) {
  const hostRef = useRef(null)
  const [failed, setFailed] = useState(false)
  const [prevCharacter, setPrevCharacter] = useState(character)

  // Reset the failure flag when this instance is reused for a different
  // character (render-time "adjust state when props change" pattern).
  if (prevCharacter !== character) {
    setPrevCharacter(character)
    setFailed(false)
  }

  useEffect(() => {
    let cancelled = false
    let writer = null
    const host = hostRef.current
    loadHanziWriter()
      .then((HanziWriter) => {
        if (cancelled || !host) return
        host.innerHTML = ''
        writer = HanziWriter.create(host, character, {
          width: 120,
          height: 120,
          padding: 6,
          strokeColor: getComputedStyle(document.documentElement)
            .getPropertyValue('--accent')
            .trim() || '#e0533d',
          delayBetweenLoops: 1200,
        })
        writer.loopCharacterAnimation()
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      writer?.cancelQuiz?.()
      if (host) host.innerHTML = ''
    }
  }, [character])

  if (failed) return null
  return <div className="word-sheet__stroke" ref={hostRef} aria-hidden />
}

/**
 * Word detail sheet. `actions` lets the calling page inject context actions
 * (add to deck, mark known, remove, …).
 */
export default function WordSheet({ word, open, onClose, actions = null }) {
  const { t } = useSettings()
  const [showStrokes, setShowStrokes] = useState(false)
  const [prevWord, setPrevWord] = useState(word)

  // Collapse the stroke panel when the sheet switches to another word
  // (render-time state adjustment instead of an effect).
  if (prevWord !== word) {
    setPrevWord(word)
    setShowStrokes(false)
  }

  if (!word) return null

  const characters = Array.from(word.simplified || '').filter((ch) => /\p{Script=Han}/u.test(ch))
  const en = word.translations?.en || []
  const ru = word.translations?.ru || []
  const primary = word.definitions || []

  return (
    <Modal open={open} onClose={onClose} title={<span className="hanzi" lang="zh">{word.simplified}</span>}>
      <div className="word-sheet">
        <div className="word-sheet__head">
          <span className="word-sheet__hanzi hanzi" lang="zh">
            {word.simplified}
          </span>
          <div className="word-sheet__meta">
            <span className="word-sheet__pinyin">{word.pinyin}</span>
            {word.traditional && word.traditional !== word.simplified && (
              <span className="word-sheet__trad">
                {t('wsTraditional', 'Traditional')}:{' '}
                <span className="hanzi" lang="zh">{word.traditional}</span>
              </span>
            )}
            {word.hsk && (
              <span className={`word-row__tag word-row__tag--hsk${word.hsk}`}>HSK {word.hsk}</span>
            )}
          </div>
        </div>

        <div className="word-sheet__actions-row">
          {canSpeak() && (
            <Button size="sm" variant="soft" onClick={() => speakChinese(word.simplified)}>
              🔊 {t('wsListen', 'Listen')}
            </Button>
          )}
          {characters.length > 0 && (
            <Button size="sm" variant="soft" onClick={() => setShowStrokes((v) => !v)}>
              ✍️ {t('wsStrokes', 'Stroke order')}
            </Button>
          )}
        </div>

        {showStrokes && (
          <div className="word-sheet__strokes">
            {characters.map((ch, i) => (
              <StrokeOrder key={`${ch}-${i}`} character={ch} />
            ))}
          </div>
        )}

        {primary.length > 0 && (
          <div className="word-sheet__block">
            <span className="eyebrow">{t('wsMeaning', 'Meaning')}</span>
            <ul className="word-sheet__defs">
              {primary.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        )}

        {ru.length > 0 && (
          <div className="word-sheet__block">
            <span className="eyebrow">Русский</span>
            <ul className="word-sheet__defs">
              {ru.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        )}

        {en.length > 0 && en.join() !== primary.join() && (
          <div className="word-sheet__block">
            <span className="eyebrow">English</span>
            <ul className="word-sheet__defs">
              {en.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        )}

        {actions && <div className="word-sheet__page-actions">{actions}</div>}
      </div>
    </Modal>
  )
}
