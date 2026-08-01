import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Link from 'next/link'
import AppShell from '~/components/AppShell'
import { Card, Field, Button, Spinner } from '~/components/ui'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { api, apiError } from '~/lib/api-client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { token } = router.query
  const { t } = useSettings()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [invalidToken, setInvalidToken] = useState(false)

  function validate() {
    if (password.length < 8) return t('authErrPasswordShort', 'Password must be at least 8 characters')
    if (password !== confirm) return t('authResetNoMatch', 'Passwords do not match')
    return null
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (loading || !token) return
    const v = validate()
    if (v) { setError(v); return }
    setError(null)
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
    } catch (err) {
      const e2 = apiError(err)
      if (e2.code === 'invalid_token') {
        // Expired/used link — swap to the "request a new one" view instead of
        // leaving a form the user can only fail with.
        setInvalidToken(true)
      } else if (e2.code === 'rate_limited') {
        setError(t('authErrTooMany', 'Too many attempts — try again later'))
      } else if (e2.code === 'validation') {
        setError(t('authErrPasswordShort', 'Password must be at least 8 characters'))
      } else {
        setError(t('authErrGeneric', 'Something went wrong — please try again'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell bare>
      <Head>
        <title>{`${t('authResetPassword', 'Reset password')} · 好好学习汉语`}</title>
      </Head>
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
            {t('authResetPassword', 'Reset password')}
          </h2>

          {done ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-2)', margin: '0 0 24px', lineHeight: 1.5 }}>
                {t('authResetDone', 'Your password has been reset. You can now sign in with your new password.')}
              </p>
              <Link href="/auth">
                <Button variant="primary" block>{t('authSubmitLogin', 'Sign in')}</Button>
              </Link>
            </div>
          ) : !router.isReady ? (
            // router.query is empty during hydration — showing the invalid-link
            // view here would flash at every user with a perfectly good link.
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
              <Spinner />
            </div>
          ) : !token || invalidToken ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--danger)', margin: '0 0 24px', lineHeight: 1.5 }}>
                {t('authResetInvalid', 'Invalid reset link. Please request a new one.')}
              </p>
              <Link href="/auth/forgot-password">
                <Button variant="primary" block>{t('authForgotResend', 'Request new link')}</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit}>
              <Field
                label={t('authNewPasswordLabel', 'New password')}
                type="password"
                name="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint={t('authPasswordHint', 'At least 8 characters')}
                required
              />
              <Field
                label={t('authConfirmPasswordLabel', 'Confirm password')}
                type="password"
                name="confirm"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              {error && (
                <div className="auth__error" role="alert">{error}</div>
              )}
              <Button type="submit" variant="primary" block loading={loading}>
                {t('authResetSubmit', 'Reset password')}
              </Button>
            </form>
          )}

          <div className="auth__footer">
            <Link href="/auth">{t('authBackToLogin', 'Back to sign in')}</Link>
            <span aria-hidden="true">·</span>
            <Link href="/privacy">{t('authPrivacy', 'Privacy')}</Link>
            <span aria-hidden="true">·</span>
            <Link href="/terms">{t('authTerms', 'Terms')}</Link>
          </div>
        </Card>
      </div>
    </AppShell>
  )
}
