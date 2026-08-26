'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { enqueueMutation, flushMutationQueue } from '@/lib/offline/mutation-queue'
import { nextVisitVersion } from '@/lib/utils/visits'
import { patchScheduleVisit } from '@/hooks/useManagementSchedule'
import type { StopDetail } from '@/hooks/crew/useStopDetail'

/**
 * Update a visit's crew instruction (the "orange cell"). Queued so an owner can
 * write one from the field; shared by CrewInstructionSheet on both surfaces.
 */
export function useUpdateCrewInstruction(visitId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    // Runs regardless of connectivity: mutationFn writes to IndexedDB, not the
    // network. React Query's default pauses a mutation when offline, which ran
    // onMutate (so the UI looked saved) but never enqueued anything.
    networkMode: 'always',
    mutationFn: async (instruction: string) => {
      const trimmed = instruction.trim() || null
      await enqueueMutation('crew_instruction', { visitId, instruction: trimmed })
      const result = await flushMutationQueue()
      if (result.failed > 0) throw new Error('Change did not save')
      return trimmed
    },

    onMutate: async (instruction) => {
      await queryClient.cancelQueries({ queryKey: ['stop-detail', visitId] })
      const previous = queryClient.getQueryData<StopDetail | null>(['stop-detail', visitId])
      const trimmed = instruction.trim() || null

      patchScheduleVisit(queryClient, visitId, (visit) => ({
        ...visit,
        crew_instruction: trimmed,
        updated_at: nextVisitVersion(visit.updated_at),
      }))

      queryClient.setQueryData<StopDetail | null>(['stop-detail', visitId], (old) =>
        old
          ? {
              ...old,
              visit: {
                ...old.visit,
                crew_instruction: trimmed,
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
      queryClient.invalidateQueries({ queryKey: ['schedule-visits'] })
    },
  })
}
