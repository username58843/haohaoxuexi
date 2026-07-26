import React from 'react'
import Head from 'next/head'
import AppShell from '~/components/AppShell'
import DocsLayout from '~/components/docs/DocsLayout'
import CmsDoc from '~/components/docs/CmsDoc'
import { TERMS_MD, DOC_UPDATED, formatDocDate } from '~/components/docs/docDefaults'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { useContent } from '~/lib/contexts/ContentContext'

/** Public terms of service for the web app and the Android app. */
export default function TermsPage() {
  const { t, language } = useSettings()
  const { contentUpdatedAt } = useContent()
  const title = t('docsTermsTitle', 'Terms of Service')
  // CMS edits move the "Last updated" date; otherwise the shipped date shows.
  const updated = formatDocDate(
    contentUpdatedAt('terms', 'body') || DOC_UPDATED.terms,
    language
  )

  return (
    <AppShell>
      <Head>
        <title>{`${title} · 好好学习汉语`}</title>
        <meta
          name="description"
          content="Terms of Service for 好好学习汉语 (HaoHao XueXi), the free Chinese vocabulary learning app: accounts, acceptable use, your content, disclaimers, and contact."
        />
      </Head>

      <DocsLayout title={title} current="terms" updated={updated}>
        <CmsDoc scope="terms" defaults={TERMS_MD} />
      </DocsLayout>
    </AppShell>
  )
}
