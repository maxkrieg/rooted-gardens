'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { enqueueMutation, flushMutationQueue } from '@/lib/crew/mutation-queue'
import type { StopDetail } from '@/hooks/crew/useStopDetail'
import type { TodayStop } from '@/hooks/crew/useTodayStops'

interface SkipSheetProps {
  visitId: string
  employeeId: string
  // Whether the visit is currently in progress — skipping stops the on-site clock.
  inProgress?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function SkipSheet({
  visitId,
  employeeId,
  inProgress,
  open,
  onOpenChange,
  onSuccess,
}: SkipSheetProps) {
  const queryClient = useQueryClient()
  const [skipReason, setSkipReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleOpenChange(next: boolean) {
    if (!next) setSkipReason('')
    onOpenChange(next)
  }

  async function handleConfirm() {
    setSubmitting(true)

    const endedAt = new Date().toISOString()

    await enqueueMutation('skip', {
      visitId,
      skipReason: skipReason.trim() || undefined,
      endedAt: inProgress ? endedAt : undefined,
    })

    await flushMutationQueue()

    queryClient.invalidateQueries({ queryKey: ['stop-detail', visitId] })
    queryClient.invalidateQueries({ queryKey: ['crew-week-schedule'] })

    queryClient.setQueryData<TodayStop[]>(['crew-today-stops', employeeId], (old) => {
      if (!old) return old
      return old.map((stop) =>
        stop.visitId === visitId
          ? {
              ...stop,
              visit: {
                ...stop.visit,
                status: 'skipped',
                skip_reason: skipReason.trim() || null,
                // Stop the on-site clock so the pulse clears on the today list
                ...(inProgress ? { ended_at: endedAt } : {}),
              },
            }
          : stop
      )
    })

    queryClient.setQueryData<StopDetail | null>(['stop-detail', visitId], (old) => {
      if (!old) return old
      return {
        ...old,
        visit: {
          ...old.visit,
          status: 'skipped',
          skip_reason: skipReason.trim() || null,
          ...(inProgress ? { ended_at: endedAt } : {}),
        },
      }
    })

    setSkipReason('')
    setSubmitting(false)
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl px-0 pb-0"
      >
        <SheetHeader className="px-4 pb-2">
          <SheetTitle className="font-display text-xl">Skip this stop?</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-3">
          <Textarea
            placeholder="Reason for skipping… (optional)"
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
            className="min-h-[80px] text-base resize-none"
          />
        </div>

        <SheetFooter className="px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-[--border] bg-background space-y-2 flex-col">
          <Button
            variant="destructive"
            className="w-full h-12 text-base font-semibold"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Skipping…' : 'Confirm Skip'}
          </Button>
          <Button
            variant="ghost"
            className="w-full h-11"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
