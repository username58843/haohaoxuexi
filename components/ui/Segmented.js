import React from 'react'

/** Pill segmented control. options: [{ value, label }] */
export default function Segmented({ options, value, onChange, block = false, ariaLabel }) {
  return (
    <div
      className={['segmented', block ? 'segmented--block' : ''].filter(Boolean).join(' ')}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={`segmented__item${value === opt.value ? ' is-active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
