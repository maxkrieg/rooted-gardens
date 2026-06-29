'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { StopDetail } from '@/hooks/crew/useStopDetail'

export type ReassignCrewInput = {
  employeeId: string
  name: string
  action: 'add' | 'remove'
}

/**
 * Add or remove an `assigned` crew member on a visit. Online-required by design
 * (NOT routed through the offline mutation queue): reassignment is a coordination
 * action — the newly assigned crew need to see it to act on it — so queuing it
 * offline would risk silent conflicts. Optimistically updates the stop-detail
 * cache and invalidates the week schedule on settle.
 */
export function useReassignCrew(visitId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ employeeId, action }: ReassignCrewInput) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('offline')
      }

      const supabase = createClient()

      if (action === 'add') {
        const { error } = await supabase.from('visit_crew').insert({
          visit_id: visitId,
          employee_id: employeeId,
          relation: 'assigned',
        })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('visit_crew')
          .delete()
          .eq('visit_id', visitId)
          .eq('employee_id', employeeId)
          .eq('relation', 'assigned')
        if (error) throw error
      }
    },

    onMutate: async ({ employeeId, name, action }) => {
      await queryClient.cancelQueries({ queryKey: ['stop-detail', visitId] })
      const previous = queryClient.getQueryData<StopDetail | null>(['stop-detail', visitId])

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
    },
  })
}
