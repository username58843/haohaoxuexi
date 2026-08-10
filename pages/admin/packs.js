import React, { useCallback, useEffect, useMemo, useState } from 'react'
import AdminLayout from '~/components/admin/AdminLayout'
import { Button, Card, Spinner, useToast } from '~/components/ui'
import { api, apiError } from '~/lib/api-client'
import { useSettings } from '~/lib/contexts/SettingsContext'
import PackImportModal from '~/components/admin/PackImportModal'
import { buildPackCsv, buildPackJson } from '~/components/admin/pack-io'
import { downloadFile, safeFileName } from '~/components/decks/deck-utils'

/**
 * /admin/packs — textbook-pack editor. The 29 textbook packs ship as JSON
 * files; admins can rename a pack, edit its words row by row, and export or
 * import the whole list as JSON/CSV — hand-editing hundreds of rows is
 * unworkable, so a list prepared elsewhere can be pasted in wholesale (the same
 * flow personal decks already have). Changes are stored as pack_overrides
 * (never touching the shipped files), so "Restore shipped" always brings the
 * original back. HSK packs are listed read-only.
 */

// ';'-separated editing for meaning lists (definitions / EN / RU / TK).
const joinLines = (list) => (Array.isArray(list) ? list.join('; ') : '')
const splitLines = (s) =>
  String(s || '')
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)

function wordToRow(w, i) {
  return {
    key: `${i}-${w.simplified}-${w.pinyin}`,
    simplified: w.simplified || '',
    traditional: w.traditional && w.traditional !== w.simplified ? w.traditional : '',
    pinyin: w.pinyin || '',
    definitions: joinLines(w.definitions),
    en: joinLines(w.translations?.en),
    ru: joinLines(w.translations?.ru),
    tk: joinLines(w.translations?.tk),
  }
}

function rowToWord(row) {
  const word = {
    simplified: row.simplified.trim(),
    traditional: row.traditional.trim() || row.simplified.trim(),
    pinyin: row.pinyin.trim(),
    definitions: splitLines(row.definitions),
  }
  const en = splitLines(row.en)
  const ru = splitLines(row.ru)
  const tk = splitLines(row.tk)
  if (en.length || ru.length || tk.length) {
    word.translations = {}
    if (en.length) word.translations.en = en
    if (ru.length) word.translations.ru = ru
    if (tk.length) word.translations.tk = tk
  }
  return word
}

