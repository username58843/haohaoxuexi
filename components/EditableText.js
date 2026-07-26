import React, { useRef, useState, useEffect } from 'react'
import { useContent } from '~/lib/contexts/ContentContext'

/**
 * A text slot the site renders normally, but that admins can edit inline.
 *
 *   <EditableText scope="landing" id="heroTitle" as="h1">Default title</EditableText>
 *
 * Non-admins (and admins with edit mode off) get plain text. In edit mode the
 * node becomes contentEditable with a dashed outline; blur saves the override
 * (empty text restores the shipped default).
 */
export default function EditableText({
  scope,
  id,
  as: Tag = 'span',
  children,
  className = '',
  ...rest
}) {
  const { content, editMode, saveEntry } = useContent()
  const fallback = typeof children === 'string' ? children : ''
  const value = content(scope, id, fallback)
  const ref = useRef(null)
  const [saving, setSaving] = useState(false)

  // Keep the DOM text in sync with the resolved value when NOT editing.
  useEffect(() => {
    if (ref.current && !editMode) ref.current.textContent = value
  }, [value, editMode])

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
    } finally {
      setSaving(false)
    }
  }

  return (
    <Tag
      ref={ref}
      className={`${className} cms-editable${saving ? ' is-saving' : ''}`}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-cms={`${scope}:${id}`}
      title={`${scope}:${id}`}
      onBlur={onBlur}
      {...rest}
    >
      {value}
    </Tag>
  )
}
