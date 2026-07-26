'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { photoTypeLabel } from '@/lib/utils/photos'
import {
  deletePropertyPhoto,
  updatePropertyPhoto,
} from '@/app/management/accounts/photo-actions'
import { PHOTO_TYPES, type PhotoType, type PhotoWithUrl } from '@/types/app'

interface PhotoLightboxProps {
  accountId: string
  /** The active property's photos, flattened in display order. */
  photos: PhotoWithUrl[]
  index: number
  address: string
  onIndexChange: (next: number) => void
  onClose: () => void
  canManage: boolean
}

export function PhotoLightbox({
  accountId,
  photos,
  index,
  address,
  onIndexChange,
  onClose,
  canManage,
}: PhotoLightboxProps) {
  const photo = photos[index]

  const hasPrev = index > 0
  const hasNext = index < photos.length - 1

  // Arrow-key navigation. Esc and focus management are Radix's job.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (e.defaultPrevented) return

      // Don't hijack arrows while the owner is editing the caption or driving
      // the type Select.
      const target = e.target as HTMLElement | null
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.closest('[role="combobox"], [role="listbox"]')
      ) {
        return
      }

      if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1)
      if (e.key === 'ArrowRight' && index < photos.length - 1) onIndexChange(index + 1)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [index, photos.length, onIndexChange])

  if (!photo) return null

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] p-0 gap-0 bg-card sm:rounded-2xl overflow-hidden">
        {/* Radix requires a title/description for screen readers. */}
        <DialogTitle className="sr-only">
          {photo.caption ?? `Photo ${index + 1} of ${photos.length} at ${address}`}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {photoTypeLabel(photo.type)} photo. Use the arrow keys to move between photos.
        </DialogDescription>

        <div className="relative bg-muted">
          {photo.url ? (
            // Plain <img>: next/image can't cache a signed URL whose signature
            // rotates hourly, and would need a remotePatterns entry for the
            // Supabase host. Matches how photos render elsewhere in the app.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.url}
              alt={photo.caption ?? `Photo at ${address}`}
              className="max-h-[65vh] w-auto mx-auto object-contain"
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              Photo unavailable
            </div>
          )}

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => hasPrev && onIndexChange(index - 1)}
                disabled={!hasPrev}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-background/80 backdrop-blur flex items-center justify-center disabled:opacity-30 hover:bg-background transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => hasNext && onIndexChange(index + 1)}
                disabled={!hasNext}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-background/80 backdrop-blur flex items-center justify-center disabled:opacity-30 hover:bg-background transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        <div className="p-5 space-y-4 max-h-[35vh] overflow-y-auto">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {photoTypeLabel(photo.type)} · {format(parseISO(photo.created_at), 'EEE MMM d, yyyy')}
            </span>
            {photos.length > 1 && (
              <span className="text-muted-foreground tabular-nums shrink-0">
                {index + 1} of {photos.length}
              </span>
            )}
          </div>

          {canManage ? (
            // Keyed by photo id so the caption draft and delete-confirm state
            // reset naturally when navigating between photos — no effect needed.
            <PhotoEditor
              key={photo.id}
              accountId={accountId}
              photo={photo}
              onClose={onClose}
            />
          ) : (
            photo.caption && <p className="text-sm text-foreground">{photo.caption}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Owner/lead controls for a single photo: caption, category, delete. */
function PhotoEditor({
  accountId,
  photo,
  onClose,
}: {
  accountId: string
  photo: PhotoWithUrl
  onClose: () => void
}) {
  const router = useRouter()
  const [caption, setCaption] = useState(photo.caption ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  const captionChanged = (photo.caption ?? '') !== caption

  function handleSaveCaption() {
    startTransition(async () => {
      const result = await updatePropertyPhoto(accountId, photo.id, { caption })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Caption saved')
      router.refresh()
    })
  }

  function handleTypeChange(next: string) {
    if (next === photo.type) return
    startTransition(async () => {
      const result = await updatePropertyPhoto(accountId, photo.id, {
        type: next as PhotoType,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Moved to ${photoTypeLabel(next)}`)
      router.refresh()
      // A type change re-partitions the groups, so this photo's index no longer
      // means what it did. Closing is simpler and less surprising than trying to
      // track it across the re-sort.
      onClose()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePropertyPhoto(accountId, photo.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Photo deleted')
      router.refresh()
      onClose()
    })
  }

  return (
    <>
      <div className="space-y-1.5">
        <label
          htmlFor="photo-caption"
          className="text-xs font-semibold text-muted-foreground uppercase tracking-widest"
        >
          Caption
        </label>
        <Textarea
          id="photo-caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Describe what crew should notice here…"
          rows={2}
          className="text-base"
        />
        <Button
          type="button"
          size="sm"
          className="h-9"
          disabled={!captionChanged || isPending}
          onClick={handleSaveCaption}
        >
          Save caption
        </Button>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Category
        </label>
        <Select value={photo.type} onValueChange={handleTypeChange} disabled={isPending}>
          <SelectTrigger className="h-11 text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PHOTO_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {photoTypeLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border-t border-border pt-3">
        {confirmingDelete ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-foreground">Delete this photo?</span>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-9"
              disabled={isPending}
              onClick={handleDelete}
            >
              Delete
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={isPending}
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-destructive hover:text-destructive"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete photo
          </Button>
        )}
      </div>
    </>
  )
}
