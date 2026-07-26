import React from 'react'
import Link from 'next/link'
import { useSettings } from '~/lib/contexts/SettingsContext'

const PAGES = [
  { key: 'privacy', href: '/privacy', labelKey: 'docsNavPrivacy', label: 'Privacy Policy' },
  { key: 'terms', href: '/terms', labelKey: 'docsNavTerms', label: 'Terms of Service' },
  { key: 'about', href: '/about', labelKey: 'docsNavAbout', label: 'About' },
]

function IconArrowLeft() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  )
}

/**
 * Shared shell for the static document pages (/privacy, /terms, /about):
 * narrow prose column, back-home link, big serif page title, muted
 * "last updated" meta line, and a footer nav between the three pages.
 *
 * Props:
 *  - title:   page heading (already translated by the page)
 *  - current: 'privacy' | 'terms' | 'about' — highlighted in the footer nav
 *  - updated: date string for the meta line
 */
export default function DocsLayout({
  title,
  current,
  updated = 'July 27, 2026',
  children,
}) {
  const { t } = useSettings()

  return (
    <div className="docs">
      <div className="docs__col">
        <Link href="/" className="docs__back">
          <IconArrowLeft />
          {t('docsBackHome', 'Back to home')}
        </Link>

        <header className="docs__header">
          <p className="eyebrow docs__eyebrow">
            <span className="hanzi" lang="zh">
              好好学习汉语
            </span>
            <span className="docs__eyebrow-sep" aria-hidden="true">
              ·
            </span>
            HaoHao XueXi
          </p>
          <h1 className="docs__title">{title}</h1>
          <p className="docs__meta">
            {t('docsLastUpdated', 'Last updated:')} {updated}
          </p>
        </header>

        <article className="docs__body">{children}</article>

        <footer className="docs__footer">
          <nav className="docs__nav" aria-label={t('docsNavLabel', 'Documents')}>
            {PAGES.map(({ key, href, labelKey, label }) => (
              <Link
                key={key}
                href={href}
                className={current === key ? 'is-current' : undefined}
                aria-current={current === key ? 'page' : undefined}
              >
                {t(labelKey, label)}
              </Link>
            ))}
          </nav>
        </footer>
      </div>
    </div>
  )
}
