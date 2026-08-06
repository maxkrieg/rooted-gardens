'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { Bold, Check, Heading2, Italic, Link as LinkIcon, List, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RICHTEXT_EXTENSIONS } from '@/lib/content/richtext-schema'
import { updateRichTextSlot } from '@/app/(public)/actions'
import type { SitePage } from '@/types/app'

export interface RichTextEditorProps {
  page: SitePage
  slotKey: string
  /** Tiptap JSON if this slot has a DB row already, otherwise the
   *  pre-rendered default HTML — Tiptap accepts either as `content`. */
  initialContent: unknown
  onDone: () => void
}

/**
 * The actual Tiptap-powered editor for a richtext slot — loaded via a plain
 * `import()` from `EditableRichText.tsx`'s click handler (deliberately NOT
 * `next/dynamic`, whose App Router preloading defeats the point — see that
 * file's comment) and only ever requested once both `canEdit` and `editing`
 * are true and the owner actually opens the editor, so this module (and
 * Tiptap itself) never reaches the bundle an anonymous visitor loads.
 */
export function RichTextEditor({ page, slotKey, initialContent, onDone }: RichTextEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const editor = useEditor({
    extensions: RICHTEXT_EXTENSIONS,
    content: initialContent as string,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose-rt min-h-[4.5rem] focus:outline-none text-base',
      },
    },
  })

  function handleSave() {
    if (!editor) return
    startTransition(async () => {
      const result = await updateRichTextSlot({ page, key: slotKey, doc: editor.getJSON() })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Saved')
      onDone()
      router.refresh()
    })
  }

  if (!editor) return null

  return (
    <div className="my-1 rounded-lg border border-[var(--clay)] bg-card shadow-warm overflow-hidden">
      {/* Desktop: a floating bubble menu near the selection. */}
      <BubbleMenu editor={editor} className="hidden md:flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-warm-lg">
        <ToolbarButtons editor={editor} />
      </BubbleMenu>

      <div className="p-3 pb-16 md:pb-3">
        <EditorContent editor={editor} />
      </div>

      {/* Mobile: a fixed bottom bar instead of a selection bubble — a floating
          bubble is unreliable above an on-screen keyboard, and owners are
          phone-primary (CLAUDE.md). */}
      <div
        className="md:hidden flex items-center gap-1 border-t border-border bg-card px-2 py-2"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <ToolbarButtons editor={editor} />
      </div>

      <div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
        <Button type="button" size="sm" disabled={isPending} onClick={handleSave} className="gap-1.5">
          <Check className="h-3.5 w-3.5" />
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={onDone}
          className="gap-1.5"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </Button>
      </div>
    </div>
  )
}

function toolbarButtonClass(active: boolean) {
  return cn(
    'inline-flex items-center justify-center h-9 w-9 pointer-coarse:h-11 pointer-coarse:w-11 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors',
    active && 'bg-accent text-accent-foreground',
  )
}

function handleSetLink(editor: Editor) {
  const previous = (editor.getAttributes('link').href as string | undefined) ?? ''
  // Simple native prompt — this editor supports exactly one link action, so
  // a full modal for it would be more UI than the feature is worth.
  const url = window.prompt('Link URL (https://, mailto:, or tel:)', previous)
  if (url === null) return
  if (url.trim() === '') {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
}

function ToolbarButtons({ editor }: { editor: Editor }) {
  return (
    <>
      <button
        type="button"
        aria-label="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={toolbarButtonClass(editor.isActive('bold'))}
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={toolbarButtonClass(editor.isActive('italic'))}
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={toolbarButtonClass(editor.isActive('bulletList'))}
      >
        <List className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Heading"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={toolbarButtonClass(editor.isActive('heading', { level: 2 }))}
      >
        <Heading2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Link"
        onClick={() => handleSetLink(editor)}
        className={toolbarButtonClass(editor.isActive('link'))}
      >
        <LinkIcon className="h-4 w-4" />
      </button>
    </>
  )
}
