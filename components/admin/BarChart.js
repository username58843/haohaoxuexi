import React from 'react'

/**
 * Pure-CSS bar chart for daily series. `data`: [{ day: 'YYYY-MM-DD', count }].
 * Day labels are printed every `labelEvery` bars (plus the final bar) to keep
 * the axis readable. Inline style is used only for the dynamic bar height.
 */
export default function BarChart({ data = [], labelEvery = 3 }) {
  const max = Math.max(1, ...data.map((d) => d.count || 0))

  return (
    <div className="adm-chart" role="img">
      {data.map((d, i) => {
        const count = d.count || 0
        const pct = Math.round((count / max) * 100)
        const showLabel = i % labelEvery === 0 || i === data.length - 1
        return (
          <div key={d.day} className="adm-chart__col" title={`${d.day} — ${count}`}>
            <span className="adm-chart__value u-mono">{count}</span>
            <div className="adm-chart__track">
              <div
                className={`adm-chart__bar${count === 0 ? ' is-zero' : ''}`}
                style={{ height: `${pct}%` }}
              />
            </div>
            <span className="adm-chart__label u-mono">{showLabel ? d.day.slice(5) : ''}</span>
          </div>
        )
      })}
    </div>
  )
}
