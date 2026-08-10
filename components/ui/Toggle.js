import React from 'react'

/**
 * Labelled on/off switch with an optional description line — the settings-page
 * row, shared so the same control can appear anywhere a preference is offered
 * in context (e.g. the quiz audio option on /learn).
 */
export default function Toggle({ label, desc, checked, onChange, className = '' }) {
  return (
    <div className={['acct-toggle', className].filter(Boolean).join(' ')}>
      <div className="acct-toggle__text">
        <span className="acct-toggle__label">{label}</span>
        {desc && <span className="acct-toggle__desc">{desc}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`acct-switch${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="acct-switch__knob" aria-hidden />
      </button>
    </div>
  )
}
