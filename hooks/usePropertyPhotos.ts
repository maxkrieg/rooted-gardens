'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

/**
 * A small projection of `photos` used by the visit drawer's property Photos
 * section — kept colocated here rather than in `types/app.ts`, matching how
 * `useStopDetail` defines `StopDetail` locally.
 */
export type PropertyPhotoRow = {
  id: string
  storage_path: string
  type: string
  created_at: string
  caption: string | null
  /** Who took it — crew may caption their own photos, owner/lead any. */
  uploaded_by: string | null
}

export type PropertyPhotosResult = {
  rows: PropertyPhotoRow[]
  /** Exact count of matching photos, so the section can offer "Show all (N)". */
  total: number
}

export const PROPERTY_PHOTOS_PAGE_SIZE = 12

/**
 * Every photo at a property EXCEPT those attached to the visit being viewed —
 * the "other times we were here" history for the visit drawer. The current
 * visit's own plan and completion photos are excluded because both already have
 * their own sections in that drawer.
 *
 * Used by both the crew stop page and the management Sheet (via
 * VisitDetailContent), hence the `hooks/` root rather than `hooks/crew/`.
 *
 * Pass `limit: 'all'` to drop the page cap. The limit is part of the query key,
 * so the capped and uncapped results cache as separate entries and expanding
 * doesn't evict the fast first page.
 */
export function usePropertyPhotos(
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
        // NOT `.neq('visit_id', id)`: visit_id is nullable, and `NULL <> 'x'` is
        // NULL rather than true in SQL, so a plain neq would silently drop every
        // property-level how_to / customer_request photo — exactly the ones this
        // section exists to surface.
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
