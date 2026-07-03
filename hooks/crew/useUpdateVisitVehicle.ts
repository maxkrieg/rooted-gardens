'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { StopDetail } from '@/hooks/crew/useStopDetail'

/**
 * Set (or clear) the vehicle assigned to a visit. Direct-client, online-only,
 * shared verbatim by the management Sheet and the crew stop page — mirrors
 * useReassignCrew's pattern. Optimistically updates the stop-detail cache.
 */
export function useUpdateVisitVehicle(visitId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (vehicleId: string | null) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('offline')
      }

      const supabase = createClient()
      const { error } = await supabase
        .from('visits')
        .update({ vehicle_id: vehicleId })
        .eq('id', visitId)
      if (error) throw error
    },

    onMutate: async (vehicleId) => {
      await queryClient.cancelQueries({ queryKey: ['stop-detail', visitId] })
      const previous = queryClient.getQueryData<StopDetail | null>(['stop-detail', visitId])

      queryClient.setQueryData<StopDetail | null>(['stop-detail', visitId], (old) =>
        old ? { ...old, visit: { ...old.visit, vehicle_id: vehicleId } } : old
      )

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
