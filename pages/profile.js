import React, { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import AppShell from '~/components/AppShell'
import { Card, Field, Button, Modal, PageLoader, useToast } from '~/components/ui'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { api, apiError, setBearerToken } from '~/lib/api-client'
import PasswordField from '~/components/account/PasswordField'

const DELETE_WORD = 'DELETE'

/** /profile — name edit, password change, danger zone (account deletion). */
export default function ProfilePage() {
  const { user, loading, setUser, logout } = useAuth()
  const { t } = useSettings()
  const router = useRouter()
  const toast = useToast()

  // Card 1: profile
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [savingName, setSavingName] = useState(false)
  const nameInitRef = useRef(false)

  // Card 2: password
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [repeatPw, setRepeatPw] = useState('')
  const [pwErrors, setPwErrors] = useState({})
  const [savingPw, setSavingPw] = useState(false)

  // Card 3: delete account
  const [delOpen, setDelOpen] = useState(false)
  const [delPassword, setDelPassword] = useState('')
  const [delConfirm, setDelConfirm] = useState('')
  const [delError, setDelError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const leavingRef = useRef(false)

  useEffect(() => {
    if (!loading && !user && !leavingRef.current) router.replace('/auth')
  }, [loading, user, router])

  useEffect(() => {
    if (user && !nameInitRef.current) {
      nameInitRef.current = true
      setName(user.name || '')
    }
  }, [user])

  if (loading || !user) {
    return (
      <AppShell>
        <PageLoader />
      </AppShell>
    )
  }

  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase()

  const saveProfile = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2 || trimmed.length > 40) {
      setNameError(t('acctNameInvalid', 'Name must be 2–40 characters'))
      return
    }
    setSavingName(true)
    setNameError('')
    try {
      const { data } = await api.put('/user/profile', { name: trimmed })
      setUser(data.user)
      setName(data.user.name || trimmed)
      toast.success(t('acctProfileSaved', 'Profile updated'))
    } catch (err) {
      const e2 = apiError(err)
      if (e2.code === 'validation') {
        setNameError(t('acctNameInvalid', 'Name must be 2–40 characters'))
      } else {
        toast.error(e2.message)
      }
    } finally {
      setSavingName(false)
    }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!currentPw) errs.current = t('acctPwCurrentRequired', 'Enter your current password')
    if (newPw.length < 8) {
      errs.next = t('acctPwTooShort', 'New password must be at least 8 characters')
    }
    if (repeatPw !== newPw) errs.repeat = t('acctPwMismatch', 'Passwords do not match')
    setPwErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSavingPw(true)
    try {
      const { data } = await api.put('/user/password', {
        currentPassword: currentPw,
        newPassword: newPw,
      })
      if (data.token) setBearerToken(data.token)
      setCurrentPw('')
      setNewPw('')
      setRepeatPw('')
      toast.success(t('acctPwChanged', 'Password changed'))
    } catch (err) {
      const e2 = apiError(err)
      if (e2.code === 'invalid_credentials') {
        setPwErrors({ current: t('acctPwWrong', 'Current password is incorrect') })
      } else if (e2.code === 'validation') {
        setPwErrors({ next: t('acctPwTooShort', 'New password must be at least 8 characters') })
      } else if (e2.code === 'rate_limited') {
        toast.error(t('acctPwRateLimited', 'Too many attempts — try again later'))
      } else {
        toast.error(e2.message)
      }
    } finally {
      setSavingPw(false)
    }
  }

  const closeDeleteModal = () => {
    if (deleting) return
    setDelOpen(false)
    setDelError('')
  }

  const canDelete = delPassword.length > 0 && delConfirm.trim() === DELETE_WORD

  const confirmDelete = async () => {
    setDeleting(true)
    setDelError('')
    leavingRef.current = true
    try {
      await api.delete('/account', { data: { password: delPassword } })
      toast.success(t('acctDeletedToast', 'Your account has been deleted'))
      await logout()
      router.replace('/')
    } catch (err) {
      leavingRef.current = false
      setDeleting(false)
      const e2 = apiError(err)
      if (e2.code === 'forbidden') {
        setDelError(t('acctDeletePwWrong', 'Password is incorrect'))
      } else if (e2.code === 'rate_limited') {
        setDelError(t('acctDeleteRateLimited', 'Too many attempts — try again later'))
      } else if (e2.code === 'validation') {
        setDelError(t('acctDeletePwRequired', 'Enter your password'))
      } else {
        setDelError(e2.message)
      }
    }
  }

  return (
    <AppShell>
      <Head>
        <title>{`${t('acctProfileTitle', 'Profile')} · 好好学习汉语`}</title>
      </Head>

      <div className="col-app acct-page">
        <header className="acct-head">
          <span className="eyebrow">{t('acctAccountEyebrow', 'Account')}</span>
          <h1>{t('acctProfileTitle', 'Profile')}</h1>
        </header>

        <Card>
          <h2 className="acct-card__title">{t('acctProfileCard', 'Profile')}</h2>
          <div className="acct-id">
            <span className="acct-avatar acct-avatar--sm" aria-hidden>
              {initial}
            </span>
            <div className="acct-id__meta">
              <div className="acct-id__name">{user.name}</div>
              <div className="acct-id__email">{user.email}</div>
            </div>
            {(user.role === 'admin' || user.isPremium) && (
              <div className="acct-badges">
                {user.role === 'admin' && (
                  <span className="acct-badge acct-badge--admin">
                    {t('acctBadgeAdmin', 'Admin')}
                  </span>
                )}
                {user.isPremium && (
                  <span className="acct-badge acct-badge--premium">
                    {t('acctBadgePremium', 'Premium')}
                  </span>
                )}
              </div>
            )}
          </div>
          <form onSubmit={saveProfile} noValidate>
            <Field
              label={t('acctNameLabel', 'Name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={nameError}
              maxLength={40}
              autoComplete="name"
            />
            <Field
              label={t('acctEmailLabel', 'Email')}
              value={user.email}
              readOnly
              className="acct-ro"
              hint={t('acctEmailHint', 'Email cannot be changed')}
            />
            <div className="acct-card__actions">
              <Button type="submit" variant="primary" loading={savingName}>
                {t('acctSave', 'Save')}
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="acct-card__title">{t('acctPasswordCard', 'Password')}</h2>
          <p className="acct-card__desc">
            {t('acctPasswordDesc', 'Changing your password signs you out on every other device.')}
          </p>
          <form onSubmit={changePassword} noValidate>
            <PasswordField
              label={t('acctPwCurrentLabel', 'Current password')}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              error={pwErrors.current}
              autoComplete="current-password"
            />
            <PasswordField
              label={t('acctPwNewLabel', 'New password')}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              error={pwErrors.next}
              hint={t('acctPwNewHint', 'At least 8 characters')}
              autoComplete="new-password"
            />
            <PasswordField
              label={t('acctPwRepeatLabel', 'Repeat new password')}
              value={repeatPw}
              onChange={(e) => setRepeatPw(e.target.value)}
              error={pwErrors.repeat}
              autoComplete="new-password"
            />
            <div className="acct-card__actions">
              <Button type="submit" variant="soft" loading={savingPw}>
                {t('acctPwChangeBtn', 'Change password')}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="acct-danger">
          <h2 className="acct-card__title">{t('acctDangerTitle', 'Danger zone')}</h2>
          <p className="acct-card__desc">
            {t('acctDangerDesc', 'Permanently delete your account, decks, and all study progress.')}
          </p>
          <Button variant="danger" onClick={() => setDelOpen(true)}>
            {t('acctDeleteAccount', 'Delete account')}
          </Button>
        </Card>
      </div>

      <Modal
        open={delOpen}
        onClose={closeDeleteModal}
        title={t('acctDeleteTitle', 'Delete account')}
        footer={
          <>
            <Button variant="ghost" disabled={deleting} onClick={closeDeleteModal}>
              {t('acctCancel', 'Cancel')}
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={!canDelete}
              onClick={confirmDelete}
            >
              {t('acctDeleteConfirmBtn', 'Delete forever')}
            </Button>
          </>
        }
      >
        <p className="acct-delete__warn">
          {t(
            'acctDeleteWarn',
            'This permanently deletes your account, decks, and all study progress. There is no undo.'
          )}
        </p>
        <PasswordField
          label={t('acctDeletePwLabel', 'Your password')}
          value={delPassword}
          onChange={(e) => setDelPassword(e.target.value)}
          error={delError}
          autoComplete="current-password"
        />
        <Field
          label={t('acctDeleteTypeLabel', 'Type DELETE to confirm')}
          value={delConfirm}
          onChange={(e) => setDelConfirm(e.target.value)}
          placeholder={DELETE_WORD}
          autoComplete="off"
        />
      </Modal>
    </AppShell>
  )
}
