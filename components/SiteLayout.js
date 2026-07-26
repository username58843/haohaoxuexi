import React from 'react'
import PropTypes from 'prop-types'
import { useRouter } from 'next/router'
import Link from './Link'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import {
  IconLearn,
  IconBook,
  IconGrid,
  IconUser,
  IconHome,
} from './NavIcons'

const tabs = [
  { key: 'home', href: '/', Icon: IconHome, labelKey: 'home' },
  { key: 'learn', href: '/learn', Icon: IconLearn, labelKey: 'learn' },
  { key: 'dictionary', href: '/dictionaries', Icon: IconBook, labelKey: 'myDictionaries' },
  { key: 'search', href: '/search', Icon: IconGrid, labelKey: 'lexiconNav' },
  { key: 'more', href: '/more', Icon: IconUser, labelKey: 'more' },
]

function resolveActiveTab(pathname) {
  if (pathname === '/' || pathname === '/landing') return 'home'
  if (pathname.startsWith('/learn')) return 'learn'
  // Personal decks + official browse share this tab
  if (pathname === '/dictionaries' || pathname === '/dictionary') return 'dictionary'
  if (pathname === '/search') return 'search'
  if (
    pathname === '/more' ||
    pathname === '/profile' ||
    pathname === '/settings' ||
    pathname.startsWith('/admin')
  ) {
    return 'more'
  }
  return ''
}

const SiteLayout = ({ children }) => {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useSettings()

  const pathname = router.pathname
  const activeTab = resolveActiveTab(pathname)
  const isMarketing = pathname === '/' || pathname === '/landing'
  const hideNav = pathname === '/auth'
  const showAppChrome = !!user && !hideNav

  return (
    <div
      className={[
        'site-shell',
        isMarketing ? 'site-shell--marketing' : '',
        showAppChrome ? 'site-shell--app' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <main
        className={[
          'page-content',
          isMarketing ? 'page-content--marketing' : '',
          showAppChrome ? 'page-content--app' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </main>

      {showAppChrome && (
        <nav className="bottom-tab-bar" aria-label="Primary">
          <div className="bottom-tab-bar__dock">
            {tabs.map(({ key, href, Icon, labelKey }) => {
              const active = activeTab === key
              return (
                <Link
                  key={key}
                  href={href}
                  className={`tab-item${active ? ' is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="tab-icon">
                    <Icon />
                  </span>
                  <span className="tab-label">{t(labelKey) || labelKey}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}

SiteLayout.propTypes = {
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
}

export default SiteLayout
