'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { StopDetail } from '@/hooks/crew/useStopDetail'

/**
 * Update a visit's crew instruction (the "orange cell"). Direct-client,
 * online-only, shared by CrewInstructionSheet on both surfaces — mirrors
 * useReassignCrew's pattern. Optimistically updates the stop-detail cache.
 */
export function useUpdateCrewInstruction(visitId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (instruction: string) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('offline')
      }

      const supabase = createClient()
      const trimmed = instruction.trim() || null
      const { error } = await supabase
        .from('visits')
        .update({ crew_instruction: trimmed })
        .eq('id', visitId)
      if (error) throw error
      return trimmed
    },

    onMutate: async (instruction) => {
      await queryClient.cancelQueries({ queryKey: ['stop-detail', visitId] })
      const previous = queryClient.getQueryData<StopDetail | null>(['stop-detail', visitId])
      const trimmed = instruction.trim() || null

      queryClient.setQueryData<StopDetail | null>(['stop-detail', visitId], (old) =>
        old ? { ...old, visit: { ...old.visit, crew_instruction: trimmed } } : old
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
