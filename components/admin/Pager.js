import React from 'react'
import { Button } from '~/components/ui'
import { useSettings } from '~/lib/contexts/SettingsContext'

/** Prev / “page X / Y” / Next — shared by every paginated admin view. */
export default function Pager({ page, pages, onPage, disabled = false }) {
  const { t } = useSettings()
  if (!pages || pages <= 1) return null

  return (
    <div className="adm-pager">
      <Button
        variant="soft"
        size="sm"
        disabled={disabled || page <= 1}
        onClick={() => onPage(page - 1)}
      >
        {t('admPrev', 'Prev')}
      </Button>
      <span className="adm-pager__info u-mono">
        {page} / {pages}
      </span>
      <Button
        variant="soft"
        size="sm"
        disabled={disabled || page >= pages}
        onClick={() => onPage(page + 1)}
      >
        {t('admNext', 'Next')}
      </Button>
    </div>
  )
}
