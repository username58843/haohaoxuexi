import React, { useState, useEffect, useCallback, useMemo } from 'react'
import AdminLayout from '~/components/admin/AdminLayout'
import { Button, Card, Segmented, Spinner, EmptyState, useToast } from '~/components/ui'
import { api, apiError } from '~/lib/api-client'
import { markdownToHtml } from '~/lib/markdown'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { DOC_DEFAULTS } from '~/components/docs/docDefaults'

const CONTENT_LANGS = ['en', 'ru', 'tk', 'zh']
const DOC_SCOPES = DOC_DEFAULTS.map((d) => d.scope)

/**
 * /admin/content — the content override editor. Manages every CMS override:
 *
 *  A. Documents  — the markdown bodies for /privacy, /terms and /about, each
 *     with a live preview and a Save button.
 *  B. Page text  — the short inline slots (landing, etc.) that already have an
 *     override for the selected language, editable in place.
 *
 * A language selector chooses which content language is being edited (defaults
 * to the admin's own UI language). Overrides are per (scope, key, lang); an
 * empty value clears the override so the page falls back to its shipped default.
 */
export default function AdminContentPage() {
  const { t, language } = useSettings()
  const toast = useToast()

  const [lang, setLang] = useState(CONTENT_LANGS.includes(language) ? language : 'en')
  const [reloadKey, setReloadKey] = useState(0)
  // Latest fetch result, tagged with the reloadKey it answers. `loading` and
  // the error message are derived at render, so nothing sets state
  // synchronously inside the effect and `t` stays out of the fetch deps.
  const [result, setResult] = useState(null) // { key, items, error: Error|null }

  // Mirror a UI-language change into the editor language — render-time
  // prev-value adjustment instead of an effect (react-compiler rule).
  const [prevUiLang, setPrevUiLang] = useState(language)
  if (prevUiLang !== language) {
    setPrevUiLang(language)
    if (CONTENT_LANGS.includes(language)) setLang(language)
  }

  useEffect(() => {
    let stale = false
    api
      .get('/admin/content')
      .then(({ data }) => {
        if (!stale) setResult({ key: reloadKey, items: data.items || [], error: null })
      })
      .catch((err) => {
        if (!stale) setResult({ key: reloadKey, items: [], error: err })
      })
    return () => {
      stale = true
    }
  }, [reloadKey])

  // Bumping the key immediately re-derives `loading` below — the "start
  // loading" state change lives in the event handler, not in the effect.
  const retry = () => setReloadKey((k) => k + 1)

  const loading = !result || result.key !== reloadKey
  const error =
    !loading && result.error
      ? apiError(result.error, t('admContentLoadFailed', 'Could not load content')).message
      : null
  const items = useMemo(() => {
    if (!result || result.key !== reloadKey || result.error) return []
    return result.items
  }, [result, reloadKey])

  // Overrides that currently exist for the selected language.
  const byKeyForLang = useMemo(() => {
    const map = {}
    for (const it of items) {
      if (it.lang === lang) map[`${it.scope}:${it.key}`] = it.value
    }
    return map
  }, [items, lang])

  // Update local cache after a successful save so the UI reflects the change
  // without a full refetch. Whitespace-only means the override was removed.
  const applyLocal = useCallback(
    (scope, key, value) => {
      setResult((r) => {
        if (!r) return r
        const rest = r.items.filter(
          (it) => !(it.scope === scope && it.key === key && it.lang === lang)
        )
        if (typeof value === 'string' && value.trim().length > 0) {
          rest.push({ scope, key, lang, value, updatedAt: new Date().toISOString() })
        }
        return { ...r, items: rest }
      })
    },
    [lang]
  )

  const saveEntry = useCallback(
    async (scope, key, value) => {
      await api.put('/admin/content', { scope, key, lang, value })
      applyLocal(scope, key, value)
    },
    [lang, applyLocal]
  )

  const langOptions = CONTENT_LANGS.map((l) => ({ value: l, label: l.toUpperCase() }))

  // Non-doc overrides (landing etc.), grouped by scope, for section B.
  const pageGroups = useMemo(() => {
    const groups = {}
    for (const it of items) {
      if (it.lang !== lang) continue
      if (DOC_SCOPES.includes(it.scope)) continue
      ;(groups[it.scope] ||= []).push(it)
    }
    for (const scope of Object.keys(groups)) {
      groups[scope].sort((a, b) => a.key.localeCompare(b.key))
    }
    return groups
  }, [items, lang])

  const pageScopes = Object.keys(pageGroups).sort()

  return (
    <AdminLayout active="content" title={t('admContentTitle', 'Content')}>
      <div className="adm-toolbar cms-page__toolbar">
        <div className="cms-page__lang">
          <span className="eyebrow">{t('admContentLangLabel', 'Editing language')}</span>
          <Segmented
            options={langOptions}
            value={lang}
            onChange={setLang}
            ariaLabel={t('admContentLangLabel', 'Editing language')}
          />
        </div>
      </div>

      <p className="cms-page__intro">
        {t(
          'admContentIntro',
          'Edit the marketing landing text and the legal / about documents. Overrides are saved per language; clearing a field restores the shipped default. You can also edit the landing page in place using the floating "Edit content" button while browsing it.'
        )}
      </p>

      {loading && (
        <div className="adm-loading">
          <Spinner />
        </div>
      )}

      {error && (
        <Card className="adm-error">
          <p className="adm-error__text">{error}</p>
          <Button variant="soft" size="sm" onClick={retry}>
            {t('admRetry', 'Retry')}
          </Button>
        </Card>
      )}

      {!loading && !error && (
        <>
          <section className="cms-page__section">
            <h2 className="cms-page__heading">{t('admContentDocsTitle', 'Documents')}</h2>
            <p className="cms-page__sub">
              {t(
                'admContentDocsSub',
                'Markdown bodies for the Privacy, Terms and About pages. Headings use ## / ###, bullets use - , links use [text](https://…).'
              )}
            </p>
            <div className="cms-admin__grid">
              {DOC_DEFAULTS.map((doc) => (
                <DocEditor
                  key={`${doc.scope}:${lang}`}
                  scope={doc.scope}
                  defaultMd={doc.md}
                  override={byKeyForLang[`${doc.scope}:body`]}
                  onSave={(value) => saveEntry(doc.scope, 'body', value)}
                  toast={toast}
                  t={t}
                />
              ))}
            </div>
          </section>

          <section className="cms-page__section">
            <h2 className="cms-page__heading">{t('admContentPageTextTitle', 'Page text')}</h2>
            <p className="cms-page__sub">
              {t(
                'admContentPageTextSub',
                'Short inline slots that have an override for this language. To create a new override, edit the text in place on the page using the floating "Edit content" button.'
              )}
            </p>

            {pageScopes.length === 0 ? (
              <EmptyState
                glyph="字"
                title={t('admContentPageTextEmpty', 'No inline overrides yet')}
                text={t(
                  'admContentPageTextEmptyHint',
                  'Open the landing page as an admin, toggle "Edit content", and edit any text to create an override here.'
                )}
              />
            ) : (
              pageScopes.map((scope) => (
                <Card key={scope} className="cms-page__group">
                  <h3 className="cms-page__group-title">{scope}</h3>
                  <div className="cms-page__rows">
                    {pageGroups[scope].map((it) => (
                      <TextRow
                        key={`${it.scope}:${it.key}:${lang}`}
                        entry={it}
                        onSave={(value) => saveEntry(it.scope, it.key, value)}
                        toast={toast}
                        t={t}
                      />
                    ))}
                  </div>
                </Card>
              ))
            )}
          </section>
        </>
      )}
    </AdminLayout>
  )
}

