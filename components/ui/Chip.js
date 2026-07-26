import React from 'react'

export default function Chip({ active = false, className = '', children, ...rest }) {
  return (
    <button
      type="button"
      className={['chip', active ? 'is-active' : '', className].filter(Boolean).join(' ')}
      aria-pressed={active}
      {...rest}
    >
      {children}
    </button>
  )
}
