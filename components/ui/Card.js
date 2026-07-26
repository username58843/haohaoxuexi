import React from 'react'

export default function Card({
  interactive = false,
  accent = false,
  as: Tag = 'div',
  className = '',
  children,
  ...rest
}) {
  const cls = [
    'card',
    interactive ? 'card--interactive' : '',
    accent ? 'card--accent' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  )
}
