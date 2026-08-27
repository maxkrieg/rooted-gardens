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
  onSave: (note: string) => Promise<void>
}

/**
 * The route sheet's group-header dispatch note, on the band.
 *
 * "no Ryan till Thurs", "matts gone all week" — a fact about the *week and the
 * route*, which is why it doesn't belong on any one visit's crew_instruction.
 * Crew read it; owner and lead tap it to edit.
 *
 * Clay rather than the band's stone, so it reads as an exception to the plan
 * rather than part of it — the same signal the orange cell carries on the sheet.
 */
export function WeekNoteRibbon({ note, canEdit, onSave }: WeekNoteRibbonProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note ?? '')
  const [saving, setSaving] = useState(false)

  if (!note && !canEdit) return null

  if (!editing) {
    if (!note) {
      return (
        <button
          type="button"
          onClick={() => {
            setDraft('')
            setEditing(true)
          }}
          className="flex min-h-8 w-full items-center gap-1.5 px-4 pb-2 text-left text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Flag className="h-3 w-3 shrink-0" aria-hidden />
          Add a note for this week
        </button>
      )
    }

    const content = (
      <span className="flex items-start gap-1.5">
        <Flag className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        <span className="whitespace-pre-wrap">{note}</span>
      </span>
    )

    return canEdit ? (
      <button
        type="button"
        onClick={() => {
          setDraft(note)
          setEditing(true)
        }}
        className="w-full border-t border-[var(--clay)]/20 bg-[var(--clay)]/10 px-4 py-2 text-left text-[12px] leading-snug text-[var(--clay)] transition-colors hover:bg-[var(--clay)]/15"
      >
        {content}
      </button>
    ) : (
      <div className="border-t border-[var(--clay)]/20 bg-[var(--clay)]/10 px-4 py-2 text-[12px] leading-snug text-[var(--clay)]">
        {content}
      </div>
    )
  }

  async function save() {
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } catch (err) {
      toast.error('Could not save the note', {
        description: toUserMessage(err, 'It is queued and will retry.', '[WeekNoteRibbon.save]'),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2 border-t border-[var(--clay)]/20 bg-[var(--clay)]/[0.06] px-4 py-3">
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
          onClick={() => setEditing(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
