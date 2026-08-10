import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Modal, Segmented } from '~/components/ui'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { makeWordId } from '~/lib/words-shared'
import { parsePackImport, PACK_WORD_CAP } from './pack-io'

const MAX_FILE_BYTES = 8 * 1024 * 1024

/**
 * Word-pack import dialog for /admin/packs — the deck import flow applied to
 * textbook packs, so a whole list can be prepared elsewhere (e.g. an LLM
 * translating a book's vocabulary) and pasted in instead of typed row by row.
 *
 * Two modes: **replace** the pack's word list outright, or **append** the new
 * words to it (duplicates against the current list are skipped either way).
 * Calls `onConfirm({ words, title, mode })` with the final word list.
 */
export default function PackImportModal({ open, onClose, existingWords, onConfirm }) {
  const { t } = useSettings()
  const [text, setText] = useState('')
  const [mode, setMode] = useState('replace')
  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState(null)
  const [useTitle, setUseTitle] = useState(true)
  const [prevOpen, setPrevOpen] = useState(open)
  const fileRef = useRef(null)

  // Reset the form each time the dialog opens (render-time state adjustment).
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setText('')
      setMode('replace')
      setFileName('')
      setFileError(null)
      setUseTitle(true)
    }
  }

  // Clearing the native file input is a DOM-only side effect.
  useEffect(() => {
    if (open && fileRef.current) fileRef.current.value = ''
  }, [open])

  const analysis = useMemo(() => {
    if (!text.trim()) return null
    const parsed = parsePackImport(text)
    if (parsed.error) return { error: parsed.error }

    const existing = Array.isArray(existingWords) ? existingWords : []
    const seen = new Set()
    const unique = []
    let dupes = 0
    for (const w of parsed.words) {
      const id = makeWordId(w)
      if (seen.has(id)) {
        dupes += 1
        continue
      }
      seen.add(id)
      unique.push(w)
    }

    let already = 0
    let result
    if (mode === 'append') {
      const existingIds = new Set(existing.map(makeWordId))
      const fresh = unique.filter((w) => {
        if (existingIds.has(makeWordId(w))) {
          already += 1
          return false
        }
        return true
      })
      const room = Math.max(0, PACK_WORD_CAP - existing.length)
      result = { added: fresh.slice(0, room), capped: Math.max(0, fresh.length - room) }
    } else {
      result = {
        added: unique.slice(0, PACK_WORD_CAP),
        capped: Math.max(0, unique.length - PACK_WORD_CAP),
      }
    }

    return {
      valid: parsed.words.length,
      invalid: parsed.invalid,
      noMeaning: parsed.noMeaning,
      title: parsed.title || null,
      dupes,
      already,
      capped: result.capped,
      words: result.added,
      total: mode === 'append' ? existing.length + result.added.length : result.added.length,
    }
  }, [text, existingWords, mode])

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setFileError(null)
    if (file.size > MAX_FILE_BYTES) {
      setFileName('')
      setFileError(t('admPackImportTooBig', 'File is too large (8 MB max)'))
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result || ''))
    reader.onerror = () =>
      setFileError(t('admPackImportReadFail', 'Could not read that file'))
    reader.readAsText(file)
  }

  let parseErrorText = null
  if (analysis && analysis.error) {
    if (analysis.error === 'bad_json') {
      parseErrorText = t('admPackImportBadJson', 'That JSON could not be parsed')
    } else if (analysis.error === 'not_array') {
      parseErrorText = t(
        'admPackImportNotArray',
        'JSON must be an array of words, or an object with a "words" array'
      )
    } else {
      parseErrorText = t('admPackImportNoWords', 'No usable rows found in that text')
    }
  }

  const canConfirm = !!analysis && !analysis.error && analysis.words.length > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('admPackImportTitle', 'Import words')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('deckCancel', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!canConfirm}
            onClick={() =>
              canConfirm &&
              onConfirm({
                words: analysis.words,
                title: useTitle ? analysis.title : null,
                mode,
              })
            }
          >
            {canConfirm
              ? `${t('admPackImportConfirm', 'Import')} (${analysis.words.length})`
              : t('admPackImportConfirm', 'Import')}
          </Button>
        </>
      }
    >
      <p className="deck-import__hint">
        {t(
          'admPackImportHint',
          'Accepts JSON (an array of words, or { title, words }) and CSV with columns simplified, traditional, pinyin, definitions, en, ru, tk. Several meanings or translations in one cell are separated by ";". Words without any meaning are skipped.'
        )}
      </p>

      <div className="adm-packs__import-mode">
        <Segmented
          block
          ariaLabel={t('admPackImportModeAria', 'Import mode')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'replace', label: t('admPackImportReplace', 'Replace all') },
            { value: 'append', label: t('admPackImportAppend', 'Add to pack') },
          ]}
        />
      </div>

      <label className="deck-import__file">
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv,application/json,text/csv,text/plain"
          onChange={handleFile}
        />
        <span className="btn btn--soft btn--sm" aria-hidden>
          {t('deckImportChoose', 'Choose file')}
        </span>
        <span className="deck-import__filename">
          {fileName || t('deckImportNoFile', 'No file selected')}
        </span>
      </label>
      {fileError && <p className="deck-import__error">{fileError}</p>}

      <label className="field">
        <span className="field__label">{t('deckImportPaste', 'Or paste JSON / CSV')}</span>
        <span className="field__wrap">
          <textarea
            className="field__input deck-import__textarea"
            value={text}
            rows={6}
            placeholder='[{"simplified":"学","pinyin":"xué","definitions":["study"],"translations":{"ru":["учиться"]}}]'
            onChange={(e) => {
              setText(e.target.value)
              setFileName('')
            }}
          />
        </span>
      </label>

      {parseErrorText && <p className="deck-import__error">{parseErrorText}</p>}

      {analysis && !analysis.error && (
        <div className="deck-import__summary">
          <span className="deck-import__summary-title">
            {t('deckImportSummary', 'Parse summary')}
          </span>
          <span>
            {t('deckImportValid', 'Valid words')}: <b className="u-mono">{analysis.valid}</b>
          </span>
          {analysis.invalid > 0 && (
            <span>
              {t('deckImportInvalid', 'Skipped rows (missing simplified)')}:{' '}
              <b className="u-mono">{analysis.invalid}</b>
            </span>
          )}
          {analysis.noMeaning > 0 && (
            <span className="deck-import__warn">
              {t('admPackImportNoMeaning', 'Skipped rows (no meaning at all)')}:{' '}
              <b className="u-mono">{analysis.noMeaning}</b>
            </span>
          )}
          {analysis.dupes > 0 && (
            <span>
              {t('deckImportDupes', 'Duplicates in the file')}:{' '}
              <b className="u-mono">{analysis.dupes}</b>
            </span>
          )}
          {analysis.already > 0 && (
            <span>
              {t('admPackImportAlready', 'Already in this pack')}:{' '}
              <b className="u-mono">{analysis.already}</b>
            </span>
          )}
          {analysis.capped > 0 && (
            <span className="deck-import__warn">
              {t('admPackImportCapped', 'Over the 5000-word pack limit, skipped')}:{' '}
              <b className="u-mono">{analysis.capped}</b>
            </span>
          )}
          {analysis.title && (
            <label className="adm-packs__import-title">
              <input
                type="checkbox"
                checked={useTitle}
                onChange={(e) => setUseTitle(e.target.checked)}
              />
              <span>
                {t('admPackImportUseTitle', 'Also use the name from the file')}:{' '}
                <b>{analysis.title}</b>
              </span>
            </label>
          )}
          <span className="deck-import__total">
            {mode === 'append'
              ? t('admPackImportWillAdd', 'Will be added')
              : t('admPackImportWillReplace', 'Pack will contain')}
            : <b className="u-mono">{mode === 'append' ? analysis.words.length : analysis.total}</b>
          </span>
        </div>
      )}
    </Modal>
  )
}
