import React, { useRef, useState } from 'react'
import { useContent } from '~/lib/contexts/ContentContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import { useToast } from '~/components/ui'
import { apiError } from '~/lib/api-client'

/**
 * A text slot the site renders normally, but that admins can edit inline.
 *
 *   <EditableText scope="landing" id="heroTitle" as="h1">Default title</EditableText>
 *
 * Non-admins (and admins with edit mode off) get plain text. In edit mode the
 * node becomes contentEditable with a dashed outline; blur saves the override
 * (empty text restores the shipped default). Slots often live inside links and
 * buttons, so edit mode swallows click/Enter activation — otherwise placing
 * the caret would navigate away.
 */
export default function EditableText({
  scope,
  id,
  as: Tag = 'span',
  children,
  className = '',
  ...rest
}) {
  const { content, editMode, saveEntry, language, ready } = useContent()
  const { t } = useSettings()
  const toast = useToast()
  const fallback = typeof children === 'string' ? children : ''
  const value = content(scope, id, fallback)
  const ref = useRef(null)
  const [saving, setSaving] = useState(false)

  // While editing, React renders a snapshot of the value instead of the live
  // one, so a background bundle refetch can't replace the text node under the
  // caret and eat in-progress keystrokes. The snapshot re-seeds when edit mode
  // toggles, the language switches, or the bundle for the language arrives —
  // render-time prev-value adjustment (react-compiler rule: no effect).
  const seed = editMode ? `${language}:${ready ? 1 : 0}` : null
  const [snapshot, setSnapshot] = useState(value)
  const [prevSeed, setPrevSeed] = useState(seed)
  if (prevSeed !== seed) {
    setPrevSeed(seed)
    setSnapshot(value)
  }

  if (!editMode) {
    return (
      <Tag className={className} {...rest}>
        {value}
      </Tag>
    )
  }

  const onBlur = async () => {
    const next = (ref.current?.textContent || '').trim()
    if (next === value) return
    setSaving(true)
    try {
      // Save empty as "" only when it differs from the default → clears override.
      await saveEntry(scope, id, next === fallback ? '' : next)
      // Clearing the slot removed the override; show the restored default
      // (the node is uncontrolled while editing, so update the DOM directly).
      if (next === '' && ref.current) ref.current.textContent = fallback
    } catch (err) {
      // Roll the visible text back to the published value; the optimistic
      // context update was already rolled back by saveEntry.
      if (ref.current) ref.current.textContent = value
      toast.error(apiError(err, t('cmsSaveFailed', 'Could not save')).message)
    } finally {
      setSaving(false)
    }
  }

  // {...rest} is spread FIRST so the editing handlers below can never be
  // clobbered by caller props.
  return (
    <Tag
      {...rest}
      ref={ref}
      className={`${className} cms-editable${saving ? ' is-saving' : ''}`}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      draggable={false}
      data-cms={`${scope}:${id}`}
      title={`${scope}:${id}`}
      onMouseDownCapture={(e) => e.stopPropagation()}
      onClick={(e) => {
        // Neutralize ancestor <Link>/<a>/<button> activation: preventDefault
        // cancels native anchor navigation, stopPropagation keeps the click
        // away from Next's router onClick.
        e.preventDefault()
        e.stopPropagation()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          // Commit instead of activating the surrounding control or inserting
          // block elements into the slot.
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      onBlur={onBlur}
    >
      {snapshot}
    </Tag>
  )
}
