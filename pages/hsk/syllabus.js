import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import AppShell from '~/components/AppShell'
import HskGuide from '~/components/HskGuide'
import { useSettings } from '~/lib/contexts/SettingsContext'

export default function SyllabusPage() {
  const { t } = useSettings()
  return <AppShell>
    <Head><title>{t('hsk3.title')} · 好好学习</title></Head>
    <div className="learning-page">
      <Link href="/hsk" className="learning-back">← {t('memorize.back')}</Link>
      <HskGuide />
    </div>
  </AppShell>
}
