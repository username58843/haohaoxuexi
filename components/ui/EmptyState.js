import React from 'react'

export default function EmptyState({ glyph = '空', title, text, hint, action }) {
  const body = text || hint
  return (
    <div className="empty-state">
      <span className="empty-state__glyph hanzi" lang="zh" aria-hidden>
        {glyph}
      </span>
      {title && <span className="empty-state__title">{title}</span>}
      {body && <span className="empty-state__text">{body}</span>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  )
}
