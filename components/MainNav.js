import React from 'react'
import PropTypes from 'prop-types'
import Link from './Link'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import {
  IconUser,
  IconSettings,
  IconShield,
  IconLogout,
  IconChevron,
} from './NavIcons'

/**
 * Account / “More” hub — profile & settings only.
 * My dictionaries live on the main bottom tab.
 */
const MainNav = ({ activeLink }) => {
  const { user, logout } = useAuth()
  const { t } = useSettings()

  const items = [
    {
      key: 'profile',
      href: '/profile',
      label: t('profile'),
      hint: t('accountProfileHint') || t('profileSettings'),
      Icon: IconUser,
    },
    {
      key: 'settings',
      href: '/settings',
      label: t('settings'),
      hint: t('accountSettingsHint') || '',
      Icon: IconSettings,
    },
  ]

  if (user?.isAdmin) {
    items.push({
      key: 'admin',
      href: '/admin',
      label: t('adminPanel'),
      hint: t('accountAdminHint') || '',
      Icon: IconShield,
    })
  }

  const displayName = user?.name || user?.email || ''
  const initial = (displayName || '?').trim().charAt(0).toUpperCase()

  return (
    <div className="account-hub">
      <header className="account-hub__hero">
        <div className="account-hub__avatar" aria-hidden>
          {initial}
        </div>
        <div className="account-hub__meta">
          <h1 className="account-hub__name">{displayName || t('profile')}</h1>
          {user?.email && user?.name ? (
            <p className="account-hub__email">{user.email}</p>
          ) : (
            <p className="account-hub__email">{t('accountHubSub') || t('more')}</p>
          )}
        </div>
      </header>

      <nav className="account-hub__menu" aria-label={t('more')}>
        {items.map(({ key, href, label, hint, Icon }) => {
          const active = activeLink === key
          return (
            <Link
              key={key}
              href={href}
              className={`account-hub__row${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="account-hub__icon">
                <Icon />
              </span>
              <span className="account-hub__text">
                <span className="account-hub__label">{label}</span>
                {hint ? <span className="account-hub__hint">{hint}</span> : null}
              </span>
              <span className="account-hub__chevron">
                <IconChevron />
              </span>
            </Link>
          )
        })}
      </nav>

      {user && (
        <button type="button" className="account-hub__logout" onClick={logout}>
          <span className="account-hub__icon account-hub__icon--danger">
            <IconLogout />
          </span>
          <span className="account-hub__label">{t('logout')}</span>
        </button>
      )}
    </div>
  )
}

MainNav.propTypes = {
  activeLink: PropTypes.string,
}

MainNav.defaultProps = {
  activeLink: '',
}

export default MainNav
