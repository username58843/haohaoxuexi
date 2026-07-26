import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Button, Field, Modal, useToast } from '~/components/ui'
import { api, apiError } from '~/lib/api-client'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { fmtDateTime, toDateInput } from './format'

/** Accessible switch row used for the premium / ban toggles. */
function Toggle({ checked, onChange, label, danger = false, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={[
        'adm-toggle',
        checked ? 'is-on' : '',
        danger ? 'adm-toggle--danger' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onChange(!checked)}
    >
      <span className="adm-toggle__track" aria-hidden>
        <span className="adm-toggle__thumb" />
      </span>
      <span className="adm-toggle__label">{label}</span>
    </button>
  )
}

/**
 * Right-side drawer with the full user record + moderation controls.
 * Saves only changed fields (PUT /admin/users/[id]); guard errors from the
 * API (self-edit, last admin) surface via toast with the server message.
 */
export default function UserDrawer({ user, open, onClose, onSaved, onDeleted }) {
  const { t, language } = useSettings()
  const toast = useToast()

  const [role, setRole] = useState('user')
  const [isPremium, setIsPremium] = useState(false)
  const [premiumExpires, setPremiumExpires] = useState('')
  const [isBanned, setIsBanned] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [saving, setSaving] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [prevUser, setPrevUser] = useState(null)

  // Re-seed the form whenever a different user is opened (render-time
  // "adjust state when props change" pattern instead of an effect).
  if (user !== prevUser) {
    setPrevUser(user)
    if (user) {
      setRole(user.role || 'user')
      setIsPremium(!!user.isPremium)
      setPremiumExpires(toDateInput(user.premiumExpiresAt))
      setIsBanned(!!user.isBanned)
      setBanReason(user.banReason || '')
      setConfirmOpen(false)
      setConfirmText('')
    }
  }

  // Body scroll lock while the drawer is open (re-applied after the
  // confirm Modal closes, since Modal restores overflow on unmount).
  useEffect(() => {
    if (!open) return undefined
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open, confirmOpen])

  // Esc closes the drawer (the delete Modal handles its own Esc first).
  useEffect(() => {
    if (!open || confirmOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, confirmOpen, onClose])

  const changes = useMemo(() => {
    if (!user) return {}
    const patch = {}
    if (role !== (user.role || 'user')) patch.role = role
    if (isPremium !== !!user.isPremium) patch.isPremium = isPremium
    if (premiumExpires !== toDateInput(user.premiumExpiresAt)) {
      patch.premiumExpiresAt = premiumExpires || null
    }
    if (isBanned !== !!user.isBanned) patch.isBanned = isBanned
    if (banReason !== (user.banReason || '')) patch.banReason = banReason
    return patch
  }, [user, role, isPremium, premiumExpires, isBanned, banReason])

  const dirty = Object.keys(changes).length > 0

  const handleSave = useCallback(async () => {
    if (!user || !dirty || saving) return
    setSaving(true)
    try {
      const { data } = await api.put(`/admin/users/${user.id}`, changes)
      toast.success(t('admSaved', 'User updated'))
      onSaved?.(data.user)
    } catch (err) {
      toast.error(apiError(err, t('admSaveFailed', 'Could not save changes')).message)
    } finally {
      setSaving(false)
    }
  }, [user, dirty, saving, changes, toast, t, onSaved])

  const handleDelete = useCallback(async () => {
    if (!user || deleting) return
    setDeleting(true)
    try {
      await api.delete(`/admin/users/${user.id}`)
      toast.success(t('admDeleted', 'User deleted'))
      setConfirmOpen(false)
      onDeleted?.(user.id)
    } catch (err) {
      toast.error(apiError(err, t('admDeleteFailed', 'Could not delete user')).message)
    } finally {
      setDeleting(false)
    }
  }, [user, deleting, toast, t, onDeleted])

  if (!open || !user) return null

  const confirmMatch = confirmText.trim().toLowerCase() === (user.email || '').toLowerCase()

  return (
    <>
      <div
        className="adm-drawer-overlay"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose?.()
        }}
        role="presentation"
      >
        <aside
          className="adm-drawer"
          role="dialog"
          aria-modal="true"
          aria-label={user.name || user.email}
        >
          <header className="adm-drawer__head">
            <div className="adm-drawer__id">
              <span className="adm-drawer__avatar" aria-hidden>
                {(user.name || '?').charAt(0).toUpperCase()}
              </span>
              <div className="adm-drawer__who">
                <span className="adm-drawer__name">{user.name}</span>
                <span className="adm-drawer__email">{user.email}</span>
              </div>
            </div>
            <button
              type="button"
              className="adm-drawer__close"
              onClick={onClose}
              aria-label={t('admClose', 'Close')}
            >
              ✕
            </button>
          </header>

          <div className="adm-drawer__body">
            <section className="adm-drawer__section">
              <span className="eyebrow">{t('admDrawerDetails', 'Details')}</span>
              <dl className="adm-dl">
                <div className="adm-dl__row">
                  <dt>{t('admDetailId', 'User ID')}</dt>
                  <dd className="u-mono">{user.id}</dd>
                </div>
                <div className="adm-dl__row">
                  <dt>{t('admDetailCreated', 'Created')}</dt>
                  <dd>{fmtDateTime(user.createdAt, language)}</dd>
                </div>
                <div className="adm-dl__row">
                  <dt>{t('admDetailLastSeen', 'Last seen')}</dt>
                  <dd>{fmtDateTime(user.lastSeen, language)}</dd>
                </div>
                {user.isBanned && (
                  <div className="adm-dl__row">
                    <dt>{t('admDetailBannedAt', 'Banned at')}</dt>
                    <dd>{fmtDateTime(user.bannedAt, language)}</dd>
                  </div>
                )}
              </dl>
            </section>

            <section className="adm-drawer__section">
              <span className="eyebrow">{t('admDrawerAccess', 'Access')}</span>
              <label className="field" htmlFor={`adm-role-${user.id}`}>
                <span className="field__label">{t('admLabelRole', 'Role')}</span>
                <span className="field__wrap">
                  <select
                    id={`adm-role-${user.id}`}
                    className="field__input"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="user">{t('admRoleUser', 'User')}</option>
                    <option value="admin">{t('admRoleAdmin', 'Admin')}</option>
                  </select>
                </span>
              </label>

              <Toggle
                checked={isPremium}
                onChange={setIsPremium}
                label={t('admLabelPremium', 'Premium supporter')}
              />
              {isPremium && (
                <Field
                  label={t('admLabelPremiumExpires', 'Premium expires')}
                  type="date"
                  value={premiumExpires}
                  onChange={(e) => setPremiumExpires(e.target.value)}
                  hint={t('admHintPremiumExpires', 'Leave empty for no expiry')}
                />
              )}
            </section>

            <section className="adm-drawer__section">
              <span className="eyebrow">{t('admDrawerModeration', 'Moderation')}</span>
              <Toggle
                checked={isBanned}
                onChange={setIsBanned}
                label={t('admLabelBanned', 'Banned')}
                danger
              />
              {isBanned && (
                <Field
                  label={t('admLabelBanReason', 'Ban reason')}
                  textarea
                  rows={2}
                  maxLength={300}
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder={t('admBanReasonPlaceholder', 'Shown to the user on login')}
                />
              )}
            </section>

            <section className="adm-drawer__section adm-drawer__section--danger">
              <span className="eyebrow">{t('admDrawerDanger', 'Danger zone')}</span>
              <p className="adm-drawer__danger-text">
                {t('admDeleteHint', 'Removes the account with all decks, cards and history.')}
              </p>
              <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>
                {t('admDeleteUser', 'Delete user')}
              </Button>
            </section>
          </div>

          <footer className="adm-drawer__foot">
            <Button variant="ghost" onClick={onClose}>
              {t('admCancel', 'Cancel')}
            </Button>
            <Button variant="primary" loading={saving} disabled={!dirty} onClick={handleSave}>
              {t('admSave', 'Save changes')}
            </Button>
          </footer>
        </aside>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('admDeleteConfirmTitle', 'Delete this user?')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              {t('admCancel', 'Cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={!confirmMatch}
              loading={deleting}
              onClick={handleDelete}
            >
              {t('admDeleteUser', 'Delete user')}
            </Button>
          </>
        }
      >
        <p className="adm-confirm__text">
          {t(
            'admDeleteConfirmText',
            'This permanently deletes the account, decks, SRS cards and review history. Type the user’s email to confirm:'
          )}
        </p>
        <p className="adm-confirm__target u-mono">{user.email}</p>
        <Field
          label={t('admDeleteConfirmLabel', 'Email confirmation')}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={user.email}
          autoComplete="off"
        />
      </Modal>
    </>
  )
}
