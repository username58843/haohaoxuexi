import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from 'react'
import { api, apiError, setBearerToken } from '../api-client'

const AuthContext = createContext(null)

const FOCUS_RECHECK_MS = 5 * 60 * 1000

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [banInfo, setBanInfo] = useState(null) // { banReason } when kicked out
  const lastCheckRef = useRef(0)
  const checkingRef = useRef(false)

  const checkAuth = useCallback(async () => {
    if (checkingRef.current) return
    checkingRef.current = true
    lastCheckRef.current = Date.now()
    try {
      const { data } = await api.get('/auth/me')
      if (data.user) {
        setUser(data.user)
        setBanInfo(null)
      }
    } catch (err) {
      const e = apiError(err)
      if (e.code === 'banned') {
        setUser(null)
        setBearerToken(null)
        setBanInfo({ banReason: e.extra?.banReason || null })
      } else if (e.code === 'unauthorized') {
        setUser(null)
        setBearerToken(null)
      }
      // network/5xx: keep current session state
    } finally {
      checkingRef.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // One-shot session check on mount. checkAuth() is async — all of its
    // setState calls run after the /auth/me request settles, never in the
    // synchronous effect body; the rule cannot see through the call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkAuth()
  }, [checkAuth])

  // Light revalidation when the tab regains focus (no polling loop).
  useEffect(() => {
    const onFocus = () => {
      if (!user) return
      if (Date.now() - lastCheckRef.current < FOCUS_RECHECK_MS) return
      checkAuth()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [user, checkAuth])

  const handleAuthSuccess = useCallback((data) => {
    if (data.token) setBearerToken(data.token)
    setUser(data.user)
    setBanInfo(null)
    return { success: true }
  }, [])

  const login = useCallback(
    async (email, password, captchaToken) => {
      try {
        const { data } = await api.post('/auth/login', { email, password, captchaToken })
        return handleAuthSuccess(data)
      } catch (err) {
        const e = apiError(err, 'Login failed')
        return { success: false, error: e.message, code: e.code, banReason: e.extra?.banReason }
      }
    },
    [handleAuthSuccess]
  )

  const register = useCallback(
    async (email, password, name, captchaToken) => {
      try {
        const { data } = await api.post('/auth/register', { email, password, name, captchaToken })
        return handleAuthSuccess(data)
      } catch (err) {
        const e = apiError(err, 'Registration failed')
        return { success: false, error: e.message, code: e.code }
      }
    },
    [handleAuthSuccess]
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // clearing local state matters more than the server call
    }
    setBearerToken(null)
    setUser(null)
  }, [])

  const value = React.useMemo(
    () => ({ user, loading, banInfo, login, register, logout, checkAuth, setUser }),
    [user, loading, banInfo, login, register, logout, checkAuth]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
