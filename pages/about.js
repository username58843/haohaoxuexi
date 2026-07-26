import React from 'react'
import Head from 'next/head'
import AppShell from '~/components/AppShell'
import DocsLayout from '~/components/docs/DocsLayout'
import CmsDoc from '~/components/docs/CmsDoc'
import { ABOUT_MD, DOC_UPDATED, formatDocDate } from '~/components/docs/docDefaults'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { useContent } from '~/lib/contexts/ContentContext'

/** Public about page: what the project is, the name, features, contact. */
export default function AboutPage() {
  const { t, language } = useSettings()
  const { contentUpdatedAt } = useContent()
  const title = t('docsAboutTitle', 'About')
  // CMS edits move the "Last updated" date; otherwise the shipped date shows.
  const updated = formatDocDate(
    contentUpdatedAt('about', 'body') || DOC_UPDATED.about,
    language
  )

  return (
    <AppShell>
      <Head>
        <title>{`${title} · 好好学习汉语`}</title>
        <meta
          name="description"
          content="About 好好学习汉语 (HaoHao XueXi) — a free Chinese-learning app with SRS flashcards, HSK 1–6 vocabulary, personal decks, quizzes, and progress tracking."
        />
      </Head>

      <DocsLayout title={title} current="about" updated={updated}>
        <CmsDoc scope="about" defaultMd={ABOUT_MD} />
      </DocsLayout>
    </AppShell>
  )
}
