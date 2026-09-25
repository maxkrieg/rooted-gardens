'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { SitePage } from '@/types/app'
import { EditableText } from './EditableText'
import { useEditMode } from './EditModeProvider'

/**
 * CTA whose label is an editable slot. In edit mode: a preview button plus a separate text
 * field, since click-to-edit inside a Link would navigate away.
 */
export function EditableCtaButton({
  page,
  slotKey,
  value,
  href,
  size = 'default',
}: {
  page: SitePage
  slotKey: string
  value: string
  href: string
  size?: 'default' | 'lg' | 'sm'
}) {
  const { canEdit, editing } = useEditMode()

  if (!canEdit || !editing) {
    return (
      <Button asChild size={size}>
        <Link href={href}>{value}</Link>
      </Button>
    )
  }

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <Button size={size} tabIndex={-1} className="pointer-events-none opacity-90" asChild>
        <span>{value || 'Button text'}</span>
      </Button>
      <EditableText page={page} slotKey={slotKey} kind="text" value={value} as="span" className="text-xs" />
    </div>
  )
}
