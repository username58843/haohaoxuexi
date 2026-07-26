import React, { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import AppShell from '~/components/AppShell'
import { Card, Button, Modal, PageLoader } from '~/components/ui'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import MenuRow from '~/components/account/MenuRow'
import FeedbackModal from '~/components/account/FeedbackModal'
import {
  IconUser,
  IconSliders,
  IconShield,
  IconMessage,
  IconInfo,
  IconLock,
  IconDoc,
  IconLogout,
} from '~/components/account/icons'

const APP_VERSION = 'v2.0.0'

/** /more — account hub: identity, navigation rows, feedback, logout. */
export default function MorePage() {
  const { user, loading, logout } = useAuth()
  const { t } = useSettings()
  const router = useRouter()

  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const leavingRef = useRef(false)

  useEffect(() => {
    if (!loading && !user && !leavingRef.current) router.replace('/auth')
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <AppShell>
        <PageLoader />
      </AppShell>
    )
  }

  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase()

  const handleLogout = async () => {
    leavingRef.current = true
    setLoggingOut(true)
    await logout()
    router.replace('/')
  }

  return (
    <AppShell>
      <Head>
        <title>{`${t('acctMoreTitle', 'More')} · 好好学习`}</title>
      </Head>

      <div className="col-app acct-page">
        <header className="acct-hub">
          <span className="acct-avatar" aria-hidden>
            {initial}
          </span>
          <div className="acct-hub__id">
            <h1 className="acct-hub__name">{user.name}</h1>
            <p className="acct-hub__email">{user.email}</p>
          </div>
        </header>

        <Card className="acct-menu">
          <MenuRow
            href="/profile"
            icon={<IconUser />}
            label={t('acctMenuProfile', 'Profile')}
          />
          <MenuRow
            href="/settings"
            icon={<IconSliders />}
            label={t('acctMenuSettings', 'Settings')}
          />
          {user.role === 'admin' && (
            <MenuRow
              href="/admin"
              icon={<IconShield />}
              label={t('acctMenuAdmin', 'Admin panel')}
            />
          )}
          <MenuRow
            onClick={() => setFeedbackOpen(true)}
            icon={<IconMessage />}
            label={t('acctMenuFeedback', 'Send feedback')}
          />
        </Card>

        <Card className="acct-menu">
          <MenuRow href="/about" icon={<IconInfo />} label={t('acctMenuAbout', 'About')} />
          <MenuRow
            href="/privacy"
            icon={<IconLock />}
            label={t('acctMenuPrivacy', 'Privacy policy')}
          />
          <MenuRow
            href="/terms"
            icon={<IconDoc />}
            label={t('acctMenuTerms', 'Terms of service')}
          />
        </Card>

        <Card className="acct-menu">
          <MenuRow
            danger
            onClick={() => setLogoutOpen(true)}
            icon={<IconLogout />}
            label={t('acctMenuLogout', 'Log out')}
          />
        </Card>

        <footer className="acct-footer u-mono">
          <span className="hanzi" lang="zh">
            好好学习
          </span>
          <span>{APP_VERSION}</span>
        </footer>
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

      <Modal
        open={logoutOpen}
        onClose={() => {
          if (!loggingOut) setLogoutOpen(false)
        }}
        title={t('acctLogoutTitle', 'Log out?')}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={loggingOut}
              onClick={() => setLogoutOpen(false)}
            >
              {t('acctCancel', 'Cancel')}
            </Button>
            <Button variant="danger" loading={loggingOut} onClick={handleLogout}>
              {t('acctLogoutConfirm', 'Log out')}
            </Button>
          </>
        }
      >
        <p>{t('acctLogoutBody', 'You will need to sign in again to keep studying.')}</p>
      </Modal>
    </AppShell>
  )
}
