'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

interface PhotoCaptionEditorProps {
  photoId: string
  initialCaption: string | null
  /** Lets the lightbox reflect the saved caption without waiting on a refetch. */
  onSaved: (photoId: string, caption: string | null) => void
}

/**
 * Caption editing inside the visit drawer's lightbox — the crew-safe counterpart
 * to management's PhotoEditor. Caption only: correcting a photo's category or
 * deleting it stays on the account Photos page.
 *
 * Mount keyed by photo id so the draft resets when paging between photos.
 */
export function PhotoCaptionEditor({
  photoId,
  initialCaption,
  onSaved,
}: PhotoCaptionEditorProps) {
  const [caption, setCaption] = useState(initialCaption ?? '')
  const updateCaption = useUpdatePhotoCaption()

  const changed = (initialCaption ?? '') !== caption

  function handleSave() {
    updateCaption.mutate(
      { photoId, caption },
      {
        onSuccess: (saved) => {
          toast.success('Caption saved')
          onSaved(photoId, saved)
        },
        onError: (err) => {
          toast.error(
            err instanceof Error && err.message === 'offline'
              ? 'Captions need a connection — try again once you have signal.'
              : 'Could not save the caption. Try again.',
          )
        },
      },
    )
  }

  return (
    <div className="space-y-1.5 border-t border-[--border] pt-3">
      <label
        htmlFor={`caption-${photoId}`}
        className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide"
      >
        Caption
      </label>
      <Textarea
        id={`caption-${photoId}`}
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="What should someone notice in this photo?"
        rows={2}
        // ≥16px keeps iOS from zooming the viewport on focus.
        className="text-base"
      />
      <Button
        type="button"
        size="sm"
        disabled={!changed || updateCaption.isPending}
        onClick={handleSave}
      >
        {updateCaption.isPending ? 'Saving…' : 'Save caption'}
      </Button>
    </div>
  )
}

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
function useUpdatePhotoCaption() {
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
