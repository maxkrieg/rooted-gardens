'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { updateSiteSlot } from '@/app/(public)/actions'
import type { SitePage } from '@/types/app'
import { useEditMode } from './EditModeProvider'

type EditableTextKind = 'text' | 'email' | 'phone' | 'url'

const INPUT_TYPE: Record<EditableTextKind, string> = {
  text: 'text',
  email: 'email',
  phone: 'tel',
  url: 'url',
}

interface EditableTextProps {
  page: SitePage
  slotKey: string
  kind: EditableTextKind
  value: string
  /** Display tag when not editing — preserves heading/paragraph semantics
   *  exactly as the plain `{getSlot(...)}` call this replaces did. */
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3'
  /** Renders a Textarea instead of an Input while editing. */
  multiline?: boolean
  className?: string
  /** Only used in the plain (not-editing) display state — e.g. `mailto:`/
   *  `tel:` for a contact field, so it stays a real, clickable link exactly
   *  as the footer's hand-written `<a>` did before this wrapped it. Once
   *  edit mode is on, the field becomes click-to-edit instead (navigating
   *  away would defeat the point), so `href` is ignored in that state. */
  href?: string
}

/**
 * The workhorse editable primitive (task 9.2.5) — wraps a single
 * text/email/phone/url `site_content` slot. Not editing (or not an owner):
 * renders `<Tag className={className}>{value}</Tag>`, identical to the plain
 * `{getSlot(content, key)}` call sites it replaces. In edit mode, hovering
 * shows a dashed outline + pencil; clicking opens an inline Input/Textarea
 * with Save/Cancel — only THIS field opens, every other editable region on
 * the page stays in its normal display state (matches the approved mockup:
 * one field open at a time, not a page-wide wall of inputs).
 */
export function EditableText({
  page,
  slotKey,
  kind,
  value,
  as: Tag = 'span',
  multiline = false,
  className,
  href,
}: EditableTextProps) {
  const { canEdit, editing } = useEditMode()
  const [open, setOpen] = useState(false)

  if (!canEdit || !editing) {
    if (href) {
      return (
        <a
          href={href}
          className={className}
          target={href.startsWith('http') ? '_blank' : undefined}
          rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
        >
          {value}
        </a>
      )
    }
    return <Tag className={className}>{value}</Tag>
  }

  if (!open) {
    return (
      <Tag
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className={cn(
          'group/edit cursor-pointer rounded-md ring-1 ring-dashed ring-[var(--clay)]/40 hover:ring-[var(--clay)] hover:bg-[var(--clay)]/[0.06] transition-colors',
          className,
        )}
      >
        {value || <span className="text-muted-foreground italic">Click to add…</span>}
        <Pencil
          aria-hidden
          className="hidden group-hover/edit:inline h-3 w-3 ml-1.5 text-[var(--clay)] align-middle"
        />
      </Tag>
    )
  }

  // A separate component, mounted only while `open` is true: its `draft`
  // state initializes fresh from `value` every time it mounts, which is
  // exactly "reset the draft when the editor opens" with no effect needed —
  // closing unmounts it entirely (the parent's branches above return a
  // completely different subtree), so the next open is a brand new mount.
  return (
    <EditableTextForm
      page={page}
      slotKey={slotKey}
      kind={kind}
      value={value}
      multiline={multiline}
      onClose={() => setOpen(false)}
    />
  )
}

function EditableTextForm({
  page,
  slotKey,
  kind,
  value,
  multiline,
  onClose,
}: {
  page: SitePage
  slotKey: string
  kind: EditableTextKind
  value: string
  multiline: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [draft, setDraft] = useState(value)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const result = await updateSiteSlot({ page, key: slotKey, kind, value: draft })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Saved')
      onClose()
      router.refresh()
    })
  }

  return (
    <div className="my-1 space-y-2 rounded-lg border border-[var(--clay)] bg-card p-3 shadow-warm">
      {multiline ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="text-base"
          disabled={isPending}
          autoFocus
        />
      ) : (
        <Input
          type={INPUT_TYPE[kind]}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-11 text-base"
          disabled={isPending}
          autoFocus
        />
      )}
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={isPending} onClick={handleSave} className="gap-1.5">
          <Check className="h-3.5 w-3.5" />
          Save
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={onClose} className="gap-1.5">
          <X className="h-3.5 w-3.5" />
          Cancel
        </Button>
      </div>
    </div>
  )
}
