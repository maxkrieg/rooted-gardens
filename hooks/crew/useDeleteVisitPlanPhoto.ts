'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { StopDetail } from '@/hooks/crew/useStopDetail'

/**
 * Delete an owner/lead reference photo from a visit's Plan — removes both the
 * storage object and the `photos` row (row-only would orphan the blob). Direct-
 * client, online-only, optimistic like the other visit-detail mutation hooks.
 */
export function useDeleteVisitPlanPhoto(visitId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string }) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('offline')
      }

      const supabase = createClient()
      await supabase.storage.from('photos').remove([storagePath])

      const { error } = await supabase.from('photos').delete().eq('id', id)
      if (error) throw error
    },

    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['stop-detail', visitId] })
      const previous = queryClient.getQueryData<StopDetail | null>(['stop-detail', visitId])

      queryClient.setQueryData<StopDetail | null>(['stop-detail', visitId], (old) =>
        old ? { ...old, photos: (old.photos ?? []).filter((p) => p.id !== id) } : old
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
