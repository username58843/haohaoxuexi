import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useSettings } from '~/lib/contexts/SettingsContext'

export default function HotkeysHint({ compact }) {
  const { t } = useSettings()
  const [open, setOpen] = useState(false)

  if (compact) {
    return (
      <div className="hotkeys-hint hotkeys-hint--compact">
        <kbd>1</kbd>–<kbd>4</kbd> {t('hotkeysAnswers') || 'answers'} · <kbd>Space</kbd>{' '}
        {t('hotkeysSkip') || 'skip'} · <kbd>Esc</kbd> {t('hotkeysEnd') || 'end'}
      </div>
    )
  }

  return (
    <div className="hotkeys-hint">
      <button
        type="button"
        className="hotkeys-hint__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        ⌨ {t('hotkeysMetaLabel') || 'hotkeys'}
      </button>
      {open && (
        <ul className="hotkeys-hint__list">
          <li>
            <kbd>1</kbd>–<kbd>4</kbd> — {t('hotkeysAnswers') || 'Select answer'}
          </li>
          <li>
            <kbd>Space</kbd> — {t('hotkeysSkip') || 'Skip card'}
          </li>
          <li>
            <kbd>Esc</kbd> — {t('hotkeysEnd') || 'End session'}
          </li>
        </ul>
      )}
    </div>
  )
}

HotkeysHint.propTypes = {
  compact: PropTypes.bool,
}
