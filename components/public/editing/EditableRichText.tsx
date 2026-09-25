'use client'

import { useState, type ComponentType } from 'react'
import { Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SitePage } from '@/types/app'
import { useEditMode } from './EditModeProvider'
import type { RichTextEditorProps } from './RichTextEditor'

interface EditableRichTextProps {
  page: SitePage
  slotKey: string
  /** Pre-rendered, safe HTML from lib/content/site.ts. Never raw Tiptap JSON. */
  value: string
  /** Tiptap JSON, present once the slot has a DB row; otherwise the editor seeds from `value`. */
  doc?: unknown
  className?: string
}

/**
 * Richtext version of EditableText, mounting Tiptap when open. Loaded via import() on click,
 * not next/dynamic, which would preload the editor chunk for every visitor.
 */
export function EditableRichText({ page, slotKey, value, doc, className }: EditableRichTextProps) {
  const { canEdit, editing } = useEditMode()
  const [open, setOpen] = useState(false)
  const [Editor, setEditor] = useState<ComponentType<RichTextEditorProps> | null>(null)

  if (!canEdit || !editing) {
    return <div className={cn('prose-rt', className)} dangerouslySetInnerHTML={{ __html: value }} />
  }

  if (!open || !Editor) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          void import('./RichTextEditor').then((mod) => {
            setEditor(() => mod.RichTextEditor)
            setOpen(true)
          })
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            void import('./RichTextEditor').then((mod) => {
              setEditor(() => mod.RichTextEditor)
              setOpen(true)
            })
          }
        }}
        className={cn(
          'group/edit prose-rt cursor-pointer rounded-md ring-1 ring-dashed ring-[var(--clay)]/40 hover:ring-[var(--clay)] hover:bg-[var(--clay)]/[0.06] transition-colors',
          className,
        )}
      >
        <div className="inline" dangerouslySetInnerHTML={{ __html: value }} />
        <Pencil
          aria-hidden
          className="hidden group-hover/edit:inline h-3 w-3 ml-1.5 text-[var(--clay)] align-middle"
        />
      </div>
    )
  }

  return <Editor page={page} slotKey={slotKey} initialContent={doc ?? value} onDone={() => setOpen(false)} />
}
