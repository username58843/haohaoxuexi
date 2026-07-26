/**
 * Formatting helpers shared by the admin console pages.
 * Pure functions — locale is passed in from useSettings().language.
 */

const LOCALES = { en: 'en', ru: 'ru', tk: 'tk', zh: 'zh-CN' }

export function localeFor(language) {
  return LOCALES[language] || 'en'
}

/** '2026-07-27T…' → 'Jul 27, 2026' (locale-aware). */
export function fmtDate(value, language) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(localeFor(language), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Full date + time, for tooltips and detail rows. */
export function fmtDateTime(value, language) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(localeFor(language), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** ObjectId → short mono display ('66a1b2…'). */
export function shortId(id) {
  if (!id || typeof id !== 'string') return '—'
  return id.length > 8 ? `${id.slice(0, 6)}…` : id
}

/** Date|string → value for <input type="date"> ('YYYY-MM-DD') or ''. */
export function toDateInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}
