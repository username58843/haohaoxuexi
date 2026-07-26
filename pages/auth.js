import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import LoginForm from '~/components/Auth/LoginForm'
import RegisterForm from '~/components/Auth/RegisterForm'
import SiteLayout from '~/components/SiteLayout'
import Link from '~/components/Link'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'

export default function AuthPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { t } = useSettings()
  const [activeTab, setActiveTab] = useState('login')

  useEffect(() => {
    if (!loading && user) router.replace('/learn')
  }, [user, loading, router])

  const handleSuccess = () => {
    router.push('/learn')
  }

  return (
    <SiteLayout>
      <div className="auth-shell">
        <div className="auth-shell__card">
          <Link href="/" className="auth-shell__back">
            ← {t('home') || 'Home'}
          </Link>

          <header className="auth-shell__header">
            <Link href="/" className="auth-shell__logo-link">
              <img
                src="/logo-180.png"
                alt={t('appName') || '好好学习'}
                className="auth-shell__logo"
                width={56}
                height={56}
              />
            </Link>
            <h1 className="auth-shell__title">
              <Link href="/" className="auth-shell__title-link">
                <span className="hanzi" lang="zh">
                  好好学习
                </span>
              </Link>
            </h1>
            <p className="auth-shell__sub">
              {t('productTagline') || t('heroSubtitle') || 'Chinese Language'}
            </p>
          </header>

          <div className="auth-shell__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'login'}
              className={`auth-shell__tab${activeTab === 'login' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('login')}
            >
              {t('login') || 'Login'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'register'}
              className={`auth-shell__tab${activeTab === 'register' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('register')}
            >
              {t('freeRegister') || 'Register'}
            </button>
          </div>

          <div className="auth-shell__body">
            {activeTab === 'login' ? (
              <LoginForm
                onSuccess={handleSuccess}
                onSwitchToRegister={() => setActiveTab('register')}
              />
            ) : (
              <RegisterForm
                onSuccess={handleSuccess}
                onSwitchToLogin={() => setActiveTab('login')}
              />
            )}
          </div>
        </div>
      </div>
    </SiteLayout>
  )
}