export default function AdminPacksPage() {
  const { t } = useSettings()
  const toast = useToast()

  const [reloadKey, setReloadKey] = useState(0)
  const [result, setResult] = useState(null) // { key, items, error }
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    let stale = false
    api
      .get('/admin/packs')
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

  const retry = () => setReloadKey((k) => k + 1)
  const loading = !result || result.key !== reloadKey
  const error =
    !loading && result.error
      ? apiError(result.error, t('admPacksLoadFailed', 'Could not load packs')).message
      : null

  const textbook = useMemo(
    () => (loading || result.error ? [] : result.items.filter((p) => p.group === 'textbook')),
    [result, loading]
  )
  const hsk = useMemo(
    () => (loading || result.error ? [] : result.items.filter((p) => p.group === 'hsk')),
    [result, loading]
  )

  return (
    <AdminLayout active="packs" title={t('admPacksTitle', 'Word packs')}>
      <p className="cms-page__intro">
        {t(
          'admPacksIntro',
          'Rename textbook packs and edit their words. Changes are stored as overrides — “Restore shipped” always brings the original pack back. Web and Android pick the changes up automatically.'
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

      {!loading && !error && editingId && (
        <PackEditor
          packId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={retry}
          toast={toast}
          t={t}
        />
      )}

      {!loading && !error && !editingId && (
        <>
          <section className="cms-page__section">
            <h2 className="cms-page__heading">
              {t('admPacksTextbook', 'Textbook packs')} ({textbook.length})
            </h2>
            <Card className="cms-page__group">
              <div className="adm-packs__rows">
                {textbook.map((p) => (
                  <div key={p.id} className="adm-packs__row">
                    <div className="adm-packs__row-main">
                      <span className="adm-packs__title">{p.title}</span>
                      <span className="adm-packs__meta u-mono">
                        {p.id} · {p.count} {t('admPacksWords', 'words')}
                      </span>
                    </div>
                    <div className="adm-packs__badges">
                      {(p.titleOverridden || p.wordsOverridden) && (
                        <span className="cms-page__badge is-custom">
                          {t('admContentBadgeCustom', 'Custom')}
                        </span>
                      )}
                    </div>
                    <Button size="sm" variant="soft" onClick={() => setEditingId(p.id)}>
                      {t('admPacksEdit', 'Edit')}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section className="cms-page__section">
            <h2 className="cms-page__heading">{t('admPacksHsk', 'HSK packs')}</h2>
            <p className="cms-page__sub">
              {t(
                'admPacksHskSub',
                'The HSK lexicon is the canonical dataset and is read-only here.'
              )}
            </p>
            <Card className="cms-page__group">
              <div className="adm-packs__rows">
                {hsk.map((p) => (
                  <div key={p.id} className="adm-packs__row">
                    <div className="adm-packs__row-main">
                      <span className="adm-packs__title">{p.title}</span>
                      <span className="adm-packs__meta u-mono">
                        {p.id} · {p.count} {t('admPacksWords', 'words')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </>
      )}
    </AdminLayout>
  )
}

/** Full editor for one textbook pack: title + words table + restore. */
function PackEditor({ packId, onClose, onSaved, toast, t }) {
  const [pack, setPack] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [title, setTitle] = useState('')
  const [rows, setRows] = useState([])
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    let stale = false
    api
      .get(`/admin/packs/${encodeURIComponent(packId)}`)
      .then(({ data }) => {
        if (stale) return
        const p = data.pack
        setPack(p)
        setTitle(p.title || p.id)
        setRows((p.words || []).map(wordToRow))
      })
      .catch((err) => {
        if (!stale) setLoadError(apiError(err).message)
      })
    return () => {
      stale = true
    }
  }, [packId])

  const updateRow = useCallback((index, field, value) => {
    setDirty(true)
    setRows((prev) => {
      const next = prev.slice()
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }, [])

  const removeRow = useCallback((index) => {
    setDirty(true)
    setRows((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const addRow = useCallback(() => {
    setDirty(true)
    setRows((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${prev.length}`,
        simplified: '',
        traditional: '',
        pinyin: '',
        definitions: '',
        en: '',
        ru: '',
        tk: '',
      },
    ])
  }, [])

  // Stable snapshot of the edited rows: the import dialog re-parses its input
  // whenever this changes, so it must not be a fresh array on every render.
  const currentWords = useMemo(() => rows.map(rowToWord), [rows])

  // Export what is on screen (including unsaved edits), so the file always
  // matches what the admin is looking at.
  const exportFile = (format) => {
    const words = currentWords.filter((w) => w.simplified)
    const base = safeFileName(title || packId)
    if (format === 'csv') {
      downloadFile(`${base}.csv`, buildPackCsv(words), 'text/csv;charset=utf-8')
    } else {
      downloadFile(
        `${base}.json`,
        buildPackJson(words, { id: packId, title }),
        'application/json'
      )
    }
  }

  const applyImport = ({ words, title: importedTitle, mode }) => {
    setImportOpen(false)
    if (!words.length) return
    setDirty(true)
    setRows((prev) => {
      const imported = words.map((w, i) => wordToRow(w, `imp${Date.now()}-${i}`))
      return mode === 'append' ? [...prev, ...imported] : imported
    })
    if (importedTitle) setTitle(importedTitle)
    toast.success(
      `${t('admPackImportDone', 'Imported words')}: ${words.length}`
    )
  }

  const save = async () => {
    const words = currentWords.filter((w) => w.simplified)
    if (!words.length) {
      toast.error(t('admPacksNeedWords', 'A pack needs at least one word'))
      return
    }
    const missingMeaning = words.findIndex(
      (w) =>
        w.definitions.length === 0 &&
        !(w.translations && (w.translations.en || w.translations.ru || w.translations.tk))
    )
    if (missingMeaning !== -1) {
      toast.error(
        `${t('admPacksNeedMeaning', 'Every word needs at least one meaning — check row')} ${missingMeaning + 1}`
      )
      return
    }
    setSaving(true)
    try {
      await api.put(`/admin/packs/${encodeURIComponent(packId)}`, {
        title: title.trim() || packId,
        words,
      })
      toast.success(t('admContentSaved', 'Saved'))
      setDirty(false)
      onSaved()
    } catch (err) {
      toast.error(apiError(err, t('admContentSaveFailed', 'Could not save')).message)
    } finally {
      setSaving(false)
    }
  }

  const restore = async () => {
    if (
      !window.confirm(
        t(
          'admPacksRestoreConfirm',
          'Restore the shipped pack? Your custom title and words for this pack will be removed.'
        )
      )
    ) {
      return
    }
    setSaving(true)
    try {
      await api.delete(`/admin/packs/${encodeURIComponent(packId)}`)
      toast.success(t('admPacksRestored', 'Shipped pack restored'))
      onSaved()
      onClose()
    } catch (err) {
      toast.error(apiError(err, t('admContentSaveFailed', 'Could not save')).message)
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <Card className="adm-error">
        <p className="adm-error__text">{loadError}</p>
        <Button variant="soft" size="sm" onClick={onClose}>
          {t('admPacksBack', 'Back to packs')}
        </Button>
      </Card>
    )
  }

  if (!pack) {
    return (
      <div className="adm-loading">
        <Spinner />
      </div>
    )
  }

  const overridden = pack.titleOverridden || pack.wordsOverridden

  return (
    <section className="cms-page__section">
      <div className="adm-packs__editor-head">
        <Button size="sm" variant="ghost" onClick={onClose}>
          ← {t('admPacksBack', 'Back to packs')}
        </Button>
        {overridden && (
          <span className="cms-page__badge is-custom">
            {t('admContentBadgeCustom', 'Custom')}
          </span>
        )}
      </div>

      <Card className="cms-page__group adm-packs__editor">
        <label className="adm-packs__field">
          <span className="cms-doc__label">{t('admPacksName', 'Pack name')}</span>
          <input
            type="text"
            className="cms-page__input"
            value={title}
            maxLength={80}
            onChange={(e) => {
              setDirty(true)
              setTitle(e.target.value)
            }}
          />
          <span className="adm-packs__meta u-mono">
            {packId} · {rows.length} {t('admPacksWords', 'words')}
          </span>
        </label>

        <p className="cms-page__sub">
          {t(
            'admPacksEditorHint',
            'Meanings, EN, RU and TK take several entries separated by “;”. Traditional can stay empty when it matches the simplified form.'
          )}
        </p>

        {/* Bulk word list handling: export the current list, edit or generate it
            elsewhere, import it back — the practical way to fill a pack from a
            book instead of typing every row. */}
        <div className="adm-packs__io">
          <span className="adm-packs__io-label">
            {t('admPacksIoLabel', 'Word list')}
          </span>
          <div className="adm-packs__io-actions">
            <Button size="sm" variant="soft" onClick={() => setImportOpen(true)}>
              {t('admPacksImport', 'Import')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => exportFile('json')}
              disabled={!rows.length}
            >
              {t('admPacksExportJson', 'Export JSON')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => exportFile('csv')}
              disabled={!rows.length}
            >
              {t('admPacksExportCsv', 'Export CSV')}
            </Button>
          </div>
        </div>

        <div className="adm-packs__table" role="table">
          <div className="adm-packs__thead" role="row">
            <span>#</span>
            <span>汉字</span>
            <span>{t('admPacksColTrad', 'Trad.')}</span>
            <span>Pinyin</span>
            <span>{t('admPacksColMeaning', 'Meaning')}</span>
            <span>EN</span>
            <span>RU</span>
            <span>TK</span>
            <span />
          </div>
          {rows.map((row, i) => (
            <div className="adm-packs__tr" role="row" key={row.key}>
              <span className="adm-packs__num u-mono">{i + 1}</span>
              <input
                className="cms-page__input"
                value={row.simplified}
                lang="zh"
                onChange={(e) => updateRow(i, 'simplified', e.target.value)}
                placeholder="汉字"
              />
              <input
                className="cms-page__input"
                value={row.traditional}
                lang="zh"
                onChange={(e) => updateRow(i, 'traditional', e.target.value)}
                placeholder="漢字"
              />
              <input
                className="cms-page__input"
                value={row.pinyin}
                onChange={(e) => updateRow(i, 'pinyin', e.target.value)}
                placeholder="hànzì"
              />
              <input
                className="cms-page__input"
                value={row.definitions}
                onChange={(e) => updateRow(i, 'definitions', e.target.value)}
              />
              <input
                className="cms-page__input"
                value={row.en}
                onChange={(e) => updateRow(i, 'en', e.target.value)}
              />
              <input
                className="cms-page__input"
                value={row.ru}
                onChange={(e) => updateRow(i, 'ru', e.target.value)}
              />
              <input
                className="cms-page__input"
                value={row.tk}
                onChange={(e) => updateRow(i, 'tk', e.target.value)}
              />
              <button
                type="button"
                className="adm-packs__remove"
                onClick={() => removeRow(i)}
                aria-label={t('admPacksRemoveWord', 'Remove word')}
                title={t('admPacksRemoveWord', 'Remove word')}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="cms-doc__actions adm-packs__actions">
          <Button variant="soft" size="sm" onClick={addRow}>
            + {t('admPacksAddWord', 'Add word')}
          </Button>
          <Button variant="primary" size="sm" onClick={save} loading={saving} disabled={!dirty}>
            {t('admPacksSave', 'Save pack')}
          </Button>
          {overridden && (
            <Button variant="ghost" size="sm" onClick={restore} disabled={saving}>
              {t('admPacksRestore', 'Restore shipped pack')}
            </Button>
          )}
        </div>
      </Card>

      <PackImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        existingWords={currentWords}
        onConfirm={applyImport}
      />
    </section>
  )
}
