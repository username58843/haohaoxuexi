import React, { useState } from 'react'
import { useContent } from '~/lib/contexts/ContentContext'
import { markdownToHtml } from '~/lib/markdown'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { useToast, PageLoader } from '~/components/ui'
import { apiError } from '~/lib/api-client'

/**
 * Renders a CMS-driven document body for a docs page (privacy/terms/about).
 *
 *   <CmsDoc scope="privacy" defaultMd={DEFAULT_MD} />
 *
 * Normal visitors (and admins with edit mode off) see the rendered markdown —
 * either the stored override for the active language or the shipped default.
 * Until the content bundle for the active language has loaded, a loader is
 * shown instead of the default so an override never flashes the wrong text.
 *
 * Admins in edit mode get an inline editor: a markdown textarea on the left,
 * a live HTML preview on the right, and a Save button that stores the override
 * for the active UI language (empty text clears it, restoring the default).
 */
export default function CmsDoc({ scope, defaultMd }) {
  const { content, editMode, saveEntry, language, ready } = useContent()
  const { t } = useSettings()
  const toast = useToast()

  // Resolved markdown: stored override for this language, or the default.
  const resolved = content(scope, 'body', defaultMd)

  const [draft, setDraft] = useState(resolved)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Re-seed the editor when the resolved value OR the language changes, so
  // admins always start from the currently-published text for the active
  // language. The seed must include the language: when neither language has an
  // override, `resolved` is identical for both, but an unsaved draft written
  // for one language must not survive a switch to the other. Render-time
  // prev-value adjustment instead of an effect (react-compiler rule).
  const seed = `${language}\u0000${resolved}`
  const [prevSeed, setPrevSeed] = useState(seed)
  if (prevSeed !== seed) {
    setPrevSeed(seed)
    setDraft(resolved)
    setSaved(false)
  }

  if (!editMode) {
    // Loading state: don't paint the shipped default before we know whether an
    // override exists for this language — swapping it later is jarring.
    if (!ready) {
      return (
        <div className="docs-prose" aria-busy="true">
          <PageLoader />
        </div>
      )
    }
    return (
      <div
        className="docs-prose"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(resolved) }}
      />
    )
  }

  const dirty = draft !== resolved
  // Text equal to the default — or cleared entirely — restores the default.
  const isDefault = draft.trim() === defaultMd.trim() || draft.trim() === ''

  const onSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await saveEntry(scope, 'body', isDefault ? '' : draft)
      setSaved(true)
    } catch (err) {
      toast.error(apiError(err, t('cmsSaveFailed', 'Could not save')).message)
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
