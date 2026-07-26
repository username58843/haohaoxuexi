import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Modal } from '~/components/ui'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { makeWordId } from '~/lib/words-shared'
import { parseImportText, DECK_WORD_CAP } from './deck-utils'

const MAX_FILE_BYTES = 5 * 1024 * 1024

/**
 * Deck import dialog: pick a .json/.csv file or paste text, see a live
 * parse summary (valid / skipped / duplicates / over-cap), then confirm.
 * Calls `onConfirm(newSnapshots)` with words deduped against the deck.
 */
export default function ImportModal({ open, onClose, existingWords, onConfirm }) {
  const { t } = useSettings()
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState(null)
  const [prevOpen, setPrevOpen] = useState(open)
  const fileRef = useRef(null)

  // Reset the form each time the dialog opens (render-time state adjustment).
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setText('')
      setFileName('')
      setFileError(null)
    }
  }

  // Clearing the native file input is a DOM-only side effect.
  useEffect(() => {
    if (open && fileRef.current) fileRef.current.value = ''
  }, [open])

  const analysis = useMemo(() => {
    if (!text.trim()) return null
    const parsed = parseImportText(text)
    if (parsed.error) return { error: parsed.error }

    const existing = Array.isArray(existingWords) ? existingWords : []
    const existingIds = new Set(existing.map(makeWordId))
    const seen = new Set()
    let dupes = 0
    let already = 0
    const fresh = []
    for (const w of parsed.words) {
      const wid = makeWordId(w)
      if (seen.has(wid)) {
        dupes += 1
        continue
      }
      seen.add(wid)
      if (existingIds.has(wid)) {
        already += 1
        continue
      }
      fresh.push(w)
    }
    const room = Math.max(0, DECK_WORD_CAP - existing.length)
    return {
      valid: parsed.words.length,
      invalid: parsed.invalid,
      dupes,
      already,
      capped: Math.max(0, fresh.length - room),
      toAdd: fresh.slice(0, room),
    }
  }, [text, existingWords])

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setFileError(null)
    if (file.size > MAX_FILE_BYTES) {
      setFileName('')
      setFileError(t('deckImportTooBig', 'File is too large (5 MB max)'))
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result || ''))
    reader.onerror = () => setFileError(t('deckImportReadFail', 'Could not read that file'))
    reader.readAsText(file)
  }

  let parseErrorText = null
  if (analysis && analysis.error) {
    if (analysis.error === 'bad_json') {
      parseErrorText = t('deckImportBadJson', 'That JSON could not be parsed')
    } else if (analysis.error === 'not_array') {
      parseErrorText = t('deckImportNotArray', 'JSON must be an array of word objects')
    } else {
      parseErrorText = t('deckImportNoWords', 'No usable rows found in that text')
    }
  }

  const canConfirm = !!analysis && !analysis.error && analysis.toAdd.length > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('deckImportTitle', 'Import words')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('deckCancel', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!canConfirm}
            onClick={() => canConfirm && onConfirm(analysis.toAdd)}
          >
            {canConfirm
              ? `${t('deckImportConfirm', 'Import')} (${analysis.toAdd.length})`
              : t('deckImportConfirm', 'Import')}
          </Button>
        </>
      }
    >
      <p className="deck-import__hint">
        {t(
          'deckImportHint',
          'Accepts a JSON array of word snapshots, or CSV with columns simplified, traditional, pinyin, definitions (multiple definitions joined by ;).'
        )}
      </p>

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
            placeholder='[{"simplified":"…","pinyin":"…","definitions":["…"]}]'
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
          {analysis.dupes > 0 && (
            <span>
              {t('deckImportDupes', 'Duplicates in the file')}:{' '}
              <b className="u-mono">{analysis.dupes}</b>
            </span>
          )}
          {analysis.already > 0 && (
            <span>
              {t('deckImportAlready', 'Already in this deck')}:{' '}
              <b className="u-mono">{analysis.already}</b>
            </span>
          )}
          {analysis.capped > 0 && (
            <span className="deck-import__warn">
              {t('deckImportCapped', 'Over the 2000-word deck limit, skipped')}:{' '}
              <b className="u-mono">{analysis.capped}</b>
            </span>
          )}
          <span className="deck-import__total">
            {t('deckImportWillAdd', 'Will be added')}:{' '}
            <b className="u-mono">{analysis.toAdd.length}</b>
          </span>
        </div>
      )}
    </Modal>
  )
}
