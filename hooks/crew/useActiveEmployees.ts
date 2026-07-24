'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Employee } from '@/types/app'

/**
 * The full active roster of field-assignable staff — used by the crew schedule
 * filters and the assigned-crew picker on the stop detail page. Excludes
 * accountants, who never work crew visits. RLS now lets crew read all employees
 * (see 20260628150000_crew_schedule_visibility.sql).
 */
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
