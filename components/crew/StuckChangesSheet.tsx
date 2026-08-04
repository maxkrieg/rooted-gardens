'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  discardMutation,
  flushMutationQueue,
  getFailedMutations,
  retryMutation,
} from '@/lib/crew/mutation-queue'
import type { QueuedMutation } from '@/lib/crew/idb'

/** What each queued mutation was, in the crew member's words rather than ours. */
const TYPE_LABELS: Record<QueuedMutation['type'], string> = {
  completion: 'Logged completion',
  photo: 'Photo',
  photo_caption: 'Photo caption',
  job_start: 'Start time',
  job_stop: 'Stop time',
  skip: 'Skipped stop',
}

/**
 * Review sheet for changes that never reached the server. A completion that
 * silently fails to sync is a visit that never gets invoiced, so this is the one
 * failure surface that's interactive: retry it, or discard it deliberately.
 */
export function StuckChangesSheet({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}) {
  const queryClient = useQueryClient()
  const [items, setItems] = useState<QueuedMutation[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    getFailedMutations()
      .then(setItems)
      .catch((err) => console.error('[StuckChangesSheet] load', err))
  }, [open])

  async function reload() {
    const next = await getFailedMutations()
    setItems(next)
    onChanged()
    if (next.length === 0) onOpenChange(false)
  }

  async function handleRetry(item: QueuedMutation) {
    setBusyId(item.id)
    try {
      await retryMutation(item.id)
      const result = await flushMutationQueue()
      if (result.offline) {
        toast.error('Still no connection. It will retry once you have signal.')
      } else if (result.synced > 0) {
        toast.success('Saved.')
        // The visit rows were written server-side; drop the local view of them.
        await queryClient.invalidateQueries()
      } else {
        toast.error('It still didn’t save. Ask an owner to check it.')
      }
      await reload()
    } finally {
      setBusyId(null)
    }
  }

  async function handleDiscard(item: QueuedMutation) {
    setBusyId(item.id)
    try {
      await discardMutation(item.id)
      toast('Discarded. Log it again if it still needs doing.')
      await reload()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* max-h / overflow / rounding / safe-area padding all come from the
          bottom SheetContent variant now. */}
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle className="font-display">Changes that didn&rsquo;t save</SheetTitle>
          <SheetDescription>
            These never reached the office. Try them again, or discard them if
            they&rsquo;re no longer needed.
          </SheetDescription>
        </SheetHeader>

        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-[var(--clay)]/30 bg-[var(--clay)]/[0.05] p-4"
            >
              <p className="font-medium text-foreground">{TYPE_LABELS[item.type]}</p>
              {item.label && (
                <p className="mt-0.5 text-sm text-muted-foreground">{item.label}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {format(parseISO(item.timestamp), 'EEE MMM d, h:mm a')}
                {item.lastError ? ` · ${item.lastError}` : ''}
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  className="h-11 flex-1"
                  disabled={busyId === item.id}
                  onClick={() => handleRetry(item)}
                >
                  {busyId === item.id ? 'Trying…' : 'Try again'}
                </Button>
                <Button
                  variant="outline"
                  className="h-11 flex-1"
                  disabled={busyId === item.id}
                  onClick={() => handleDiscard(item)}
                >
                  Discard
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  )
}
