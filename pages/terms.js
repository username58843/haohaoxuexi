import React from 'react'
import Head from 'next/head'
import AppShell from '~/components/AppShell'
import DocsLayout from '~/components/docs/DocsLayout'
import CmsDoc from '~/components/docs/CmsDoc'
import { TERMS_MD } from '~/components/docs/docDefaults'
import { useSettings } from '~/lib/contexts/SettingsContext'

/** Public terms of service for the web app and the Android app. */
export default function TermsPage() {
  const { t } = useSettings()
  const title = t('docsTermsTitle', 'Terms of Service')

  return (
    <AppShell>
      <Head>
        <title>{`${title} · 好好学习汉语`}</title>
        <meta
          name="description"
          content="Terms of Service for 好好学习汉语 (HaoHao XueXi), the free Chinese vocabulary learning app: accounts, acceptable use, your content, disclaimers, and contact."
        />
      </Head>

      <DocsLayout title={title} current="terms">
        <CmsDoc scope="terms" defaultMd={TERMS_MD} />
      </DocsLayout>
    </AppShell>
  )
}
