import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

/**
 * Cloudflare Turnstile widget (explicit render).
 *
 * Lifecycle: the widget is rendered exactly once per mount. The latest
 * onVerify/onExpire callbacks flow through refs, so inline arrow props do NOT
 * re-trigger the mount effect (the old effect re-ran on every parent render;
 * its cleanup removed the widget without clearing `widgetId`, after which the
 * early-return guard prevented it from ever rendering again).
 *
 * Siteverify tokens are single-use: after ANY failed submit the token in the
 * caller's state is already spent. Callers should hold a ref to this component
 * and call `reset()` on failure — the stale token is dropped via onExpire and
 * the widget re-runs the challenge to mint a fresh one.
 */
const Turnstile = forwardRef(function Turnstile({ onVerify, onExpire }, ref) {
  const containerRef = useRef(null)
  const widgetId = useRef(null)

  const onVerifyRef = useRef(onVerify)
  const onExpireRef = useRef(onExpire)
  useEffect(() => {
    onVerifyRef.current = onVerify
    onExpireRef.current = onExpire
  })

  useImperativeHandle(ref, () => ({
    /** Drop the (spent) token and re-run the challenge for a fresh one. */
    reset() {
      onExpireRef.current?.()
      if (widgetId.current != null && typeof window !== 'undefined' && window.turnstile) {
        try {
          window.turnstile.reset(widgetId.current)
        } catch {
          /* widget already disposed */
        }
      }
    },
  }))

  useEffect(() => {
    if (!SITE_KEY) return undefined
    let disposed = false
    let timer = null

    const renderWidget = () => {
      if (disposed || widgetId.current != null) return
      if (!containerRef.current || !window.turnstile) return
      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        action: 'turnstile-spin-v2',
        theme: 'auto',
        callback: (token) => onVerifyRef.current?.(token),
        'expired-callback': () => onExpireRef.current?.(),
        'error-callback': () => onExpireRef.current?.(),
        'timeout-callback': () => onExpireRef.current?.(),
      })
    }

    if (window.turnstile) {
      // Script already loaded (e.g. client-side navigation between auth pages).
      renderWidget()
    } else {
      // Wait for the <Script> onLoad event, with a poll as a race fallback.
      window.addEventListener('turnstile-ready', renderWidget, { once: true })
      timer = setInterval(() => {
        if (window.turnstile) {
          clearInterval(timer)
          timer = null
          renderWidget()
        }
      }, 200)
    }

    return () => {
      disposed = true
      window.removeEventListener('turnstile-ready', renderWidget)
      if (timer) clearInterval(timer)
      if (widgetId.current != null) {
        try {
          window.turnstile?.remove(widgetId.current)
        } catch {
          /* already gone */
        }
        widgetId.current = null
      }
    }
  }, [])

  if (!SITE_KEY) return null

  return (
    <div className="turnstile-wrap">
      <div ref={containerRef} />
      <style jsx>{`
        .turnstile-wrap {
          display: flex;
          justify-content: center;
          margin: 4px 0 8px;
        }
      `}</style>
    </div>
  )
})

export default Turnstile
