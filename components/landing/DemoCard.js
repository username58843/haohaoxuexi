import React, { useEffect, useState } from 'react'
import { Card } from '~/components/ui'
import { useSettings } from '~/lib/contexts/SettingsContext'

/**
 * Live SRS demo flashcard for the landing hero.
 * Every ~2.4s it highlights a different wrong answer, then the correct one
 * with an ok-state, then rests — an ambient loop, no interaction required.
 */

const STEP_MS = 2400

// Answer index highlighted at each phase (null = idle). Index 1 is correct.
const PHASES = [null, 2, 3, 1]

export default function DemoCard() {
  const { t } = useSettings()
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setPhase((p) => (p + 1) % PHASES.length)
    }, STEP_MS)
    return () => clearInterval(id)
  }, [])

  const answers = [
    { id: 'water', label: t('lpDemoAnsWater', 'water'), correct: false },
    { id: 'learn', label: t('lpDemoAnsLearn', 'to learn; to study'), correct: true },
    { id: 'eat', label: t('lpDemoAnsEat', 'to eat'), correct: false },
    { id: 'big', label: t('lpDemoAnsBig', 'big'), correct: false },
  ]

  const active = PHASES[phase]
  const solved = active !== null && answers[active].correct

  return (
    <Card className={`lp-demo${solved ? ' is-solved' : ''}`}>
      <div className="lp-demo__top">
        <span className="eyebrow">{t('lpDemoEyebrow', 'Live demo')}</span>
        <span className="lp-demo__pulse" aria-hidden="true" />
      </div>

      <div className="lp-demo__word">
        <span className="lp-demo__hanzi hanzi" lang="zh">
          学
        </span>
        <span className="lp-demo__pinyin u-mono">xué</span>
      </div>

      <p className="lp-demo__question">
        {t('lpDemoQuestion', 'Pick the right meaning')}
      </p>

      <div className="lp-demo__answers">
        {answers.map((a, i) => {
          const isActive = active === i
          const cls = ['lp-demo__answer']
          if (isActive) cls.push(a.correct ? 'is-ok' : 'is-wrong')
          return (
            <div key={a.id} className={cls.join(' ')}>
              <span>{a.label}</span>
              {isActive && (
                <span className="lp-demo__mark u-mono" aria-hidden="true">
                  {a.correct ? '✓' : '✕'}
                </span>
              )}
            </div>
          )
        })}
      </div>

      <p className="lp-demo__status u-mono">
        {solved
          ? t('lpDemoStatusOk', 'correct · next review in 3 days')
          : t('lpDemoStatusIdle', 'srs schedules every review for you')}
      </p>
    </Card>
  )
}
