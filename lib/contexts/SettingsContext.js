import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useCallback,
} from 'react'
import { api } from '../api-client'
import { translate, LANGUAGES } from '../i18n'
import { useAuth } from './AuthContext'

/**
 * User preferences: theme (dark/light/system), accent color, UI language,
 * daily goal, pinyin/translation display. Applied instantly via CSS custom
 * properties; persisted to localStorage always and to the server when authed.
 */

export const THEME_COLORS = {
  cinnabar: '#e0533d',
  orange: '#ff9500',
  gold: '#eab308',
  jade: '#34c759',
  blue: '#0a84ff',
  violet: '#af52de',
  pink: '#ff2d55',
  cyan: '#5ac8fa',
}

// Pre-rebuild documents may store old color names.
const LEGACY_COLOR_ALIASES = {
  red: 'cinnabar',
  yellow: 'gold',
  green: 'jade',
  purple: 'violet',
}

export { LANGUAGES }

export const DEFAULTS = {
  theme: 'dark',
  themeColor: 'cinnabar',
  language: 'en',
  dailyGoal: 20,
  alwaysShowPinyin: false,
  alwaysShowTranslation: false,
}

const LS_KEY = 'xue_settings_v2'

function normalizeColor(name) {
  const resolved = LEGACY_COLOR_ALIASES[name] || name
  return THEME_COLORS[resolved] ? resolved : DEFAULTS.themeColor
}

function normalizeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {}
  return {
    theme: ['dark', 'light', 'system'].includes(s.theme) ? s.theme : DEFAULTS.theme,
    themeColor: normalizeColor(s.themeColor),
    language: Object.keys(LANGUAGES).includes(s.language) ? s.language : DEFAULTS.language,
    dailyGoal: Number.isInteger(s.dailyGoal) && s.dailyGoal >= 5 && s.dailyGoal <= 500
      ? s.dailyGoal
      : DEFAULTS.dailyGoal,
    alwaysShowPinyin: !!s.alwaysShowPinyin,
    alwaysShowTranslation: !!s.alwaysShowTranslation,
  }
}

function readLocal() {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(LS_KEY) || '{}'))
  } catch {
    return DEFAULTS
  }
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m
    ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
    : [224, 83, 61]
}

export function applyThemeToDom(settings) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const resolvedTheme =
    settings.theme === 'system'
      ? window.matchMedia?.('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : settings.theme
  root.setAttribute('data-theme', resolvedTheme)

  const hex = THEME_COLORS[settings.themeColor] || THEME_COLORS.cinnabar
  const [r, g, b] = hexToRgb(hex)
  root.style.setProperty('--accent', hex)
  root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  root.style.setProperty('--on-accent', luminance > 0.6 ? '#1a1a1a' : '#ffffff')

  root.lang = settings.language || 'en'
}

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState(DEFAULTS)
  const [hydrated, setHydrated] = useState(false)
  const saveTimerRef = useRef(null)
  const serverSyncedRef = useRef(false)

  // Boot from localStorage (pre-paint script in _document already set the DOM).
  useEffect(() => {
    const local = readLocal()
    setSettings(local)
    applyThemeToDom(local)
    setHydrated(true)
  }, [])

  // When a user logs in, server settings win once per session.
  useEffect(() => {
    if (!user || serverSyncedRef.current) return
    serverSyncedRef.current = true
    const merged = normalizeSettings({ ...readLocal(), ...(user.settings || {}) })
    setSettings(merged)
    applyThemeToDom(merged)
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(merged))
    } catch {
      /* private mode */
    }
  }, [user])

  useEffect(() => {
    if (user === null) serverSyncedRef.current = false
  }, [user])

  // React to OS theme changes while in "system" mode.
  useEffect(() => {
    if (settings.theme !== 'system' || typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => applyThemeToDom(settings)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [settings])

  const update = useCallback(
    (patch) => {
      setSettings((prev) => {
        const next = normalizeSettings({ ...prev, ...patch })
        applyThemeToDom(next)
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(next))
        } catch {
          /* private mode */
        }
        if (user) {
          clearTimeout(saveTimerRef.current)
          saveTimerRef.current = setTimeout(() => {
            api.put('/user/settings', next).catch(() => {})
          }, 600)
        }
        return next
      })
    },
    [user]
  )

  useEffect(() => () => clearTimeout(saveTimerRef.current), [])

  const t = useCallback(
    (key, fallback = '') => translate(settings.language, key, fallback),
    [settings.language]
  )

  const value = useMemo(
    () => ({
      ...settings,
      hydrated,
      update,
      t,
      themeColors: THEME_COLORS,
      languages: LANGUAGES,
    }),
    [settings, hydrated, update, t]
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used within SettingsProvider')
  return context
}
