import React, { useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import AppShell from '~/components/AppShell'
import { PageLoader } from '~/components/ui'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

function IconOverview() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 13.5a8 8 0 1 1 16 0" />
      <path d="M12 13.5 15.5 9" />
      <line x1="3.5" y1="19" x2="20.5" y2="19" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8" />
      <path d="M17.5 14.8c1.8.7 3 2.2 3 4.7" />
    </svg>
  )
}

function IconFeedback() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M20 12.5a7.5 7.5 0 0 1-10.9 6.7L4 20.5l1.3-5.1A7.5 7.5 0 1 1 20 12.5Z" />
      <line x1="9" y1="11" x2="15" y2="11" />
      <line x1="9" y1="14.5" x2="13" y2="14.5" />
    </svg>
  )
}

function IconAudit() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v14A1.5 1.5 0 0 1 17 20.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="12.5" y2="16" />
    </svg>
  )
}

function IconContent() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 5.5h16" />
      <path d="M4 12h10" />
      <path d="M4 18.5h7" />
      <path d="m16.5 15 3.5 3.5-3.5 3.5" opacity="0" />
      <path d="M15 20.5 18 14l3 6.5" />
    </svg>
  )
}

const NAV = [
  { key: 'overview', href: '/admin', Icon: IconOverview, labelKey: 'admNavOverview', label: 'Overview' },
  { key: 'users', href: '/admin/users', Icon: IconUsers, labelKey: 'admNavUsers', label: 'Users' },
  { key: 'content', href: '/admin/content', Icon: IconContent, labelKey: 'admNavContent', label: 'Content' },
  { key: 'feedback', href: '/admin/feedback', Icon: IconFeedback, labelKey: 'admNavFeedback', label: 'Feedback' },
  { key: 'audit', href: '/admin/audit', Icon: IconAudit, labelKey: 'admNavAudit', label: 'Audit' },
]

/**
 * Admin console frame: role guard + left subnav (Overview/Users/Feedback/Audit).
 * Non-admins are silently redirected to `/`. Pages pass their translated
 * `title` (used for both the <Head> title and the page heading) and the
 * `active` nav key.
 */
export default function AdminLayout({ active, title, actions = null, children }) {
  const { user, loading } = useAuth()
  const { t } = useSettings()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) router.replace('/')
  }, [loading, user, router])

  if (loading || !user || user.role !== 'admin') {
    return (
      <AppShell>
        <PageLoader />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Head>
        <title>{`${title} · 好好学习汉语`}</title>
      </Head>
      <div className="adm col-wide">
        <aside className="adm__side">
          <span className="eyebrow adm__eyebrow">{t('admConsole', 'Admin console')}</span>
          <nav className="adm__nav" aria-label={t('admNavLabel', 'Admin sections')}>
            {NAV.map(({ key, href, Icon, labelKey, label }) => (
              <Link
                key={key}
                href={href}
                className={`adm__nav-item${active === key ? ' is-active' : ''}`}
                aria-current={active === key ? 'page' : undefined}
              >
                <Icon />
                <span>{t(labelKey, label)}</span>
              </Link>
            ))}
          </nav>
        </aside>

        <div className="adm__content">
          <header className="adm__head">
            <h1 className="adm__title">{title}</h1>
            {actions && <div className="adm__head-actions">{actions}</div>}
          </header>
          {children}
        </div>
      </div>
    </AppShell>
  )
}
