import React from 'react'
import PropTypes from 'prop-types'

/**
 * Friendly empty / error placeholder.
 */
export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = '空',
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon hanzi" lang="zh" aria-hidden>
        {icon}
      </div>
      {title && <h3 className="empty-state__title">{title}</h3>}
      {description && <p className="empty-state__desc">{description}</p>}
      {actionLabel && onAction && (
        <button type="button" className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}

EmptyState.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  actionLabel: PropTypes.string,
  onAction: PropTypes.func,
  icon: PropTypes.string,
}
