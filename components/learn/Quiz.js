import React from 'react'
import { Button } from '~/components/ui'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { QmodeLabel } from './session-utils'

/**
 * One multiple-choice question. `answered` is null before the user picks,
 * then { index, correct }. Correct answers flash green and auto-advance
 * (handled by the parent); wrong answers reveal the right option and wait
 * for the Next button.
 */
export default function Quiz({ question, answered, onAnswer, onNext }) {
  const { t } = useSettings()
  const q = question
  const promptHanzi = q.promptType === 'hanzi'
  const answerHanzi = q.answerType === 'hanzi'

  const promptCls = [
    'sess-quiz__prompt',
    promptHanzi ? 'sess-quiz__prompt--hanzi' : '',
    q.promptType === 'pinyin' ? 'sess-quiz__prompt--pinyin' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="sess-quiz">
      <span className="sess-quiz__mode eyebrow">
        <QmodeLabel mode={q.qmode} t={t} />
      </span>

      <div className={promptCls}>
        {promptHanzi ? (
          <span className="hanzi" lang="zh">
            {q.prompt}
          </span>
        ) : (
          q.prompt
        )}
      </div>

      <div className="sess-options">
        {q.options.map((opt, i) => {
          const cls = ['sess-option']
          if (answerHanzi) cls.push('sess-option--hanzi')
          if (q.answerType === 'pinyin') cls.push('sess-option--pinyin')
          if (answered) {
            if (opt.correct) cls.push('is-correct')
            else if (i === answered.index) cls.push('is-wrong')
          }
          return (
            <button
              key={`${opt.wordId}-${i}`}
              type="button"
              className={cls.join(' ')}
              disabled={!!answered}
              onClick={() => onAnswer(i)}
            >
              <span className="sess-option__num u-mono" aria-hidden>
                {i + 1}
              </span>
              <span
                className={answerHanzi ? 'sess-option__text hanzi' : 'sess-option__text'}
                lang={answerHanzi ? 'zh' : undefined}
              >
                {opt.text}
              </span>
            </button>
          )
        })}
      </div>

      {answered && !answered.correct && (
        <Button variant="primary" size="lg" block className="sess-next" onClick={onNext}>
          {t('sessNext', 'Next')}{' '}
          <span className="sess-key-hint u-mono">{t('sessKeyEnter', 'Enter')}</span>
        </Button>
      )}
    </div>
  )
}
