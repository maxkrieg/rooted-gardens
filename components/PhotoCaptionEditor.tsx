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
 * Caption editing in the visit drawer's lightbox. Caption only; category and delete stay on
 * the account Photos page. Keyed by photo id so the draft resets on paging.
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
 * Caption a photo from the drawer. Direct-client and online-only: no Server Actions on the stop
 * page, and a deliberate caption should fail loudly. RLS limits crew to their own photos.
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
