import React from 'react'
import { useAuth } from '~/lib/contexts/AuthContext'
import AppShell from '~/components/AppShell'
import { PageLoader } from '~/components/ui'
import Landing from '~/components/landing/Landing'
import Dashboard from '~/components/dashboard/Dashboard'

/** Root: marketing landing for guests, dashboard for signed-in users. */
export default function HomePage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <AppShell bare>
        <PageLoader />
      </AppShell>
    )
  }

  return <AppShell>{user ? <Dashboard /> : <Landing />}</AppShell>
}
