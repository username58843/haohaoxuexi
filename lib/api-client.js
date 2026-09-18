import axios from 'axios'
import { HSK_CATALOG_VERSION } from './hsk-catalog'

/**
 * Single API client for the web app. Auth is cookie-first (httpOnly `token`);
 * a Bearer token is additionally kept IN MEMORY ONLY for the current tab —
 * never persisted to localStorage.
 */

let bearerToken = null

export function setBearerToken(token) {
  bearerToken = token || null
}

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 20000,
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  if ((config.method || 'get').toLowerCase() === 'get' && /^\/(words|srs|dict)(\/|$)/.test(config.url || '')) {
    config.params = { catalog: HSK_CATALOG_VERSION, ...config.params }
  }
  if (bearerToken) config.headers.Authorization = `Bearer ${bearerToken}`
  return config
})

/** Normalizes API failures to { code, message, extra } (see ARCHITECTURE §4). */
export function apiError(err, fallbackMessage = 'Something went wrong') {
  const data = err?.response?.data
  if (data?.error?.code) {
    return { code: data.error.code, message: data.error.message, extra: data.error }
  }
  if (err?.code === 'ECONNABORTED') {
    return { code: 'timeout', message: 'Request timed out — check your connection' }
  }
  return { code: 'network', message: fallbackMessage }
}
