import React, { useState } from 'react'
import { Field } from '~/components/ui'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { IconEye, IconEyeOff } from './icons'

/** Password input with a show/hide visibility toggle in the trailing slot. */
export default function PasswordField({ className = '', ...props }) {
  const { t } = useSettings()
  const [visible, setVisible] = useState(false)

  return (
    <Field
      type={visible ? 'text' : 'password'}
      className={['acct-pw', className].filter(Boolean).join(' ')}
      trailing={
        <button
          type="button"
          className="field__trailing"
          onClick={() => setVisible((v) => !v)}
          aria-label={
            visible ? t('acctPwHide', 'Hide password') : t('acctPwShow', 'Show password')
          }
        >
          {visible ? <IconEyeOff /> : <IconEye />}
        </button>
      }
      {...props}
    />
  )
}
