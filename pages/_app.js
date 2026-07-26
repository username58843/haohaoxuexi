import React from 'react'
import Head from 'next/head'
import NextTopLoader from 'nextjs-toploader'
import { AuthProvider } from '~/lib/contexts/AuthContext'
import { SettingsProvider } from '~/lib/contexts/SettingsContext'
import { ToastProvider } from '~/components/ui/Toast'

import '~/styles/main.scss'

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ToastProvider>
          <Head>
            <title>好好学习 — Learn Chinese</title>
            <meta
              name="description"
              content="好好学习 — HSK 1–6 vocabulary with spaced repetition, personal decks and progress tracking."
            />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
          </Head>
          <NextTopLoader color="var(--accent)" height={2} showSpinner={false} />
          <Component {...pageProps} />
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
  )
}
