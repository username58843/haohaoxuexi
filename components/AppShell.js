import React from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { IconHome, IconLearn, IconBook, IconGrid, IconReader, IconNote, IconUser } from './NavIcons'

const TABS = [
  { key: 'home', href: '/', Icon: IconHome, labelKey: 'navHome', label: 'Home' },
  { key: 'learn', href: '/learn', Icon: IconLearn, labelKey: 'navLearn', label: 'Learn' },
  { key: 'decks', href: '/decks', Icon: IconBook, labelKey: 'navDecks', label: 'Decks' },
  { key: 'hsk', href: '/hsk', Icon: IconGrid, labelKey: 'navHsk', label: 'HSK' },
  { key: 'books', href: '/books', Icon: IconReader, labelKey: 'navBooks', label: 'Books' },
  { key: 'notes', href: '/notes', Icon: IconNote, labelKey: 'navNotes', label: 'Notes' },
  { key: 'more', href: '/more', Icon: IconUser, labelKey: 'navMore', label: 'More' },
]

function activeTab(pathname) {
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/learn')) return 'learn'
  if (pathname.startsWith('/decks')) return 'decks'
  if (pathname.startsWith('/hsk')) return 'hsk'
  if (pathname.startsWith('/books')) return 'books'
  if (pathname.startsWith('/notes')) return 'notes'
  if (
    ['/more', '/profile', '/settings'].includes(pathname) ||
    pathname.startsWith('/admin')
  ) {
    return 'more'
  }
  return ''
}

/**
 * App chrome: bottom dock on mobile, left rail on desktop (≥1024px).
 * Guests (and /auth, /privacy, /terms, landing) get a bare shell.
 */
export default function AppShell({ children, bare = false }) {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useSettings()

  const showChrome = !!user && !bare && router.pathname !== '/auth'
  const current = activeTab(router.pathname)

  if (!showChrome) {
    return <div className="app-shell">{children}</div>
  }

  return (
    <div className="app-shell app-shell--rail">
      <nav className="rail" aria-label={t('navPrimary', 'Primary')}>
        <Link href="/" className="rail__brand">
          <img src="/logo-180.png" alt="" width={30} height={30} />
          <span className="hanzi" lang="zh">
            好好学习汉语
          </span>
        </Link>
        {TABS.map(({ key, href, Icon, labelKey, label, badge }) => (
          <Link
            key={key}
            href={href}
            className={`rail__item${current === key ? ' is-active' : ''}`}
            aria-current={current === key ? 'page' : undefined}
          >
            <Icon />
            <span className="rail__label">
              {t(labelKey, label)}
              {badge ? <span className="nav-badge">{badge}</span> : null}
            </span>
          </Link>
        ))}
        <div className="rail__spacer" />
      </nav>

      <main className="app-shell__main" style={{ flex: 1, minWidth: 0 }}>
        {children}
      </main>

      <nav className="dock" aria-label={t('navPrimary', 'Primary')}>
        {TABS.map(({ key, href, Icon, labelKey, label, badge }) => (
          <Link
            key={key}
            href={href}
            className={`dock__item${current === key ? ' is-active' : ''}`}
            aria-current={current === key ? 'page' : undefined}
          >
            <span className="dock__icon-wrap">
              <Icon />
              {badge ? <span className="nav-badge nav-badge--dot" aria-hidden /> : null}
            </span>
            <span className="dock__label">
              {t(labelKey, label)}
              {badge ? <span className="nav-badge nav-badge--dock">{badge}</span> : null}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