/** One document body editor: markdown textarea + live preview + save. */
function DocEditor({ scope, defaultMd, override, onSave, toast, t }) {
  const hasOverride = typeof override === 'string' && override.trim().length > 0
  const resolved = hasOverride ? override : defaultMd
  const [draft, setDraft] = useState(resolved)
  const [saving, setSaving] = useState(false)

  // Re-seed when the published value changes (language switches remount via
  // the parent `key`) — render-time prev-value adjustment, not an effect.
  const [prevResolved, setPrevResolved] = useState(resolved)
  if (prevResolved !== resolved) {
    setPrevResolved(resolved)
    setDraft(resolved)
  }

  const dirty = draft !== resolved
  // Text equal to the default — or cleared entirely — restores the default.
  const isDefault = draft.trim() === defaultMd.trim() || draft.trim() === ''

  const save = async () => {
    setSaving(true)
    try {
      await onSave(isDefault ? '' : draft)
      toast.success(t('admContentSaved', 'Saved'))
    } catch (err) {
      toast.error(apiError(err, t('admContentSaveFailed', 'Could not save')).message)
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    setSaving(true)
    try {
      await onSave('')
      setDraft(defaultMd)
      toast.success(t('admContentReset', 'Restored default'))
    } catch (err) {
      toast.error(apiError(err, t('admContentSaveFailed', 'Could not save')).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="cms-page__doc">
      <div className="cms-page__doc-head">
        <h3 className="cms-page__group-title">{scope}</h3>
        <span className={`cms-page__badge${hasOverride ? ' is-custom' : ''}`}>
          {hasOverride
            ? t('admContentBadgeCustom', 'Custom')
            : t('admContentBadgeDefault', 'Default')}
        </span>
      </div>
      <div className="cms-admin__doc-editor">
        <label className="cms-doc__field">
          <span className="cms-doc__label">{t('cmsDocMarkdown', 'Markdown')}</span>
          <textarea
            className="cms-doc__textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            rows={18}
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
        <Button variant="primary" size="sm" onClick={save} loading={saving} disabled={!dirty}>
          {t('cmsDocSave', 'Save document')}
        </Button>
        {hasOverride && (
          <Button variant="ghost" size="sm" onClick={reset} disabled={saving}>
            {t('admContentRestore', 'Restore default')}
          </Button>
        )}
      </div>
    </Card>
  )
}

/** One inline-slot editable row: label + text field + save. */
function TextRow({ entry, onSave, toast, t }) {
  const [value, setValue] = useState(entry.value)
  const [saving, setSaving] = useState(false)

  // Re-seed when the stored value changes — render-time adjustment, no effect.
  const [prevValue, setPrevValue] = useState(entry.value)
  if (prevValue !== entry.value) {
    setPrevValue(entry.value)
    setValue(entry.value)
  }

  const dirty = value !== entry.value
  const multiline = (entry.value || '').length > 80

  const save = async () => {
    setSaving(true)
    try {
      await onSave(value)
      toast.success(t('admContentSaved', 'Saved'))
    } catch (err) {
      toast.error(apiError(err, t('admContentSaveFailed', 'Could not save')).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cms-page__row">
      <code className="cms-page__key" title={`${entry.scope}:${entry.key}`}>
        {entry.key}
      </code>
      {multiline ? (
        <textarea
          className="cms-page__input cms-page__input--area"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
        />
      ) : (
        <input
          type="text"
          className="cms-page__input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      )}
      <Button variant="soft" size="sm" onClick={save} loading={saving} disabled={!dirty}>
        {t('admContentSave', 'Save')}
      </Button>
    </div>
  )
}
