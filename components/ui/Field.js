import React, { useId } from 'react'

/**
 * Labeled input/textarea with error + hint lines.
 * Extra props go to the input element. Use `trailing` for e.g. a
 * password-visibility toggle button.
 */
export default function Field({
  label,
  error,
  hint,
  textarea = false,
  trailing = null,
  className = '',
  ...inputProps
}) {
  const id = useId()
  const InputTag = textarea ? 'textarea' : 'input'

  return (
    <label
      htmlFor={id}
      className={['field', error ? 'field--invalid' : '', className].filter(Boolean).join(' ')}
    >
      {label && <span className="field__label">{label}</span>}
      <span className="field__wrap">
        <InputTag id={id} className="field__input" {...inputProps} />
        {trailing}
      </span>
      {error && <span className="field__error">{error}</span>}
      {!error && hint && <span className="field__hint">{hint}</span>}
    </label>
  )
}
