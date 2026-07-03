'use client'

import { useState } from 'react'
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
import { useUpdateCrewInstruction } from '@/hooks/crew/useUpdateCrewInstruction'

interface CrewInstructionSheetProps {
  visitId: string
  initialInstruction: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Focused editor for a visit's crew instruction (the "orange cell") — owner/lead
 * only. Cross-surface (used by VisitDetailContent on both management and crew),
 * mirrors the CrewAssignSheet/SkipSheet bottom-sheet pattern. Saves immediately
 * via a direct-client mutation, no offline queue (this control is new to crew,
 * so there's no prior offline behavior to preserve for it).
 */
export function CrewInstructionSheet({
  visitId,
  initialInstruction,
  open,
  onOpenChange,
}: CrewInstructionSheetProps) {
  const [instruction, setInstruction] = useState(initialInstruction ?? '')
  const update = useUpdateCrewInstruction(visitId)

  function handleOpenChange(next: boolean) {
    if (next) setInstruction(initialInstruction ?? '')
    onOpenChange(next)
  }

  function handleSave() {
    update.mutate(instruction, {
      onSuccess: () => onOpenChange(false),
      onError: (err) => {
        if (err instanceof Error && err.message === 'offline') {
          toast.error('Saving the instruction needs a connection.')
        } else {
          toast.error('Could not save the instruction. Try again.')
        }
      },
    })
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-0 pb-0">
        <SheetHeader className="px-4 pb-2 text-left">
          <SheetTitle className="font-display text-xl">Crew instruction</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-3">
          <Textarea
            placeholder="Add a note for crew…"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            className="min-h-[100px] text-base resize-none"
          />
        </div>

        <SheetFooter className="px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-border bg-background space-y-2 flex-col">
          <Button
            className="w-full h-12 text-base font-semibold"
            onClick={handleSave}
            disabled={update.isPending}
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button
            variant="ghost"
            className="w-full h-11"
            onClick={() => handleOpenChange(false)}
            disabled={update.isPending}
          >
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
