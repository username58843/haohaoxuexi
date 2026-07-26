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
 * save overrides inline (see components/EditableText + admin/ContentTools).
 */

const ContentContext = createContext(null)

export function ContentProvider({ children }) {
  const { language } = useSettings()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [entries, setEntries] = useState({}) // { 'scope:key': value }
  const [editMode, setEditMode] = useState(false)
  const cacheRef = useRef({}) // lang -> entries

  const load = useCallback(async (lang) => {
    try {
      const { data } = await api.get('/content', { params: { lang } })
      cacheRef.current[lang] = data.entries || {}
      setEntries(data.entries || {})
    } catch {
      setEntries(cacheRef.current[lang] || {})
    }
  }, [])

  useEffect(() => {
    if (cacheRef.current[language]) setEntries(cacheRef.current[language])
    load(language)
  }, [language, load])

  const content = useCallback(
    (scope, key, fallback = '') => {
      const v = entries[`${scope}:${key}`]
      return typeof v === 'string' && v.length > 0 ? v : fallback
    },
    [entries]
  )

  const saveEntry = useCallback(
    async (scope, key, value) => {
      const cacheKey = `${scope}:${key}`
      const next = { ...entries }
      if (value && value.length > 0) next[cacheKey] = value
      else delete next[cacheKey]
      setEntries(next)
      cacheRef.current[language] = next
      await api.put('/admin/content', { scope, key, lang: language, value })
    },
    [entries, language]
  )

  const value = useMemo(
    () => ({
      content,
      isAdmin,
      editMode: isAdmin && editMode,
      toggleEditMode: () => setEditMode((v) => !v),
      saveEntry,
      language,
    }),
    [content, isAdmin, editMode, saveEntry, language]
  )

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
}

export function useContent() {
  const ctx = useContext(ContentContext)
  if (!ctx) throw new Error('useContent must be used within ContentProvider')
  return ctx
}
