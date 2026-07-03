'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { StopDetail } from '@/hooks/crew/useStopDetail'

/**
 * Revert a skipped or completed visit back to `scheduled`. Clears only
 * `skip_reason` — mirrors the old `unskipVisit` Server Action's minimal
 * behavior; completion fields (service_types/completion_note/ended_at) are
 * intentionally left as-is if reverting from `completed`. Direct-client,
 * online-only, shared by both surfaces — mirrors useReassignCrew's pattern.
 */
export function useRevertVisitToScheduled(visitId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('offline')
      }

      const supabase = createClient()
      const { error } = await supabase
        .from('visits')
        .update({ status: 'scheduled', skip_reason: null })
        .eq('id', visitId)
      if (error) throw error
    },

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['stop-detail', visitId] })
      const previous = queryClient.getQueryData<StopDetail | null>(['stop-detail', visitId])

      queryClient.setQueryData<StopDetail | null>(['stop-detail', visitId], (old) =>
        old ? { ...old, visit: { ...old.visit, status: 'scheduled', skip_reason: null } } : old
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
