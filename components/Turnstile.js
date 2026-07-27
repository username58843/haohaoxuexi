import { useEffect, useRef, useCallback, useState } from 'react'

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

export default function Turnstile({ onVerify, onExpire }) {
  const ref = useRef(null)
  const widgetId = useRef(null)
  const [missing, setMissing] = useState(!SITE_KEY)

  const renderWidget = useCallback(() => {
    if (!ref.current || !window.turnstile) return
    if (widgetId.current != null) return

    widgetId.current = window.turnstile.render(ref.current, {
      sitekey: SITE_KEY,
      action: 'turnstile-spin-v2',
      theme: 'auto',
      callback: (token) => onVerify?.(token),
      'expired-callback': () => onExpire?.(),
      'error-callback': () => onExpire?.(),
      'timeout-callback': () => onExpire?.(),
    })
  }, [onVerify, onExpire])

  useEffect(() => {
    if (!SITE_KEY) return

    // If the Turnstile script is already loaded, render immediately.
    if (window.turnstile) {
      renderWidget()
      return
    }

    // Otherwise wait for the script to finish loading.
    const onScriptLoad = () => renderWidget()
    window.addEventListener('turnstile-ready', onScriptLoad, { once: true })

    // Also poll as a fallback in case the event never fires.
    const timer = setInterval(() => {
      if (window.turnstile) {
        clearInterval(timer)
        renderWidget()
      }
    }, 200)

    return () => {
      window.removeEventListener('turnstile-ready', onScriptLoad)
      clearInterval(timer)
      if (widgetId.current != null) window.turnstile?.remove(widgetId.current)
    }
  }, [renderWidget])

  if (missing) return null

  return (
    <div className="turnstile-wrap">
      <div ref={ref} />
      <style jsx>{`
        .turnstile-wrap {
          display: flex;
          justify-content: center;
          margin: 4px 0 8px;
        }
      `}</style>
    </div>
  )
}
