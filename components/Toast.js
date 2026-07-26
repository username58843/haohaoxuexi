import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import { createPortal } from 'react-dom'

export default function Toast({ message, type = 'success', onClose, ms = 2400 }) {
  useEffect(() => {
    if (!message) return undefined
    const id = setTimeout(() => onClose?.(), ms)
    return () => clearTimeout(id)
  }, [message, ms, onClose])

  if (!message || typeof document === 'undefined') return null

  return createPortal(
    <div className={`app-toast app-toast--${type}`} role="status">
      {message}
    </div>,
    document.body
  )
}

Toast.propTypes = {
  message: PropTypes.string,
  type: PropTypes.oneOf(['success', 'error', 'info']),
  onClose: PropTypes.func,
  ms: PropTypes.number,
}
