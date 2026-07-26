import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react'
import axios from 'axios'
import { useRouter } from 'next/router'

const AuthContext = createContext()
const TOKEN_KEY = 'hsk_auth_token'

function readStoredToken() {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(TOKEN_KEY) || null
  } catch {
    return null
  }
}

function writeStoredToken(token) {
  if (typeof window === 'undefined') return
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore quota / private mode
  }
}

function authHeaders() {
  const token = readStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const intervalRef = useRef(null)
  const isCheckingAuth = useRef(false)
  const failCountRef = useRef(0)
  const userRef = useRef(null)

  useEffect(() => {
    userRef.current = user
  }, [user])

  const applyToken = useCallback((token) => {
    if (token) {
      writeStoredToken(token)
      axios.defaults.headers.common.Authorization = `Bearer ${token}`
    } else {
      writeStoredToken(null)
      delete axios.defaults.headers.common.Authorization
    }
  }, [])

  const checkAuth = useCallback(async (silent = false) => {
    if (isCheckingAuth.current) return
    isCheckingAuth.current = true

    try {
      const response = await axios.get('/api/auth/me', {
        withCredentials: true,
        timeout: 15000,
        headers: authHeaders(),
      })

      if (response.data.user) {
        failCountRef.current = 0
        if (response.data.user.isBanned) {
          setUser(null)
          applyToken(null)
          if (!silent) {
            alert(
              `Your account has been banned. Reason: ${
                response.data.user.banReason || 'No reason provided'
              }`
            )
            router.push('/auth')
          }
        } else {
          setUser(response.data.user)
        }
      }
    } catch (error) {
      const status = error.response?.status

      if (status === 403 && error.response?.data?.isBanned) {
        setUser(null)
        applyToken(null)
        if (!silent) {
          alert(
            `Your account has been banned. Reason: ${
              error.response.data.banReason || 'No reason provided'
            }`
          )
          router.push('/auth')
        }
      } else if (status === 401) {
        // Don't log out on a single flaky 401 while a session is active —
        // require 2 consecutive failures (or initial load with no user).
        failCountRef.current += 1
        const hadUser = !!userRef.current
        const stored = readStoredToken()

        if (!hadUser || failCountRef.current >= 2 || !stored) {
          setUser(null)
          if (!stored) applyToken(null)
        }
      }
      // Network / 5xx: keep current user (do not force logout)
    } finally {
      isCheckingAuth.current = false
      setLoading(false)
    }
  }, [router, applyToken])

  // Bootstrap token from localStorage once, then validate
  useEffect(() => {
    const token = readStoredToken()
    if (token) {
      axios.defaults.headers.common.Authorization = `Bearer ${token}`
    }
    checkAuth(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Heartbeat — soft check, won't kill session on one failure
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (user) {
      intervalRef.current = setInterval(() => {
        checkAuth(true)
      }, 120000) // every 2 minutes
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const login = async (email, password) => {
    try {
      const response = await axios.post(
        '/api/auth/login',
        { email, password },
        { withCredentials: true, timeout: 15000 }
      )

      if (response.data.user) {
        if (response.data.user.isBanned) {
          setUser(null)
          applyToken(null)
          return {
            success: false,
            error: response.data.error || 'Your account has been banned',
          }
        }
        if (response.data.token) applyToken(response.data.token)
        failCountRef.current = 0
        setUser(response.data.user)
        return { success: true }
      }
      return { success: false, error: 'Login failed' }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
      }
    }
  }

  const register = async (email, password, name) => {
    try {
      const response = await axios.post(
        '/api/auth/register',
        { email, password, name },
        { withCredentials: true, timeout: 15000 }
      )

      if (response.data.user) {
        if (response.data.token) applyToken(response.data.token)
        failCountRef.current = 0
        setUser(response.data.user)
        return { success: true }
      }
      return { success: false, error: 'Registration failed' }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed',
      }
    }
  }

  const logout = async () => {
    try {
      await axios.post(
        '/api/auth/logout',
        {},
        {
          withCredentials: true,
          timeout: 5000,
          headers: authHeaders(),
        }
      )
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      applyToken(null)
      setUser(null)
      failCountRef.current = 0
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
