'use client'

import { Check } from 'lucide-react'
import { EditableText } from '@/components/public/editing/EditableText'
import { useEditMode } from '@/components/public/editing/EditModeProvider'
import type { SitePage } from '@/types/app'

/** A newline-delimited slot shown as a check-marked list and edited as one multiline field. */
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
