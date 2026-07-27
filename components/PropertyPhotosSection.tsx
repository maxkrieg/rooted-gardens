'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Images } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { photoTypeLabel, signPhotoUrls } from '@/lib/utils/photos'
import {
  usePropertyPhotos,
  PROPERTY_PHOTOS_PAGE_SIZE,
  type PropertyPhotoRow,
} from '@/hooks/usePropertyPhotos'
import type { LightboxPhoto } from '@/components/PhotoLightbox'

interface PropertyPhotosSectionProps {
  propertyId: string
  /** The visit being viewed — its own photos are shown elsewhere in the drawer. */
  visitId: string
  onOpenPhoto: (photos: LightboxPhoto[], index: number) => void
}

/**
 * Historical photos for the property, shown inside the drawer's Property Notes
 * card. Everything at this property except the current visit's own photos, flat
 * and newest-first, so crew standing on site can see how the place has looked
 * and what the standing reference photos say.
 *
 * Both queries live here rather than in VisitDetailContent because the Property
 * Notes body is collapsed by default and unmounted until opened — so nothing is
 * fetched until a crew member actually expands the card.
 */
export function PropertyPhotosSection({
  propertyId,
  visitId,
  onOpenPhoto,
}: PropertyPhotosSectionProps) {
  const [limit, setLimit] = useState<number | 'all'>(PROPERTY_PHOTOS_PAGE_SIZE)
  const { data, isLoading } = usePropertyPhotos(propertyId, visitId, limit)

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const paths = rows.map((p) => p.storage_path)

  // Batch-signed in one round trip — the drawer's other photo sections sign one
  // request per photo, which is fine for ≤4 but not for a dozen or more.
  //
  // Returns a plain Record, NOT the Map that signPhotoUrls hands back: the React
  // Query cache is persisted to IndexedDB through JSON.stringify, and a Map
  // serializes to {}. A rehydrated Map would arrive as a plain object and blow up
  // on .get().
  const { data: urlByPath } = useQuery({
    queryKey: ['photo-urls-batch', paths],
    queryFn: async () =>
      Object.fromEntries(await signPhotoUrls(createClient().storage, paths)) as Record<
        string,
        string
      >,
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000, // under the 1-hr signed URL expiry
  })

  const lightboxPhotos: LightboxPhoto[] = rows.map((p) => ({
    id: p.id,
    type: p.type,
    created_at: p.created_at,
    caption: p.caption,
    uploaded_by: p.uploaded_by,
    url: urlByPath?.[p.storage_path] ?? null,
  }))

  return (
    <div className="flex items-start gap-3">
      <Images className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Photos
          </p>
          {total > 0 && (
            <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
              {total} total
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No other photos for this property.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2">
              {rows.map((photo, i) => (
                <PhotoTile
                  key={photo.id}
                  photo={photo}
                  url={urlByPath?.[photo.storage_path] ?? null}
                  onOpen={() => onOpenPhoto(lightboxPhotos, i)}
                />
              ))}
            </div>

            {total > rows.length && (
              <button
                type="button"
                onClick={() => setLimit('all')}
                className="text-xs font-medium text-[--primary] hover:underline"
              >
                Show all {total} photos
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function PhotoTile({
  photo,
  url,
  onOpen,
}: {
  photo: PropertyPhotoRow
  url: string | null
  onOpen: () => void
}) {
  // Flat list, so every non-visit photo is labelled. (The account gallery groups
  // by type and therefore badges only before/after — the opposite rule.)
  const showTypeBadge = photo.type !== 'visit'

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={photo.caption ?? `Open ${photoTypeLabel(photo.type)} photo`}
      className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
    >
      <div className="relative aspect-square rounded-xl overflow-hidden border border-[--border] bg-muted">
        {url ? (
          // Plain <img> — signed URLs rotate hourly, so next/image buys nothing.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={photo.caption ?? ''}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          // An honest label, not an endless shimmer: offline (or a failed sign)
          // is a normal state in the field, and crew shouldn't wait on it.
          <span className="flex h-full w-full items-center justify-center text-[9px] text-muted-foreground px-1 text-center">
            Unavailable
          </span>
        )}

        {showTypeBadge && (
          <span className="absolute top-0.5 left-0.5 rounded-full bg-foreground/70 text-background text-[9px] px-1.5 py-px leading-tight">
            {photoTypeLabel(photo.type)}
          </span>
        )}
      </div>

      <span className="block mt-1 text-[10px] tabular-nums text-muted-foreground truncate">
        {format(parseISO(photo.created_at), 'MMM d, yyyy')}
      </span>
    </button>
  )
}
