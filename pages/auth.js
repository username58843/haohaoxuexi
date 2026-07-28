import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import Script from 'next/script'
import Link from 'next/link'
import { useRouter } from 'next/router'
import AppShell from '~/components/AppShell'
import { Button, Card, Field, Segmented, PageLoader } from '~/components/ui'
import Turnstile from '~/components/Turnstile'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { api, apiError, setBearerToken } from '~/lib/api-client'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function IconEye({ off = false }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="4.5" y1="19.5" x2="19.5" y2="4.5" />}
    </svg>
  )
}

function IconAlert() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.5 22 20H2L12 3.5Z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

export default function AuthPage() {
  const router = useRouter()
  const { user, loading, login, register, banInfo, setUser, setBanInfo } = useAuth()
  const { t, settings } = useSettings()

  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [banNotice, setBanNotice] = useState(null)
  const [verifiedNotice, setVerifiedNotice] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null)
  const [registered, setRegistered] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState(null)

  const nextTarget =
    router.query.next && String(router.query.next).startsWith('/')
      ? String(router.query.next)
      : '/'

  // Deep link: /auth?mode=register opens the register tab. Applied by adjusting
  // state during render when the route value changes (React docs pattern);
  // router.isReady is false during SSR and hydration, so markup stays in sync.
  const routeMode = router.isReady && router.query.mode === 'register' ? 'register' : null
  const [prevRouteMode, setPrevRouteMode] = useState(routeMode)
  if (prevRouteMode !== routeMode) {
    setPrevRouteMode(routeMode)
    if (routeMode) setMode(routeMode)
  }

  // Already authenticated → leave the auth page.
  useEffect(() => {
    if (router.isReady && !loading && user) router.replace(nextTarget)
  }, [loading, user, router, nextTarget])

  // Show verified notice after email confirmation redirect.
  useEffect(() => {
    if (router.isReady && router.query.verified === '1') {
      setVerifiedNotice(true)
    }
  }, [router.isReady, router.query.verified])

  const clearFieldError = useCallback((field) => {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }, [])

  function validate() {
    const errs = {}
    const em = email.trim()
    if (!em) {
      errs.email = t('authErrEmailRequired', 'Email is required')
    } else if (!EMAIL_RE.test(em)) {
      errs.email = t('authErrEmailFormat', 'Enter a valid email address')
    }
    if (!password) {
      errs.password = t('authErrPasswordRequired', 'Password is required')
    } else if (mode === 'register' && password.length < 8) {
      errs.password = t('authErrPasswordShort', 'Password must be at least 8 characters')
    }
    if (mode === 'register') {
      const nm = name.trim()
      if (nm.length < 2 || nm.length > 40) {
        errs.name = t('authErrNameLength', 'Name must be 2–40 characters')
      }
    }
    return errs
  }

  function switchMode(next) {
    if (next === mode) return
    setMode(next)
    setErrors({})
    setFormError(null)
    setBanNotice(null)
    setRegistered(false)
    setRegisteredEmail('')
    setVerifyCode('')
    setVerifyError(null)
    setCaptchaToken(null)
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (submitting) return
    setFormError(null)
    setBanNotice(null)
    const errs = validate()
    if (Object.values(errs).some(Boolean)) {
      setErrors(errs)
      return
    }
    setErrors({})
    setSubmitting(true)
    const result =
      mode === 'login'
        ? await login(email.trim(), password, captchaToken)
        : await register(email.trim(), password, name.trim(), captchaToken, settings.language)

    if (result.success) {
      if (mode === 'register') {
        setRegistered(true)
        setRegisteredEmail(email.trim())
        setSubmitting(false)
        return
      }
      router.replace(nextTarget)
      return
    }

    setSubmitting(false)
    if (result.code === 'email_not_verified') {
      setRegisteredEmail(email.trim())
      setRegistered(true)
      setVerifyError(result.error)
      return
    }
    switch (result.code) {
      case 'banned':
        setBanNotice({ banReason: result.banReason || null })
        break
      case 'email_taken':
        setErrors({
          email: t('authErrEmailTaken', 'An account with this email already exists'),
        })
        break
      case 'invalid_credentials':
        setFormError(t('authErrInvalidCredentials', 'Incorrect email or password'))
        break
      case 'rate_limited':
        setFormError(t('authErrRateLimited', 'Too many attempts — wait 15 minutes'))
        break
      case 'network':
      case 'timeout':
        setFormError(
          t('authErrNetwork', 'Connection problem — check your internet and try again')
        )
        break
      default:
        setFormError(
          result.error || t('authErrGeneric', 'Something went wrong — please try again')
        )
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault()
    if (verifying || verifyCode.length !== 6) return
    setVerifying(true)
    setVerifyError(null)
    try {
      const code = verifyCode.trim()
      const { data } = await api.post('/auth/verify-email', { email: registeredEmail, code })
      if (data.token) setBearerToken(data.token)
      setUser(data.user)
      setBanInfo(null)
      router.replace(nextTarget)
    } catch (err) {
      const e = apiError(err)
      setVerifyError(e.message || 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  async function handleResendCode() {
    try {
      await fetch('/api/v1/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registeredEmail }),
      })
    } catch {}
  }

  const pageTitle =
    mode === 'register'
      ? t('authTitleRegister', 'Create account')
      : t('authTitleLogin', 'Sign in')

  if (loading || user) {
    return (
      <AppShell bare>
        <Head>
          <title>{`${pageTitle} · 好好学习汉语`}</title>
        </Head>
        <PageLoader />
      </AppShell>
    )
  }

  const ban = banNotice || banInfo

  return (
    <AppShell bare>
      <Head>
        <title>{`${pageTitle} · 好好学习汉语`}</title>
      </Head>

      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => window.dispatchEvent(new Event('turnstile-ready'))}
      />

      <div className="auth">
        <Card as="section" className="auth__card" aria-label={pageTitle}>
          <div className="auth__brand">
            <img src="/logo-180.png" alt="" width={48} height={48} className="auth__logo" />
            <div className="auth__brand-name hanzi" lang="zh">
              好好学习汉语
            </div>
            <p className="auth__tagline">
              {t('authTagline', 'HSK vocabulary with spaced repetition')}
            </p>
          </div>

          {registered ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>
                {t('authVerifyTitle', 'Check your email')}
              </p>
              <p style={{ margin: '0 0 4px', color: '#666', fontSize: 14 }}>
                {t('authVerifySent', 'We sent a verification code to')} <strong>{registeredEmail}</strong>
              </p>
              <p style={{ margin: '0 0 20px', color: '#999', fontSize: 13 }}>
                {t('authVerifySpam', "Didn't receive it? Check your spam folder")}
              </p>
              <form onSubmit={handleVerifyCode} style={{ maxWidth: 280, margin: '0 auto' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setVerifyCode(v)
                    setVerifyError(null)
                  }}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: 28,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    letterSpacing: 8,
                    textAlign: 'center',
                    border: verifyError ? '2px solid var(--danger)' : '2px solid var(--accent)',
                    borderRadius: 10,
                    outline: 'none',
                    background: 'var(--surface-2)',
                    color: 'var(--text)',
                    boxSizing: 'border-box',
                  }}
                  autoFocus
                  disabled={verifying}
                />
                {verifyError && (
                  <p style={{ margin: '8px 0 0', color: '#ef4444', fontSize: 13 }}>
                    {verifyError}
                  </p>
                )}
                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      background: 'none',
                      border: '1px solid #10b981',
                      borderRadius: 8,
                      color: '#10b981',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                    disabled={verifying}
                  >
                    {t('authResend', 'Resend')}
                  </button>
                  <Button
                    type="submit"
                    variant="primary"
                    block
                    loading={verifying}
                    disabled={verifyCode.length !== 6}
                    style={{ flex: 2 }}
                  >
                    {t('authVerifySubmit', 'Confirm')}
                  </Button>
                </div>
              </form>
              <div style={{ marginTop: 20 }}>
                <Link href="/auth" style={{ fontSize: 14, color: '#10b981' }} onClick={() => { setRegistered(false); setRegisteredEmail(''); }}>
                  {t('authBackToLogin', 'Back to sign in')}
                </Link>
              </div>
            </div>
          ) : (
          <>
          {ban && (
            <div className="auth__ban" role="alert">
              <div className="auth__ban-title">
                <IconAlert />
                {t('authBanTitle', 'Account suspended')}
              </div>
              <p className="auth__ban-text">
                {ban.banReason ||
                  t(
                    'authBanBody',
                    'Your account has been suspended. Contact support if you believe this is a mistake.'
                  )}
              </p>
            </div>
          )}

          {verifiedNotice && (
            <div style={{ background: '#10b9811a', border: '1px solid #10b98140', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#10b981', fontSize: 14 }}>
              {t('authVerifiedSuccess', 'Email confirmed! You can now sign in.')}
            </div>
          )}

          <div className="auth__segmented">
            <Segmented
              block
              ariaLabel={t('authModeSwitch', 'Sign in or create an account')}
              value={mode}
              onChange={switchMode}
              options={[
                { value: 'login', label: t('authModeLogin', 'Sign in') },
                { value: 'register', label: t('authModeRegister', 'Create account') },
              ]}
            />
          </div>

          <form className="auth__form" onSubmit={onSubmit} noValidate>
            {mode === 'register' && (
              <Field
                label={t('authNameLabel', 'Name')}
                type="text"
                name="name"
                autoComplete="name"
                maxLength={40}
                placeholder={t('authNamePlaceholder', 'What should we call you?')}
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  clearFieldError('name')
                }}
                error={errors.name}
              />
            )}

            <Field
              label={t('authEmailLabel', 'Email')}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder={t('authEmailPlaceholder', 'you@example.com')}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                clearFieldError('email')
              }}
              error={errors.email}
            />

            <Field
              label={t('authPasswordLabel', 'Password')}
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                clearFieldError('password')
              }}
              error={errors.password}
              hint={
                mode === 'register' ? t('authPasswordHint', 'At least 8 characters') : undefined
              }
              trailing={
                <button
                  type="button"
                  className="field__trailing"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword
                      ? t('authHidePassword', 'Hide password')
                      : t('authShowPassword', 'Show password')
                  }
                >
                  <IconEye off={showPassword} />
                </button>
              }
            />

            {mode === 'login' && (
              <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 8 }}>
                <Link href="/auth/forgot-password" style={{ fontSize: 13, color: '#10b981' }}>
                  {t('authForgotPassword', 'Forgot password?')}
                </Link>
              </div>
            )}

            <Turnstile
              key={mode}
              onVerify={setCaptchaToken}
              onExpire={() => setCaptchaToken(null)}
            />

            {formError && (
              <div className="auth__error" role="alert">
                {formError}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              block
              loading={submitting}
              className="auth__submit"
            >
              {mode === 'register'
                ? t('authSubmitRegister', 'Create account')
                : t('authSubmitLogin', 'Sign in')}
            </Button>
          </form>

          <div className="auth__footer">
            <Link href="/privacy">{t('authPrivacy', 'Privacy')}</Link>
            <span aria-hidden="true">·</span>
            <Link href="/terms">{t('authTerms', 'Terms')}</Link>
          </div>
          </>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
