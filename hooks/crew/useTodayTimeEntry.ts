'use client'

import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { TimeEntry } from '@/types/app'

export function useTodayTimeEntry(employeeId: string | undefined) {
  return useQuery<TimeEntry[]>({
    queryKey: ['today-time-entry', employeeId],
    queryFn: async () => {
      if (!employeeId) return []
      const supabase = createClient()
      const today = format(new Date(), 'yyyy-MM-dd')
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('date', today)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!employeeId,
    staleTime: 30_000,
  })
}
