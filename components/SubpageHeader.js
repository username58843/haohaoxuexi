import React from 'react'
import PropTypes from 'prop-types'
import Link from './Link'
import { useSettings } from '~/lib/contexts/SettingsContext'

/**
 * Compact header for account subpages: back to hub + title (no chip switcher).
 */
export default function SubpageHeader({ title, subtitle, backHref = '/more', backLabel }) {
  const { t } = useSettings()
  const label = backLabel || t('backToAccount') || t('more') || 'Back'

  return (
    <header className="subpage-header">
      <Link href={backHref} className="subpage-header__back">
        <span className="subpage-header__back-icon" aria-hidden>
          ‹
        </span>
        <span>{label}</span>
      </Link>
      {title ? <h1 className="subpage-header__title">{title}</h1> : null}
      {subtitle ? <p className="subpage-header__sub">{subtitle}</p> : null}
    </header>
  )
}

SubpageHeader.propTypes = {
  title: PropTypes.node,
  subtitle: PropTypes.node,
  backHref: PropTypes.string,
  backLabel: PropTypes.string,
}
