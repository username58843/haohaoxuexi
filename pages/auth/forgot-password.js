import { useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Script from 'next/script'
import AppShell from '~/components/AppShell'
import { Card, Field, Button } from '~/components/ui'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { api, apiError } from '~/lib/api-client'
import Turnstile from '~/components/Turnstile'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { t } = useSettings()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null)
  const captchaRef = useRef(null)

  async function onSubmit(e) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email: email.trim(), captchaToken })
      setSent(true)
    } catch (err) {
      // The failed attempt spent the single-use captcha token — mint a new one.
      captchaRef.current?.reset()
      const e2 = apiError(err)
      if (e2.code === 'rate_limited') {
        setError(t('authErrTooMany', 'Too many attempts — try again later'))
      } else if (e2.code === 'captcha_required' || e2.code === 'captcha_failed') {
        setError(t('authErrCaptcha', 'Captcha check failed — please try again'))
      } else if (e2.code === 'validation') {
        setError(t('authErrEmailFormat', 'Enter a valid email address'))
      } else {
        setError(t('authErrGeneric', 'Something went wrong. Please try again.'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell bare>
      <Head>
        <title>{`${t('authForgotPassword', 'Forgot password')} · 好好学习汉语`}</title>
      </Head>

      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => window.dispatchEvent(new Event('turnstile-ready'))}
      />

      <div className="auth">
        <Card as="section" className="auth__card">
          <div className="auth__brand">
            <Link href="/">
              <img src="/logo-180.png" alt="" width={48} height={48} className="auth__logo" />
            </Link>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <div className="auth__brand-name hanzi" lang="zh">好好学习汉语</div>
            </Link>
            <p className="auth__tagline">
              {t('authTagline', 'HSK vocabulary with spaced repetition')}
            </p>
          </div>

          <h2 style={{ margin: '0 0 8px', fontSize: 20, textAlign: 'center', color: 'var(--text)' }}>
            {t('authForgotPasswordTitle', 'Forgot password?')}
          </h2>

          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-2)', margin: '0 0 24px', lineHeight: 1.5 }}>
                {t('authForgotSent', 'If an account exists with')} <strong style={{ color: 'var(--text)' }}>{email}</strong>, {t('authForgotSentSuffix', 'we sent a password reset link. Check your inbox.')}
              </p>
              <Link href="/auth">
                <Button variant="primary" block>{t('authBackToLogin', 'Back to sign in')}</Button>
              </Link>
            </div>
          ) : (
            <>
              <p style={{ color: 'var(--text-2)', margin: '0 0 24px', fontSize: 14, textAlign: 'center' }}>
                {t('authForgotHint', "Enter your email and we'll send you a link to reset your password.")}
              </p>
              <form onSubmit={onSubmit}>
                <Field
                  label={t('authEmailLabel', 'Email')}
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <Turnstile
                  ref={captchaRef}
                  onVerify={setCaptchaToken}
                  onExpire={() => setCaptchaToken(null)}
                />

                {error && (
                  <div className="auth__error" role="alert">{error}</div>
                )}
                <Button type="submit" variant="primary" block loading={loading}>
                  {t('authForgotSubmit', 'Send reset link')}
                </Button>
              </form>
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Link href="/auth" style={{ fontSize: 14, color: 'var(--accent)' }}>
                  {t('authBackToLogin', 'Back to sign in')}
                </Link>
              </div>
            </>
          )}

          <div className="auth__footer">
            <Link href="/privacy">{t('authPrivacy', 'Privacy')}</Link>
            <span aria-hidden="true">·</span>
            <Link href="/terms">{t('authTerms', 'Terms')}</Link>
          </div>
        </Card>
      </div>
    </AppShell>
  )
}
