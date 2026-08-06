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
  /** Pre-rendered, safe-to-inject HTML (lib/content/site.ts — always safe:
   *  either server-derived from validated Tiptap JSON, or an escaped
   *  default-string fallback). Never raw Tiptap JSON. */
  value: string
  /** Tiptap JSON to resume editing from, only present once this slot has an
   *  actual DB row. Undefined for the still-default case — the editor then
   *  seeds itself from `value`'s HTML instead (Tiptap accepts either). */
  doc?: unknown
  className?: string
}

/**
 * Richtext counterpart to `EditableText.tsx` — same not-editing / hover-to-
 * open / open-editor three-state shape, but the open state mounts the actual
 * Tiptap editor instead of a plain Input/Textarea. Scoped to exactly two
 * slots app-wide (`global.org_tagline`, `home.hero_body`) per the 9.2.5 plan.
 *
 * Deliberately does NOT use `next/dynamic` for RichTextEditor: Next's App
 * Router preloads every `next/dynamic(..., { ssr: false })` chunk reachable
 * in a page's server-rendered tree as an eager `<script async>` tag in the
 * initial HTML, regardless of the runtime `open` conditional that gates
 * whether it ever actually mounts — verified during 9.2.5's own build
 * (`grep RichTextEditor` on a signed-out page's HTML showed the chunk being
 * requested for every visitor). A plain `import()` fired from the click
 * handler below is invisible to that preload heuristic — Turbopack still
 * code-splits `RichTextEditor.tsx` into its own chunk, but nothing requests
 * it until an owner actually clicks to open the editor.
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
