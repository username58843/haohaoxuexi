import React from 'react'

export function Spinner() {
  return <span className="spinner" role="status" aria-label="Loading" />
}

export function PageLoader({ text = '' }) {
  return (
    <div className="page-loader">
      <Spinner />
      {text && <span>{text}</span>}
    </div>
  )
}
