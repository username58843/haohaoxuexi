import React from 'react'
import { useContent } from '~/lib/contexts/ContentContext'

/**
 * A CMS text slot: renders the stored override for the active language when
 * one exists, otherwise the shipped default (children). Editing happens ONLY
 * in the admin panel (/admin/content) — there is no on-page editing.
 *
 *   <EditableText scope="landing" id="heroTitle" as="h1">Default title</EditableText>
 */
export default function EditableText({
  scope,
  id,
  as: Tag = 'span',
  children,
  className = '',
  ...rest
}) {
  const { content } = useContent()
  const fallback = typeof children === 'string' ? children : ''
  return (
    <Tag className={className} {...rest}>
      {content(scope, id, fallback)}
    </Tag>
  )
}
