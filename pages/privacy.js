import React from 'react'
import Head from 'next/head'
import AppShell from '~/components/AppShell'
import DocsLayout from '~/components/docs/DocsLayout'
import CmsDoc from '~/components/docs/CmsDoc'
import { PRIVACY_MD } from '~/components/docs/docDefaults'
import { useSettings } from '~/lib/contexts/SettingsContext'

/** Public privacy policy for the web app and the Android app. */
export default function PrivacyPage() {
  const { t } = useSettings()
  const title = t('docsPrivacyTitle', 'Privacy Policy')

  return (
    <AppShell>
      <Head>
        <title>{`${title} · 好好学习汉语`}</title>
        <meta
          name="description"
          content="Privacy Policy for 好好学习汉语 (HaoHao XueXi): what data the web and Android apps collect, how it is stored and protected, and how to delete your account and data."
        />
      </Head>

      <DocsLayout title={title} current="privacy">
        <CmsDoc scope="privacy" defaultMd={PRIVACY_MD} />
      </DocsLayout>
    </AppShell>
  )
}
