import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import { api } from '../api-client'
import { useSettings } from './SettingsContext'
import { useAuth } from './AuthContext'

/**
 * CMS layer. Loads published content overrides for the active language and
 * exposes `content(scope, key, fallback)`. Admins can toggle edit mode and
 * save overrides from the /admin/content editor.
 *
 * Bundles are kept per language in a single state map, so a slow response for
 * one language can never overwrite another language's entries, and switching
 * back to an already-loaded language is instant.
 */

const ContentContext = createContext(null)

const EMPTY_BUNDLE = { entries: {}, meta: {} }

export function ContentProvider({ children }) {
  const { language } = useSettings()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  // lang -> { entries: { 'scope:key': value }, meta: { 'scope:key': updatedAtISO } }
  const [bundles, setBundles] = useState({})
  // The language the UI currently wants — stale responses for other langs are dropped.
  const latestLangRef = useRef(null)
  // Timestamp of the last optimistic local edit; load results that started
  // before it are skipped so an in-flight fetch cannot undo a fresh save.
  const lastEditRef = useRef(0)

  const load = useCallback((lang, { bust = false } = {}) => {
    const startedAt = Date.now()
    // Admin reads bypass the public CDN/browser cache (the extra param changes
    // the cache key), so fresh edits never look like they vanished on reload.
    const params = bust ? { lang, v: Date.now() } : { lang }
    api
      .get('/content', { params })
      .then(({ data }) => {
        if (latestLangRef.current !== lang) return
        if (lastEditRef.current > startedAt) return // a local save landed mid-flight
        setBundles((prev) => ({
          ...prev,
          [lang]: { entries: data.entries || {}, meta: data.meta || {} },
        }))
      })
      .catch(() => {
        if (latestLangRef.current !== lang) return
        // Keep any previously-loaded bundle; otherwise mark the language as
        // settled (no overrides) so pages fall back to their shipped defaults.
        setBundles((prev) => (prev[lang] ? prev : { ...prev, [lang]: EMPTY_BUNDLE }))
      })
  }, [])

  useEffect(() => {
    latestLangRef.current = language
    load(language, { bust: isAdmin })
  }, [language, isAdmin, load])

  const activeBundle = bundles[language] || EMPTY_BUNDLE
  // True once the active language's bundle has been fetched (or failed) at
  // least once — lets doc pages show a loader instead of flashing defaults.
  const ready = !!bundles[language]

  const content = useCallback(
    (scope, key, fallback = '') => {
      const v = activeBundle.entries[`${scope}:${key}`]
      return typeof v === 'string' && v.trim().length > 0 ? v : fallback
    },
    [activeBundle]
  )

  /** ISO `updatedAt` of the stored override for (scope, key), or null. */
  const contentUpdatedAt = useCallback(
    (scope, key) => activeBundle.meta[`${scope}:${key}`] || null,
    [activeBundle]
  )

  const saveEntry = useCallback(
    async (scope, key, value) => {
      const lang = language
      const cacheKey = `${scope}:${key}`
      const prevBundle = bundles[lang] || EMPTY_BUNDLE
      const hadPrev = Object.prototype.hasOwnProperty.call(prevBundle.entries, cacheKey)

      // Whitespace-only counts as "no content": the override is removed and
      // the page falls back to its shipped default (mirrors the server check).
      const keeps = typeof value === 'string' && value.trim().length > 0
      const entries = { ...prevBundle.entries }
      const meta = { ...prevBundle.meta }
      if (keeps) {
        entries[cacheKey] = value
        meta[cacheKey] = new Date().toISOString()
      } else {
        delete entries[cacheKey]
        delete meta[cacheKey]
      }
      lastEditRef.current = Date.now()
      setBundles((prev) => ({ ...prev, [lang]: { entries, meta } }))

      try {
        await api.put('/admin/content', { scope, key, lang, value })
      } catch (err) {
        // Roll back just this key — a failed save must not keep masquerading
        // as published content. Callers surface the error to the user.
        setBundles((prev) => {
          const cur = prev[lang] || EMPTY_BUNDLE
          const nextEntries = { ...cur.entries }
          const nextMeta = { ...cur.meta }
          if (hadPrev) {
            nextEntries[cacheKey] = prevBundle.entries[cacheKey]
            if (prevBundle.meta[cacheKey]) nextMeta[cacheKey] = prevBundle.meta[cacheKey]
            else delete nextMeta[cacheKey]
          } else {
            delete nextEntries[cacheKey]
            delete nextMeta[cacheKey]
          }
          return { ...prev, [lang]: { entries: nextEntries, meta: nextMeta } }
        })
        throw err
      }
    },
    [bundles, language]
  )

  const value = useMemo(
    () => ({
      content,
      contentUpdatedAt,
      ready,
      isAdmin,
      saveEntry,
      language,
    }),
    [content, contentUpdatedAt, ready, isAdmin, saveEntry, language]
  )

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
}

export function useContent() {
  const ctx = useContext(ContentContext)
  if (!ctx) throw new Error('useContent must be used within ContentProvider')
  return ctx
}
