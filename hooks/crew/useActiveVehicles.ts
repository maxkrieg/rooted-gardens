'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Vehicle } from '@/types/app'

/**
 * Non-retired vehicles — used by the Vehicle select in VisitDetailContent. RLS
 * (vehicles_select) permits owner/lead/crew; accountant is intentionally excluded,
 * which is why the Vehicle field is hidden entirely for that role.
 */
export function useActiveVehicles() {
  return useQuery<Vehicle[]>({
    queryKey: ['active-vehicles'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .neq('status', 'retired')
        .order('name', { ascending: true })

      if (error) throw error
      return (data ?? []) as Vehicle[]
    },
    staleTime: 5 * 60 * 1000,
  })
}
