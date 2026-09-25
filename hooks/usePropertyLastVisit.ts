'use client'

import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

const propertyLastVisitKey = ['property-last-visit'] as const

/** A plain object, not a Map: the persisted cache goes through JSON.stringify. */
type PropertyLastVisitMap = Record<string, string>

/**
 * Last completed visit (yyyy-MM-dd) per property, shared by every surface that shows
 * days-since. Also phases planWeek().
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
