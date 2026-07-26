import React from 'react'
import { useSettings } from '~/lib/contexts/SettingsContext'

export function Spinner() {
  const { t } = useSettings()
  return <span className="spinner" role="status" aria-label={t('navLoading', 'Loading')} />
}

export function PageLoader({ text = '' }) {
  return (
    <div className="page-loader">
      <Spinner />
      {text && <span>{text}</span>}
    </div>
  )
}
