'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { enqueueMutation, flushMutationQueue } from '@/lib/crew/mutation-queue'
import { patchScheduleVisit } from '@/hooks/useManagementSchedule'
import type { StopDetail } from '@/hooks/crew/useStopDetail'
import type { VisitCrewWithEmployee } from '@/types/app'

export type ReassignCrewInput = {
  employeeId: string
  name: string
  action: 'add' | 'remove'
}

/**
 * Add or remove an `assigned` crew member on a visit.
 *
 * Was online-only, on the reasoning that reassignment is a coordination action
 * the newly assigned crew must see to act on, so queuing it risked silent
 * conflicts. That held while only crew were offline; owners are now phone-primary
 * in the field, where a refused write is worse than a delayed one.
 */
export function useReassignCrew(visitId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    // Runs regardless of connectivity: mutationFn writes to IndexedDB, not the
    // network. React Query's default pauses a mutation when offline, which ran
    // onMutate (so the UI looked saved) but never enqueued anything.
    networkMode: 'always',
    mutationFn: async ({ employeeId, action }: ReassignCrewInput) => {
      await enqueueMutation('assign_crew', { visitId, employeeId, action })
      const result = await flushMutationQueue()
      if (result.failed > 0) throw new Error('Change did not save')
    },

    onMutate: async ({ employeeId, name, action }) => {
      await queryClient.cancelQueries({ queryKey: ['stop-detail', visitId] })
      const previous = queryClient.getQueryData<StopDetail | null>(['stop-detail', visitId])

      // The grid reads visit_crew, which no other cache write reaches.
      patchScheduleVisit(queryClient, visitId, (visit) => ({
        ...visit,
        visit_crew:
          action === 'add'
            ? visit.visit_crew.some(
                (vc) => vc.employee_id === employeeId && vc.relation === 'assigned',
              )
              ? visit.visit_crew
              : [
                  ...visit.visit_crew,
                  {
                    visit_id: visitId,
                    employee_id: employeeId,
                    relation: 'assigned',
                    created_at: new Date().toISOString(),
                    employee: { id: employeeId, name },
                  } as VisitCrewWithEmployee,
                ]
            : visit.visit_crew.filter(
                (vc) => !(vc.employee_id === employeeId && vc.relation === 'assigned'),
              ),
      }))

      queryClient.setQueryData<StopDetail | null>(['stop-detail', visitId], (old) => {
        if (!old) return old
        if (action === 'add') {
          if (old.assignedCrew.some((c) => c.employee_id === employeeId)) return old
          return { ...old, assignedCrew: [...old.assignedCrew, { employee_id: employeeId, name }] }
        }
        return {
          ...old,
          assignedCrew: old.assignedCrew.filter((c) => c.employee_id !== employeeId),
        }
      })

      return { previous }
    },

    onError: (_err, _input, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['stop-detail', visitId], context.previous)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['stop-detail', visitId] })
      queryClient.invalidateQueries({ queryKey: ['crew-week-schedule'] })
      queryClient.invalidateQueries({ queryKey: ['schedule-visits'] })
    },
  })
}
