'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { enqueueMutation, flushMutationQueue } from '@/lib/crew/mutation-queue'
import { nextVisitVersion } from '@/lib/utils/visits'
import { patchScheduleVisit } from '@/hooks/useManagementSchedule'
import type { StopDetail } from '@/hooks/crew/useStopDetail'

/**
 * Set (or clear) the vehicle assigned to a visit. Queued so it survives a dead
 * zone; shared verbatim by the management Sheet and the crew stop page.
 */
export function useUpdateVisitVehicle(visitId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (vehicleId: string | null) => {
      await enqueueMutation('set_vehicle', { visitId, vehicleId })
      const result = await flushMutationQueue()
      if (result.failed > 0) throw new Error('Change did not save')
    },

    onMutate: async (vehicleId) => {
      await queryClient.cancelQueries({ queryKey: ['stop-detail', visitId] })
      const previous = queryClient.getQueryData<StopDetail | null>(['stop-detail', visitId])

      patchScheduleVisit(queryClient, visitId, (visit) => ({
        ...visit,
        vehicle_id: vehicleId,
        updated_at: nextVisitVersion(visit.updated_at),
      }))

      queryClient.setQueryData<StopDetail | null>(['stop-detail', visitId], (old) =>
        old
          ? {
              ...old,
              visit: {
                ...old.visit,
                vehicle_id: vehicleId,
                updated_at: nextVisitVersion(old.visit.updated_at),
              },
            }
          : old
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
      queryClient.invalidateQueries({ queryKey: ['schedule-visits'] })
    },
  })
}
