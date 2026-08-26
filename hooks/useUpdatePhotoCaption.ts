'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

/**
 * Caption a photo from the visit drawer.
 *
 * Deliberately a direct-client mutation rather than the `updatePropertyPhoto`
 * Server Action the account gallery uses: this runs on `/app/stop/[visitId]`,
 * where CLAUDE.md forbids Server Actions. Same online-only pattern as the other
 * drawer mutations (useUpdateCrewInstruction, useAddVisitPlanPhoto) — captions
 * are typed deliberately, so failing loudly beats silently queueing.
 *
 * Authorization is RLS's job: owner/lead may caption any photo, crew only the
 * photos they uploaded, and a trigger stops crew changing anything but caption.
 */
export function useUpdatePhotoCaption() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ photoId, caption }: { photoId: string; caption: string }) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('offline')
      }

      const supabase = createClient()
      const trimmed = caption.trim() || null

      const { error } = await supabase
        .from('photos')
        .update({ caption: trimmed })
        .eq('id', photoId)
      if (error) throw error

      return trimmed
    },

    onSettled: () => {
      // Prefix-matched: refreshes whichever drawer surface the photo came from
      // (visit plan / completion via stop-detail, history via property-photos).
      queryClient.invalidateQueries({ queryKey: ['stop-detail'] })
      queryClient.invalidateQueries({ queryKey: ['property-photos'] })
    },
  })
}
