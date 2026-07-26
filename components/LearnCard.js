import React, { useState, useCallback, useRef, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useHotkeys } from 'react-hotkeys-hook'
import { useSettings } from '~/lib/contexts/SettingsContext'
import Hider from './Hider'

function modeLabel(type, t) {
  switch (type) {
    case 'characters-pinyin':
      return t('charactersToPinyin') || 'Characters → Pinyin'
    case 'pinyin-characters':
      return t('pinyinToCharacters') || 'Pinyin → Characters'
    case 'characters-translation':
      return t('charactersToTranslation') || 'Characters → Meaning'
    case 'translation-characters':
      return t('translationToCharacters') || 'Meaning → Characters'
    default:
      return t('learningMode') || 'Practice'
  }
}

function renderPrompt(config, question, type, t) {
  const { alwaysShowPinyin = false, alwaysShowTranslation = false } = config || {}

  switch (type) {
    case 'characters-pinyin':
      return (
        <>
          <div className="study-prompt__main hanzi" lang="zh">
            {question?.simplified || '?'}
          </div>
          <div className="study-prompt__hint">
            <Hider enabled={!alwaysShowTranslation} caption={t('showTranslation') || 'Show meaning'}>
              {question?.definitions?.[0] || '—'}
            </Hider>
          </div>
        </>
      )
    case 'pinyin-characters':
      return (
        <>
          <div className="study-prompt__main study-prompt__main--latin">{question?.pinyin || '?'}</div>
          <div className="study-prompt__hint">
            <Hider enabled={!alwaysShowTranslation} caption={t('showTranslation') || 'Show meaning'}>
              {question?.definitions?.[0] || '—'}
            </Hider>
          </div>
        </>
      )
    case 'characters-translation':
      return (
        <>
          <div className="study-prompt__main hanzi" lang="zh">
            {question?.simplified || '?'}
          </div>
          <div className="study-prompt__hint">
            <Hider enabled={!alwaysShowPinyin} caption={t('showPinyin') || 'Show pinyin'}>
              {question?.pinyin || '—'}
            </Hider>
          </div>
        </>
      )
    case 'translation-characters':
      return (
        <div className="study-prompt__main study-prompt__main--latin study-prompt__main--def">
          {question?.definitions?.[0] || '?'}
        </div>
      )
    default:
      return <div className="study-prompt__main">?</div>
  }
}

function answerText(answer, type) {
  if (!answer) return '—'
  switch (type) {
    case 'characters-pinyin':
      return answer.pinyin || '—'
    case 'pinyin-characters':
      return answer.simplified || '—'
    case 'characters-translation':
      return answer.definitions?.[0] || '—'
    case 'translation-characters':
      return `${answer.simplified || '—'} · ${answer.pinyin || ''}`
    default:
      return '—'
  }
}

const LearnCard = ({ word, submitResult, config, finish }) => {
  const { t } = useSettings()
  const { question, variants = [], type } = word || {}
  const [selected, setSelected] = useState([])
  const [locked, setLocked] = useState(false)
  const [feedback, setFeedback] = useState(null) // 'correct' | 'wrong' | null

  useEffect(() => {
    setSelected([])
    setLocked(false)
    setFeedback(null)
  }, [word])

  const stateRef = useRef({})
  stateRef.current = {
    locked,
    word,
    question,
    variants,
    submitResult,
    selected,
  }

  const selectAnswer = useCallback((index, isCorrect) => {
    const s = stateRef.current
    if (s.locked) return

    const next = [index, ...s.selected]
    setSelected(next)

    if (isCorrect) {
      setFeedback('correct')
      setLocked(true)
      s.submitResult({ word: s.word, selected: next }, 420)
      return
    }

    setFeedback('wrong')
    // keep open so user can find the right one; wrong picks stay red
  }, [])

  const skip = useCallback(() => {
    const s = stateRef.current
    if (s.locked) return
    setLocked(true)
    setFeedback('wrong')
    const next = [0, 1, 2, 3]
    setSelected(next)
    s.submitResult({ word: s.word, selected: next }, 700)
  }, [])

  useHotkeys(
    '1,2,3,4,space,escape',
    (event) => {
      event.preventDefault()
      if (event.key === 'Escape' || event.code === 'Escape') {
        finish()
        return
      }
      const s = stateRef.current
      if (s.locked) return

      if (event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar') {
        skip()
        return
      }
      const digit = event.key
      if (!['1', '2', '3', '4'].includes(digit)) return
      const index = Number(digit) - 1
      if (!s.variants || index < 0 || index >= s.variants.length) return
      const isCorrect = s.question?.simplified === s.variants[index]?.simplified
      selectAnswer(index, isCorrect)
    },
    { preventDefault: true, enableOnFormTags: false, keydown: true },
    [skip, selectAnswer, finish]
  )

  if (!question) return null

  return (
    <div className={`study-session ${feedback ? `study-session--${feedback}` : ''}`}>
      <div className="study-prompt">
        <div className="study-prompt__mode">{modeLabel(type, t)}</div>
        {renderPrompt(config, question, type, t)}
      </div>

      <div className="study-answers" role="listbox" aria-label={t('learningMode') || 'Answers'}>
        {(variants || []).map((variant, index) => {
          const isCorrect = question.simplified === variant?.simplified
          const isSelected = selected.includes(index)
          let state = ''
          if (isSelected && isCorrect) state = 'is-correct'
          else if (isSelected && !isCorrect) state = 'is-wrong'
          else if (locked && isCorrect) state = 'is-reveal'

          const isHanzi =
            type === 'pinyin-characters' || type === 'translation-characters'

          return (
            <button
              key={`${word.id || index}-${index}`}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`study-answer ${state}`}
              disabled={isSelected || locked}
              onClick={() => selectAnswer(index, isCorrect)}
            >
              <span className="study-answer__key">{index + 1}</span>
              <span className={`study-answer__text ${isHanzi ? 'hanzi' : ''}`} lang={isHanzi ? 'zh' : undefined}>
                {answerText(variant, type)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="study-toolbar">
        <button type="button" className="study-toolbar__btn" onClick={skip} disabled={locked}>
          <kbd>Space</kbd>
          <span>{t('hotkeysSkip') || 'Skip'}</span>
        </button>
        <button type="button" className="study-toolbar__btn study-toolbar__btn--ghost" onClick={finish}>
          <kbd>Esc</kbd>
          <span>{t('finish') || 'End'}</span>
        </button>
      </div>
    </div>
  )
}

LearnCard.propTypes = {
  word: PropTypes.object.isRequired,
  submitResult: PropTypes.func.isRequired,
  config: PropTypes.object.isRequired,
  finish: PropTypes.func.isRequired,
}

export default LearnCard
