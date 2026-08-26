'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { enqueueMutation, flushMutationQueue } from '@/lib/offline/mutation-queue'
import { nextVisitVersion } from '@/lib/utils/visits'
import { patchScheduleVisit } from '@/hooks/useManagementSchedule'
import type { StopDetail } from '@/hooks/crew/useStopDetail'

/**
 * Revert a skipped or completed visit back to `scheduled`. Clears only
 * `skip_reason` — mirrors the old `unskipVisit` Server Action's minimal
 * behavior; completion fields (service_types/completion_note/ended_at) are
 * intentionally left as-is if reverting from `completed`. Queued so it works in
 * the field; shared by both surfaces.
 */
export function useRevertVisitToScheduled(visitId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    // Runs regardless of connectivity: mutationFn writes to IndexedDB, not the
    // network. React Query's default pauses a mutation when offline, which ran
    // onMutate (so the UI looked saved) but never enqueued anything.
    networkMode: 'always',
    mutationFn: async () => {
      await enqueueMutation('revert_status', { visitId })
      const result = await flushMutationQueue()
      if (result.failed > 0) throw new Error('Change did not save')
    },

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['stop-detail', visitId] })
      const previous = queryClient.getQueryData<StopDetail | null>(['stop-detail', visitId])

      patchScheduleVisit(queryClient, visitId, (visit) => ({
        ...visit,
        status: 'scheduled',
        skip_reason: null,
        updated_at: nextVisitVersion(visit.updated_at),
      }))

      queryClient.setQueryData<StopDetail | null>(['stop-detail', visitId], (old) =>
        old
          ? {
              ...old,
              visit: {
                ...old.visit,
                status: 'scheduled',
                skip_reason: null,
                // Beat the row this replaces so the management grid's live
                // overlay takes it now rather than on the confirming refetch.
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
