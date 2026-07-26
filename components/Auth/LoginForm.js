import React, { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'

export default function LoginForm({ onSuccess, onSwitchToRegister }) {
  const { login } = useAuth()
  const { t } = useSettings()
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { email: '', password: '' },
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (data) => {
    setError('')
    setLoading(true)
    try {
      const result = await login(data.email.trim(), data.password)
      if (result.success) {
        onSuccess?.()
      } else {
        setError(result.error || t('loginFailed') || 'Login failed')
      }
    } catch (err) {
      setError(t('somethingWentWrong') || 'An error occurred')
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>
      {error ? <div className="auth-form__error">{error}</div> : null}

      <label className="auth-form__field">
        <span className="auth-form__label">{t('email') || 'Email'}</span>
        <Controller
          name="email"
          control={control}
          rules={{ required: t('emailRequired') || 'Email is required' }}
          render={({ field }) => (
            <input
              {...field}
              type="email"
              className="auth-form__input"
              placeholder="you@email.com"
              autoComplete="email"
              inputMode="email"
            />
          )}
        />
        {errors.email ? (
          <span className="auth-form__hint is-error">{errors.email.message}</span>
        ) : null}
      </label>

      <label className="auth-form__field">
        <span className="auth-form__label">{t('password') || 'Password'}</span>
        <Controller
          name="password"
          control={control}
          rules={{ required: t('passwordRequired') || 'Password is required' }}
          render={({ field }) => (
            <input
              {...field}
              type="password"
              className="auth-form__input"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          )}
        />
        {errors.password ? (
          <span className="auth-form__hint is-error">{errors.password.message}</span>
        ) : null}
      </label>

      <button type="submit" className="auth-form__submit" disabled={loading}>
        {loading ? t('loading') || '…' : t('login') || 'Login'}
      </button>

      {onSwitchToRegister ? (
        <p className="auth-form__switch">
          <button type="button" className="auth-form__switch-btn" onClick={onSwitchToRegister}>
            {t('freeRegister') || 'Create account'}
          </button>
        </p>
      ) : null}
    </form>
  )
}
