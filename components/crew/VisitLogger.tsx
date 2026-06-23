'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Camera } from 'lucide-react'
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
import { ServiceTypeSelector } from '@/components/crew/ServiceTypeSelector'
import { enqueueMutation } from '@/lib/crew/mutation-queue'
import type { StopDetail } from '@/hooks/crew/useStopDetail'

interface VisitLoggerProps {
  visitId: string
  employeeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function VisitLogger({
  visitId,
  employeeId,
  open,
  onOpenChange,
  onSuccess,
}: VisitLoggerProps) {
  const queryClient = useQueryClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [actualDate, setActualDate] = useState(today)
  const [serviceTypes, setServiceTypes] = useState<string[]>([])
  const [completionNote, setCompletionNote] = useState('')
  const [serviceTypeError, setServiceTypeError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function resetForm() {
    setActualDate(today)
    setServiceTypes([])
    setCompletionNote('')
    setServiceTypeError(false)
    setSubmitting(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm()
    onOpenChange(next)
  }

  async function handleSubmit() {
    if (serviceTypes.length === 0) {
      setServiceTypeError(true)
      return
    }
    setSubmitting(true)

    await enqueueMutation('completion', {
      visitId,
      employeeId,
      actualDate,
      serviceTypes,
      completionNote: completionNote.trim() || undefined,
    })

    // Optimistic update: mark this visit completed in the cache immediately
    queryClient.setQueryData<StopDetail | null>(['stop-detail', visitId], (old) => {
      if (!old) return old
      return {
        ...old,
        visit: {
          ...old.visit,
          status: 'completed',
          actual_date: actualDate,
          service_types: serviceTypes,
          completion_note: completionNote.trim() || null,
        },
      }
    })

    // Invalidate the Today list so the stop card reflects the new status
    queryClient.invalidateQueries({ queryKey: ['crew-today-stops'] })

    resetForm()
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88vh] overflow-y-auto rounded-t-2xl px-0 pb-0"
      >
        <SheetHeader className="px-4 pb-2">
          <SheetTitle className="font-display text-xl">Log Completion</SheetTitle>
        </SheetHeader>

        <div className="px-4 space-y-5 pb-4">
          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="completion-date">
              Date
            </label>
            <input
              id="completion-date"
              type="date"
              value={actualDate}
              onChange={(e) => setActualDate(e.target.value)}
              className="h-11 w-full rounded-lg border border-[--border] bg-card px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-[--ring]"
            />
          </div>

          {/* Service types */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">
              Services performed <span className="text-destructive">*</span>
            </label>
            <ServiceTypeSelector
              value={serviceTypes}
              onChange={(types) => {
                setServiceTypes(types)
                if (types.length > 0) setServiceTypeError(false)
              }}
            />
            {serviceTypeError && (
              <p className="text-xs text-destructive">Select at least one service type.</p>
            )}
          </div>

          {/* Completion note */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="completion-note">
              Note <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              id="completion-note"
              placeholder="Any details about this visit…"
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              className="min-h-[80px] text-base resize-none"
            />
          </div>

          {/* Photo upload — wired in task 4.5 */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 gap-2"
            onClick={() => {
              // Wired in task 4.5
            }}
          >
            <Camera className="h-4 w-4" />
            Add Photo
          </Button>
        </div>

        <SheetFooter className="px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-[--border] bg-background">
          <Button
            className="w-full h-12 text-base font-semibold"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Complete Stop'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
