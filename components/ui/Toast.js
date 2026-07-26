import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from 'react'

const ToastContext = createContext(null)

let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
    clearTimeout(timersRef.current.get(id))
    timersRef.current.delete(id)
  }, [])

  const show = useCallback(
    (message, { type = 'info', duration = 3200 } = {}) => {
      const id = nextId++
      setToasts((prev) => [...prev.slice(-2), { id, message, type }])
      timersRef.current.set(id, setTimeout(() => dismiss(id), duration))
    },
    [dismiss]
  )

  const value = React.useMemo(
    () => ({
      show,
      success: (msg) => show(msg, { type: 'success' }),
      error: (msg) => show(msg, { type: 'error', duration: 4500 }),
    }),
    [show]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            type="button"
            className={`toast toast--${toast.type}`}
            onClick={() => dismiss(toast.id)}
          >
            <span className="toast__dot" aria-hidden />
            {toast.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
