'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { SitePage } from '@/types/app'
import { EditableText } from './EditableText'
import { useEditMode } from './EditModeProvider'

/**
 * A CTA button whose *label* is an editable `site_content` slot (task
 * 9.2.5) — e.g. `home.cta_label`. Nesting `EditableText`'s click-to-edit
 * affordance directly inside a `<Link>`/`<Button>` would put one
 * interactive element inside another (and clicking to edit would also
 * navigate away), so this instead shows a non-interactive preview of the
 * real button plus a separate, genuinely clickable text field beneath it —
 * only while editing. Not editing (the common case): just the real button.
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
