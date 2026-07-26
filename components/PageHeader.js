import React from 'react'
import PropTypes from 'prop-types'

export default function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="page-heading">
      <div className="page-heading__row">
        <div>
          {title && <h1 className="page-heading__title">{title}</h1>}
          {subtitle && <p className="page-heading__sub">{subtitle}</p>}
        </div>
        {actions && <div className="page-heading__actions">{actions}</div>}
      </div>
    </header>
  )
}

PageHeader.propTypes = {
  title: PropTypes.node,
  subtitle: PropTypes.node,
  actions: PropTypes.node,
}
