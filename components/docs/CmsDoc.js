import React, { useState, useEffect } from 'react'
import { useContent } from '~/lib/contexts/ContentContext'
import { markdownToHtml } from '~/lib/markdown'
import { useSettings } from '~/lib/contexts/SettingsContext'

/**
 * Renders a CMS-driven document body for a docs page (privacy/terms/about).
 *
 *   <CmsDoc scope="privacy" defaultMd={DEFAULT_MD} />
 *
 * Normal visitors (and admins with edit mode off) see the rendered markdown —
 * either the stored override for the active language or the shipped default.
 *
 * Admins in edit mode get an inline editor: a markdown textarea on the left,
 * a live HTML preview on the right, and a Save button that stores the override
 * for the active UI language (empty text clears it, restoring the default).
 */
export default function CmsDoc({ scope, defaultMd }) {
  const { content, editMode, saveEntry, language } = useContent()
  const { t } = useSettings()

  // Resolved markdown: stored override for this language, or the default.
  const resolved = content(scope, 'body', defaultMd)

  const [draft, setDraft] = useState(resolved)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Re-seed the editor when the resolved value or language changes so admins
  // always start from the currently-published text for the active language.
  useEffect(() => {
    setDraft(resolved)
    setSaved(false)
  }, [resolved, language])

  if (!editMode) {
    return (
      <div
        className="docs-prose"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(resolved) }}
      />
    )
  }

  const dirty = draft !== resolved
  const isDefault = draft.trim() === defaultMd.trim()

  const onSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      // Saving text equal to the shipped default clears the override.
      await saveEntry(scope, 'body', isDefault ? '' : draft)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cms-admin__entry">
      <p className="cms-doc__note">
        {t('cmsDocEditingNote', 'Editing this document for language')}{' '}
        <strong>{language.toUpperCase()}</strong>.{' '}
        {t('cmsDocEditingHint', 'Markdown supported. Clearing the text restores the default.')}
      </p>
      <div className="cms-admin__doc-editor">
        <label className="cms-doc__field">
          <span className="cms-doc__label">{t('cmsDocMarkdown', 'Markdown')}</span>
          <textarea
            className="cms-doc__textarea"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setSaved(false)
            }}
            spellCheck={false}
            rows={22}
          />
        </label>
        <div className="cms-doc__preview-wrap">
          <span className="cms-doc__label">{t('cmsDocPreview', 'Preview')}</span>
          <div
            className="cms-admin__preview docs-prose"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(draft) }}
          />
        </div>
      </div>
      <div className="cms-doc__actions">
        <button
          type="button"
          className="cms-doc__save"
          onClick={onSave}
          disabled={saving || !dirty}
        >
          {saving ? t('cmsDocSaving', 'Saving…') : t('cmsDocSave', 'Save document')}
        </button>
        {saved && !dirty && (
          <span className="cms-doc__saved">{t('cmsDocSaved', 'Saved')}</span>
        )}
      </div>
    </div>
  )
}
