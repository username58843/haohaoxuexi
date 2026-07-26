import React, { useState } from 'react'
import { Button, Card, ProgressRing, StatCard } from '~/components/ui'
import WordSheet from '~/components/WordSheet'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { meaningLine } from './session-utils'

/**
 * End-of-session summary: accuracy ring, counts, list of missed words
 * (tap opens the WordSheet) and follow-up actions.
 */
export default function Results({ mode, total, correct, mistakes, syncFailed = 0, onRetry }) {
  const { t, language } = useSettings()
  const [sheetWord, setSheetWord] = useState(null)

  const wrong = mistakes.length
  const accuracy = total > 0 ? correct / total : 0

  return (
    <div className="sess-results">
      <div className="sess-results__head">
        <span className="eyebrow">
          {mode === 'review' ? t('sessModeReview', 'Review') : t('sessModeQuiz', 'Quiz')}
        </span>
        <h1 className="sess-results__title">{t('sessComplete', 'Session complete')}</h1>
      </div>

      <div className="sess-results__hero">
        <ProgressRing value={accuracy} size={124} stroke={10}>
          <span className="sess-results__pct u-mono">{Math.round(accuracy * 100)}%</span>
          <span className="sess-results__pct-label">{t('sessAccuracy', 'accuracy')}</span>
        </ProgressRing>
        <div className="sess-results__stats">
          <StatCard value={correct} label={t('sessCorrect', 'Correct')} />
          <StatCard value={wrong} label={t('sessMistakes', 'Mistakes')} />
          <StatCard
            value={total}
            label={
              mode === 'review'
                ? t('sessTotalCards', 'Cards')
                : t('sessTotalQuestions', 'Questions')
            }
          />
        </div>
      </div>

      {wrong === 0 && total > 0 && (
        <p className="sess-results__perfect">{t('sessPerfect', 'Flawless run — no mistakes!')}</p>
      )}

      {syncFailed > 0 && (
        <p className="sess-results__warn" role="alert">
          {t(
            'sessSyncFailed',
            "Some answers couldn't be saved — check your connection. They may not count toward your progress."
          )}
        </p>
      )}

      {wrong > 0 && (
        <Card className="sess-results__mistakes">
          <span className="eyebrow">{t('sessMistakesList', 'Words to revisit')}</span>
          <div className="sess-results__list">
            {mistakes.map((w) => (
              <button
                key={w.id}
                type="button"
                className="word-row"
                onClick={() => setSheetWord(w)}
              >
                <span className="word-row__hanzi hanzi" lang="zh">
                  {w.simplified}
                </span>
                <span className="word-row__body">
                  <span className="word-row__pinyin">{w.pinyin}</span>
                  <span className="word-row__def">{meaningLine(w, language)}</span>
                </span>
                {w.hsk ? (
                  <span className={`word-row__tag word-row__tag--hsk${w.hsk}`}>HSK {w.hsk}</span>
                ) : null}
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="sess-results__actions">
        {wrong > 0 && (
          <Button variant="primary" size="lg" block onClick={onRetry}>
            {t('sessRetryMistakes', 'Review mistakes again')}
          </Button>
        )}
        <Button variant="soft" block href="/learn">
          {t('sessBackToLearn', 'Back to Learn')}
        </Button>
        <Button variant="ghost" block href="/">
          {t('sessHome', 'Home')}
        </Button>
      </div>

      <WordSheet word={sheetWord} open={!!sheetWord} onClose={() => setSheetWord(null)} />
    </div>
  )
}
