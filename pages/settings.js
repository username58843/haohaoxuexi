import React, { useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import AppShell from '~/components/AppShell'
import { Card, Segmented, Chip, PageLoader } from '~/components/ui'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'

const GOAL_STEP = 5
const GOAL_MIN = 5
const GOAL_MAX = 500

function ToggleRow({ label, desc, checked, onChange }) {
  return (
    <div className="acct-toggle">
      <div className="acct-toggle__text">
        <span className="acct-toggle__label">{label}</span>
        {desc && <span className="acct-toggle__desc">{desc}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`acct-switch${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="acct-switch__knob" aria-hidden />
      </button>
    </div>
  )
}

/** /settings — instant-apply preferences: theme, accent, language, goal, display. */
export default function SettingsPage() {
  const { user, loading } = useAuth()
  const {
    t,
    update,
    theme,
    themeColor,
    language,
    dailyGoal,
    alwaysShowPinyin,
    alwaysShowTranslation,
    themeColors,
    languages,
  } = useSettings()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/auth')
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <AppShell>
        <PageLoader />
      </AppShell>
    )
  }

  const themeOptions = [
    { value: 'dark', label: t('acctThemeDark', 'Dark') },
    { value: 'light', label: t('acctThemeLight', 'Light') },
    { value: 'system', label: t('acctThemeSystem', 'System') },
  ]

  const stepGoal = (delta) => {
    update({ dailyGoal: Math.min(GOAL_MAX, Math.max(GOAL_MIN, dailyGoal + delta)) })
  }

  return (
    <AppShell>
      <Head>
        <title>{`${t('acctSettingsTitle', 'Settings')} · 好好学习汉语`}</title>
      </Head>

      <div className="col-app acct-page">
        <header className="acct-head">
          <span className="eyebrow">{t('acctAccountEyebrow', 'Account')}</span>
          <h1>{t('acctSettingsTitle', 'Settings')}</h1>
        </header>

        <Card>
          <h2 className="acct-card__title">{t('acctAppearanceTitle', 'Appearance')}</h2>
          <p className="acct-card__desc">
            {t('acctAppearanceDesc', 'Theme and accent color apply instantly on this device.')}
          </p>

          <div className="acct-set__row">
            <span className="acct-set__label">{t('acctThemeLabel', 'Theme')}</span>
            <Segmented
              block
              ariaLabel={t('acctThemeLabel', 'Theme')}
              options={themeOptions}
              value={theme}
              onChange={(v) => update({ theme: v })}
            />
          </div>

          <div className="acct-set__row">
            <span className="acct-set__label">{t('acctAccentLabel', 'Accent color')}</span>
            <div
              className="acct-swatches"
              role="radiogroup"
              aria-label={t('acctAccentLabel', 'Accent color')}
            >
              {Object.entries(themeColors).map(([colorName, hex]) => (
                <button
                  key={colorName}
                  type="button"
                  role="radio"
                  aria-checked={themeColor === colorName}
                  aria-label={colorName}
                  className={`acct-swatch${themeColor === colorName ? ' is-active' : ''}`}
                  style={{ backgroundColor: hex }}
                  onClick={() => update({ themeColor: colorName })}
                />
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="acct-card__title">{t('acctLanguageTitle', 'Language')}</h2>
          <p className="acct-card__desc">
            {t('acctLanguageDesc', 'Language of the app interface.')}
          </p>
          <div className="acct-langs">
            {Object.entries(languages).map(([code, label]) => (
              <Chip
                key={code}
                active={language === code}
                onClick={() => update({ language: code })}
              >
                {code === 'zh' ? (
                  <span className="hanzi" lang="zh">
                    {label}
                  </span>
                ) : (
                  label
                )}
              </Chip>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="acct-card__title">{t('acctGoalTitle', 'Daily goal')}</h2>
          <p className="acct-card__desc">
            {t('acctGoalDesc', 'How many reviews per day complete your goal and keep the streak alive.')}
          </p>
          <div className="acct-stepper">
            <button
              type="button"
              className="acct-stepper__btn"
              onClick={() => stepGoal(-GOAL_STEP)}
              disabled={dailyGoal <= GOAL_MIN}
              aria-label={t('acctGoalDec', 'Decrease daily goal')}
            >
              −
            </button>
            <div className="acct-stepper__value">
              {dailyGoal}
              <span className="acct-stepper__unit">{t('acctGoalUnit', 'reviews / day')}</span>
            </div>
            <button
              type="button"
              className="acct-stepper__btn"
              onClick={() => stepGoal(GOAL_STEP)}
              disabled={dailyGoal >= GOAL_MAX}
              aria-label={t('acctGoalInc', 'Increase daily goal')}
            >
              +
            </button>
          </div>
        </Card>

        <Card>
          <h2 className="acct-card__title">{t('acctDisplayTitle', 'Study display')}</h2>
          <p className="acct-card__desc">
            {t('acctDisplayDesc', 'What is visible on cards before you reveal the answer.')}
          </p>
          <ToggleRow
            label={t('acctPinyinToggle', 'Always show pinyin')}
            desc={t('acctPinyinToggleDesc', 'Show pronunciation under every word by default')}
            checked={alwaysShowPinyin}
            onChange={(v) => update({ alwaysShowPinyin: v })}
          />
          <ToggleRow
            label={t('acctTranslationToggle', 'Always show translation')}
            desc={t('acctTranslationToggleDesc', 'Show the meaning without flipping the card')}
            checked={alwaysShowTranslation}
            onChange={(v) => update({ alwaysShowTranslation: v })}
          />
        </Card>
      </div>
    </AppShell>
  )
}
