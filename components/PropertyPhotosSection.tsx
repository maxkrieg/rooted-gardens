'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Images } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { photoTypeLabel, signPhotoUrls } from '@/lib/utils/photos'
import type { LightboxPhoto } from '@/components/PhotoLightbox'

interface PropertyPhotosSectionProps {
  propertyId: string
  /** The visit being viewed — its own photos are shown elsewhere in the drawer. */
  visitId: string
  onOpenPhoto: (photos: LightboxPhoto[], index: number) => void
}

/**
 * Past photos for this property (excluding the current visit's), newest first. Queries live
 * here so nothing loads until the collapsed card is opened.
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

  // Batch-signed in one round trip. A Record, not a Map: the persisted cache goes through
  // JSON.stringify, and a Map serializes to {}.
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
                className="inline-flex min-h-11 items-center text-xs font-medium text-[--primary] hover:underline"
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

type PropertyPhotoRow = {
  id: string
  storage_path: string
  type: string
  created_at: string
  caption: string | null
  /** Who took it — crew may caption their own photos, owner/lead any. */
  uploaded_by: string | null
}

type PropertyPhotosResult = {
  rows: PropertyPhotoRow[]
  /** Exact count of matching photos, so the section can offer "Show all (N)". */
  total: number
}

const PROPERTY_PHOTOS_PAGE_SIZE = 12

/**
 * Every photo at a property except the viewed visit's. `limit: 'all'` removes the page cap;
 * the limit is in the query key, so both results cache separately.
 */
function usePropertyPhotos(
  propertyId: string | undefined,
  excludeVisitId: string | undefined,
  limit: number | 'all' = PROPERTY_PHOTOS_PAGE_SIZE,
) {
  return useQuery<PropertyPhotosResult>({
    queryKey: ['property-photos', propertyId, excludeVisitId, limit],
    queryFn: async () => {
      const supabase = createClient()

      let query = supabase
        .from('photos')
        .select('id, storage_path, type, created_at, caption, uploaded_by', { count: 'exact' })
        .eq('property_id', propertyId!)
        // Not `.neq('visit_id', id)`: NULL <> 'x' is NULL, which would drop every property-level
        // photo.
        .or(`visit_id.is.null,visit_id.neq.${excludeVisitId}`)
        .order('created_at', { ascending: false })

      if (limit !== 'all') {
        query = query.range(0, limit - 1)
      }

      const { data, error, count } = await query
      if (error) throw error

      return {
        rows: (data ?? []) as PropertyPhotoRow[],
        total: count ?? 0,
      }
    },
    enabled: !!propertyId && !!excludeVisitId,
    staleTime: 30_000,
  })
}
