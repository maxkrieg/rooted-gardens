'use client'

import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Checkbox } from '@/components/ui/checkbox'
import { useActiveEmployees } from '@/hooks/crew/useActiveEmployees'
import { enqueueMutation } from '@/lib/offline/mutation-queue'
import { useQueuedVisitMutation } from '@/hooks/useManagementSchedule'
import type { VisitCrewWithEmployee } from '@/types/app'
import { emitTourEvent } from '@/lib/onboarding/events'

interface CrewAssignSheetProps {
  visitId: string
  assignedCrew: Array<{ employee_id: string; name: string }>
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CrewAssignSheet({
  visitId,
  assignedCrew,
  open,
  onOpenChange,
}: CrewAssignSheetProps) {
  const { data: employees = [], isLoading } = useActiveEmployees()
  const reassign = useReassignCrew(visitId)

  const assignedIds = new Set(assignedCrew.map((c) => c.employee_id))

  function toggle(employeeId: string, name: string, currentlyAssigned: boolean) {
    reassign.mutate(
      { employeeId, name, action: currentlyAssigned ? 'remove' : 'add' },
      {
        // No offline branch: this queues now, so reaching onError means the
        // write was tried and parked, not that there's no signal.
        onError: () => {
          toast.error('Could not update crew.', {
            description: 'Check "Changes that didn’t save" at the top of the screen.',
          })
        },
      }
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* max-h / overflow / rounding / safe-area padding all come from the
          bottom SheetContent variant now. */}
      <SheetContent side="bottom">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display">Assigned crew</SheetTitle>
          <SheetDescription>Tap a name to add or remove them from this stop.</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6 pt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <ul className="divide-y divide-[--border]">
              {employees.map((emp) => {
                const checked = assignedIds.has(emp.id)
                return (
                  <li key={emp.id}>
                    <label className="flex items-center gap-3 py-3 min-h-[44px] cursor-pointer select-none">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(emp.id, emp.name, checked)}
                      />
                      <span className="text-base text-foreground">{emp.name}</span>
                      <span className="ml-auto text-[11px] uppercase tracking-wide text-muted-foreground">
                        {emp.role}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

type ReassignCrewInput = {
  employeeId: string
  name: string
  action: 'add' | 'remove'
}

function useReassignCrew(visitId: string) {
  return useQueuedVisitMutation(visitId, {
    enqueue: async ({ employeeId, action }: ReassignCrewInput) => {
      await enqueueMutation('assign_crew', { visitId, employeeId, action })
      if (action === 'add') emitTourEvent('schedule.crewAssigned')
    },
    patchVisit: (visit, { employeeId, name, action }) => {
      const isThis = (vc: VisitCrewWithEmployee) =>
        vc.employee_id === employeeId && vc.relation === 'assigned'
      if (action === 'remove') {
        return { ...visit, visit_crew: visit.visit_crew.filter((vc) => !isThis(vc)) }
      }
      if (visit.visit_crew.some(isThis)) return visit
      const added = {
        visit_id: visitId,
        employee_id: employeeId,
        relation: 'assigned',
        created_at: new Date().toISOString(),
        employee: { id: employeeId, name },
      } as VisitCrewWithEmployee
      return { ...visit, visit_crew: [...visit.visit_crew, added] }
    },
    patchStop: (stop, { employeeId, name, action }) => {
      if (action === 'remove') {
        const assignedCrew = stop.assignedCrew.filter((c) => c.employee_id !== employeeId)
        return { ...stop, assignedCrew }
      }
      if (stop.assignedCrew.some((c) => c.employee_id === employeeId)) return stop
      return { ...stop, assignedCrew: [...stop.assignedCrew, { employee_id: employeeId, name }] }
    },
  })
}
