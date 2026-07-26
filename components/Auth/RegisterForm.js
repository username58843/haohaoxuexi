import React, { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'

export default function RegisterForm({ onSuccess, onSwitchToLogin }) {
  const { register: registerUser } = useAuth()
  const { t } = useSettings()
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { name: '', email: '', password: '' },
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (data) => {
    setError('')
    setLoading(true)
    try {
      const result = await registerUser(data.email.trim(), data.password, data.name.trim())
      if (result.success) {
        onSuccess?.()
      } else {
        setError(result.error || t('registerFailed') || 'Registration failed')
      }
    } catch (err) {
      setError(t('somethingWentWrong') || 'An error occurred')
      console.error('Registration error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>
      {error ? <div className="auth-form__error">{error}</div> : null}

      <label className="auth-form__field">
        <span className="auth-form__label">{t('name') || 'Name'}</span>
        <Controller
          name="name"
          control={control}
          rules={{
            required: t('nameRequired') || 'Name is required',
            minLength: { value: 2, message: t('nameTooShort') || 'At least 2 characters' },
          }}
          render={({ field }) => (
            <input
              {...field}
              type="text"
              className="auth-form__input"
              placeholder={t('yourNamePlaceholder') || 'Name'}
              autoComplete="name"
            />
          )}
        />
        {errors.name ? (
          <span className="auth-form__hint is-error">{errors.name.message}</span>
        ) : null}
      </label>

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
          rules={{
            required: t('passwordRequired') || 'Password is required',
            minLength: { value: 6, message: t('passwordTooShort') || 'At least 6 characters' },
          }}
          render={({ field }) => (
            <input
              {...field}
              type="password"
              className="auth-form__input"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          )}
        />
        {errors.password ? (
          <span className="auth-form__hint is-error">{errors.password.message}</span>
        ) : null}
      </label>

      <button type="submit" className="auth-form__submit" disabled={loading}>
        {loading ? t('loading') || '…' : t('freeRegister') || 'Register'}
      </button>

      {onSwitchToLogin ? (
        <p className="auth-form__switch">
          <button type="button" className="auth-form__switch-btn" onClick={onSwitchToLogin}>
            {t('login') || 'Login'}
          </button>
        </p>
      ) : null}
    </form>
  )
}
