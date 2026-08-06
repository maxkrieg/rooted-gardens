'use client'

import { Check } from 'lucide-react'
import { EditableText } from '@/components/public/editing/EditableText'
import { useEditMode } from '@/components/public/editing/EditModeProvider'
import type { SitePage } from '@/types/app'

/**
 * A single newline-delimited `site_content` slot (one item per line),
 * displayed as a check-marked list. Not editing: splits `value` on `\n` into
 * `<li>`s. Editing: collapses to one multiline `EditableText`, same reasoning
 * as `CredentialsLine`'s `·`-split — a display shape that isn't the raw
 * string needs `useEditMode()` directly, which a page's async Server
 * Component can't call, hence a small client component.
 */
export function BulletList({
  page,
  slotKey,
  value,
  className,
}: {
  page: SitePage
  slotKey: string
  value: string
  className?: string
}) {
  const { canEdit, editing } = useEditMode()

  if (canEdit && editing) {
    return (
      <EditableText
        page={page}
        slotKey={slotKey}
        kind="text"
        value={value}
        as="p"
        multiline
        className={className}
      />
    )
  }

  const items = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (items.length === 0) return null

  return (
    <ul className={className}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
          <span className="text-sm text-foreground leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  )
}
