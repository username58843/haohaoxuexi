import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import Router from 'next/router'
import LearnCard from './LearnCard'
import Link from './Link'
import { recordSession } from '~/lib/stats'
import { useSettings } from '~/lib/contexts/SettingsContext'

const Learn = ({ data, config }) => {
  const { t } = useSettings()
  const [position, setPosition] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [errors, setErrors] = useState([])
  const [finished, setFinished] = useState(false)
  const [statsSaved, setStatsSaved] = useState(false)

  const prevConfigRef = useRef(null)
  const startedAtRef = useRef(Date.now())
  const liveRef = useRef({ position, correct, errors })
  liveRef.current = { position, correct, errors }

  useEffect(() => {
    const next = JSON.stringify(config)
    const prev = JSON.stringify(prevConfigRef.current)
    if (prev !== next) {
      setPosition(0)
      setCorrect(0)
      setErrors([])
      setFinished(false)
      setStatsSaved(false)
      startedAtRef.current = Date.now()
      prevConfigRef.current = config
    }
  }, [config])

  useEffect(() => {
    if (!finished && !(data && position >= data.length)) return
    if (statsSaved || !data?.length) return

    const { correct: c, errors: e } = liveRef.current
    recordSession({
      correct: c,
      wrong: e.length,
      mistakes: e,
      durationSec: Math.round((Date.now() - startedAtRef.current) / 1000),
      source: 'learn',
    })
    setStatsSaved(true)
  }, [finished, position, data, statsSaved])

  const submitResult = (result, timeout) => {
    const { word, selected } = result
    setTimeout(() => {
      setPosition((p) => p + 1)
      if (selected.length === 1) setCorrect((c) => c + 1)
      else setErrors((prev) => [...prev, word])
    }, timeout)
  }

  const finish = () => setFinished(true)

  const tryAgain = () => {
    setPosition(0)
    setCorrect(0)
    setErrors([])
    setFinished(false)
    setStatsSaved(false)
    startedAtRef.current = Date.now()
  }

  const retryIncorrect = () => {
    if (!errors.length) return
    try {
      const words = errors.map((e) => e.question || e).filter((q) => q?.simplified)
      sessionStorage.setItem('xue_review_words', JSON.stringify(words))
      Router.push({ pathname: '/learn', query: { review: '1' } })
    } catch {
      tryAgain()
    }
  }

  if (!data?.length) return null

  const done = position >= data.length || finished
  const answered = correct + errors.length
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0
  const progressPct = Math.min(100, Math.round((position / data.length) * 100))

  if (done) {
    const grade =
      accuracy >= 90 ? t('gradeGreat') || 'Excellent' :
      accuracy >= 70 ? t('gradeGood') || 'Good work' :
      accuracy >= 40 ? t('gradeOk') || 'Keep going' :
      t('gradeRetry') || 'Review recommended'

    return (
      <div className="study-result">
        <div className="study-result__card">
          <div className="study-result__ring" style={{ '--p': `${accuracy}%` }}>
            <span>{accuracy}%</span>
          </div>
          <h2 className="study-result__title">{t('sessionComplete') || 'Session complete'}</h2>
          <p className="study-result__grade">{grade}</p>

          <div className="study-result__stats">
            <div>
              <strong className="text-success">{correct}</strong>
              <span>{t('sessionCorrect') || 'Correct'}</span>
            </div>
            <div>
              <strong className="text-danger">{errors.length}</strong>
              <span>{t('sessionWrong') || 'Wrong'}</span>
            </div>
            <div>
              <strong>{answered}</strong>
              <span>{t('sessionTotal') || 'Total'}</span>
            </div>
          </div>

          <div className="study-result__actions">
            <button type="button" className="btn btn-primary" onClick={tryAgain}>
              {t('sessionRetry') || 'Try again'}
            </button>
            {errors.length > 0 && (
              <button type="button" className="btn btn-warning" onClick={retryIncorrect}>
                {t('sessionRetryWrong') || 'Retry mistakes'}
              </button>
            )}
            <Link href="/learn" className="btn btn-secondary">
              {t('sessionHome') || 'Home'}
            </Link>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="study-mistakes">
            <h3>{t('sessionMistakes') || 'Mistakes'}</h3>
            <ul>
              {errors.map((m, idx) => {
                const q = m?.question || m
                if (!q?.simplified) return null
                return (
                  <li key={`${q.simplified}-${idx}`}>
                    <span className="hanzi" lang="zh">{q.simplified}</span>
                    <span className="study-mistakes__py">{q.pinyin || ''}</span>
                    <span className="study-mistakes__def">
                      {(q.definitions || []).slice(0, 2).join('; ')}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="study-learn">
      <div className="study-progress">
        <div className="study-progress__top">
          <span className="study-progress__count">
            {position + 1}
            <em> / {data.length}</em>
          </span>
          <span className="study-progress__score">
            <span className="ok">✓ {correct}</span>
            <span className="bad">✗ {errors.length}</span>
          </span>
        </div>
        <div className="study-progress__track" aria-hidden>
          <div className="study-progress__fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <LearnCard
        word={data[position]}
        key={`${position}-${data[position]?.id || position}`}
        submitResult={submitResult}
        config={config}
        finish={finish}
      />
    </div>
  )
}

Learn.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  config: PropTypes.object,
}

Learn.defaultProps = {
  config: {
    modes: ['characters-pinyin'],
    alwaysShowPinyin: false,
    alwaysShowTranslation: false,
    wordsLimit: 0,
  },
}

export default Learn
