import React from 'react'
import Head from 'next/head'
import NextTopLoader from 'nextjs-toploader'
import { AuthProvider } from '~/lib/contexts/AuthContext'
import { SettingsProvider } from '~/lib/contexts/SettingsContext'
import { ContentProvider } from '~/lib/contexts/ContentContext'
import { ToastProvider } from '~/components/ui/Toast'

import '~/styles/main.scss'

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ContentProvider>
        <ToastProvider>
          <Head>
            <title>好好学习汉语 — Learn Chinese</title>
            <meta
              name="description"
              content="好好学习汉语 — HSK 1–6 vocabulary with spaced repetition, personal decks and progress tracking."
            />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
          </Head>
          <NextTopLoader color="var(--accent)" height={2} showSpinner={false} />
          <Component {...pageProps} />
        </ToastProvider>
        </ContentProvider>
      </SettingsProvider>
    </AuthProvider>
  )
}
