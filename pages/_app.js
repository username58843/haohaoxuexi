import React from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'

import NextTopLoader from 'nextjs-toploader'
import { AuthProvider } from '~/lib/contexts/AuthContext'
import { SettingsProvider } from '~/lib/contexts/SettingsContext'

import 'bootstrap/dist/css/bootstrap.min.css'
import '~/styles/main.scss'

function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Head>
          <title>好好学习: Chinese Language</title>
          <meta name="description" content="好好学习: Chinese Language — HSK 1–6 vocabulary practice, personal decks, progress tracking" />
          <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        </Head>
        {/* Color is overridden by CSS var(--theme-color) — keeps SSR/client in sync */}
        <NextTopLoader
          color="var(--theme-color)"
          initialPosition={0.3}
          crawlSpeed={200}
          height={2}
          showSpinner={false}
        />
        <Component {...pageProps} />
      </SettingsProvider>
    </AuthProvider>
  )
}

MyApp.propTypes = {
  Component: PropTypes.elementType.isRequired,
  pageProps: PropTypes.object.isRequired
}

export default MyApp
