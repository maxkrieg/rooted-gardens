'use client'

import { useRef, useState } from 'react'
import { Image as ImageIcon, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAddVisitPlanPhoto } from '@/hooks/crew/useAddVisitPlanPhoto'
import { useDeleteVisitPlanPhoto } from '@/hooks/crew/useDeleteVisitPlanPhoto'
import { MAX_PHOTO_BYTES, ALLOWED_PHOTO_TYPES } from '@/lib/utils/photos'
import type { LightboxPhoto } from '@/components/PhotoLightbox'
import type { StopDetail } from '@/hooks/crew/useStopDetail'

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
 * Owner/lead-managed reference photos on the Visit Plan (photos.type = 'plan') —
 * distinct from crew's completion photos (type = 'visit', shown in the Completion
 * Log). Visible to every role; add/delete is gated to owner/lead and locks once
 * the visit is final, same treatment as the sibling Plan rows.
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
  const fileInputRef = useRef<HTMLInputElement>(null)
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
                  {/* Opens the shared lightbox rather than dumping a raw signed
                      URL into a new tab — crew are on a phone and need to page
                      through photos with the caption and date in view. */}
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
            {/* Hidden file input — capture="environment" opens rear camera on mobile */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={photos.length >= MAX_PLAN_PHOTOS || addPhoto.isPending}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              {addPhoto.isPending
                ? 'Uploading…'
                : photos.length > 0
                  ? `Add Photo (${photos.length}/${MAX_PLAN_PHOTOS})`
                  : 'Add Photo'}
            </Button>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}
