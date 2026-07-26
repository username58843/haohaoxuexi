import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Form, FormGroup, Label, Input, Button, Alert } from 'reactstrap'
import axios from 'axios'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import SiteLayout from '~/components/SiteLayout'
import SubpageHeader from '~/components/SubpageHeader'

export default function ProfilePage() {
  const router = useRouter()
  const { user, checkAuth, loading: authLoading } = useAuth()
  const { t } = useSettings()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [searchHistory, setSearchHistory] = useState([])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/auth')
      return
    }

    setFormData({
      name: user.name || '',
      email: user.email || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })

    if (user.searchHistory) {
      setSearchHistory(user.searchHistory.slice(0, 20))
    }
  }, [user, router, authLoading])

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const updates = {}
      if (formData.name !== user.name) {
        updates.name = formData.name
      }

      await axios.put('/api/user/profile', updates, {
        withCredentials: true,
      })

      setSuccess(t('nameChanged'))
      checkAuth()
    } catch (err) {
      setError(err.response?.data?.error || t('somethingWentWrong'))
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (formData.newPassword !== formData.confirmPassword) {
      setError(t('passwordMismatch') || 'Passwords do not match')
      setLoading(false)
      return
    }

    if (formData.newPassword.length < 6) {
      setError(t('passwordTooShort') || 'Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      await axios.put(
        '/api/user/password',
        {
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        },
        { withCredentials: true }
      )

      setSuccess(t('passwordChanged'))
      setFormData({
        ...formData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
    } catch (err) {
      setError(err.response?.data?.error || t('somethingWentWrong'))
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || !user) {
    return (
      <SiteLayout>
        <div className="text-center py-5 text-muted">{t ? t('loading') : 'Loading...'}</div>
      </SiteLayout>
    )
  }

  return (
    <SiteLayout>
      <div className="account-page">
        <SubpageHeader title={t('profile')} />

        {(user.isAdmin || user.isPremium) && (
          <div className="account-page__badges">
            {user.isAdmin && (
              <span className="account-page__badge account-page__badge--admin">
                ADMIN · {t('youAreAdmin')}
              </span>
            )}
            {user.isPremium && (
              <span className="account-page__badge account-page__badge--premium">
                PREMIUM
                {user.premiumExpiresAt
                  ? ` · ${t('expires')} ${new Date(user.premiumExpiresAt).toLocaleDateString()}`
                  : ''}
              </span>
            )}
          </div>
        )}

        {success && (
          <Alert color="success" className="account-page__alert">
            {success}
          </Alert>
        )}
        {error && (
          <Alert color="danger" className="account-page__alert">
            {error}
          </Alert>
        )}

        <section className="account-panel">
          <h2 className="account-panel__title">{t('profileInformation')}</h2>
          <Form onSubmit={handleUpdateProfile} className="account-form">
            <div className="account-form__grid">
              <FormGroup className="account-form__field">
                <Label>{t('name')}</Label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </FormGroup>
              <FormGroup className="account-form__field">
                <Label>{t('email')}</Label>
                <Input type="email" value={formData.email} disabled />
              </FormGroup>
            </div>
            <Button type="submit" color="primary" size="sm" disabled={loading} className="account-form__btn">
              {loading ? t('updating') : t('updateProfile')}
            </Button>
          </Form>
        </section>

        <details className="account-panel account-panel--fold">
          <summary className="account-panel__summary">
            <span>{t('changePassword')}</span>
            <span className="account-panel__chevron" aria-hidden>
              ›
            </span>
          </summary>
          <Form onSubmit={handleChangePassword} className="account-form">
            <FormGroup className="account-form__field">
              <Label>{t('currentPassword')}</Label>
              <Input
                type="password"
                value={formData.currentPassword}
                onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                autoComplete="current-password"
              />
            </FormGroup>
            <div className="account-form__grid">
              <FormGroup className="account-form__field">
                <Label>{t('newPassword')}</Label>
                <Input
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  autoComplete="new-password"
                />
              </FormGroup>
              <FormGroup className="account-form__field">
                <Label>{t('confirmNewPassword')}</Label>
                <Input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  autoComplete="new-password"
                />
              </FormGroup>
            </div>
            <Button type="submit" color="primary" size="sm" disabled={loading} className="account-form__btn">
              {loading ? t('changing') : t('changePassword')}
            </Button>
          </Form>
        </details>

        {searchHistory.length > 0 && (
          <details className="account-panel account-panel--fold">
            <summary className="account-panel__summary">
              <span>
                {t('recentSearchHistory')}
                <span className="account-panel__count">{searchHistory.length}</span>
              </span>
              <span className="account-panel__chevron" aria-hidden>
                ›
              </span>
            </summary>
            <ul className="account-history">
              {searchHistory.map((item, idx) => (
                <li key={idx}>
                  <span className="account-history__term">{item.term}</span>
                  <span className="account-history__time">
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </SiteLayout>
  )
}
