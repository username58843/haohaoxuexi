import { useEffect, useRef, useState } from 'react'

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

export default function Turnstile({ onVerify, onExpire }) {
  const ref = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return

    const id = window.turnstile?.render(ref.current, {
      sitekey: SITE_KEY,
      action: 'turnstile-spin-v2',
      theme: 'auto',
      callback: (token) => onVerify?.(token),
      'expired-callback': () => onExpire?.(),
      'error-callback': () => onExpire?.(),
      'timeout-callback': () => onExpire?.(),
    })

    setReady(true)

    return () => {
      if (id != null) window.turnstile?.remove(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!SITE_KEY) return null

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
