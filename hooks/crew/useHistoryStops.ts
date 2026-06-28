'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export type HistoryStop = {
  visitId: string
  actual_date: string | null
  week_start: string
  service_types: string[] | null
  address: string
  accountName: string
  completedAt: string
}

export function useHistoryStops(employeeId: string | undefined) {
  return useQuery<HistoryStop[]>({
    queryKey: ['crew-history-stops', employeeId],
    queryFn: async () => {
      if (!employeeId) throw new Error('No employee ID')

      const supabase = createClient()

      const { data, error } = await supabase
        .from('visit_crew')
        .select(`
          created_at,
          visits (
            id, actual_date, week_start, service_types, status,
            properties ( address ),
            accounts ( name )
          )
        `)
        .eq('employee_id', employeeId)
        .eq('relation', 'completed')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      return (data ?? [])
        .filter((row) => {
          if (!row.visits) return false
          const status = (row.visits as { status: string | null }).status
          return status === 'completed' || status === 'invoiced'
        })
        .slice(0, 30)
        .map((row) => {
          const v = row.visits as {
            id: string
            actual_date: string | null
            week_start: string
            service_types: string[] | null
            status: string
            properties: { address: string } | null
            accounts: { name: string } | null
          }
          return {
            visitId: v.id,
            actual_date: v.actual_date,
            week_start: v.week_start,
            service_types: v.service_types,
            address: v.properties?.address ?? '',
            accountName: v.accounts?.name ?? '',
            completedAt: row.created_at,
          }
        })
    },
    enabled: !!employeeId,
    staleTime: 60_000,
  })
}
