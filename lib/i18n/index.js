import ru from './locales/ru'
import tk from './locales/tk'
import zh from './locales/zh'

/**
 * i18n model: English lives inline in components as the second argument of
 * t('key', 'English default') — so a missing key can never render as a raw
 * key. ru/tk/zh are override maps keyed by the same keys.
 */

export const LANGUAGES = {
  en: 'English',
  ru: 'Русский',
  tk: 'Türkmençe',
  zh: '中文',
}

const OVERRIDES = { ru, tk, zh }

export function translate(lang, key, fallback = '') {
  if (lang && lang !== 'en') {
    const table = OVERRIDES[lang]
    const hit = table && table[key]
    if (typeof hit === 'string' && hit.length > 0) return hit
  }
  return fallback || key
}
