import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { Button, Card } from '~/components/ui'
import { useSettings } from '~/lib/contexts/SettingsContext'
import DemoCard from './DemoCard'

/**
 * Guest marketing landing. Rendered inside <AppShell> by pages/index.js
 * (guests get the bare shell, so this component owns the full page chrome:
 * floating pill nav, hero, live demo, features, steps, stats, CTA, footer).
 */

/* ---------- Inline icons (1.8 stroke, currentColor) ---------- */

function IconCycle() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  )
}

function IconLayers() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2 2 7l10 5 10-5-10-5z" />
      <path d="m2 12 10 5 10-5" />
      <path d="m2 17 10 5 10-5" />
    </svg>
  )
}

function IconBook() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  )
}

function IconFlame() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  )
}

export default function Landing() {
  const { t } = useSettings()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const features = [
    {
      key: 'srs',
      tint: 'accent',
      icon: <IconCycle />,
      title: t('lpFeatSrsTitle', 'SRS spaced repetition'),
      text: t(
        'lpFeatSrsText',
        'Reviews land right before you forget. A proven SM-2 schedule with four honest grades — no cramming, no wasted reps.'
      ),
    },
    {
      key: 'hsk',
      tint: 'ok',
      icon: <IconLayers />,
      title: t('lpFeatHskTitle', 'HSK 1–6, five thousand words'),
      text: t(
        'lpFeatHskText',
        'Every official level plus textbook packs — searchable by hanzi, pinyin or meaning, with stroke order and audio.'
      ),
    },
    {
      key: 'decks',
      tint: 'warn',
      icon: <IconBook />,
      title: t('lpFeatDecksTitle', 'Personal decks'),
      text: t(
        'lpFeatDecksText',
        'Collect words from any pack into your own decks and study exactly what your course — or your curiosity — demands.'
      ),
    },
    {
      key: 'progress',
      tint: 'ink',
      icon: <IconFlame />,
      title: t('lpFeatProgressTitle', 'Progress & streaks'),
      text: t(
        'lpFeatProgressText',
        'Daily goals, streaks and per-level mastery bars turn showing up every day into the easiest part.'
      ),
    },
  ]

  const steps = [
    {
      key: 'pick',
      title: t('lpStep1Title', 'Pick your words'),
      text: t(
        'lpStep1Text',
        'Choose an HSK level, a textbook pack, or build a deck of your own.'
      ),
    },
    {
      key: 'study',
      title: t('lpStep2Title', 'Study smart'),
      text: t(
        'lpStep2Text',
        'Flip flashcards or take quizzes — every answer reschedules the card.'
      ),
    },
    {
      key: 'stick',
      title: t('lpStep3Title', 'Watch it stick'),
      text: t(
        'lpStep3Text',
        'Streaks, goals and level mastery show words moving into long-term memory.'
      ),
    },
  ]

  const stats = [
    { key: 'words', value: '5000+', label: t('lpStatWords', 'words') },
    { key: 'levels', value: 'HSK 1–6', label: t('lpStatLevels', 'every level') },
    { key: 'packs', value: '29', label: t('lpStatPacks', 'textbook packs') },
    { key: 'free', value: '100%', label: t('lpStatFree', 'free') },
  ]

  const year = new Date().getFullYear()

  return (
    <div className="lp">
      <Head>
        <title>{`${t('lpPageTitle', 'Learn Chinese vocabulary')} · 好好学习汉语`}</title>
        <meta
          name="description"
          content={t(
            'lpPageDesc',
            'HaoHao XueXi — free spaced-repetition flashcards for HSK 1–6 and textbook vocabulary. Learn Chinese words that stay learned.'
          )}
        />
      </Head>

      {/* Floating pill nav */}
      <header className={`lp-nav${scrolled ? ' is-scrolled' : ''}`}>
        <Link href="/" className="lp-nav__brand hanzi" lang="zh">
          好好学习汉语
        </Link>
        <div className="lp-nav__actions">
          <Button variant="ghost" size="sm" href="/auth" className="lp-nav__login">
            {t('lpNavSignIn', 'Sign in')}
          </Button>
          <Button variant="primary" size="sm" href="/auth">
            {t('lpNavStart', 'Get started')}
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="lp-hero">
        <p className="eyebrow lp-hero__eyebrow">
          {t('lpHeroEyebrow', 'Spaced repetition · HSK 1–6 · Free')}
        </p>
        <h1 className="lp-hero__title hanzi" lang="zh">
          好好学习汉语
          <span className="lp-hero__seal" aria-hidden="true" />
        </h1>
        <p className="lp-hero__sub u-two-tone">
          <span>{t('lpHeroSubLead', 'Learn Chinese words that stay learned.')}</span>{' '}
          {t(
            'lpHeroSubRest',
            'Flashcards and quizzes scheduled by an SRS that knows exactly when you are about to forget.'
          )}
        </p>
        <div className="lp-hero__ctas">
          <Button variant="primary" size="lg" href="/auth">
            {t('lpHeroCta', 'Start learning free')}
          </Button>
          <Link href="/auth" className="lp-hero__signin">
            {t('lpHeroSignIn', 'Sign in')}
          </Link>
        </div>
        <p className="lp-hero__micro u-mono">
          {t('lpHeroMicro', 'free forever · no ads · no credit card')}
        </p>

        <div className="lp-hero__demo">
          <DemoCard />
        </div>
      </section>

      {/* Features */}
      <section className="lp-section lp-features">
        <div className="col-wide">
          <p className="eyebrow u-center">{t('lpFeaturesEyebrow', 'Why it sticks')}</p>
          <h2 className="lp-section__title u-two-tone u-center">
            <span>{t('lpFeaturesTitleLead', 'Built for memory,')}</span>{' '}
            {t('lpFeaturesTitleRest', 'not busywork.')}
          </h2>
          <div className="lp-features__grid">
            {features.map((f) => (
              <Card className="lp-feature" key={f.key}>
                <span className={`lp-feature__tile lp-feature__tile--${f.tint}`}>
                  {f.icon}
                </span>
                <h3 className="lp-feature__title">{f.title}</h3>
                <p className="lp-feature__text">{f.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="lp-section lp-steps">
        <div className="col-wide">
          <p className="eyebrow u-center">{t('lpStepsEyebrow', 'How it works')}</p>
          <h2 className="lp-section__title u-two-tone u-center">
            <span>{t('lpStepsTitleLead', 'Three steps,')}</span>{' '}
            {t('lpStepsTitleRest', 'a few minutes a day.')}
          </h2>
          <div className="lp-steps__list">
            <div className="lp-steps__line" aria-hidden="true">
              <span className="lp-steps__dot" />
            </div>
            {steps.map((s, i) => (
              <div className="lp-step" key={s.key}>
                <span className="lp-step__marker u-mono">{i + 1}</span>
                <h3 className="lp-step__title">{s.title}</h3>
                <p className="lp-step__text">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="lp-stats">
        <div className="col-wide lp-stats__row">
          {stats.map((s) => (
            <div className="lp-stats__item" key={s.key}>
              <span className="lp-stats__value u-mono">{s.value}</span>
              <span className="lp-stats__label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="lp-section">
        <div className="col-wide">
          <div className="lp-cta">
            <span className="lp-cta__glyph hanzi" lang="zh" aria-hidden="true">
              学
            </span>
            <p className="eyebrow">{t('lpCtaEyebrow', 'Start today')}</p>
            <h2 className="lp-cta__title u-two-tone">
              <span>{t('lpCtaTitleLead', 'Ready when you are.')}</span>{' '}
              {t('lpCtaTitleRest', 'The first review takes a minute.')}
            </h2>
            <Button variant="primary" size="lg" href="/auth">
              {t('lpCtaButton', 'Start learning free')}
            </Button>
            <p className="lp-cta__micro u-mono">
              {t('lpCtaMicro', 'no credit card · no ads · just hanzi')}
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        <div className="col-wide lp-footer__inner">
          <div className="lp-footer__brand">
            <span className="hanzi" lang="zh">
              好好学习汉语
            </span>
            <span className="lp-footer__tag">HaoHao XueXi</span>
          </div>
          <nav className="lp-footer__links" aria-label="Footer">
            <Link href="/about">{t('lpFooterAbout', 'About')}</Link>
            <Link href="/privacy">{t('lpFooterPrivacy', 'Privacy')}</Link>
            <Link href="/terms">{t('lpFooterTerms', 'Terms')}</Link>
          </nav>
        </div>
        <div className="col-wide lp-footer__copy u-mono">
          © {year}{' '}
          <span className="hanzi" lang="zh">
            好好学习汉语
          </span>{' '}
          · {t('lpFooterCopy', 'made for Chinese learners')}
        </div>
      </footer>
    </div>
  )
}
