import React from 'react'
import { Button } from '~/components/ui'
import ExampleSentence from '~/components/ExampleSentence'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { canSpeak, speakChinese } from '~/lib/speech'
import { previewIntervals } from './session-utils'

/**
 * SRS flashcard: hanzi front (tap/Space to flip), answer back with pinyin,
 * definitions, translations and the example sentence, then the 4-grade bar
 * with interval previews.
 */
export default function Flashcard({ card, flipped, onFlip, onGrade, posting }) {
  const { t, alwaysShowPinyin } = useSettings()
  const word = card.word || {}
  const hints = previewIntervals(card, t)
  const defs = Array.isArray(word.definitions) ? word.definitions : []
  const ru = (word.translations && word.translations.ru) || []
  const en = (word.translations && word.translations.en) || []
  const tk = (word.translations && word.translations.tk) || []

  const grades = [
    { grade: 0, label: t('sessAgain', 'Again'), variant: 'danger' },
    { grade: 1, label: t('sessHard', 'Hard'), variant: 'soft' },
    { grade: 2, label: t('sessGood', 'Good'), variant: 'soft' },
    { grade: 3, label: t('sessEasy', 'Easy'), variant: 'primary' },
  ]

  return (
    <div className="sess-flash-wrap">
      <div className={`sess-flash card${flipped ? ' is-flipped' : ''}`}>
        {card.isNew && <span className="sess-flash__new u-mono">{t('sessNewBadge', 'NEW')}</span>}

        <button
          type="button"
          className="sess-flash__face"
          onClick={() => {
            if (!flipped) onFlip()
          }}
          aria-label={flipped ? undefined : t('sessShowAnswer', 'Show answer')}
        >
          <span className="sess-flash__hanzi hanzi" lang="zh">
            {word.simplified}
          </span>
          {!flipped && alwaysShowPinyin && word.pinyin && (
            <span className="sess-flash__front-pinyin">{word.pinyin}</span>
          )}
        </button>

        {flipped && (
          <div className="sess-flash__answer">
            <div className="sess-flash__pinyin-row">
              <span className="sess-flash__pinyin">{word.pinyin}</span>
              {canSpeak() && (
                <button
                  type="button"
                  className="sess-flash__tts"
                  onClick={() => speakChinese(word.simplified)}
                  aria-label={t('sessListen', 'Listen')}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M11 5 6 9H2v6h4l5 4z" />
                    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                    <path d="M18.4 5.6a9 9 0 0 1 0 12.8" />
                  </svg>
                </button>
              )}
            </div>

            {word.traditional && word.traditional !== word.simplified && (
              <p className="sess-flash__trans">
                {t('sessTraditional', 'Traditional')}:{' '}
                <span className="hanzi" lang="zh">
                  {word.traditional}
                </span>
              </p>
            )}

            {defs.length > 0 && (
              <ul className="sess-flash__defs">
                {defs.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
            {tk.length > 0 && <p className="sess-flash__trans">{tk.join(' · ')}</p>}
            {ru.length > 0 && <p className="sess-flash__trans">{ru.join(' · ')}</p>}
            {en.length > 0 && en.join() !== defs.join() && (
              <p className="sess-flash__trans">{en.join(' · ')}</p>
            )}
            {word.example?.zh && (
              <ExampleSentence example={word.example} className="sess-flash__example" />
            )}
          </div>
        )}
      </div>

      {!flipped ? (
        <Button variant="soft" size="lg" block className="sess-reveal" onClick={onFlip}>
          {t('sessShowAnswer', 'Show answer')}{' '}
          <span className="sess-key-hint u-mono">{t('sessKeySpace', 'Space')}</span>
        </Button>
      ) : (
        <div className="sess-grades">
          {grades.map(({ grade, label, variant }) => (
            <Button
              key={grade}
              variant={variant}
              className="sess-grade"
              disabled={posting}
              onClick={() => onGrade(grade)}
              title={`${label} (${grade + 1})`}
            >
              <span className="sess-grade__label">{label}</span>
              <span className="sess-grade__hint u-mono">{hints[grade]}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
