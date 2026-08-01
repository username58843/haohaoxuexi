import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import Script from 'next/script'
import Link from 'next/link'
import { useRouter } from 'next/router'
import AppShell from '~/components/AppShell'
import { Button, Card, Field, Segmented, PageLoader, useToast } from '~/components/ui'
import Turnstile from '~/components/Turnstile'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { api, apiError, setBearerToken } from '~/lib/api-client'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Client-side resend pacing; the server additionally rate-limits sends. */
const RESEND_COOLDOWN_S = 60

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
  const { t, language } = useSettings()
  const toast = useToast()

  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [banNotice, setBanNotice] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null)
  const [registered, setRegistered] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState(null)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

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

  // Auto-send verification email when the verify screen appears (silent —
  // the panel itself already says a code is on its way).
  useEffect(() => {
    if (!registered || !registeredEmail) return
    api.post('/auth/send-verification', { email: registeredEmail }).catch(() => {})
  }, [registered, registeredEmail])

  // Resend-cooldown countdown (setTimeout chain — dep-correct, no leaks).
  useEffect(() => {
    if (resendCooldown <= 0) return undefined
    const id = setTimeout(() => setResendCooldown((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [resendCooldown])

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
        : await register(email.trim(), password, name.trim(), captchaToken, language)

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
    if (resending || resendCooldown > 0) return
    setResending(true)
    try {
      await api.post('/auth/send-verification', { email: registeredEmail })
      setResendCooldown(RESEND_COOLDOWN_S)
      toast.success(t('authResendSent', 'Verification code sent'))
    } catch (err) {
      const e = apiError(err)
      toast.error(
        e.code === 'rate_limited'
          ? t('authErrRateLimited', 'Too many attempts — wait 15 minutes')
          : t('authResendFailed', 'Could not send the code. Try again later.')
      )
    } finally {
      setResending(false)
    }
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
            <div className="auth__verify">
              <p className="auth__verify-title">{t('authVerifyTitle', 'Check your email')}</p>
              <p className="auth__verify-sent">
                {t('authVerifySent', 'We sent a verification code to')}{' '}
                <strong>{registeredEmail}</strong>
              </p>
              <p className="auth__verify-spam">
                {t('authVerifySpam', "Didn't receive it? Check your spam folder")}
              </p>
              <form onSubmit={handleVerifyCode} className="auth__verify-form">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  aria-label={t('authVerifyCodeAria', 'Verification code')}
                  className={`auth__code-input${verifyError ? ' is-invalid' : ''}`}
                  value={verifyCode}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setVerifyCode(v)
                    setVerifyError(null)
                  }}
                  autoFocus
                  disabled={verifying}
                />
                {verifyError && (
                  <p className="auth__verify-error" role="alert">
                    {verifyError}
                  </p>
                )}
                <div className="auth__verify-actions">
                  <Button
                    type="button"
                    onClick={handleResendCode}
                    disabled={verifying || resending || resendCooldown > 0}
                  >
                    {resendCooldown > 0
                      ? `${t('authResend', 'Resend')} (${resendCooldown})`
                      : resending
                        ? t('authSending', 'Sending…')
                        : t('authResend', 'Resend')}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={verifying}
                    disabled={verifyCode.length !== 6}
                  >
                    {t('authVerifySubmit', 'Confirm')}
                  </Button>
                </div>
              </form>
              <button
                type="button"
                className="auth__verify-back"
                onClick={() => {
                  setRegistered(false)
                  setRegisteredEmail('')
                  setVerifyCode('')
                  setVerifyError(null)
                }}
              >
                {t('authBackToLogin', 'Back to sign in')}
              </button>
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
              <div className="auth__forgot">
                <Link href="/auth/forgot-password">
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
