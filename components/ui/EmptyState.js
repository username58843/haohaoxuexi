import React from 'react'

export default function EmptyState({ glyph = '空', title, text, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state__glyph hanzi" lang="zh" aria-hidden>
        {glyph}
      </span>
      {title && <span className="empty-state__title">{title}</span>}
      {text && <span className="empty-state__text">{text}</span>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  )
}
