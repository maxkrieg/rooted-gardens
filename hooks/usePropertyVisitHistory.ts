'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

/**
 * A small projection of `visits` used only by the Visit History section — kept
 * colocated here rather than in `types/app.ts`, matching how `useStopDetail`
 * defines `StopDetail` locally.
 */
export type PropertyVisitHistoryRow = {
  id: string
  status: string
  week_start: string
  ended_at: string | null
  service_types: string[] | null
  completion_note: string | null
  skip_reason: string | null
}

export type PropertyVisitHistoryResult = {
  rows: PropertyVisitHistoryRow[]
  total: number // exact count of past visits at this property (excludes the current one)
}

const PAGE_SIZE = 5

/**
 * Past visits at a property, for the "Visit History" section on a visit's detail
 * view (management Sheet + crew stop page). Filters strictly BEFORE the current
 * visit's week — not just by excluding its id — so a visit being viewed ahead of
 * schedule never shows other future-scheduled visits at the same property as
 * "history." Because visits has a UNIQUE(property_id, week_start) index, ordering
 * by week_start alone is deterministic (no duplicate-week ties to break).
 */
export function usePropertyVisitHistory(
  propertyId: string | undefined,
  beforeWeekStart: string | undefined
) {
  return useQuery<PropertyVisitHistoryResult>({
    queryKey: ['property-visit-history', propertyId, beforeWeekStart],
    queryFn: async () => {
      const supabase = createClient()

      const { data, error, count } = await supabase
        .from('visits')
        .select(
          'id, status, week_start, ended_at, service_types, completion_note, skip_reason',
          { count: 'exact' }
        )
        .eq('property_id', propertyId!)
        .lt('week_start', beforeWeekStart!)
        .order('week_start', { ascending: false })
        .range(0, PAGE_SIZE - 1)

      if (error) throw error

      return {
        rows: (data ?? []) as PropertyVisitHistoryRow[],
        total: count ?? 0,
      }
    },
    enabled: !!propertyId && !!beforeWeekStart,
    staleTime: 30_000,
  })
}
