import React from 'react'

export default function StatCard({ value, label, trend, className = '' }) {
  return (
    <div className={['stat-card', className].filter(Boolean).join(' ')}>
      <span className="stat-card__value">{value}</span>
      <span className="stat-card__label">{label}</span>
      {trend && <span className="stat-card__trend">{trend}</span>}
    </div>
  )
}
