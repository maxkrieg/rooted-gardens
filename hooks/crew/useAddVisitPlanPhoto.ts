'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import type { StopDetail } from '@/hooks/crew/useStopDetail'

/**
 * Upload an owner/lead reference photo onto a visit's Plan (type='plan') — distinct
 * from crew's completion photos (type='visit'). Direct-client, online-only, same
 * pattern as the other visit-detail mutation hooks. Unlike those, this can't be
 * optimistic in onMutate (the photo's id/storage_path don't exist until the upload
 * and insert complete), so the new photo is appended to the cache in onSuccess.
 */
export function useAddVisitPlanPhoto(visitId: string, propertyId: string) {
  const queryClient = useQueryClient()
  const { data: employee } = useCurrentEmployee()

  return useMutation({
    mutationFn: async (file: File) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('offline')
      }

      const supabase = createClient()
      const storagePath = `photos/${propertyId}/${visitId}/${Date.now()}.jpg`

      const { error: uploadError } = await supabase.storage.from('photos').upload(storagePath, file)
      if (uploadError) throw uploadError

      const { data, error } = await supabase
        .from('photos')
        .insert({
          property_id: propertyId,
          visit_id: visitId,
          storage_path: storagePath,
          type: 'plan',
          uploaded_by: employee?.id ?? null,
        })
        .select('id, storage_path, type, created_at, caption')
        .single()
      if (error) throw error

      return data as StopDetail['photos'][number]
    },

    onSuccess: (photo) => {
      queryClient.setQueryData<StopDetail | null>(['stop-detail', visitId], (old) =>
        old ? { ...old, photos: [...(old.photos ?? []), photo] } : old
      )
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['stop-detail', visitId] })
      queryClient.invalidateQueries({ queryKey: ['crew-week-schedule'] })
    },
  })
}
