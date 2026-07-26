export function parseCookies(req) {
  const cookies = {}

  const cookieHeader = req.headers?.cookie
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return cookies
  }

  try {
    cookieHeader.split(';').forEach((cookie) => {
      const parts = cookie.split('=')
      if (parts.length >= 2) {
        const key = parts[0].trim()
        const value = parts.slice(1).join('=').trim()
        if (key) {
          cookies[key] = decodeURIComponent(value)
        }
      }
    })
  } catch (error) {
    console.error('Cookie parsing error:', error)
  }

  return cookies
}