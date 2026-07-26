import React from 'react'
import Link from 'next/link'
import { IconChevronRight } from './icons'

/**
 * Account-hub menu row: icon tile + label + chevron.
 * Renders a Link when `href` is given, a button otherwise.
 */
export default function MenuRow({ href, onClick, icon, label, danger = false }) {
  const cls = ['acct-row', danger ? 'acct-row--danger' : ''].filter(Boolean).join(' ')

  const content = (
    <>
      <span className="acct-row__icon" aria-hidden>
        {icon}
      </span>
      <span className="acct-row__label">{label}</span>
      <span className="acct-row__chevron" aria-hidden>
        <IconChevronRight />
      </span>
    </>
  )

  if (href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" className={cls} onClick={onClick}>
      {content}
    </button>
  )
}
