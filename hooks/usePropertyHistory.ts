'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { VisitWithCrew } from '@/types/app'

export const HISTORY_LIMIT = 8

export const propertyHistoryKey = (propertyId: string | undefined) =>
  ['property-history', propertyId] as const

/**
 * The latest settled (completed/skipped) visits at one property, newest first. Keyed on the
 * property alone so every stop there shares one entry; the viewed visit is dropped client-side.
 * No is_archived filter: this is history, and archived rows still have to render.
 */
export function usePropertyHistory(propertyId: string | undefined, excludeVisitId?: string) {
  return useQuery({
    queryKey: propertyHistoryKey(propertyId),
    queryFn: async (): Promise<VisitWithCrew[]> => {
      const supabase = createClient()
      // One extra row, so the list is still HISTORY_LIMIT long once the viewed visit is dropped.
      const { data, error } = await supabase
        .from('visits')
        .select('*, visit_crew(*, employee:employees(*)), photos(type)')
        .eq('property_id', propertyId!)
        .in('status', ['completed', 'skipped'])
        .order('week_start', { ascending: false })
        .limit(HISTORY_LIMIT + 1)
      if (error) throw error

      type Row = VisitWithCrew & { photos: Array<{ type: string | null }> | null }
      return ((data ?? []) as unknown as Row[]).map(({ photos, ...visit }) => ({
        ...visit,
        photo_count: (photos ?? []).filter((p) => p.type === 'visit').length,
      }))
    },
    enabled: !!propertyId,
    staleTime: 30_000,
    select: (visits) =>
      visits.filter((v) => v.id !== excludeVisitId).slice(0, HISTORY_LIMIT),
  })
}
