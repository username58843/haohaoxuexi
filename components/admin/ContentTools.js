import React from 'react'
import { useContent } from '~/lib/contexts/ContentContext'
import { useSettings } from '~/lib/contexts/SettingsContext'

/**
 * Floating control mounted app-wide (via _app). Visible only to admins; lets
 * them flip on inline editing of any <EditableText> on the current page.
 * Shows which language they're editing (edits apply to the active UI language).
 */
export default function ContentTools() {
  const { isAdmin, editMode, toggleEditMode, language } = useContent()
  const { t } = useSettings()

  if (!isAdmin) return null

  return (
    <div className={`cms-toolbar${editMode ? ' is-editing' : ''}`}>
      {editMode && (
        <span className="cms-toolbar__hint">
          {t('cmsEditingHint', 'Editing content')} · {language.toUpperCase()}
        </span>
      )}
      <button type="button" className="cms-toolbar__btn" onClick={toggleEditMode}>
        {editMode
          ? t('cmsExit', 'Done editing')
          : t('cmsEnter', 'Edit content')}
      </button>
    </div>
  )
}
