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
 * through the offline queue, so an owner can write one from the field.
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
      // No offline branch: this queues now, so reaching onError means the write
      // was tried and parked, not that there's no signal.
      onError: () => {
        toast.error('Could not save the instruction.', {
          description: 'Check "Changes that didn’t save" at the top of the screen.',
        })
      },
    })
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {/* max-h / overflow / rounding come from the bottom SheetContent variant;
          pb-0 because the footer below owns its own safe-area padding. */}
      <SheetContent side="bottom" className="px-0 pb-0">
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
