'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Vehicle } from '@/types/app'

/** Non-retired vehicles. RLS excludes the accountant, who doesn't see the Vehicle field. */
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
