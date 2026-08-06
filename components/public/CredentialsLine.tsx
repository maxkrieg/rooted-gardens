'use client'

import { EditableText } from '@/components/public/editing/EditableText'
import { useEditMode } from '@/components/public/editing/EditModeProvider'

/**
 * The footer's credentials line ("Fully Insured · Equal Opportunity
 * Employer · ...") — a single `site_content` string split into pill badges
 * for display, but edited as one plain text field (task 9.2.5). A separate
 * small client component because the display/edit split needs
 * `useEditMode()`, which the (async, server-only) PublicFooter can't call
 * itself.
 */
export function CredentialsLine({ value }: { value: string }) {
  const { canEdit, editing } = useEditMode()

  if (canEdit && editing) {
    return (
      <div className="border-t border-border pt-6">
        <EditableText
          page="global"
          slotKey="credentials_line"
          kind="text"
          value={value}
          as="p"
          className="text-xs text-muted-foreground"
        />
      </div>
    )
  }

  const chips = value
    .split('·')
    .map((chip) => chip.trim())
    .filter(Boolean)

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground border-t border-border pt-6">
      {chips.map((chip) => (
        <span
          key={chip}
          className="rounded-full bg-card border border-border px-2.5 py-1 text-[11px] uppercase tracking-wide"
        >
          {chip}
        </span>
      ))}
    </div>
  )
}
