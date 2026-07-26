import React from 'react'
import { useContent } from '~/lib/contexts/ContentContext'
import { markdownToHtml } from '~/lib/markdown'
import { PageLoader } from '~/components/ui'

/**
 * Renders a CMS-driven document body for a docs page (privacy/terms/about).
 *
 *   <CmsDoc scope="privacy" defaults={PRIVACY_MD} />
 *
 * `defaults` is a per-language map ({ en, ru?, tk?, zh? }); the shipped default
 * for the active language (falling back to English) is used unless an admin
 * saved an override in /admin/content. Editing happens ONLY in the admin panel.
 */
export default function CmsDoc({ scope, defaults }) {
  const { content, language, ready } = useContent()

  const defaultMd =
    (defaults && (defaults[language] || defaults.en)) ||
    (typeof defaults === 'string' ? defaults : '')
  const resolved = content(scope, 'body', defaultMd)

  // Don't paint the shipped default before we know whether an override exists
  // for this language — swapping it in later is jarring.
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
