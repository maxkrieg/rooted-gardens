'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Equipment, Vehicle } from '@/types/app'

export const fleetIssuesKey = ['fleet-issues'] as const

/** Vehicles and equipment flagged for maintenance — the dashboard's only read
 *  that the schedule's cache doesn't already cover. Changes rarely. */
export function useFleetIssues() {
  return useQuery({
    queryKey: fleetIssuesKey,
    queryFn: async () => {
      const supabase = createClient()
      const [equipmentResult, vehiclesResult] = await Promise.all([
        supabase.from('equipment').select('*').eq('status', 'maintenance').order('name'),
        supabase.from('vehicles').select('*').eq('status', 'maintenance').order('name'),
      ])
      if (equipmentResult.error) throw equipmentResult.error
      if (vehiclesResult.error) throw vehiclesResult.error

      return {
        equipment: (equipmentResult.data ?? []) as Equipment[],
        vehicles: (vehiclesResult.data ?? []) as Vehicle[],
      }
    },
    staleTime: 5 * 60_000,
  })
}
