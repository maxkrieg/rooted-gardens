'use client'

import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

export const propertyLastVisitKey = ['property-last-visit'] as const

/**
 * A plain object, deliberately NOT a Map. This query is persisted, and the
 * persister serialises with JSON.stringify — which turns a Map into `{}`. It
 * would work until the first reload and then throw on every `.get`.
 */
export type PropertyLastVisitMap = Record<string, string>

/**
 * Most recent completed visit per property, as yyyy-MM-dd, keyed by property id.
 *
 * One shared side-car map rather than a join into each feature's query: the
 * schedule, accounts, routes and the stop screen all need it, and joining a
 * view without an FK relationship would mean a second query per feature plus a
 * shape change (and a CACHE_BUSTER bump) on four persisted caches.
 *
 * Phases biweekly and monthly properties in planWeek(), and drives every
 * days-since-last-visit reading in the UI.
 */
export function usePropertyLastVisit() {
  return useQuery({
    queryKey: propertyLastVisitKey,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase.from('property_last_visit').select('*')
      if (error) throw error
      const byProperty: PropertyLastVisitMap = {}
      for (const row of data ?? []) {
        if (row.property_id && row.last_visit_at) {
          byProperty[row.property_id] = format(parseISO(row.last_visit_at), 'yyyy-MM-dd')
        }
      }
      return byProperty
    },
    staleTime: 5 * 60_000,
  })
}
