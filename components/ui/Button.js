import React from 'react'
import Link from 'next/link'

export default function Button({
  variant = 'soft',
  size = 'md',
  block = false,
  loading = false,
  href,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}) {
  const cls = [
    'btn',
    `btn--${variant}`,
    size !== 'md' ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      {loading && <span className="btn__spinner" aria-hidden />}
      {children}
    </>
  )

  if (href && !disabled) {
    return (
      <Link href={href} className={cls} {...rest}>
        {content}
      </Link>
    )
  }

  return (
    <button type={type} className={cls} disabled={disabled || loading} {...rest}>
      {content}
    </button>
  )
}
