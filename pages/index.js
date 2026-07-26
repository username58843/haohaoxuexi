import React from 'react'
import Link from 'next/link'
import SiteLayout from '~/components/SiteLayout'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'

/**
 * Landing — plain language: what the site is, what you do, how to start.
 */
export default function HomePage() {
  const { user } = useAuth()
  const { t } = useSettings()

  const primaryHref = user ? '/learn' : '/auth'
  const primaryLabel = user ? t('startLearning') : t('freeRegister')
  const loginHref = '/auth'
  const loginLabel = t('login')

  const whatYouGet = [
    {
      title: t('lpWhat1Title') || 'HSK 1–6 words',
      text: t('lpWhat1Text') || 'About 5000 words from the official HSK lists.',
    },
    {
      title: t('lpWhat2Title') || 'Flashcard practice',
      text:
        t('lpWhat2Text') ||
        'See a character or pinyin, pick the right answer. Modes for meaning too.',
    },
    {
      title: t('lpWhat3Title') || 'Your own lists',
      text:
        t('lpWhat3Text') ||
        'Save words into personal decks and study only what you need.',
    },
  ]

  const howSteps = [
    {
      n: '1',
      title: t('lpHow1Title') || 'Open Learn',
      text: t('lpHow1Text') || 'Pick HSK level or your deck.',
    },
    {
      n: '2',
      title: t('lpHow2Title') || 'Choose how many cards',
      text: t('lpHow2Text') || '10, 20, 40, or the whole list.',
    },
    {
      n: '3',
      title: t('lpHow3Title') || 'Answer and go on',
      text: t('lpHow3Text') || 'Wrong answers can be reviewed later.',
    },
  ]

  return (
    <SiteLayout>
      <div className="lp">
        <header className="lp-nav">
          <Link href="/" className="lp-nav__brand">
            <img
              src="/logo-180.png"
              alt=""
              className="lp-nav__logo"
              width={36}
              height={36}
            />
            <span className="lp-nav__name">
              <span className="hanzi" lang="zh">
                好好学习
              </span>
              <span className="lp-nav__sep">:{'\u00A0\u00A0\u00A0\u00A0\u00A0'}</span>
              <span className="hanzi" lang="zh">
                汉语
              </span>
            </span>
          </Link>

          <div className="lp-nav__actions">
            {!user && (
              <Link href={loginHref} className="lp-btn lp-btn--ghost">
                {loginLabel}
              </Link>
            )}
            <Link href={primaryHref} className="lp-btn lp-btn--primary">
              {user ? t('startLearning') : primaryLabel}
            </Link>
          </div>
        </header>

        <section className="lp-hero lp-hero--simple">
          <div className="lp-hero__copy">
            <p className="lp-hero__eyebrow">{t('lpEyebrow') || 'Site for HSK vocabulary'}</p>
            <h1 className="lp-hero__title">
              <span className="hanzi" lang="zh">
                好好学习
              </span>
            </h1>
            <p className="lp-hero__lead">{t('lpLead')}</p>

            <div className="lp-hero__cta">
              <Link href={primaryHref} className="lp-btn lp-btn--primary lp-btn--lg">
                {user ? t('startLearning') : primaryLabel}
              </Link>
              {!user && (
                <Link href={loginHref} className="lp-btn lp-btn--ghost lp-btn--lg">
                  {loginLabel}
                </Link>
              )}
              {user && (
                <Link href="/search" className="lp-btn lp-btn--ghost lp-btn--lg">
                  {t('lexiconNav') || 'HSK'}
                </Link>
              )}
            </div>
          </div>

          <div className="lp-hero__visual" aria-hidden="true">
            <div className="lp-demo">
              <div className="lp-demo__bar">
                <span className="lp-demo__label">{t('lpDemoLabel') || 'Example card'}</span>
              </div>
              <div className="lp-demo__prompt hanzi" lang="zh">
                学
              </div>
              <div className="lp-demo__pinyin">xué</div>
              <div className="lp-demo__def">
                {t('lpDemoDef') || 'to study · to learn'}
              </div>
              <div className="lp-demo__answers">
                <span>xiě</span>
                <span className="is-ok">xué</span>
                <span>xǐ</span>
                <span>xuéxiào</span>
              </div>
              <p className="lp-demo__caption">
                {t('lpDemoCaption') || 'You see a word → choose the right answer'}
              </p>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-section__head">
            <h2 className="lp-section__title">{t('lpWhatTitle') || 'What is here'}</h2>
          </div>
          <div className="lp-plain-list">
            {whatYouGet.map((item) => (
              <div key={item.title} className="lp-plain">
                <h3 className="lp-plain__title">{item.title}</h3>
                <p className="lp-plain__text">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-section__head">
            <h2 className="lp-section__title">{t('lpHowTitle') || 'How to use'}</h2>
          </div>
          <div className="lp-steps">
            {howSteps.map((step) => (
              <div key={step.n} className="lp-step">
                <div className="lp-step__n">{step.n}</div>
                <h3 className="lp-step__title">{step.title}</h3>
                <p className="lp-step__text">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-cta">
          <div className="lp-cta__inner">
            <h2 className="lp-cta__title">{t('lpCtaTitle') || 'Ready to practice?'}</h2>
            <p className="lp-cta__sub">
              {user
                ? t('lpCtaLoggedIn') || 'Open Learn and pick a deck.'
                : t('lpCtaGuest') || 'Create an account or log in — then open Learn.'}
            </p>
            <Link href={primaryHref} className="lp-btn lp-btn--primary lp-btn--lg">
              {user ? t('startLearning') : primaryLabel}
            </Link>
          </div>
        </section>

        <footer className="lp-footer">
          <span>
            © {new Date().getFullYear()}{' '}
            <span className="hanzi" lang="zh">
              好好学习
            </span>
            :{'\u00A0\u00A0\u00A0\u00A0\u00A0'}
            <span className="hanzi" lang="zh">
              汉语
            </span>
          </span>
        </footer>
      </div>
    </SiteLayout>
  )
}
