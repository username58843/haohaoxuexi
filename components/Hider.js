import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

/**
 * Reveal-on-tap secondary info (pinyin / meaning) during practice.
 */
const Hider = ({ children, caption, enabled }) => {
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    setHidden(true)
  }, [children, caption])

  if (!enabled || !hidden) {
    return <span className="hider-content">{children}</span>
  }

  return (
    <button
      type="button"
      className="hider-reveal"
      onClick={() => setHidden(false)}
    >
      {caption}
    </button>
  )
}

Hider.propTypes = {
  enabled: PropTypes.bool.isRequired,
  children: PropTypes.node.isRequired,
  caption: PropTypes.string.isRequired,
}

export default Hider
