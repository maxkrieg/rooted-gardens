'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Employee } from '@/types/app'

/** Active field staff (no accountants), for crew filters and the crew picker. */
export function useActiveEmployees() {
  return useQuery<Employee[]>({
    queryKey: ['active-employees'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('active', true)
        .neq('role', 'accountant')
        .order('name', { ascending: true })

      if (error) throw error
      return (data ?? []) as Employee[]
    },
    staleTime: 5 * 60 * 1000,
  })
}
