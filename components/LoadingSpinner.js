import React from 'react'

const LoadingSpinner = ({ text = 'Loading...', size = 'medium' }) => {
  const sizes = {
    small: { block: 40, text: '0.85rem' },
    medium: { block: 60, text: '0.95rem' },
    large: { block: 80, text: '1.1rem' }
  }

  const currentSize = sizes[size] || sizes.medium

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      minHeight: '200px',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      {/* Shimmer skeleton cards */}
      <div style={{ width: '100%', maxWidth: '400px', marginBottom: '24px' }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              marginBottom: '12px',
              borderRadius: '12px',
              overflow: 'hidden',
              opacity: 1 - (i * 0.15)
            }}
          >
            <div className="shimmer" style={{
              height: currentSize.block,
              width: '100%',
              borderRadius: '12px',
            }} />
          </div>
        ))}
      </div>

      {/* Loading text */}
      <p style={{
        color: '#8E8E93',
        fontSize: currentSize.text,
        fontWeight: 500,
        marginBottom: '12px'
      }}>
        {text}
      </p>

      {/* Animated dots */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: '6px',
              height: '6px',
              backgroundColor: 'var(--theme-color)',
              borderRadius: '50%',
              animation: `bounce 1.4s ease-in-out ${i * 0.2}s infinite`
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  )
}

export default LoadingSpinner
