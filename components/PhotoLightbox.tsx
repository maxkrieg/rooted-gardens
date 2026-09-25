'use client'

import { useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { photoTypeLabel } from '@/lib/utils/photos'

/** The fields both crew and management photo rows can supply. */
export type LightboxPhoto = {
  id: string
  type: string
  created_at: string
  caption: string | null
  url: string | null
  /** Who took it. Absent on surfaces that don't select it (the account gallery
   *  gates editing on role alone). */
  uploaded_by?: string | null
}

interface PhotoLightboxProps {
  photos: LightboxPhoto[]
  index: number
  /** Context line for screen readers, e.g. the property address. */
  subtitle?: string
  onIndexChange: (next: number) => void
  onClose: () => void
  /**
   * Owner-only editing controls, injected as a slot so this stays free of Server Actions for the
   * offline stop page.
   */
  footer?: React.ReactNode
}

/** Full-screen photo viewer with paging, shared by the account gallery and the visit drawer. */
export function PhotoLightbox({
  photos,
  index,
  subtitle,
  onIndexChange,
  onClose,
  footer,
}: PhotoLightboxProps) {
  const photo = photos[index]

  const hasPrev = index > 0
  const hasNext = index < photos.length - 1

  // Arrow-key navigation. Esc and focus management are Radix's job.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (e.defaultPrevented) return

      // Don't hijack arrows while someone is editing a caption in the footer
      // slot or driving its type Select.
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
      <DialogContent
        className="max-w-4xl w-[95vw] p-0 gap-0 bg-card sm:rounded-2xl overflow-hidden"
        // Inside a Radix Sheet, restoring focus into the closing subtree leaves a stuck pointer
        // lock.
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Radix requires a title/description for screen readers. */}
        <DialogTitle className="sr-only">
          {photo.caption ??
            `Photo ${index + 1} of ${photos.length}${subtitle ? ` at ${subtitle}` : ''}`}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {photoTypeLabel(photo.type)} photo. Use the arrow keys to move between photos.
        </DialogDescription>

        <div className="relative bg-muted">
          {photo.url ? (
            // Plain <img>: signed URLs rotate hourly, so next/image can't cache them.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.url}
              alt={photo.caption ?? 'Property photo'}
              className="max-h-[50dvh] w-auto mx-auto object-contain"
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

        {/* dvh, sized to fit the dialog's cap so the caption field never double-scrolls. */}
        <div className="p-5 space-y-4 max-h-[30dvh] overflow-y-auto">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {photoTypeLabel(photo.type)} ·{' '}
              {format(parseISO(photo.created_at), 'EEE MMM d, yyyy')}
            </span>
            {photos.length > 1 && (
              <span className="text-muted-foreground tabular-nums shrink-0">
                {index + 1} of {photos.length}
              </span>
            )}
          </div>

          {/* Always shown — crew open a photo specifically for this context. */}
          {photo.caption && <p className="text-sm text-foreground">{photo.caption}</p>}

          {footer}
        </div>
      </DialogContent>
    </Dialog>
  )
}
