import React from 'react'

/** Shared SVG props for bottom-nav icons */
const base = {
  viewBox: '0 0 24 24',
  width: 24,
  height: 24,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
}

/** Главная */
export function IconHome(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 10.2 12 3.5l8 6.7" />
      <path d="M6.2 9.2V19.5h11.6V9.2" />
      <path d="M9.5 19.5v-5.2h5v5.2" />
    </svg>
  )
}

/** Учить — flashcards (не «ещё одна книга») */
export function IconLearn(props) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="5.5" width="12.5" height="15" rx="2.2" />
      <path d="M8.2 3.8h9.2A2.2 2.2 0 0 1 19.6 6v12.2" />
      <path d="M8.2 10.2h6.2M8.2 13.5h4.5" />
    </svg>
  )
}

/** Словарь — открытая книга */
export function IconBook(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5c2.2-1.1 4.4-1.1 6.5 0v13c-2.1-1.1-4.3-1.1-6.5 0V5.5z" />
      <path d="M20 5.5c-2.2-1.1-4.4-1.1-6.5 0v13c2.1-1.1 4.3-1.1 6.5 0V5.5z" />
      <path d="M10.5 5.8v12.5M13.5 5.8v12.5" opacity="0.35" />
    </svg>
  )
}

/** 词库 — сетка символов / lexicon tiles */
export function IconGrid(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
      {/* tiny stroke marks — look like mini 字 cells */}
      <path d="M5.6 7h2.8M7 5.6v2.8" strokeWidth="1.4" />
      <path d="M15.6 7h2.8" strokeWidth="1.4" />
      <path d="M5.6 17h2.8M7 15.6v2.8" strokeWidth="1.4" />
      <circle cx="17" cy="17" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Ещё — профиль / account */
export function IconUser(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.2 19.2c1.1-3.2 3.4-4.8 6.8-4.8s5.7 1.6 6.8 4.8" />
    </svg>
  )
}

export function IconSettings(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.2v1.8M12 19v1.8M4.8 4.8l1.3 1.3M17.9 17.9l1.3 1.3M3.2 12h1.8M19 12h1.8M4.8 19.2l1.3-1.3M17.9 6.1l1.3-1.3" />
    </svg>
  )
}

export function IconList(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 7h11M9 12h11M9 17h11" />
      <circle cx="5" cy="7" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconShield(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.2 19 6.2v5c0 4.3-2.9 7.2-7 8.8-4.1-1.6-7-4.5-7-8.8v-5l7-3z" />
    </svg>
  )
}

export function IconLogout(props) {
  return (
    <svg {...base} {...props}>
      <path d="M10 7.2V5.5A2 2 0 0 1 12 3.5h6.5v17H12a2 2 0 0 1-2-2v-1.7" />
      <path d="M14.5 12H4m0 0 2.8-2.8M4 12l2.8 2.8" />
    </svg>
  )
}

export function IconChevron(props) {
  return (
    <svg {...base} width={18} height={18} {...props}>
      <path d="M9 6.5 14.5 12 9 17.5" />
    </svg>
  )
}

/** Книги — читалка: книга с закладкой */
export function IconReader(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 4.5h11.5A1.5 1.5 0 0 1 18 6v14.5H6.5A1.5 1.5 0 0 1 5 19V4.5z" />
      <path d="M5 17.5A1.5 1.5 0 0 1 6.5 16H18" />
      <path d="M13.5 4.5v6l-2-1.6-2 1.6v-6" />
    </svg>
  )
}

/** Записи — блокнот с пером */
export function IconNote(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
      <path d="M8.2 8h7.6M8.2 11.5h7.6M8.2 15h4" />
    </svg>
  )
}
