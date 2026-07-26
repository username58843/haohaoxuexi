import React, { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import SiteLayout from '~/components/SiteLayout'
import MainNav from '~/components/MainNav'
import LoadingSpinner from '~/components/LoadingSpinner'

/**
 * Account hub — primary entry from bottom “More” tab.
 * Profile / settings / dictionaries open from here, not a top chip strip.
 */
export default function MorePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { t } = useSettings()

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth')
    }
  }, [user, authLoading, router])

  if (authLoading || !user) {
    return (
      <SiteLayout>
        <LoadingSpinner text={t('loading')} />
      </SiteLayout>
    )
  }

  return (
    <SiteLayout>
      <MainNav />
    </SiteLayout>
  )
}
