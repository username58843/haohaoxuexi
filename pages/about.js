import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import AppShell from '~/components/AppShell'
import DocsLayout from '~/components/docs/DocsLayout'
import { useSettings } from '~/lib/contexts/SettingsContext'

const CONTACT_EMAIL = 'bobby.minecrafter06@gmail.com'
const APP_VERSION = '2.0.0'

/** Public about page: what the project is, the name, features, contact. */
export default function AboutPage() {
  const { t } = useSettings()
  const title = t('docsAboutTitle', 'About')

  return (
    <AppShell>
      <Head>
        <title>{`${title} · 好好学习汉语`}</title>
        <meta
          name="description"
          content="About 好好学习汉语 (HaoHao XueXi) — a free Chinese-learning app with SRS flashcards, HSK 1–6 vocabulary, personal decks, quizzes, and progress tracking."
        />
      </Head>

      <DocsLayout title={title} current="about">
        <p className="docs__lede">
          <span className="hanzi" lang="zh">
            好好学习汉语
          </span>{' '}
          (HaoHao XueXi) is a free tool for learning Chinese vocabulary. It
          runs in the browser and as an Android app, with one account and your
          progress synced between the two. No ads, no tracking — just words,
          cards, and steady progress.
        </p>

        <h2>The name</h2>
        <p>
          <span className="hanzi" lang="zh">
            好好学习汉语
          </span>{' '}
          (<em>hǎohǎo xuéxí</em>) means “study well”. It comes from the classic
          encouragement{' '}
          <span className="hanzi" lang="zh">
            好好学习，天天向上
          </span>{' '}
          (<em>hǎohǎo xuéxí, tiāntiān xiàngshàng</em>) — “study well and make
          progress every day”. That is exactly what the app is built around:
          small daily sessions that add up.
        </p>

        <h2>What you get</h2>
        <ul>
          <li>
            <strong>Spaced repetition (SRS)</strong> — flashcards scheduled
            with an SM-2-style algorithm, graded Again / Hard / Good / Easy, so
            you review each word right before you would forget it.
          </li>
          <li>
            <strong>HSK 1–6</strong> — the complete standard vocabulary for all
            six levels, plus textbook word packs, with pinyin, definitions,
            stroke-order animations, and audio.
          </li>
          <li>
            <strong>Personal decks</strong> — collect words into your own
            decks, edit them freely, and import or export them.
          </li>
          <li>
            <strong>Quizzes</strong> — multiple-choice practice modes for quick
            self-testing.
          </li>
          <li>
            <strong>Progress</strong> — streaks, a daily goal, activity charts,
            and per-level mastery so you always know where you stand.
          </li>
        </ul>

        <h2>Feedback</h2>
        <p>
          The app improves through the people who use it. Found a bug, missing
          word, or have an idea? Send feedback right from the app (
          <Link href="/more">More → Send feedback</Link>) or email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <h2>The fine print</h2>
        <p>
          How your data is handled is described in the{' '}
          <Link href="/privacy">Privacy Policy</Link>, and the rules of the
          road in the <Link href="/terms">Terms of Service</Link>.
        </p>

        <p className="docs__version u-mono">
          {t('docsVersionLabel', 'Version')} {APP_VERSION}
        </p>
      </DocsLayout>
    </AppShell>
  )
}
