import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Button, Input, Alert } from 'reactstrap'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import SiteLayout from '~/components/SiteLayout'
import SubpageHeader from '~/components/SubpageHeader'
import LoadingSpinner from '~/components/LoadingSpinner'

export default function SettingsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const {
    themeColor,
    setThemeColor,
    language,
    setLanguage,
    saveSettings,
    t,
    getColorName,
    THEME_COLORS,
    LANGUAGES,
  } = useSettings()

  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth')
    }
  }, [user, authLoading, router])

  if (authLoading) {
    return (
      <SiteLayout>
        <LoadingSpinner text={t('loading')} />
      </SiteLayout>
    )
  }

  if (!user) {
    return (
      <SiteLayout>
        <LoadingSpinner text={t('redirecting')} />
      </SiteLayout>
    )
  }

  const handleSave = async () => {
    await saveSettings()
    setSuccess(t('settingsSaved'))
    setTimeout(() => setSuccess(''), 3000)
  }

  return (
    <SiteLayout>
      <div className="account-page">
        <SubpageHeader title={t('settings')} />

        {success && (
          <Alert color="success" className="account-page__alert">
            {success}
          </Alert>
        )}

        <section className="account-panel">
          <h2 className="account-panel__title">
            {t('themeColor')}
            <span className="account-panel__meta" style={{ color: THEME_COLORS[themeColor] }}>
              {getColorName(themeColor, language)}
            </span>
          </h2>
          <div className="theme-swatch-row">
            {Object.entries(THEME_COLORS).map(([name, color]) => (
              <button
                key={name}
                type="button"
                className={`theme-swatch ${themeColor === name ? 'is-active' : ''}`}
                style={{ '--swatch-color': color }}
                onClick={() => setThemeColor(name)}
                title={getColorName(name, language)}
                aria-label={getColorName(name, language)}
                aria-pressed={themeColor === name}
              >
                <span className="theme-swatch__dot" />
                <span className="theme-swatch__label">{getColorName(name, language)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="account-panel">
          <h2 className="account-panel__title">{t('language')}</h2>
          <Input
            type="select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="account-form__select"
          >
            {Object.entries(LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </Input>
        </section>

        <Button color="primary" onClick={handleSave} className="account-page__save">
          {t('save')}
        </Button>
      </div>
    </SiteLayout>
  )
}
