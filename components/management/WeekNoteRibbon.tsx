'use client'

import { useState } from 'react'
import { Flag, Loader2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { toUserMessage } from '@/lib/errors'

interface WeekNoteRibbonProps {
  note: string | null
  /** Owner/lead edit it inline; crew read it. */
  canEdit: boolean
  /** Controlled by the band's `⋯` — there's no permanent "add a note" row. */
  editing: boolean
  onEditingChange: (editing: boolean) => void
  onSave: (note: string) => Promise<void>
}

/**
 * The route's dispatch note for the week ("no Ryan till Thurs"), shown on the band. Crew read
 * it; owner/lead tap to edit. Clay, so it reads as an exception to the plan.
 */
export function WeekNoteRibbon({
  note,
  canEdit,
  editing,
  onEditingChange,
  onSave,
}: WeekNoteRibbonProps) {
  const [draft, setDraft] = useState(note ?? '')
  const [saving, setSaving] = useState(false)

  // Re-seed the draft each time the editor opens, so reopening after a cancel
  // doesn't resurrect the abandoned text.
  const [wasEditing, setWasEditing] = useState(editing)
  if (wasEditing !== editing) {
    setWasEditing(editing)
    if (editing) setDraft(note ?? '')
  }

  // Nothing to show when empty; the band's ⋯ menu adds a note.
  if (!editing && !note) return null

  if (!editing) {
    const content = (
      <span className="flex items-start gap-1.5">
        <Flag className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        <span className="whitespace-pre-wrap">{note}</span>
      </span>
    )

    return canEdit ? (
      <button
        type="button"
        onClick={() => onEditingChange(true)}
        className="w-full bg-[var(--clay)]/10 px-4 py-1.5 text-left text-[12px] leading-snug text-[var(--clay)] transition-colors hover:bg-[var(--clay)]/15"
      >
        {content}
      </button>
    ) : (
      <div className="bg-[var(--clay)]/10 px-4 py-1.5 text-[12px] leading-snug text-[var(--clay)]">
        {content}
      </div>
    )
  }

  async function save() {
    setSaving(true)
    try {
      await onSave(draft)
      onEditingChange(false)
    } catch (err) {
      toast.error('Could not save the note', {
        description: toUserMessage(err, 'It is queued and will retry.', '[WeekNoteRibbon.save]'),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2 bg-[var(--clay)]/[0.06] px-4 py-3">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        autoFocus
        placeholder="Who's out, what to watch for this week…"
        className="bg-card text-base"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-9 flex-1"
          disabled={saving || draft.trim() === (note ?? '').trim()}
          onClick={save}
        >
          {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {draft.trim().length === 0 && note ? 'Clear note' : 'Save'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-9"
          disabled={saving}
          onClick={() => onEditingChange(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
