'use client'

import { useRef, useState } from 'react'
import { Camera, Image as ImageIcon, ImagePlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { MAX_PHOTO_BYTES, ALLOWED_PHOTO_TYPES } from '@/lib/utils/photos'
import type { LightboxPhoto } from '@/components/PhotoLightbox'
import type { StopDetail } from '@/hooks/crew/useStopDetail'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'

const MAX_PLAN_PHOTOS = 4

interface VisitPlanPhotosProps {
  visitId: string
  propertyId: string
  photos: StopDetail['photos']
  urlByPath: Map<string, string | null | undefined>
  canManage: boolean
  isFinalVisit: boolean
  /** Opens the shared lightbox at this photo's index within `photos`. */
  onOpenPhoto: (index: number) => void
  /** Fired once a new photo is uploaded, so the drawer can open it straight away
   *  for captioning while the uploader still has it in mind. */
  onPhotoAdded: (photo: LightboxPhoto) => void
}

/**
 * Owner/lead reference photos on the Plan (type 'plan'). Everyone sees them; add/delete is
 * owner/lead-only and locks once the visit is final.
 */
export function VisitPlanPhotos({
  visitId,
  propertyId,
  photos,
  urlByPath,
  canManage,
  isFinalVisit,
  onOpenPhoto,
  onPhotoAdded,
}: VisitPlanPhotosProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const addPhoto = useAddVisitPlanPhoto(visitId, propertyId)
  const deletePhoto = useDeleteVisitPlanPhoto(visitId)

  const canEdit = canManage && !isFinalVisit

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so the same file can be picked again
    if (!file) return

    if (file.size > MAX_PHOTO_BYTES) {
      setError('Photo is too large — max 20 MB.')
      return
    }
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setError('Unsupported format — use JPEG, PNG, or WebP.')
      return
    }
    if (!navigator.onLine) {
      setError('Photos need a connection — connect and try again.')
      return
    }

    setError(null)
    addPhoto.mutate(file, {
      onSuccess: ({ photo, url }) => {
        // Straight into the lightbox on the photo just added — captioning is the
        // natural next step and the uploader still knows what they shot.
        onPhotoAdded({
          id: photo.id,
          type: photo.type,
          created_at: photo.created_at,
          caption: photo.caption,
          uploaded_by: photo.uploaded_by,
          url,
        })
      },
      onError: (err) => {
        setError(
          err instanceof Error && err.message === 'offline'
            ? 'Photos need a connection — connect and try again.'
            : 'Upload failed — please try again.'
        )
      },
    })
  }

  function handleDelete(id: string, storagePath: string) {
    deletePhoto.mutate(
      { id, storagePath },
      {
        onError: (err) => {
          if (err instanceof Error && err.message === 'offline') {
            toast.error('This needs a connection.')
          } else {
            toast.error('Could not delete photo. Try again.')
          }
        },
      }
    )
  }

  return (
    <div className="flex items-start gap-3">
      <ImageIcon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Reference Photos
        </p>

        {photos.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No reference photos.</p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {photos.map((photo, i) => {
              const url = urlByPath.get(photo.storage_path)
              return (
                <div key={photo.id} className="relative">
                  {/* Opens the shared lightbox so crew can page with caption and date in view. */}
                  <button
                    type="button"
                    onClick={() => onOpenPhoto(i)}
                    aria-label={photo.caption ?? 'Open reference photo'}
                    className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={photo.caption ?? 'Reference photo'}
                        className="h-16 w-16 rounded-xl object-cover border border-[--border]"
                      />
                    ) : (
                      <span className="flex h-16 w-16 rounded-xl border border-[--border] bg-muted items-center justify-center text-[9px] text-muted-foreground text-center px-1">
                        Unavailable
                      </span>
                    )}
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleDelete(photo.id, photo.storage_path)}
                      disabled={deletePhoto.isPending}
                      // Badge stays 20px so it doesn't swamp the 64px thumb; the
                      // touch target is expanded invisibly instead.
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-foreground text-background flex items-center justify-center disabled:opacity-50 pointer-coarse:before:absolute pointer-coarse:before:-inset-3 pointer-coarse:before:content-['']"
                      aria-label="Remove photo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {canEdit && (
          <>
            {/* Two inputs, not one: capture="environment" jumps straight to the
                rear camera, so the library needs its own input without it. */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleFileChange}
            />
            <input
              ref={libraryInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileChange}
            />
            <div className="flex items-center gap-2 flex-wrap">
              {/* Camera-only when the primary pointer is a finger; CSS, so no hydration flash. */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hidden pointer-coarse:inline-flex gap-1.5"
                onClick={() => cameraInputRef.current?.click()}
                disabled={photos.length >= MAX_PLAN_PHOTOS || addPhoto.isPending}
              >
                <Camera className="h-3.5 w-3.5" />
                {addPhoto.isPending ? 'Uploading…' : 'Take Photo'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => libraryInputRef.current?.click()}
                disabled={photos.length >= MAX_PLAN_PHOTOS || addPhoto.isPending}
              >
                <ImagePlus className="h-3.5 w-3.5" />
                {addPhoto.isPending ? (
                  'Uploading…'
                ) : (
                  <>
                    <span className="pointer-coarse:hidden">Add Photo</span>
                    <span className="hidden pointer-coarse:inline">Choose Photo</span>
                  </>
                )}
              </Button>
              {photos.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {photos.length}/{MAX_PLAN_PHOTOS}
                </span>
              )}
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Upload a plan photo. Online-only, and appended in onSuccess since its id doesn't exist until
 * the insert completes.
 */
function useAddVisitPlanPhoto(visitId: string, propertyId: string) {
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
        .select('id, storage_path, type, created_at, caption, uploaded_by')
        .single()
      if (error) throw error

      const photo = data as StopDetail['photos'][number]

      // Sign it now so the lightbox can open on the new photo for captioning.
      const { data: signed } = await supabase.storage
        .from('photos')
        .createSignedUrl(storagePath, 3600)

      return { photo, url: signed?.signedUrl ?? null }
    },

    onSuccess: ({ photo }) => {
      queryClient.setQueryData<StopDetail | null>(['stop-detail', visitId], (old) =>
        old ? { ...old, photos: [...(old.photos ?? []), photo] } : old
      )
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['stop-detail', visitId] })
      queryClient.invalidateQueries({ queryKey: ['schedule-visits'] })
    },
  })
}

/** Delete a plan photo's storage object and row (row-only would orphan the blob). Online-only. */
function useDeleteVisitPlanPhoto(visitId: string) {
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
      queryClient.invalidateQueries({ queryKey: ['schedule-visits'] })
    },
  })
}
