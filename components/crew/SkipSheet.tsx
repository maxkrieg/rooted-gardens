'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
import { nextVisitVersion } from '@/lib/utils/visits'
import { patchScheduleVisit } from '@/hooks/useManagementSchedule'
import type { StopDetail } from '@/hooks/crew/useStopDetail'

interface SkipSheetProps {
  visitId: string
  employeeId: string
  /** Property address, stored on the queued mutation so the "changes that didn't
   *  save" sheet can name the stop even with no connection. */
  label?: string
  // Whether the visit is currently in progress — skipping stops the on-site clock.
  inProgress?: boolean
  initialSkipReason?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function SkipSheet({
  visitId,
  employeeId,
  label,
  inProgress,
  initialSkipReason,
  open,
  onOpenChange,
  onSuccess,
}: SkipSheetProps) {
  const queryClient = useQueryClient()
  const [skipReason, setSkipReason] = useState(initialSkipReason ?? '')
  const [submitting, setSubmitting] = useState(false)

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
  }

  async function handleConfirm() {
    setSubmitting(true)

    const endedAt = new Date().toISOString()

    await enqueueMutation(
      'skip',
      {
        visitId,
        skipReason: skipReason.trim() || undefined,
        endedAt: inProgress ? endedAt : undefined,
      },
      label,
    )

    const result = await flushMutationQueue()

    // The cache used to be set to 'skipped' and the sheet closed regardless, so
    // a skip that never landed looked done forever. Queued-while-offline is
    // still success; a parked mutation is not.
    if (result.failed > 0) {
      setSubmitting(false)
      toast.error('That didn’t save.', {
        description: 'Check "Changes that didn’t save" at the top of the screen.',
      })
      return
    }

    queryClient.invalidateQueries({ queryKey: ['stop-detail', visitId] })
    queryClient.invalidateQueries({ queryKey: ['crew-week-schedule'] })
    queryClient.invalidateQueries({ queryKey: ['schedule-visits'] })

    patchScheduleVisit(queryClient, visitId, (visit) => ({
      ...visit,
      status: 'skipped',
      skip_reason: skipReason.trim() || null,
      ...(inProgress ? { ended_at: endedAt } : {}),
      updated_at: nextVisitVersion(visit.updated_at),
    }))

    queryClient.setQueryData<StopDetail | null>(['stop-detail', visitId], (old) => {
      if (!old) return old
      return {
        ...old,
        visit: {
          ...old.visit,
          status: 'skipped',
          skip_reason: skipReason.trim() || null,
          ...(inProgress ? { ended_at: endedAt } : {}),
          // Beat the row this replaces so the management grid's live overlay
          // takes it now rather than on the confirming refetch.
          updated_at: nextVisitVersion(old.visit.updated_at),
        },
      }
    })

    if (result.offline) {
      toast.success('Skipped — it’ll sync when you have signal.')
    }

    setSkipReason('')
    setSubmitting(false)
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {/* max-h / overflow / rounding come from the bottom SheetContent variant;
          pb-0 because the footer below owns its own safe-area padding. */}
      <SheetContent side="bottom" className="px-0 pb-0">
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
